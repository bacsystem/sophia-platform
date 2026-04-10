'use client';

import Link from 'next/link';
import { formatDistanceToNow } from './date-utils';
import type { Project } from '@sophia/shared';

const STATUS_CONFIG = {
  idle:    { label: 'Pendiente',  classes: 'bg-[var(--surface-header)] text-[var(--text-tertiary)] border border-[var(--muted-border)]', dot: 'bg-[var(--text-disabled)]' },
  running: { label: 'Ejecutando', classes: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30', dot: 'bg-cyan-500 animate-pulse' },
  paused:  { label: 'Pausado',    classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30', dot: 'bg-amber-500' },
  done:    { label: 'Completado', classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30', dot: 'bg-emerald-500' },
  error:   { label: 'Error',      classes: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30', dot: 'bg-red-500' },
} as const;

const STACK_LABELS: Record<string, string> = {
  'node-nextjs': 'Node + Next.js',
  'laravel-nextjs': 'Laravel + Next.js',
  'python-nextjs': 'Python + Next.js',
};

interface ProjectCardProps {
  project: Project;
  onDelete?: (id: string) => void;
}

/** @description Project summary card with status badge, progress bar and context menu */
export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.idle;

  const progressColor = project.status === 'error'
    ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
    : project.status === 'done'
      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
      : 'bg-[linear-gradient(90deg,var(--accent-500),var(--accent-400))] shadow-[0_0_8px_rgba(var(--accent-rgb),0.3)]';

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block glass-card rounded-xl p-5 transition-all duration-300 hover:scale-[1.01]"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent-500)] transition-colors text-[15px]">
            {project.name}
          </h3>
          <span className="text-[11px] text-[var(--text-tertiary)] tracking-wide uppercase">{STACK_LABELS[project.stack] ?? project.stack}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium ${status.classes}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-[11px]">
          <span className="text-[var(--text-tertiary)] truncate">{project.currentLayerName || 'Capa inicial'}</span>
          <span className="text-[var(--text-secondary)] tabular-nums font-medium">{project.progress}%</span>
        </div>
          <div className="h-1 rounded-full bg-[var(--muted-border)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${progressColor}`}
            style={{ width: `${project.progress}%` }}
            role="progressbar"
            aria-valuenow={project.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[var(--text-disabled)]">
          {formatDistanceToNow(new Date(project.createdAt))}
        </span>
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(project.id);
            }}
            aria-label={`Eliminar ${project.name}`}
            className="text-[11px] text-[var(--text-disabled)] hover:text-red-500 transition-colors px-2 py-1 rounded-md hover:bg-red-500/10 opacity-0 group-hover:opacity-100"
          >
            Eliminar
          </button>
        )}
      </div>
    </Link>
  );
}
