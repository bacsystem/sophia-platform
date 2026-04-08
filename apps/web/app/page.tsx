export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="text-center space-y-4 animate-fade-in">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-glow">
            <span className="text-white font-bold text-2xl">S</span>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white">Sophia Platform</h1>
        <p className="text-white/40 text-sm">Dashboard — próximamente en M5</p>
        <div className="flex gap-2 justify-center pt-4">
          {['DBA', 'Backend', 'Frontend', 'QA', 'Security', 'Deploy'].map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-white/40 border border-white/10"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
