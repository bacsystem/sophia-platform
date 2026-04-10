'use client';

/** @description AgentDetailPanel — expandable panel showing agent details on node click */

import { useMemo } from 'react';
import { X, Clock, FileCode, Coins } from 'lucide-react';
import { useDashboardStore, type AgentNode } from '@/hooks/use-dashboard-store';
import { useElapsedTime } from '@/hooks/use-elapsed-time';

interface AgentDetailPanelProps {
  agentId: string;
  onClose: () => void;
  position?: { left: number; top: number };
}

/** @description Floating card with agent logs, files, progress, and timing — positioned beside the clicked node */
export function AgentDetailPanel({ agentId, onClose, position }: AgentDetailPanelProps) {
  const agent = useDashboardStore((s) => s.agents.find((a) => a.id === agentId));
  const allLogs = useDashboardStore((s) => s.logs);
  const allFiles = useDashboardStore((s) => s.files);
  const logs = useMemo(() => allLogs.filter((l) => l.agentType === agentId), [allLogs, agentId]);
  const files = useMemo(() => allFiles.filter((f) => f.agentType === agentId), [allFiles, agentId]);
  const elapsed = useElapsedTime(agent?.startedAt ?? null);

  if (!agent) return null;

  return (
    <div
      className="absolute z-30 w-64 pointer-events-auto"
      style={position ? { left: position.left, top: position.top } : { left: 16, top: 16 }}
    >
      <div
        className="bg-[var(--surface-console)]/96 backdrop-blur-xl rounded-2xl overflow-hidden"
        style={{
          border: `1px solid ${agent.color}28`,
          boxShadow: `0 8px 40px rgba(0,0,0,0.35), 0 0 0 1px ${agent.color}12, 0 0 24px ${agent.color}0a`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--muted-border)]">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: agent.color, boxShadow: `0 0 6px ${agent.color}90` }}
            />
            <span
              className="text-[var(--text-primary)] font-bold capitalize text-xs tracking-wide truncate"
              style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)" }}
            >
              {agent.type as string}
            </span>
            <StatusBadge status={agent.status} />
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors p-0.5 rounded shrink-0 ml-1"
            aria-label="Cerrar detalle del agente"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Metrics */}
        <div
          className="flex items-center gap-3 px-3 py-1.5 border-b border-[var(--muted-border)] text-[10px] text-[var(--text-tertiary)]"
          style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}
        >
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-[var(--color-info)]" />
            {elapsed}
          </span>
          <span className="flex items-center gap-1">
            <FileCode className="w-3 h-3 text-[var(--color-success)]" />
            {agent.filesCreated}
          </span>
          <span className="flex items-center gap-1">
            <Coins className="w-3 h-3 text-[var(--accent-500)]" />
            {agent.tokensUsed.toLocaleString()}
          </span>
        </div>

        {/* Progress bar */}
        <div className="px-3 pt-2.5 pb-1">
          <div className="w-full h-[3px] bg-[var(--muted-border)] rounded-full">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${agent.progress}%`, backgroundColor: agent.color, boxShadow: `0 0 6px ${agent.color}60` }}
            />
          </div>
        </div>

        {/* Logs */}
        <div className="px-3 pb-1">
          <p
            className="label-caption mb-1.5 mt-1"
          >
            Logs recientes
          </p>
          <div
            className="space-y-0.5 max-h-[88px] overflow-y-auto text-[10px]"
            style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}
          >
            {logs.length === 0 ? (
              <p className="text-[var(--text-tertiary)] italic">Sin logs aún</p>
            ) : (
              logs.slice(-6).map((log) => (
                <div key={log.id} className="flex gap-1.5 text-[var(--text-secondary)]">
                  <span className="text-[var(--text-tertiary)] shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString('es', { minute: '2-digit', second: '2-digit' })}
                  </span>
                  <LogIcon level={log.level} />
                  <span className="truncate">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Files */}
        <div className="px-3 pb-3">
          <p
            className="label-caption mb-1.5 mt-1 border-t border-[var(--muted-border)] pt-2"
          >
            Archivos generados
          </p>
          <div
            className="space-y-0.5 max-h-[72px] overflow-y-auto text-[10px] text-[var(--text-secondary)]"
            style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}
          >
            {files.length === 0 ? (
              <p className="text-[var(--text-tertiary)] italic">Sin archivos aún</p>
            ) : (
              files.slice(-5).map((file) => (
                <div key={file.path} className="truncate">{file.path}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AgentNode['status'] }) {
  const config: Record<string, { label: string; className: string }> = {
    idle:    { label: 'Inactivo',    className: 'bg-[var(--muted-border)] text-[var(--text-tertiary)]' },
    queued:  { label: 'En cola',    className: 'bg-[var(--muted-border)] text-[var(--text-tertiary)]' },
    working: { label: 'Trabajando', className: 'badge-info' },
    done:    { label: 'Completado', className: 'badge-success' },
    error:   { label: 'Error',      className: 'badge-error' },
    paused:  { label: 'Pausado',    className: 'badge-warn' },
  };
  const c = config[status] ?? config.idle;

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}

function LogIcon({ level }: { level: string }) {
  switch (level) {
    case 'ok':    return <span className="text-[var(--color-success)]">✓</span>;
    case 'warn':  return <span className="text-[var(--color-warn)]">⚠</span>;
    case 'error': return <span className="text-[var(--color-error)]">✕</span>;
    default:      return <span className="text-[var(--text-disabled)]">●</span>;
  }
}
