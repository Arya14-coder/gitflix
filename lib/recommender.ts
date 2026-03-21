import { OpenAI } from "openai";
import { Redis } from "@upstash/redis";
import { GitHubRepository } from "@/types/github";
import { 
  RecommendationRow, 
  RecommendationContext 
} from "@/types/recommender";

// Lazy initialization helpers
let _openai: OpenAI | null = null;
let _redis: Redis | null = null;

function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({ 
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://gitflix.vercel.app",
        "X-Title": "GitFlix", 
      }
    });
  }
  return _openai;
}

function getRedis() {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

function getGitHubHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  return token 
    ? { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" }
    : { Accept: "application/vnd.github.v3+json" };
}

const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Validates if a cached value is a proper embedding vector.
 */
function isValidEmbedding(val: any): val is number[] {
  return Array.isArray(val) && val.length > 0 && typeof val[0] === 'number';
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (!isValidEmbedding(a) || !isValidEmbedding(b)) return 0;
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (magA * magB);
}

/**
 * Batch embed multiple repositories using mget for optimization.
 */
async function getBatchEmbeddings(repos: GitHubRepository[], signal?: AbortSignal): Promise<Map<string, number[]>> {
  const results = new Map<string, number[]>();
  if (repos.length === 0) return results;

  const redis = getRedis();
  const openai = getOpenAI();

  // 1. Bulk check cache using mget
  const keys = repos.map(r => `embedding:${r.full_name}`);
  const cachedValues = await redis.mget<any[]>(...keys);
  
  const toFetch: GitHubRepository[] = [];

  cachedValues.forEach((val, idx) => {
    if (isValidEmbedding(val)) {
      results.set(repos[idx].full_name, val);
    } else {
      toFetch.push(repos[idx]);
    }
  });

  // 2. Fetch missing in batches of 50
  for (let i = 0; i < toFetch.length; i += 50) {
    const batch = toFetch.slice(i, i + 50);
    const inputs = batch.map(r => `${r.name} ${r.description || ""} ${r.language || ""}`.slice(0, 8000));
    
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: inputs,
    }, { signal });

    const pipeline = redis.pipeline();
    for (let j = 0; j < batch.length; j++) {
      const embedding = response.data[j].embedding;
      const repo = batch[j];
      pipeline.set(`embedding:${repo.full_name}`, embedding, { ex: CACHE_TTL_SECONDS });
      results.set(repo.full_name, embedding);
    }
    await pipeline.exec();
  }

  return results;
}

/**
 * Main recommendation engine function.
 */
export async function getRecommendations(
  context: RecommendationContext, 
  signal?: AbortSignal
): Promise<{ rows: RecommendationRow[], coldStart: boolean }> {
  const { stars, owned, topLanguages } = context;

  // 0. Derive Top Language from pre-computed weights (passed from route.ts)
  const userTopLang = (topLanguages && Object.keys(topLanguages)[0]) || "TypeScript";

  // 1. Cold Start Check
  const coldStart = stars.length < 5;
  if (coldStart) {
    const [popular, underrated] = await Promise.all([
      getPopularInStack(userTopLang, signal),
      getUnderratedGems(userTopLang, signal)
    ]);
    
    const rows = [popular, underrated].filter(r => r.repos.length > 0);
    return { rows, coldStart: true };
  }

  // 2. Full Recommendation Flow (Embedding-based)
  const embeddings = await getBatchEmbeddings(stars, signal);
  let profileVector: number[] | null = null;
  let totalWeight = 0;

  for (const repo of stars) {
    const vector = embeddings.get(repo.full_name);
    if (!vector) continue;

    const index = stars.indexOf(repo);
    const weight = index < 20 ? 2 : 1; 

    if (!profileVector) {
      profileVector = vector.map(v => v * weight);
    } else {
      profileVector = profileVector.map((v, i) => v + vector[i] * weight);
    }
    totalWeight += weight;
  }

  if (profileVector && totalWeight > 0) {
    profileVector = profileVector.map(v => v / totalWeight);
  }

  const rowPromises: Promise<RecommendationRow | null>[] = [];

  // A. "Because you starred X"
  if (stars.length > 0) {
    const anchor = stars[0];
    const anchorEmbed = embeddings.get(anchor.full_name);
    if (anchorEmbed) {
      rowPromises.push(
        fetchTrendingForSimilaritySearch(anchor.language || "TypeScript", signal).then(async (candidates) => {
          if (candidates.length === 0) return null;
          const candEmbeds = await getBatchEmbeddings(candidates, signal);
          const similar = candidates
            .map(c => ({
              ...c,
              similarityScore: candEmbeds.has(c.full_name) 
                ? cosineSimilarity(anchorEmbed, candEmbeds.get(c.full_name)!) 
                : 0
            }))
            .filter(c => c.full_name !== anchor.full_name)
            .sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0))
            .slice(0, 10);
          return similar.length > 0 ? { title: `Because you starred ${anchor.name}`, repos: similar } : null;
        })
      );
    }
  }

  // B. "Trending in your stack"
  rowPromises.push(getTrendingInYourStack(userTopLang, signal));

  // C. "Hidden Gems"
  if (profileVector) {
    const pVector = profileVector;
    rowPromises.push(
      fetchHiddenGemsCandidates(signal).then(async (candidates) => {
        if (candidates.length === 0) return null;
        const candEmbeds = await getBatchEmbeddings(candidates, signal);
        const gems = candidates
          .map(c => ({
            ...c,
            similarityScore: candEmbeds.has(c.full_name) 
              ? cosineSimilarity(pVector, candEmbeds.get(c.full_name)!) 
              : 0
          }))
          .filter(c => (c.similarityScore || 0) > 0.45 && c.stargazers_count < 2000)
          .sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0))
          .slice(0, 10);
        return gems.length > 0 ? { title: "Hidden Gems", repos: gems } : null;
      })
    );
  }

  // D. "New & Noteworthy" (Embedding-based)
  if (profileVector) {
    const pVector = profileVector;
    rowPromises.push(
      fetchNewAndNoteworthyCandidates(signal).then(async (candidates) => {
        if (candidates.length === 0) return null;
        const candEmbeds = await getBatchEmbeddings(candidates, signal);
        const noteworthy = candidates
          .map(c => ({
            ...c,
            similarityScore: candEmbeds.has(c.full_name) 
              ? cosineSimilarity(pVector, candEmbeds.get(c.full_name)!) 
              : 0
          }))
          .filter(c => (c.similarityScore || 0) > 0.45)
          .sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0))
          .slice(0, 10);
        return noteworthy.length > 0 ? { title: "New & Noteworthy", repos: noteworthy } : null;
      })
    );
  }

  // E. "Popular in your stack" (Always returns results)
  rowPromises.push(getPopularInStack(userTopLang, signal));

  // F. "Underrated Gems in {userTopLang}"
  rowPromises.push(getUnderratedGems(userTopLang, signal));

  const resolvedRows = await Promise.all(rowPromises);
  const rows = resolvedRows.filter((r): r is RecommendationRow => r !== null && r.repos.length > 0);

  // Guarantee a minimum of 3 rows — add a "Trending this week" fallback if needed
  if (rows.length < 3) {
    const fallback = await getTrendingThisWeek(signal);
    if (fallback.repos.length > 0) rows.push(fallback);
  }

  // Deduplicate repos across all rows by repo.id
  const seen = new Set<number>();
  const dedupedRows = rows.map(row => ({
    ...row,
    repos: row.repos.filter(r => !seen.has(r.id) && seen.add(r.id))
  })).filter(r => r.repos.length > 0);

  return { rows: dedupedRows, coldStart: false };
}

