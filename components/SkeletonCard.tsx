"use client";

export default function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-[300px] md:w-[350px] bg-[#1a1a1a] rounded-xl overflow-hidden border border-white/5 animate-pulse">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-700" />
            <div className="w-16 h-2 bg-gray-700 rounded" />
          </div>
          <div className="w-20 h-4 bg-gray-700 rounded-full" />
        </div>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-6 h-6 rounded-md bg-gray-700 flex-shrink-0" />
          <div className="w-3/4 h-5 bg-gray-700 rounded" />
        </div>
        
        <div className="space-y-2 mt-4">
          <div className="w-full h-3 bg-gray-700 rounded" />
          <div className="w-2/3 h-3 bg-gray-700 rounded" />
        </div>

        <div className="mt-8 flex items-center justify-between">
          <div className="w-12 h-3 bg-gray-700 rounded" />
          <div className="w-24 h-8 bg-gray-700 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
