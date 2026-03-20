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

// Re-using the header helper from github.ts conceptually or importing it
// For simplicity and to avoid circular deps if they exist, I'll local-redefine or import
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
function getGitHubHeaders(): HeadersInit {
  return GITHUB_TOKEN 
    ? { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" }
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
  const { stars, owned } = context;

  // Cold Start Check
  if (stars.length < 5) {
    const trendingRow = await getTrendingInYourStack(owned, signal);
    return { 
      rows: trendingRow.repos.length > 0 ? [trendingRow] : [], 
      coldStart: true 
    };
  }

  // Calculate User Profile Vector
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

  const rows: RecommendationRow[] = [];

  // 1. "Because you starred X"
  if (stars.length > 0) {
    const anchor = stars[0];
    const anchorEmbed = embeddings.get(anchor.full_name);
    if (anchorEmbed) {
      const candidates = await fetchTrendingForSimilaritySearch(anchor.language || "TypeScript", signal);
      if (candidates.length > 0) {
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

        if (similar.length > 0) {
          rows.push({ title: `Because you starred ${anchor.name}`, repos: similar });
        }
      }
    }
  }

  // 2. "Hidden Gems"
  if (profileVector) {
    const candidates = await fetchHiddenGemsCandidates(signal);
    if (candidates.length > 0) {
      const candEmbeds = await getBatchEmbeddings(candidates, signal);
      const pVector = profileVector;

      const gems = candidates
        .map(c => ({
          ...c,
          similarityScore: candEmbeds.has(c.full_name) 
            ? cosineSimilarity(pVector, candEmbeds.get(c.full_name)!) 
            : 0
        }))
        .filter(c => (c.similarityScore || 0) > 0.78 && c.stargazers_count < 500)
        .sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0))
        .slice(0, 10);

      if (gems.length > 0) {
        rows.push({ title: "Hidden Gems", repos: gems });
      }
    }
  }

  // 3. "Trending in your stack"
  const trendingStack = await getTrendingInYourStack(owned, signal);
  if (trendingStack.repos.length > 0) {
    rows.push(trendingStack);
  }

  return { rows, coldStart: false };
}

async function getTrendingInYourStack(owned: GitHubRepository[], signal?: AbortSignal): Promise<RecommendationRow> {
  const topLang = owned[0]?.language || "TypeScript";
  const url = `https://api.github.com/search/repositories?q=language:${topLang}+stars:>500&sort=stars&order=desc&per_page=10`;
  
  const response = await fetch(url, {
    headers: getGitHubHeaders(),
    signal,
  });
  
  if (!response.ok) return { title: "Trending in your stack", repos: [] };
  
  const data = await response.json();
  return { title: "Trending in your stack", repos: data.items || [] };
}

async function fetchTrendingForSimilaritySearch(lang: string, signal?: AbortSignal): Promise<GitHubRepository[]> {
  const url = `https://api.github.com/search/repositories?q=language:${lang}+stars:>1000&sort=stars&order=desc&per_page=30`;
  const response = await fetch(url, { 
    headers: getGitHubHeaders(),
    signal 
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.items || [];
}

async function fetchHiddenGemsCandidates(signal?: AbortSignal): Promise<GitHubRepository[]> {
  const url = `https://api.github.com/search/repositories?q=stars:50..500+pushed:>2024-01-01&sort=updated&order=desc&per_page=50`;
  const response = await fetch(url, { 
    headers: getGitHubHeaders(),
    signal 
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.items || [];
}

