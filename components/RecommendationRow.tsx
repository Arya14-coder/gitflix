import { RecommendationRow as RecommendationRowType } from "@/types/recommender";
import RepoCard from "./RepoCard";

interface RecommendationRowProps {
  row: RecommendationRowType;
}

export default function RecommendationRow({ row }: RecommendationRowProps) {
  if (!row.repos.length) return null;

  return (
    <div className="py-8">
      <h2 className="px-6 mb-4 text-xl font-bold tracking-tight text-white/90">
        {row.title}
      </h2>
      
      <div className="relative group/row">
        <div className="flex gap-4 overflow-x-auto px-6 pb-4 scroll-snap-x-mandatory scrollbar-hide">
          {row.repos.map((repo) => (
            <RepoCard 
              key={repo.id} 
              name={repo.name}
              description={repo.description || ""}
              language={repo.language}
              stars={repo.stargazers_count}
              matchScore={repo.similarityScore || 0}
              ownerAvatar={repo.owner.avatar_url}
              htmlUrl={`https://github.com/${repo.full_name}`}
            />
          ))}
        </div>
        
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-4 w-12 bg-gradient-to-r from-[#0d0d0d] to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-[#0d0d0d] to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
