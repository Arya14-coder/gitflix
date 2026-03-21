import { GitHubUser, GitHubRepository, LanguageWeights } from "@/types/github";
import { Redis } from "@upstash/redis";

const GITHUB_API_URL = "https://api.github.com";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const LANG_CACHE_TTL = 7 * 24 * 60 * 60; // 7 days

// Lazy Redis initialization
let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

/**
 * Returns Authorization header if GITHUB_TOKEN is set, otherwise empty object.
 */
function getHeaders(): HeadersInit {
  return GITHUB_TOKEN 
    ? { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" }
    : { Accept: "application/vnd.github.v3+json" };
}

export class GitHubError extends Error {
  constructor(public message: string, public status: number, public retryAfter?: number) {
    super(message);
    this.name = "GitHubError";
  }
}

/**
 * Central error handler for GitHub API responses.
 */
async function handleApiError(response: Response) {
  const status = response.status;
  
  if (status === 403 || status === 429) {
    const retryAfter = response.headers.get("Retry-After") || response.headers.get("X-RateLimit-Reset");
    const retrySeconds = retryAfter ? parseInt(retryAfter) : undefined;
    
    if (status === 403 && response.headers.get("X-RateLimit-Remaining") === "0") {
      throw new GitHubError("GitHub Rate Limit Exceeded.", status, retrySeconds);
    }
    
    if (status === 429 || retryAfter) {
      throw new GitHubError("GitHub Secondary Rate Limit Hit.", status, retrySeconds);
    }
  }

  if (status === 404) {
    throw new GitHubError("GitHub User Not Found.", 404);
  }

  throw new GitHubError(`GitHub API Error: ${status} ${response.statusText}`, status);
}

/**
 * Fetch a user's GitHub profile. Hard-errors on failure.
 */
export async function fetchUserProfile(username: string, signal?: AbortSignal): Promise<GitHubUser> {
  const sanitized = encodeURIComponent(username);
  const response = await fetch(`${GITHUB_API_URL}/users/${sanitized}`, {
    headers: getHeaders(),
    signal,
  });
  
  if (!response.ok) {
    await handleApiError(response);
  }
  
  return response.json();
}

/**
 * Fetch starred repositories (cap at 300). 
 * Returns partial results if rate limit is hit mid-loop.
 */
export async function fetchStarredRepos(username: string, signal?: AbortSignal): Promise<GitHubRepository[]> {
  const sanitized = encodeURIComponent(username);
  const allStarred: GitHubRepository[] = [];
  let page = 1;
  const per_page = 100;
  
  while (page <= 3) {
    const response = await fetch(`${GITHUB_API_URL}/users/${sanitized}/starred?per_page=${per_page}&page=${page}`, {
      headers: getHeaders(),
      signal,
    });
    
    if (!response.ok) {
      // If we hit a rate limit or error, return what we have so far
      if (response.status === 403 || response.status === 429) {
        return allStarred;
      }
      await handleApiError(response);
    }
    
    const data: GitHubRepository[] = await response.json();
    if (data.length === 0) break;
    
    allStarred.push(...data);
    if (data.length < per_page) break;
    page++;
  }

  return allStarred;
}

/**
 * Fetch owned repositories.
 */
export async function fetchOwnedRepos(username: string, signal?: AbortSignal): Promise<GitHubRepository[]> {
  const sanitized = encodeURIComponent(username);
  const response = await fetch(`${GITHUB_API_URL}/users/${sanitized}/repos?per_page=100&sort=pushed&direction=desc`, {
    headers: getHeaders(),
    signal,
  });
  
  if (!response.ok) {
    await handleApiError(response);
  }
  
  const repos: GitHubRepository[] = await response.json();
  return repos.filter(repo => !repo.fork);
}

/**
 * Fetch language breakdown for a specific repository.
 */
export async function fetchLanguagesForRepo(owner: string, repo: string, signal?: AbortSignal): Promise<Record<string, number>> {
  const response = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/languages`, {
    headers: getHeaders(),
    signal,
  });
  
  if (!response.ok) {
    await handleApiError(response);
  }
  
  return response.json();
}

/**
 * Calculate language weights based strictly on the top 50 repos.
 * GitHub returns repos sorted by 'pushed' by default, so this targets recent activity.
 * Uses Redis caching (keyed by repo.full_name) to avoid redundant GitHub API calls.
 */
export async function calculateLanguageWeights(repos: GitHubRepository[], signal?: AbortSignal): Promise<LanguageWeights> {
  const topRepos = repos.slice(0, 50);
  const languageTotals: Record<string, number> = {};
  let overallBytes = 0;

  const redis = getRedis();

  // 1. Bulk-check cache for language data
  const cacheKeys = topRepos.map(r => `lang:${r.full_name}`);
  const cachedValues = await redis.mget<(Record<string, number> | null)[]>(...cacheKeys);

  // Use a positional array to preserve repo→data correspondence
  const allResults: Record<string, number>[] = new Array(topRepos.length);
  const toFetch: { repo: GitHubRepository; index: number }[] = [];

  cachedValues.forEach((val, idx) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      allResults[idx] = val;
    } else {
      toFetch.push({ repo: topRepos[idx], index: idx });
    }
  });

  // 2. Fetch uncached repos from GitHub (with graceful per-repo fallback)
  if (toFetch.length > 0) {
    const languagePromises = toFetch.map(({ repo }) =>
      fetchLanguagesForRepo(repo.owner.login, repo.name, signal)
        .catch(() => ({})) // Gracefully handle individual failures per repo
    );
    const fetched = await Promise.all(languagePromises);

    // 3. Pipeline-set fetched results into Redis, slot into positional array
    const pipeline = redis.pipeline();
    fetched.forEach((data, i) => {
      const { repo, index } = toFetch[i];
      pipeline.set(`lang:${repo.full_name}`, data, { ex: LANG_CACHE_TTL });
      allResults[index] = data;
    });
    await pipeline.exec();
  }

  // 4. Aggregate language totals
  allResults.forEach(data => {
    if (!data) return;
    Object.entries(data).forEach(([lang, bytes]) => {
      languageTotals[lang] = (languageTotals[lang] || 0) + bytes;
      overallBytes += bytes;
    });
  });

  const weights: LanguageWeights = {};
  if (overallBytes > 0) {
    Object.entries(languageTotals).forEach(([lang, bytes]) => {
      weights[lang] = parseFloat(((bytes / overallBytes) * 100).toFixed(2));
    });
  }

  // Sort by weight descending
  return Object.fromEntries(
    Object.entries(weights).sort(([, a], [, b]) => b - a)
  );
}
