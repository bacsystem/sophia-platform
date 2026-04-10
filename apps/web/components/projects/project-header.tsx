import type { Project } from '@sophia/shared';
import { AlertCircle } from 'lucide-react';

const STATUS_CONFIG = {
  idle:    { label: 'Pendiente',  classes: 'bg-[var(--surface-header)] text-[var(--text-tertiary)]' },
  running: { label: 'Ejecutando', classes: 'bg-[rgba(var(--accent-rgb)/0.20)] text-[var(--accent-500)] dark:text-[var(--accent-300)]' },
  paused:  { label: 'Pausado',    classes: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-300' },
  done:    { label: 'Completado', classes: 'bg-green-500/20 text-green-600 dark:text-green-300' },
  error:   { label: 'Error',      classes: 'bg-red-500/20 text-red-600 dark:text-red-300' },
} as const;

const STACK_LABELS: Record<string, string> = {
  'node-nextjs': 'Node.js + Next.js',
  'laravel-nextjs': 'Laravel + Next.js',
  'python-nextjs': 'Python + Next.js',
};

interface ProjectHeaderProps {
  project: Project;
}

/** @description Project name, stack, status badge, progress bar and error message */
export function ProjectHeader({ project }: ProjectHeaderProps) {
  const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.idle;
  const isRunning = project.status === 'running';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{project.name}</h1>
        <span className="text-sm text-[var(--text-tertiary)] bg-[var(--surface-header)] px-2.5 py-0.5 rounded-full">
          {STACK_LABELS[project.stack] ?? project.stack}
        </span>
        <div className="flex items-center gap-1.5">
          {isRunning && (
            <span className="w-2 h-2 rounded-full bg-[var(--accent-400)] animate-pulse" aria-hidden="true" />
          )}
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${status.classes}`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm text-[var(--text-secondary)]">
          <span>{project.currentLayerName || 'Capa inicial'}</span>
          <span>{project.progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--muted-border)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              project.status === 'error'
                ? 'bg-red-500'
                : project.status === 'done'
                ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                : 'bg-[linear-gradient(90deg,var(--accent-500),var(--accent-400))]'
            }`}
            style={{ width: `${project.progress}%` }}
            role="progressbar"
            aria-valuenow={project.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Error message */}
      {project.status === 'error' && project.errorMessage && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{project.errorMessage}</p>
        </div>
      )}
    </div>
  );
}
