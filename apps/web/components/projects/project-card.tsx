'use client';

import Link from 'next/link';
import { formatDistanceToNow } from './date-utils';
import type { Project } from '@sophia/shared';

const STATUS_CONFIG = {
  idle: { label: 'Pendiente', classes: 'bg-white/10 text-white/50' },
  running: { label: 'Ejecutando', classes: 'bg-violet-500/20 text-violet-300' },
  paused: { label: 'Pausado', classes: 'bg-yellow-500/20 text-yellow-300' },
  done: { label: 'Completado', classes: 'bg-green-500/20 text-green-300' },
  error: { label: 'Error', classes: 'bg-red-500/20 text-red-300' },
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
  const isRunning = project.status === 'running';

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block glass rounded-2xl p-5 hover:border-white/20 hover:bg-white/6 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-white truncate group-hover:text-violet-300 transition-colors">
            {project.name}
          </h3>
          <span className="text-xs text-white/40">{STACK_LABELS[project.stack] ?? project.stack}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isRunning && (
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" aria-hidden="true" />
          )}
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${status.classes}`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1.5 mb-4">
        <div className="flex justify-between text-xs text-white/40">
          <span>{project.currentLayerName || 'Capa inicial'}</span>
          <span>{project.progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              project.status === 'error'
                ? 'bg-red-500'
                : project.status === 'done'
                ? 'bg-green-500'
                : 'bg-gradient-to-r from-violet-500 to-indigo-500'
            }`}
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
        <span className="text-xs text-white/30">
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
            className="text-xs text-white/25 hover:text-red-400 transition-colors px-2 py-1 rounded-md hover:bg-red-500/10"
          >
            Eliminar
          </button>
        )}
      </div>
    </Link>
  );
}
