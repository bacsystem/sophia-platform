'use client';

/** @description AgentMetricsBar — top metrics bar showing progress, layer, agents, files, tokens, time */

import { Bot, BarChart3, FolderOpen, Timer, Coins } from 'lucide-react';
import { useDashboardStore } from '@/hooks/use-dashboard-store';
import { useElapsedTime } from '@/hooks/use-elapsed-time';

interface AgentMetricsBarProps {
  startedAt: string | null;
}

/** @description Horizontal metrics bar with 5 stat cards and overall progress bar */
export function AgentMetricsBar({ startedAt }: AgentMetricsBarProps) {
  const { progress, currentLayer, currentLayerName, activeAgents, totalFiles, tokensUsed, status } =
    useDashboardStore();
  const elapsed = useElapsedTime(startedAt);

  const isRunning = status === 'running';

  /* Heuristic: ~3 files per completed layer + ~5 for active layer */
  const estimatedFiles = Math.max(currentLayer * 3 + 5, totalFiles);

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/60">
            {currentLayerName ? `Capa ${currentLayer}: ${currentLayerName}` : 'Iniciando...'}
          </span>
          <span className="text-white/80 font-mono">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-5 gap-2">
        <MetricCard
          icon={<Bot className="w-4 h-4" />}
          label="Agentes"
          value={`${activeAgents} / 9`}
          active={isRunning}
        />
        <MetricCard
          icon={<BarChart3 className="w-4 h-4" />}
          label="Creados"
          value={`${totalFiles} / ~${estimatedFiles}`}
          active={isRunning}
        />
        <MetricCard
          icon={<FolderOpen className="w-4 h-4" />}
          label="Generados"
          value={totalFiles}
          active={isRunning}
        />
        <MetricCard
          icon={<Timer className="w-4 h-4" />}
          label="Tiempo"
          value={elapsed}
          active={isRunning}
        />
        <MetricCard
          icon={<Coins className="w-4 h-4" />}
          label="Tokens"
          value={formatTokens(tokensUsed)}
          active={isRunning}
        />
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  active: boolean;
}

function MetricCard({ icon, label, value, active }: MetricCardProps) {
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center transition-colors ${
        active
          ? 'border-white/10 bg-white/5'
          : 'border-white/5 bg-white/[0.02]'
      }`}
    >
      <div className={active ? 'text-white/70' : 'text-white/30'}>{icon}</div>
      <span className="text-xs font-mono text-white/90">{value}</span>
      <span className="text-[10px] text-white/40">{label}</span>
    </div>
  );
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}
