import Image from "next/image";
import { GitHubUser, LanguageWeights } from "@/types/github";

interface HeroProps {
  user: GitHubUser;
  languages: LanguageWeights;
}

export default function Hero({ user, languages }: HeroProps) {
  const topLangs = Object.entries(languages)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="relative pt-32 pb-16 px-6 overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#7c3aed]/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">
        <Image
          src={user.avatar_url}
          alt={user.login}
          width={160}
          height={160}
          className="rounded-2xl border-4 border-[#1a1a1a] shadow-2xl"
        />

        <div className="flex-1 text-center md:text-left">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            {user.login}
          </h1>
          <p className="mt-4 text-gray-400 max-w-2xl text-lg leading-relaxed">
            {user.bio || "No bio provided. Just a passion for building cool stuff on GitHub."}
          </p>

          <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-3">
            {topLangs.map(([lang, weight]) => (
              <div
                key={lang}
                className="bg-[#1a1a1a] border border-white/5 rounded-full px-4 py-1.5 flex items-center gap-2 group hover:border-[#7c3aed]/50 transition-all"
              >
                <span className="text-sm font-medium text-gray-300">{lang}</span>
                <span className="text-[10px] bg-[#7c3aed]/10 text-[#7c3aed] px-2 py-0.5 rounded-full font-bold">
                  {Math.round(weight)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
