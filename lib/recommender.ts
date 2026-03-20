import { OpenAI } from "openai";
import { Redis } from "@upstash/redis";
import { GitHubRepository } from "@/types/github";
import { 
  RecommendationRow, 
  RecommendationContext 
} from "@/types/recommender";

const openai = new OpenAI({ 
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://gitflix.vercel.app", // Optional for OpenRouter
    "X-Title": "GitFlix", 
  }
});
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magA * magB);
}

/**
 * Batch embed multiple repositories (groups of 50).
 */
async function getBatchEmbeddings(repos: GitHubRepository[], signal?: AbortSignal): Promise<Map<string, number[]>> {
  const results = new Map<string, number[]>();
  const toFetch: GitHubRepository[] = [];

  // Check cache for all
  for (const repo of repos) {
    const cached = await redis.get<number[]>(`embedding:${repo.full_name}`);
    if (cached) {
      results.set(repo.full_name, cached);
    } else {
      toFetch.push(repo);
    }
  }

  // Fetch missing in batches of 50
  for (let i = 0; i < toFetch.length; i += 50) {
    const batch = toFetch.slice(i, i + 50);
    const inputs = batch.map(r => `${r.name} ${r.description || ""} ${r.language || ""}`.slice(0, 8000));
    
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: inputs,
    }, { signal });

    for (let j = 0; j < batch.length; j++) {
      const embedding = response.data[j].embedding;
      const repo = batch[j];
      await redis.set(`embedding:${repo.full_name}`, embedding, { ex: CACHE_TTL_SECONDS });
      results.set(repo.full_name, embedding);
    }
  }

  return results;
}

/**
 * Main recommendation engine function.
 */
export async function getRecommendations(context: RecommendationContext, signal?: AbortSignal): Promise<RecommendationRow[]> {
  const { stars, owned } = context;

  // Cold Start Check
  if (stars.length < 5) {
    return [await getTrendingInYourStack(owned, signal)];
  }

  // Calculate User Profile Vector
  const embeddings = await getBatchEmbeddings(stars, signal);
  let profileVector: number[] | null = null;
  let totalWeight = 0;

  for (const repo of stars) {
    const vector = embeddings.get(repo.full_name);
    if (!vector) continue;

    // Recency weighting: last 30 days = 2x
    // Note: GitHub doesn't return starred_at in default repo list easy, 
    // but we'll assume stars are sorted by recency or use a heuristic.
    // In a real app, starred_at would be part of the context.
    // Here we'll weight the first 50 repos higher as a proxy for recency.
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

  // Build Recommendation Rows
  const rows: RecommendationRow[] = [];

  // 1. "Because you starred X"
  if (stars.length > 0) {
    const anchor = stars[0];
    const anchorEmbed = embeddings.get(anchor.full_name);
    if (anchorEmbed) {
      // Find similar repos (this would usually be a DB vector search, 
      // here we'll mock it by searching trending and filtering).
      const candidates = await fetchTrendingForSimilaritySearch(anchor.language || "TypeScript", signal);
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

      rows.push({ title: `Because you starred ${anchor.name}`, repos: similar });
    }
  }

  // 2. "Hidden Gems" (Similarity > 0.78 & Stars < 500)
  if (profileVector) {
    // Again, simplified vector search proxy
    const candidates = await fetchHiddenGemsCandidates(signal);
    const candEmbeds = await getBatchEmbeddings(candidates, signal);
    const pVector = profileVector; // closure safety

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

    rows.push({ title: "Hidden Gems", repos: gems });
  }

  // 3. "Trending in your stack"
  rows.push(await getTrendingInYourStack(owned, signal));

  return rows;
}

async function getTrendingInYourStack(owned: GitHubRepository[], signal?: AbortSignal): Promise<RecommendationRow> {
  const topLang = owned[0]?.language || "TypeScript";
  const url = `https://api.github.com/search/repositories?q=language:${topLang}+stars:>500&sort=stars&order=desc&per_page=10`;
  
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github.v3+json" },
    signal,
  });
  const data = await response.json();
  return { title: "Trending in your stack", repos: data.items || [] };
}

async function fetchTrendingForSimilaritySearch(lang: string, signal?: AbortSignal): Promise<GitHubRepository[]> {
  const url = `https://api.github.com/search/repositories?q=language:${lang}+stars:>1000&sort=stars&order=desc&per_page=30`;
  const response = await fetch(url, { signal });
  const data = await response.json();
  return data.items || [];
}

async function fetchHiddenGemsCandidates(signal?: AbortSignal): Promise<GitHubRepository[]> {
  // Broad search to find potential matches
  const url = `https://api.github.com/search/repositories?q=stars:50..500+pushed:>2024-01-01&sort=updated&order=desc&per_page=50`;
  const response = await fetch(url, { signal });
  const data = await response.json();
  return data.items || [];
}
