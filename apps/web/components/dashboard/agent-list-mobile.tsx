'use client';

/** @description AgentListMobile — vertical list of agents for mobile viewport (<768px) */

import { useDashboardStore, type AgentNode, type AgentNodeStatus } from '@/hooks/use-dashboard-store';
import { AGENT_CONFIGS } from '@/lib/agent-config';

interface AgentListMobileProps {
  onAgentClick: (node: AgentNode) => void;
}

/** @description Compact vertical agent list with inline progress bars for mobile screens */
export function AgentListMobile({ onAgentClick }: AgentListMobileProps) {
  const agents = useDashboardStore((s) => s.agents);

  return (
    <div className="space-y-1.5">
      {agents
        .filter((a) => a.type !== 'orchestrator')
        .map((agent) => (
          <button
            key={agent.id}
            onClick={() => onAgentClick(agent)}
            className="flex items-center gap-3 w-full rounded-lg border border-[var(--muted-border)] bg-[var(--row-hover)] px-3 py-2 text-left hover:bg-[var(--surface-header)] transition-colors"
          >
            {/* Status dot */}
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: statusDotColor(agent.status) }}
            />

            {/* Agent name */}
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-[var(--text-primary)] block truncate">
                {AGENT_CONFIGS[agent.type]?.label ?? agent.type}
              </span>
              {agent.currentTask && (
                <span className="text-[10px] text-[var(--text-tertiary)] block truncate">{agent.currentTask}</span>
              )}
            </div>

            {/* Progress */}
            <div className="w-16 shrink-0">
              <div className="h-1.5 bg-[var(--muted-border)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${agent.progress}%`,
                    backgroundColor: agent.color,
                  }}
                />
              </div>
            </div>

            {/* Percentage */}
            <span className="text-[10px] font-mono text-[var(--text-tertiary)] w-8 text-right">
              {Math.round(agent.progress)}%
            </span>
          </button>
        ))}
    </div>
  );
}

function statusDotColor(status: AgentNodeStatus): string {
  switch (status) {
    case 'working':
      return '#3b82f6';
    case 'done':
      return '#22c55e';
    case 'error':
      return '#ef4444';
    case 'paused':
      return '#f59e0b';
    case 'queued':
      return '#6b7280';
    default:
      return '#374151';
  }
}
