'use client';

/** @description AgentDetailPanel — expandable panel showing agent details on node click */

import { X, Clock, FileCode, Coins } from 'lucide-react';
import { useDashboardStore, type AgentNode } from '@/hooks/use-dashboard-store';
import { useElapsedTime } from '@/hooks/use-elapsed-time';

interface AgentDetailPanelProps {
  agentId: string;
  onClose: () => void;
}

/** @description Expandable panel with agent logs, files, progress, and timing */
export function AgentDetailPanel({ agentId, onClose }: AgentDetailPanelProps) {
  const agent = useDashboardStore((s) => s.agents.find((a) => a.id === agentId));
  const logs = useDashboardStore((s) =>
    s.logs.filter((l) => l.agentType === agentId),
  );
  const files = useDashboardStore((s) =>
    s.files.filter((f) => f.agentType === agentId),
  );
  const elapsed = useElapsedTime(agent?.startedAt ?? null);

  if (!agent) return null;

  return (
    <div className="border-t border-white/10 bg-black/30 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: agent.color }}
            />
            <h3 className="text-white font-medium capitalize">
              {agent.type as string}
            </h3>
            <StatusBadge status={agent.status} />
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/70 transition-colors"
            aria-label="Cerrar panel de detalle"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Metrics row */}
        <div className="flex gap-6 text-sm text-white/50 mb-3">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {elapsed}
          </span>
          <span className="flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5" />
            {agent.filesCreated} archivos
          </span>
          <span className="flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5" />
            {agent.tokensUsed.toLocaleString()} tokens
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-white/5 rounded-full mb-4">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${agent.progress}%`,
              backgroundColor: agent.color,
            }}
          />
        </div>

        {/* Recent logs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
              Logs recientes
            </h4>
            <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
              {logs.length === 0 && (
                <p className="text-white/30">Sin logs aún</p>
              )}
              {logs.slice(-8).map((log) => (
                <div key={log.id} className="flex gap-2 text-white/60">
                  <span className="text-white/30 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString('es', {
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                  <LogIcon level={log.level} />
                  <span className="truncate">{log.message}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
              Archivos generados
            </h4>
            <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
              {files.length === 0 && (
                <p className="text-white/30">Sin archivos aún</p>
              )}
              {files.slice(-8).map((file) => (
                <div
                  key={file.path}
                  className="text-white/60 truncate"
                >
                  {file.path}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AgentNode['status'] }) {
  const config: Record<string, { label: string; className: string }> = {
    idle: { label: 'Inactivo', className: 'bg-gray-500/20 text-gray-400' },
    queued: { label: 'En cola', className: 'bg-gray-500/20 text-gray-400' },
    working: { label: 'Trabajando', className: 'bg-blue-500/20 text-blue-400' },
    done: { label: 'Completado', className: 'bg-green-500/20 text-green-400' },
    error: { label: 'Error', className: 'bg-red-500/20 text-red-400' },
    paused: { label: 'Pausado', className: 'bg-amber-500/20 text-amber-400' },
  };
  const c = config[status] ?? config.idle;

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}

function LogIcon({ level }: { level: string }) {
  switch (level) {
    case 'ok':
      return <span className="text-green-400">✓</span>;
    case 'warn':
      return <span className="text-amber-400">⚠</span>;
    case 'error':
      return <span className="text-red-400">✕</span>;
    default:
      return <span className="text-gray-500">●</span>;
  }
}
