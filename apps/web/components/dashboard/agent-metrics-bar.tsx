'use client';

/** @description AgentMetricsBar — compact inline metrics with neon progress bar for control room layout */

import { useDashboardStore } from '@/hooks/use-dashboard-store';
import { useElapsedTime } from '@/hooks/use-elapsed-time';

interface AgentMetricsBarProps {
  startedAt: string | null;
}

/** @description Compact inline metrics bar with progress for the premium dashboard layout */
export function AgentMetricsBar({ startedAt }: AgentMetricsBarProps) {
  const { progress, currentLayer, currentLayerName, activeAgents, totalFiles, tokensUsed, status } =
    useDashboardStore();
  const elapsed = useElapsedTime(startedAt);

  const isDone = status === 'done';
  const isError = status === 'error';
  const isPaused = status === 'paused';

  const statusText = isDone
    ? 'Pipeline complete'
    : isError
      ? 'Pipeline error'
      : isPaused
        ? `Paused — Layer ${currentLayer}: ${currentLayerName}`
        : currentLayerName
          ? `Layer ${currentLayer}: ${currentLayerName}`
          : status === 'running'
            ? 'Starting pipeline...'
            : 'Idle';

  const barColor = isDone
    ? 'bg-[var(--color-success)]'
    : isError
      ? 'bg-red-500'
      : isPaused
        ? 'bg-amber-500'
        : 'bg-[linear-gradient(90deg,var(--accent-500),var(--accent-400))]';

  return (
    <div className="flex items-center gap-4">
      {/* Status + progress bar */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <span className="text-[10px] text-[var(--text-secondary)] shrink-0 truncate max-w-[220px] font-medium" style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}>
          {statusText}
        </span>
        <div className="flex-1 h-[4px] bg-[var(--muted-border)] rounded-full overflow-hidden max-w-xs">
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-700 ease-out`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <span className="text-[12px] font-bold text-[var(--text-primary)] tabular-nums shrink-0" style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)" }}>
          {Math.round(progress)}%
        </span>
      </div>

      {/* Inline metrics */}
      <div className="flex items-center gap-5" style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}>
        <InlineStat label="AGENTS" value={`${activeAgents}/9`} />
        <InlineStat label="LAYER"  value={currentLayer > 0 ? `${currentLayer}/9` : '—'} />
        <InlineStat label="FILES"  value={String(totalFiles)} />
        <InlineStat label="TOKENS" value={formatTokens(tokensUsed)} />
        <InlineStat label="TIME"   value={elapsed} />
      </div>
    </div>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[8px] tracking-wider text-[var(--text-tertiary)] uppercase font-semibold">{label}</span>
      <span className="text-[12px] tabular-nums font-bold text-[var(--accent-500)]">{value}</span>
    </div>
  );
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}
