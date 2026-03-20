"use client";

import { useState } from "react";
import { Search } from "lucide-react";

interface NavbarProps {
  onSearch: (username: string) => void;
  isLoading?: boolean;
}

export default function Navbar({ onSearch, isLoading }: NavbarProps) {
  const [username, setUsername] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) onSearch(username.trim());
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0d0d0d]/80 backdrop-blur-md border-b border-white/5 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="text-2xl font-bold tracking-tighter text-[#7c3aed]">
          GITFLIX
        </div>

        <form onSubmit={handleSubmit} className="flex-1 max-w-md mx-6">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#7c3aed] transition-colors" />
            <input
              type="text"
              placeholder="Enter GitHub username..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] transition-all placeholder:text-gray-500"
            />
          </div>
        </form>

        <button
          onClick={() => { if (username.trim()) onSearch(username.trim()); }}
          disabled={isLoading || !username}
          className="bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-full text-sm font-medium transition-all"
        >
          {isLoading ? "Searching..." : "Explore"}
        </button>
      </div>
    </nav>
  );
}
