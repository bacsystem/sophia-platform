import { Loader2 } from 'lucide-react';

export default function ProjectDetailLoading() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-pulse">
      {/* Back link skeleton */}
      <div className="h-4 w-28 rounded bg-[var(--surface-header)]" />

      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1 space-y-3">
          <div className="h-7 w-64 rounded bg-[var(--surface-header)]" />
          <div className="h-4 w-96 rounded bg-[var(--row-hover)]" />
        </div>
        <div className="h-9 w-24 rounded-lg bg-[var(--surface-header)]" />
      </div>

      {/* Tabs skeleton */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="flex border-b border-[var(--muted-border)] px-2 py-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 w-20 rounded bg-[var(--surface-header)]" />
          ))}
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--text-disabled)]" />
        </div>
      </div>
    </div>
  );
}
