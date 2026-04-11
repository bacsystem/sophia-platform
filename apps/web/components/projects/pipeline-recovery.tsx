'use client';

/**
 * @description Banner shown when a pipeline has been interrupted (e.g. worker crash).
 * Provides a "Resume Pipeline" button that calls POST /api/projects/:id/resume.
 */

import { useState } from 'react';
import { useDashboardStore } from '@/hooks/use-dashboard-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface PipelineRecoveryProps {
  projectId: string;
}

export function PipelineRecovery({ projectId }: PipelineRecoveryProps) {
  const interruptedInfo = useDashboardStore((s) => s.interruptedInfo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!interruptedInfo) return null;

  const handleResume = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/resume`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Error al reanudar' }));
        setError(body.message ?? `Error ${res.status}`);
      }
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const layerLabel = interruptedInfo.lastCompletedLayer > 0
    ? `Layer ${interruptedInfo.lastCompletedLayer}`
    : 'inicio';

  return (
    <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 text-amber-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-amber-400">Pipeline Interrumpido</h3>
          <p className="text-sm text-muted-foreground mt-1">
            El pipeline se detuvo inesperadamente en {layerLabel}.
            Puedes reanudarlo desde el último checkpoint completado.
          </p>
          {error && (
            <p className="text-sm text-red-400 mt-1">{error}</p>
          )}
        </div>
        <button
          onClick={handleResume}
          disabled={loading}
          className="shrink-0 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-black hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Reanudando...' : 'Reanudar Pipeline'}
        </button>
      </div>
    </div>
  );
}
