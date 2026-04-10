'use client';

/** @description AgentControls — pause/continue/retry/download action buttons */

import { useState } from 'react';
import { Pause, Play, RotateCcw, Download, Loader2 } from 'lucide-react';
import type { ProjectStatus } from '@sophia/shared';
import { useDashboardStore } from '@/hooks/use-dashboard-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface AgentControlsProps {
  projectId: string;
  status: ProjectStatus;
  onStatusChange?: (status: ProjectStatus) => void;
}

/**
 * @description Fetch with automatic token refresh on 401.
 * Tries the request, if 401, refreshes token and retries once.
 */
async function fetchWithRefresh(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status === 401) {
    const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (refreshRes.ok) {
      return fetch(url, init);
    }
  }
  return res;
}

/** @description Context-aware action buttons for controlling the agent pipeline */
export function AgentControls({ projectId, status, onStatusChange }: AgentControlsProps) {
  const [loading, setLoading] = useState(false);
  const [confirmPause, setConfirmPause] = useState(false);
  const connected = useDashboardStore((s) => s.connected);

  const sendAction = async (action: 'pause' | 'continue' | 'retry') => {
    setLoading(true);
    try {
      const res = await fetchWithRefresh(`${API_URL}/api/projects/${projectId}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const body = await res.json();
        onStatusChange?.(body.data?.status ?? status);
      } else if (res.status === 401) {
        // Token refresh also failed — session truly expired
        window.location.href = '/login';
      }
    } finally {
      setLoading(false);
      setConfirmPause(false);
    }
  };

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isError = status === 'error';
  const isDone = status === 'done';

  return (
    <div className="flex items-center gap-2">
      {/* Pause / Continue */}
      {isRunning && !confirmPause && (
        <button
          onClick={() => setConfirmPause(true)}
          disabled={loading}
          className="btn-info flex items-center gap-1.5 rounded-lg px-3 py-1.5 disabled:opacity-50"
          aria-label="Pausar generación"
        >
          <Pause className="w-3.5 h-3.5" />
          Pausar
        </button>
      )}

      {isRunning && confirmPause && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--color-info)]" style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}>El agente actual terminará su tarea antes de pausar. ¿Continuar?</span>
          <button
            onClick={() => sendAction('pause')}
            disabled={loading}
            className="btn-info rounded-md px-2 py-1 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Sí'}
          </button>
          <button
            onClick={() => setConfirmPause(false)}
            className="btn-ghost rounded-md px-2 py-1"
          >
            No
          </button>
        </div>
      )}

      {isPaused && (
        <button
          onClick={() => sendAction('continue')}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--color-info)] px-3 py-1.5 text-xs text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}
          aria-label="Continuar generación"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          Continuar
        </button>
      )}

      {/* Retry */}
      {isError && (
        <button
          onClick={() => sendAction('retry')}
          disabled={loading}
          className="btn-error flex items-center gap-1.5 rounded-lg px-3 py-1.5 disabled:opacity-50"
          aria-label="Reintentar generación"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
          Reintentar
        </button>
      )}

      {/* Download ZIP */}
      {isDone && (
        <button
          disabled
          className="btn-success flex items-center gap-1.5 rounded-lg px-3 py-1.5 cursor-not-allowed opacity-50"
          aria-label="Descargar ZIP del proyecto"
          title="Descarga de archivos generados"
        >
          <Download className="w-3.5 h-3.5" />
          Descargar ZIP
        </button>
      )}

      {/* Connection indicator */}
      <div className="ml-auto flex items-center gap-1.5 text-xs text-[var(--text-secondary)]" style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}>
        <div
          className={`w-2 h-2 rounded-full ${
            connected ? 'bg-[var(--color-success)]' : status === 'idle' ? 'bg-[var(--text-disabled)]' : 'bg-[var(--color-error)] animate-pulse'
          }`}
        />
        {connected ? 'En vivo' : status === 'idle' ? 'Desconectado' : 'Sin conexión'}
      </div>
    </div>
  );
}
