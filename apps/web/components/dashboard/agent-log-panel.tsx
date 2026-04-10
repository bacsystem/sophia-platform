'use client';

/** @description AgentLogPanel — real-time log panel with auto-scroll, pause/resume, and agent filter */

import { useRef, useEffect, useState, useCallback } from 'react';
import { Pause, Play, History } from 'lucide-react';
import { useDashboardStore, type AgentLog } from '@/hooks/use-dashboard-store';
import { LAYER_AGENTS } from '@/lib/agent-config';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface AgentLogPanelProps {
  projectId?: string;
  onViewHistory?: () => void;
}

/** @description Panel de logs con auto-scroll, filtro por agente, y badge de mensajes nuevos */
export function AgentLogPanel({ projectId, onViewHistory }: AgentLogPanelProps) {
  const logs = useDashboardStore((s) => s.logs);
  const scrollPaused = useDashboardStore((s) => s.scrollPaused);
  const unreadCount = useDashboardStore((s) => s.unreadCount);
  const setScrollPaused = useDashboardStore((s) => s.setScrollPaused);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [historyLogs, setHistoryLogs] = useState<AgentLog[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const filteredLogs = filter
    ? logs.filter((l) => l.agentType === filter)
    : logs;

  const displayLogs = historyLogs ?? filteredLogs;

  const fetchHistory = useCallback(async () => {
    if (historyLogs) { setHistoryLogs(null); return; }
    if (!projectId || loadingHistory) return;
    if (onViewHistory) { onViewHistory(); return; }
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/logs?limit=200`, {
        credentials: 'include',
      });
      if (res.ok) {
        const body = await res.json();
        setHistoryLogs(body.data ?? []);
      }
    } finally {
      setLoadingHistory(false);
    }
  }, [projectId, loadingHistory, onViewHistory, historyLogs]);

  // Auto-scroll when not paused
  useEffect(() => {
    if (!scrollPaused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayLogs.length, scrollPaused]);

  const togglePause = useCallback(() => {
    setScrollPaused(!scrollPaused);
  }, [scrollPaused, setScrollPaused]);

  return (
    <div className="flex flex-col h-full console-surface">
      {/* Console-style header */}
      <div className="flex items-center gap-2 px-3 py-1.5 console-header">
        <span className="text-[9px] tracking-[0.15em] uppercase text-[var(--accent-500)] font-semibold" style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}>
          ▸ Agent Log
        </span>

        <select
          value={filter ?? ''}
          onChange={(e) => setFilter(e.target.value || null)}
          className="ml-auto select-themed"
          aria-label="Filtrar logs por agente"
        >
          <option value="">All</option>
          {LAYER_AGENTS.map((a) => (
            <option key={a} value={a}>
              {a.charAt(0).toUpperCase() + a.slice(1)}
            </option>
          ))}
          <option value="system">System</option>
        </select>

        <div className="flex-1" />

        {scrollPaused && unreadCount > 0 && (
          <span className="bg-[rgba(var(--accent-rgb)/0.10)] text-[var(--accent-500)] text-[10px] px-1.5 py-0.5 rounded-full" style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}>
            +{unreadCount}
          </span>
        )}

        <button
          onClick={togglePause}
          className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors p-0.5"
          aria-label={scrollPaused ? 'Reanudar auto-scroll' : 'Pausar auto-scroll'}
          aria-pressed={scrollPaused}
        >
          {scrollPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
        </button>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-1 text-[10px] leading-relaxed"
        style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}
        aria-live="polite"
        aria-atomic="false"
      >
        {displayLogs.length === 0 && (
          <p className="text-[var(--text-tertiary)] text-[10px] text-center py-6" style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}>
            No logs available
          </p>
        )}
        {displayLogs.map((log) => (
          <div key={log.id} className="flex items-start gap-1.5 py-px row-hover-bg transition-colors">
            <span className="text-[var(--text-tertiary)] shrink-0 tabular-nums w-10">
              {formatTime(log.timestamp)}
            </span>
            <LogLevelIcon level={log.level} />
            <span className={`shrink-0 font-medium ${getAgentColor(log.agentType)}`}>
              {log.agentType}
            </span>
            <span className="text-[var(--text-tertiary)]">→</span>
            <span className="text-[var(--text-secondary)] break-words min-w-0 leading-snug">{log.message}</span>
          </div>
        ))}
      </div>

      {/* History button */}
      <div className="px-3 py-2 border-t border-[var(--muted-border)]">
        <button
          onClick={fetchHistory}
          disabled={loadingHistory}
          className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors disabled:opacity-50"
          aria-label="Ver historial completo de logs"
        >
          <History className="w-3 h-3" />
          {loadingHistory ? 'Cargando...' : historyLogs ? 'Volver a tiempo real' : 'Ver historial completo'}
        </button>
      </div>
    </div>
  );
}

function LogLevelIcon({ level }: { level: string }) {
  switch (level) {
    case 'ok':
      return <span className="text-[var(--color-success)] shrink-0 text-[10px]">●</span>;
    case 'warn':
      return <span className="text-[var(--color-warn)] shrink-0 text-[10px]">▲</span>;
    case 'error':
      return <span className="text-[var(--color-error)] shrink-0 text-[10px]">✕</span>;
    default:
      return <span className="text-[var(--text-disabled)] shrink-0 text-[10px]">○</span>;
  }
}

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function getAgentColor(agentType: string): string {
  const colors: Record<string, string> = {
    dba: 'text-amber-400',
    seed: 'text-lime-400',
    backend: 'text-purple-400',
    frontend: 'text-cyan-400',
    qa: 'text-[var(--color-success)]',
    security: 'text-red-400',
    docs: 'text-orange-400',
    deploy: 'text-indigo-400',
    integration: 'text-pink-400',
    system: 'text-blue-400',
  };
  return colors[agentType] ?? 'text-[var(--text-secondary)]';
}
