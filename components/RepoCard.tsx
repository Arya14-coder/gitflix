"use client";

import { Star, ExternalLink } from "lucide-react";
import Image from "next/image";
import { getLanguageColor } from "@/lib/constants/languageColors";

interface RepoCardProps {
  name: string;
  description: string;
  language: string | null;
  stars: number;
  matchScore: number;
  ownerAvatar: string;
  htmlUrl: string;
}

export default function RepoCard({
  name,
  description,
  language,
  stars,
  matchScore,
  ownerAvatar,
  htmlUrl,
}: RepoCardProps) {
  const formatStars = (count: number) => {
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + "k";
    }
    return count.toString();
  };

  const getMatchScoreColor = (score: number) => {
    const percentage = score * 100;
    if (percentage > 85) return "text-green-500 bg-green-500/10 border-green-500/20";
    if (percentage >= 60) return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
    return "text-gray-400 bg-gray-400/10 border-gray-400/20";
  };

  const langColor = getLanguageColor(language);

  return (
    <div className="flex-shrink-0 w-[300px] md:w-[350px] scroll-snap-align-start group bg-[#1a1a1a] rounded-xl overflow-hidden border border-white/5 hover:border-[#7c3aed]/30 hover:scale-[1.02] transition-all duration-300 cursor-pointer relative">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: langColor }}
            />
            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400">
              {language || "Unknown"}
            </span>
          </div>
          
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getMatchScoreColor(matchScore)}`}>
            {Math.round(matchScore * 100)}% match
          </span>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <div className="relative w-6 h-6 rounded-md overflow-hidden bg-white/10 flex-shrink-0">
            <Image
              src={ownerAvatar}
              alt={name}
              fill
              className="object-cover"
            />
          </div>
          <h3 className="text-lg font-bold text-white truncate group-hover:text-[#7c3aed] transition-colors">
            {name}
          </h3>
        </div>
        
        <p className="mt-2 text-sm text-gray-400 line-clamp-2 h-10">
          {description || "No description available for this repository."}
        </p>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Star className="w-3.5 h-3.5 text-yellow-500/80" />
            <span>{formatStars(stars)}</span>
          </div>
          
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <a 
              href={htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#7c3aed] bg-[#7c3aed]/10 px-3 py-1.5 rounded-lg border border-[#7c3aed]/20 hover:bg-[#7c3aed]/20 transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              View on GitHub
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
