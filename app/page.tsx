"use client";

import { useState, useRef } from "react";
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
  const [isColdStart, setIsColdStart] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const addToast = (message: string, type: ToastMessage["type"] = "error") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 6000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSearch = async (username: string) => {
    // Abort any in-flight request to prevent race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        if (response.status === 429) {
          addToast("GitHub Rate Limit hit! Add a personal GITHUB_TOKEN to increase limits.");
        }
        throw new Error(err.error || err.message || "Failed to fetch data");
      }

      const data = await response.json();
      setUser(data.user);
      setLanguages(data.languages);
      setRecommendations(data.rows);
      setIsColdStart(data.coldStart || false);
    } catch (err: unknown) {
      // Silently ignore aborted requests — they're intentional
      if (err instanceof DOMException && err.name === "AbortError") return;
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
          <div className="w-20 h-20 bg-[#7c3aed]/15 rounded-3xl flex items-center justify-center mb-8 border border-[#7c3aed]/30 shadow-[0_0_40px_rgba(124,58,237,0.15)] animate-bounce-subtle">
            <span className="text-4xl">🎬</span>
          </div>
          <h1 className="text-5xl font-extrabold mb-6 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-500">
            Welcome to GitFlix
          </h1>
          <p className="text-gray-400 mb-10 max-w-lg text-lg leading-relaxed">
            The personalized discovery engine for developers. Enter your GitHub username above to find your next great project to contribute to.
          </p>
          <div className="flex gap-4 items-center text-sm text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Vector Matching</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Hidden Gems</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Smart Filters</span>
          </div>
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
          <div className="text-red-500 bg-red-500/10 px-6 py-4 rounded-xl border border-red-500/20 mb-6 max-w-md">
            <p className="font-semibold mb-1">Search Failed</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
          <button 
            onClick={() => { setUser(null); setError(null); }}
            className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-full text-sm font-medium transition-all border border-white/10"
          >
            Try another username
          </button>
        </div>
      )}

      {user && languages && !loading && (
        <div className="animate-in fade-in duration-1000">
          <Hero user={user} languages={languages} />
          
          <div className="pb-20">
            {isColdStart && (
              <div className="px-6 py-4 mb-8 mx-6 bg-[#7c3aed]/10 border border-[#7c3aed]/20 rounded-2xl text-center shadow-[0_0_30px_rgba(124,58,237,0.05)]">
                <p className="text-gray-300 text-sm">
                  <span className="text-[#a78bfa] font-bold uppercase tracking-wider text-xs mr-2">Cold Start</span>
                  It looks like you haven&apos;t starred many repositories yet! We&apos;ve curated some trending projects for you to explore.
                </p>
              </div>
            )}

            {recommendations.length > 0 ? (
              recommendations.map((row, i) => (
                <RecommendationRow key={row.title} row={row} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold mb-2">No recommendations found</h3>
                <p className="text-gray-500 max-w-xs">
                  We couldn&apos;t find any matches based on your profile. Try starring more repositories on GitHub!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <ToastContainer messages={toasts} onRemove={removeToast} />
    </main>
  );
}