async function getTrendingThisWeek(signal?: AbortSignal): Promise<RecommendationRow> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const dateStr = oneWeekAgo.toISOString().split('T')[0];
  const url = `https://api.github.com/search/repositories?q=stars:>5000+pushed:>${dateStr}&sort=updated&order=desc&per_page=10`;
  const response = await fetch(url, { headers: getGitHubHeaders(), signal });
  if (!response.ok) return { title: "Trending this week", repos: [] };
  const data = await response.json();
  return { title: "Trending this week", repos: data.items || [] };
}

async function getTrendingInYourStack(topLang: string, signal?: AbortSignal): Promise<RecommendationRow> {
  const url = `https://api.github.com/search/repositories?q=language:${topLang}+stars:>500&sort=updated&order=desc&per_page=10`;
  const response = await fetch(url, { headers: getGitHubHeaders(), signal });
  if (!response.ok) return { title: "Trending in your stack", repos: [] };
  const data = await response.json();
  return { title: "Trending in your stack", repos: data.items || [] };
}

async function getPopularInStack(topLang: string, signal?: AbortSignal): Promise<RecommendationRow> {
  const url = `https://api.github.com/search/repositories?q=language:${topLang}+stars:>1000&sort=stars&order=desc&per_page=10`;
  const response = await fetch(url, { headers: getGitHubHeaders(), signal });
  if (!response.ok) return { title: "Popular in your stack", repos: [] };
  const data = await response.json();
  return { title: "Popular in your stack", repos: data.items || [] };
}

async function getUnderratedGems(topLang: string, signal?: AbortSignal): Promise<RecommendationRow> {
  const url = `https://api.github.com/search/repositories?q=language:${topLang}+stars:50..500&sort=updated&order=desc&per_page=10`;
  const response = await fetch(url, { headers: getGitHubHeaders(), signal });
  if (!response.ok) return { title: `Underrated Gems in ${topLang}`, repos: [] };
  const data = await response.json();
  return { title: `Underrated Gems in ${topLang}`, repos: data.items || [] };
}

async function fetchTrendingForSimilaritySearch(lang: string, signal?: AbortSignal): Promise<GitHubRepository[]> {
  const url = `https://api.github.com/search/repositories?q=language:${lang}+stars:>1000&sort=stars&order=desc&per_page=30`;
  const response = await fetch(url, { headers: getGitHubHeaders(), signal });
  if (!response.ok) return [];
  const data = await response.json();
  return data.items || [];
}

async function fetchHiddenGemsCandidates(signal?: AbortSignal): Promise<GitHubRepository[]> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const dateStr = sixMonthsAgo.toISOString().split('T')[0];
  const url = `https://api.github.com/search/repositories?q=stars:50..500+pushed:>${dateStr}&sort=updated&order=desc&per_page=50`;
  const response = await fetch(url, { headers: getGitHubHeaders(), signal });
  if (!response.ok) return [];
  const data = await response.json();
  return data.items || [];
}

async function fetchNewAndNoteworthyCandidates(signal?: AbortSignal): Promise<GitHubRepository[]> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const dateStr = sixMonthsAgo.toISOString().split('T')[0];
  const url = `https://api.github.com/search/repositories?q=created:>${dateStr}+stars:>100&sort=stars&order=desc&per_page=50`;
  const response = await fetch(url, { headers: getGitHubHeaders(), signal });
  if (!response.ok) return [];
  const data = await response.json();
  return data.items || [];
}

