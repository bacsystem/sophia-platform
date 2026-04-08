'use client';

/** @description AgentControls — pause/continue/retry/download action buttons */

import { useState } from 'react';
import { Pause, Play, RotateCcw, Download, Loader2 } from 'lucide-react';
import type { ProjectStatus } from '@sophia/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface AgentControlsProps {
  projectId: string;
  status: ProjectStatus;
  onStatusChange?: (status: ProjectStatus) => void;
}

/** @description Context-aware action buttons for controlling the agent pipeline */
export function AgentControls({ projectId, status, onStatusChange }: AgentControlsProps) {
  const [loading, setLoading] = useState(false);
  const [confirmPause, setConfirmPause] = useState(false);

  const sendAction = async (action: 'pause' | 'resume' | 'retry') => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/generation/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const body = await res.json();
        onStatusChange?.(body.data?.status ?? status);
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
          className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
          aria-label="Pausar generación"
        >
          <Pause className="w-3.5 h-3.5" />
          Pausar
        </button>
      )}

      {isRunning && confirmPause && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-amber-400">¿Pausar?</span>
          <button
            onClick={() => sendAction('pause')}
            disabled={loading}
            className="rounded-md bg-amber-500/20 px-2 py-1 text-xs text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Sí'}
          </button>
          <button
            onClick={() => setConfirmPause(false)}
            className="rounded-md bg-white/5 px-2 py-1 text-xs text-white/60 hover:bg-white/10 transition-colors"
          >
            No
          </button>
        </div>
      )}

      {isPaused && (
        <button
          onClick={() => sendAction('resume')}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
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
          className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          aria-label="Reintentar generación"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
          Reintentar
        </button>
      )}

      {/* Download ZIP (M6 placeholder — disabled for now) */}
      {isDone && (
        <button
          disabled
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/30 cursor-not-allowed"
          aria-label="Descargar ZIP — disponible en M6"
          title="Disponible en M6 File Manager"
        >
          <Download className="w-3.5 h-3.5" />
          Descargar ZIP
        </button>
      )}

      {/* Connection indicator */}
      <div className="ml-auto flex items-center gap-1.5 text-xs text-white/40">
        <div
          className={`w-2 h-2 rounded-full ${
            status === 'idle' ? 'bg-white/20' : 'bg-green-400'
          }`}
        />
        {status === 'idle' ? 'Desconectado' : 'En vivo'}
      </div>
    </div>
  );
}
