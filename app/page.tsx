"use client";

import { useState, useMemo } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import RecommendationRow from "@/components/RecommendationRow";
import SkeletonCard from "@/components/SkeletonCard";
import ToastContainer, { ToastMessage } from "@/components/Toast";
import { GitHubUser, LanguageWeights } from "@/types/github";
import { RecommendationRow as RecommendationRowType } from "@/types/recommender";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [languages, setLanguages] = useState<LanguageWeights | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationRowType[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (message: string, type: ToastMessage["type"] = "error") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 6000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const hasFewStars = useMemo(() => {
    // If we have recommendations but the first row title indicates a fallback or empty
    // But better: the API should return if user has few stars
    // We'll rely on our logic: recommendations will be "Trending" only if < 5 stars
    return user && recommendations.length === 1 && recommendations[0].title === "Trending in your stack";
  }, [user, recommendations]);

  const handleSearch = async (username: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        const err = await response.json();
        if (response.status === 429) {
          addToast("GitHub Rate Limit hit! Add a personal GITHUB_TOKEN to .env.local to increase limits.");
        }
        throw new Error(err.error || err.message || "Failed to fetch data");
      }

      const data = await response.json();
      setUser(data.user);
      setLanguages(data.languages);
      setRecommendations(data.rows);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-white">
      <Navbar onSearch={handleSearch} isLoading={loading} />
      
      {!user && !loading && !error && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
          <div className="w-20 h-20 bg-[#7c3aed]/10 rounded-3xl flex items-center justify-center mb-6 border border-[#7c3aed]/20">
            <span className="text-4xl text-[#7c3aed]">🎬</span>
          </div>
          <h1 className="text-4xl font-bold mb-4 tracking-tight">
            Discover Your Next Favorite Project
          </h1>
          <p className="text-gray-500 mb-8 max-w-md">
            You haven&apos;t starred enough repositories yet. Explore GitHub to get personalized recommendations!
          </p>
        </div>
      )}

      {loading && (
        <div className="px-6 pt-10">
          {[1, 2, 3].map((row) => (
            <div key={row} className="mb-12">
              <div className="w-48 h-6 bg-gray-800/50 rounded mb-6 animate-pulse" />
              <div className="flex gap-4 overflow-hidden">
                {[1, 2, 3, 4].map((card) => (
                  <SkeletonCard key={card} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
          <div className="text-red-500 bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20 mb-4">
            {error}
          </div>
          <button 
            onClick={() => { setUser(null); setError(null); }}
            className="text-gray-400 hover:text-white transition-colors underline underline-offset-4"
          >
            Try another username
          </button>
        </div>
      )}

      {user && languages && !loading && (
        <div className="animate-in fade-in duration-700">
          <Hero user={user} languages={languages} />
          
          <div className="pb-20">
            {hasFewStars && (
              <div className="px-6 py-4 mb-6 mx-6 bg-[#7c3aed]/5 border border-[#7c3aed]/20 rounded-xl text-center">
                <p className="text-gray-400 text-sm">
                  <span className="text-[#7c3aed] font-bold">Cold Start:</span> No stars yet — start exploring GitHub! We&apos;ve recommended some trending projects for you instead.
                </p>
              </div>
            )}

            {recommendations.length > 0 ? (
              recommendations.map((row, i) => (
                <RecommendationRow key={i} row={row} />
              ))
            ) : (
              <div className="px-6 py-20 text-center text-gray-500">
                No recommendations found. Try starring more repositories!
              </div>
            )}
          </div>
        </div>
      )}

      <ToastContainer messages={toasts} onRemove={removeToast} />
    </main>
  );
}
