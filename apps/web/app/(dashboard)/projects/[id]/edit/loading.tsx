import { Loader2 } from 'lucide-react';

export default function EditProjectLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-pulse">
      {/* Back link skeleton */}
      <div className="space-y-1">
        <div className="h-4 w-32 rounded bg-[var(--surface-header)] mb-4" />
        <div className="h-7 w-48 rounded bg-[var(--surface-header)]" />
        <div className="h-4 w-72 rounded bg-[var(--row-hover)]" />
      </div>

      {/* Form skeleton */}
      <div className="glass rounded-2xl p-6 sm:p-8 space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 rounded bg-[var(--surface-header)]" />
            <div className="h-10 w-full rounded-lg bg-[var(--row-hover)]" />
          </div>
        ))}
        <div className="flex items-center justify-center pt-4">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--text-disabled)]" />
        </div>
      </div>
    </div>
  );
}
