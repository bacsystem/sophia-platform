import Link from 'next/link';
import { Plus } from 'lucide-react';

/** @description Empty state shown when user has no projects */
export function ProjectEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      {/* Illustration */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[rgba(var(--accent-rgb)/0.20)] to-[rgba(var(--accent-rgb)/0.08)] border border-[rgba(var(--accent-rgb)/0.20)] flex items-center justify-center">
          <div className="grid grid-cols-2 gap-1.5">
            {['DBA', 'BE', 'FE', 'QA'].map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--surface-header)] text-[var(--text-disabled)]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-glow-sm"
          style={{ background: 'linear-gradient(135deg, var(--accent-500), var(--accent-400))' }}
        >
          <Plus className="w-3.5 h-3.5 text-white" />
        </div>
      </div>

      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Sin proyectos aún</h2>
      <p className="text-sm text-[var(--text-tertiary)] max-w-xs mb-8">
        Crea tu primer proyecto y deja que Sophia genere el código con agentes IA especializados.
      </p>

      <Link
        href="/projects/new"
        className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
      >
        <Plus className="w-4 h-4" />
        Crear primer proyecto
      </Link>
    </div>
  );
}
