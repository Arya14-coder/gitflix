"use client";

export default function SkeletonCard() {
  const skelBg = { backgroundColor: 'var(--color-skeleton)' };

  return (
    <div className="flex-shrink-0 w-[300px] md:w-[350px] bg-[#1a1a1a] rounded-xl overflow-hidden border border-white/5 animate-pulse">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={skelBg} />
            <div className="w-16 h-2 rounded" style={skelBg} />
          </div>
          <div className="w-20 h-4 rounded-full" style={skelBg} />
        </div>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-6 h-6 rounded-md flex-shrink-0" style={skelBg} />
          <div className="w-3/4 h-5 rounded" style={skelBg} />
        </div>
        
        <div className="space-y-2 mt-4">
          <div className="w-full h-3 rounded" style={skelBg} />
          <div className="w-2/3 h-3 rounded" style={skelBg} />
        </div>

        <div className="mt-8 flex items-center justify-between">
          <div className="w-12 h-3 rounded" style={skelBg} />
          <div className="w-24 h-8 rounded-lg" style={skelBg} />
        </div>
      </div>
    </div>
  );
}
