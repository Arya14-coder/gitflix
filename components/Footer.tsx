export default function Footer() {
  return (
    <footer className="w-full border-t border-white/10 bg-[#0d0d0d] py-12 px-6 mt-12">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
        <p>Built with Next.js + OpenRouter</p>
        <p>© {new Date().getFullYear()} GitFlix · Not affiliated with GitHub</p>
      </div>
    </footer>
  );
}
