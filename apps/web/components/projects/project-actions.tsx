'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Pause, RotateCcw, Download, Loader2, Pencil, Trash2, LayoutDashboard } from 'lucide-react';
import type { Project } from '@sophia/shared';
import { DeleteProjectDialog } from './delete-project-dialog';

interface ProjectActionsProps {
  project: Project;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** @description State-dependent action buttons: start/pause/continue/retry/download + edit/delete triggers */
export function ProjectActions({ project }: ProjectActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const callAction = async (action: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/projects/${project.id}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.message ?? 'Error en la acción');
      } else {
        router.refresh();
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex flex-wrap gap-2 justify-end">
        {/* Primary state action */}
        {project.status === 'idle' && (
          <button
            type="button"
            onClick={() => void callAction('start')}
            disabled={loading}
            className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Iniciar
          </button>
        )}

        {project.status === 'running' && (
          <button
            type="button"
            onClick={() => void callAction('pause')}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-[var(--color-warn-subtle)] bg-[var(--color-warn-subtle)] text-[var(--color-warn)] hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
            Pausar
          </button>
        )}

        {project.status === 'paused' && (
          <button
            type="button"
            onClick={() => void callAction('continue')}
            disabled={loading}
            className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Continuar
          </button>
        )}

        {project.status === 'error' && (
          <button
            type="button"
            onClick={() => void callAction('retry')}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-[var(--color-warn-subtle)] bg-[var(--color-warn-subtle)] text-[var(--color-warn)] hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            Reintentar
          </button>
        )}

        {project.status === 'done' && (
          <a
            href={`/projects/${project.id}/files`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-green-400/80 border border-green-500/20 hover:border-green-500/40 hover:text-green-400 hover:bg-green-500/10 transition-colors"
            aria-label="Ver archivos generados"
          >
            <Download className="w-4 h-4" />
            Ver archivos
          </a>
        )}

        {/* Dashboard — visible when generation has started */}
        {project.status !== 'idle' && (
          <a
            href={`/projects/${project.id}/dashboard`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-blue-400/80 border border-blue-500/20 hover:border-blue-500/40 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
            aria-label="Ver dashboard de agentes"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </a>
        )}

        {/* Edit — only when idle (T036.5) */}
        {project.status === 'idle' && (
          <a
            href={`/projects/${project.id}/edit`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] border border-[var(--muted-border)] hover:border-[var(--text-disabled)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Editar proyecto"
          >
            <Pencil className="w-4 h-4" />
            Editar
          </a>
        )}

        {/* Delete — only when not running (T040.5) */}
        {project.status !== 'running' && (
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            aria-label="Eliminar proyecto"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-400/70 border border-red-500/20 hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {showDelete && (
        <DeleteProjectDialog
          project={project}
          onClose={() => setShowDelete(false)}
          onSuccess={() => router.push('/projects')}
        />
      )}
    </div>
  );
}
