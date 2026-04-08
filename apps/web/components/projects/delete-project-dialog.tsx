'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2, X, AlertTriangle } from 'lucide-react';
import type { Project } from '@sophia/shared';

interface DeleteProjectDialogProps {
  project: Project;
  onClose: () => void;
  onSuccess: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** @description Confirmation modal that requires typing the project name before deletion */
export function DeleteProjectDialog({ project, onClose, onSuccess }: DeleteProjectDialogProps) {
  const [confirmName, setConfirmName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const matches = confirmName === project.name;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleDelete = async () => {
    if (!matches) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/projects/${project.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.message ?? 'No se pudo eliminar el proyecto');
        return;
      }
      onSuccess();
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative glass rounded-2xl p-6 w-full max-w-md shadow-2xl animate-slide-up">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 id="delete-dialog-title" className="text-base font-semibold text-white">
              Eliminar proyecto
            </h2>
            <p className="text-sm text-white/50 mt-1">
              Esta acción no se puede deshacer. El proyecto y todos sus archivos serán eliminados.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="confirm-name" className="label-premium">
              Escribe{' '}
              <strong className="text-white font-semibold">{project.name}</strong> para confirmar
            </label>
            <input
              ref={inputRef}
              id="confirm-name"
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={project.name}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && matches) void handleDelete();
              }}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white/60 border border-white/10 hover:border-white/20 hover:text-white/80 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={!matches || loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-500/80 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Eliminar proyecto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
