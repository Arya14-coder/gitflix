import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { 
  fetchUserProfile, 
  fetchStarredRepos, 
  fetchOwnedRepos, 
  calculateLanguageWeights,
  GitHubError 
} from "@/lib/github";
import { getRecommendations } from "@/lib/recommender";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const CACHE_TTL_SECONDS = 86400; // 24 hours
// TODO: For power users (300+ stars, cold cache), the full pipeline can approach
// Vercel's 30s limit. Consider streaming rows to the client as they resolve,
// or splitting language weight calculation into a separate pre-cache endpoint.
const REQUEST_TIMEOUT_MS = 25000; // 25 seconds

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();
    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const sanitizedUsername = encodeURIComponent(username);
    const cacheKey = `recommendations:${sanitizedUsername.toLowerCase()}`;

    // 1. Check Cache
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // 2. Setup AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      // 3. Fetch Data with Timeout
      const [user, starred, owned] = await Promise.all([
        fetchUserProfile(username, controller.signal),
        fetchStarredRepos(username, controller.signal),
        fetchOwnedRepos(username, controller.signal),
      ]);

      const topLanguages = await calculateLanguageWeights(owned, controller.signal);
      
      const { rows, coldStart } = await getRecommendations({
        user,
        stars: starred,
        owned,
        topLanguages
      }, controller.signal);

      const result = { user, languages: topLanguages, rows, coldStart };

      // 4. Cache full results
      await redis.set(cacheKey, result, { ex: CACHE_TTL_SECONDS });

      return NextResponse.json(result);

    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return NextResponse.json({ 
          error: "Request timed out after 25s",
          details: "GitHub or OpenRouter taking too long. Heavy profiles may need a second attempt."
        }, { status: 504 });
      }

      if (err instanceof GitHubError) {
        if (err.status === 404) {
          return NextResponse.json({ error: "GitHub user not found" }, { status: 404 });
        }
        if (err.status === 403 || err.status === 429) {
          return NextResponse.json({ 
            error: "GitHub rate limit exceeded",
            retryAfter: err.retryAfter 
          }, { status: 429 });
        }
      }

      throw err; // Let outer catch handle generic errors
    } finally {
      clearTimeout(timeoutId);
    }

  } catch (error: unknown) {
    console.error("API Error:", error);
    return NextResponse.json({ 
      error: "Internal server error", 
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
