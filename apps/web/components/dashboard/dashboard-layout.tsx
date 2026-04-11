'use client';

/** @description DashboardLayout — responsive desktop/mobile layout composing all dashboard panels */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDashboardStore, type GeneratedFile } from '@/hooks/use-dashboard-store';
import type { AgentNode } from '@/hooks/use-dashboard-store';
import { useWebSocket } from '@/hooks/use-websocket';
import { AgentCanvas } from './agent-canvas';
import { AgentDetailPanel } from './agent-detail-panel';
import { AgentLogPanel } from './agent-log-panel';
import { AgentFilesPanel } from './agent-files-panel';
import { AgentMetricsBar } from './agent-metrics-bar';
import { AgentControls } from './agent-controls';
import { FilePreviewModal } from './file-preview-modal';
import { DashboardEmpty } from './dashboard-empty';
import { CheckpointIndicators } from '@/components/projects/checkpoint-indicator';
import { LAYER_AGENTS, AGENT_CONFIGS, type AgentType } from '@/lib/agent-config';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface DashboardLayoutProps {
  projectId: string;
  projectName: string;
  startedAt: string | null;
  initialStatus?: import('@sophia/shared').ProjectStatus;
}

/** @description Main dashboard view — orchestrates canvas, panels, metrics, and controls */
export function DashboardLayout({ projectId, projectName, startedAt, initialStatus }: DashboardLayoutProps) {
  const storeStatus = useDashboardStore((s) => s.status);
  const setStatus = useDashboardStore((s) => s.setStatus);
  const activeTab = useDashboardStore((s) => s.activeTab);
  const setActiveTab = useDashboardStore((s) => s.setActiveTab);
  const selectedAgentId = useDashboardStore((s) => s.selectedAgentId);
  const selectAgent = useDashboardStore((s) => s.selectAgent);

  const [previewFile, setPreviewFile] = useState<GeneratedFile | null>(null);
  const [selectedPos, setSelectedPos] = useState<{ left: number; top: number } | null>(null);

  // Sync initial project status from server into Zustand store (once)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initialStatus && !initializedRef.current) {
      initializedRef.current = true;
      setStatus(initialStatus);
    }
  }, [initialStatus, setStatus]);

  // Hydrate dashboard store with existing agents/logs from DB when project is active
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !initialStatus || initialStatus === 'idle') return;
    hydratedRef.current = true;

    const store = useDashboardStore.getState();

    // Fetch agents from DB
    fetch(`${API_URL}/api/projects/${projectId}/agents`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!body?.data) return;
        for (const agent of body.data) {
          const agentId = agent.type.replace('-agent', '');
          const statusMap: Record<string, 'idle' | 'queued' | 'working' | 'done' | 'error' | 'paused'> = {
            running: 'working', completed: 'done', failed: 'error', paused: 'paused', pending: 'queued',
          };
          store.updateAgent(agentId, {
            status: statusMap[agent.status] ?? 'idle',
            progress: agent.progress ?? 0,
            currentTask: agent.currentTask ?? null,
            tokensUsed: (agent.tokensInput ?? 0) + (agent.tokensOutput ?? 0),
            filesCreated: agent.filesCreated ?? 0,
            startedAt: agent.startedAt ?? null,
            completedAt: agent.completedAt ?? null,
          });
        }
        // Update orchestrator if there are any running agents
        const hasRunning = body.data.some((a: { status: string }) => a.status === 'running');
        if (hasRunning) store.updateAgent('orchestrator', { status: 'working' });
        const doneCount = body.data.filter((a: { status: string }) => a.status === 'completed').length;
        if (doneCount > 0) {
          store.setProgress(Math.round((doneCount / 9) * 100));
        }
        // Set current layer from the most advanced running/completed agent
        const agentOrder = body.data
          .map((a: { type: string; status: string }) => ({
            idx: LAYER_AGENTS.indexOf(a.type.replace('-agent', '') as typeof LAYER_AGENTS[number]),
            status: a.status,
            type: a.type.replace('-agent', ''),
          }))
          .filter((a: { idx: number }) => a.idx >= 0)
          .sort((a: { idx: number }, b: { idx: number }) => b.idx - a.idx);
        const currentAgent = agentOrder.find((a: { status: string }) => a.status === 'running') ?? agentOrder[0];
        if (currentAgent) {
          const label = AGENT_CONFIGS[currentAgent.type as AgentType]?.label ?? currentAgent.type;
          store.setCurrentLayer(currentAgent.idx + 1, label);
        }
      })
      .catch(() => { /* non-fatal */ });

    // Fetch recent logs from DB
    fetch(`${API_URL}/api/projects/${projectId}/logs?limit=50&page=1`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!body?.data) return;
        // Logs come newest-first, reverse for chronological order
        const logs = [...body.data].reverse();
        for (const log of logs) {
          store.addLog({
            id: log.id,
            agentType: log.agentType ?? 'system',
            level: log.type === 'error' ? 'error' : log.type === 'complete' ? 'ok' : 'info',
            message: log.message,
            timestamp: log.createdAt,
          });
        }
      })
      .catch(() => { /* non-fatal */ });

    // Fetch generated files from DB (tree endpoint returns flat in nested structure)
    fetch(`${API_URL}/api/projects/${projectId}/files`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!body?.data?.tree) return;
        // Walk tree to extract flat file list
        const extractFiles = (nodes: Array<{ id: string; name: string; type: string; agentType?: string; createdAt?: string; sizeBytes?: number; children?: Array<unknown> }>, parentPath = ''): void => {
          for (const node of nodes) {
            const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;
            if (node.type === 'file') {
              store.addFile({
                path: fullPath,
                name: node.name,
                agentType: node.agentType ?? 'system',
                createdAt: node.createdAt ?? new Date().toISOString(),
                size: node.sizeBytes,
              });
            } else if (node.children) {
              extractFiles(node.children as typeof nodes, fullPath);
            }
          }
        };
        extractFiles(body.data.tree);
      })
      .catch(() => { /* non-fatal */ });
  }, [initialStatus, projectId]);

  // Use initialStatus to avoid flash of empty state before useEffect fires
  const status = storeStatus === 'idle' && initialStatus ? initialStatus : storeStatus;

  // Only connect WebSocket when pipeline is running/paused
  const wsEnabled = status !== 'idle';
  useWebSocket({ projectId, enabled: wsEnabled });

  const handleNodeClick = useCallback(
    (node: AgentNode, px: number, py: number, cw: number, ch: number) => {
      if (selectedAgentId === node.id) {
        selectAgent(null);
        setSelectedPos(null);
        return;
      }
      selectAgent(node.id);
      const CARD_W = 264;
      const CARD_H = 320;
      const GAP = 20;
      const left = px + CARD_W + GAP > cw
        ? Math.max(GAP, px - CARD_W - GAP)
        : px + GAP;
      const top = Math.max(GAP, Math.min(py - 60, ch - CARD_H - GAP));
      setSelectedPos({ left, top });
    },
    [selectedAgentId, selectAgent],
  );

  const isIdle = status === 'idle';

  const TABS: { key: typeof activeTab; label: string; icon: string }[] = [
    { key: 'logs', label: 'Agent Log', icon: '▸' },
    { key: 'progress', label: 'Progress', icon: '◆' },
    { key: 'files', label: 'Files', icon: '◇' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* ── Status Bar ── */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--panel-bg)]/90 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-bold tracking-wider uppercase text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)" }}>
            {projectName}
          </h1>
          {!isIdle && (
            <span className="text-[10px] px-2.5 py-0.5 rounded-full tracking-widest border border-[rgba(var(--accent-rgb)/0.3)] bg-[rgba(var(--accent-rgb)/0.1)] text-[var(--accent-500)] shadow-[0_0_12px_rgba(var(--accent-rgb)/0.15)]" style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}>
              <span className="animate-pulse">●</span> LIVE
            </span>
          )}
        </div>
        <AgentControls projectId={projectId} status={status} onStatusChange={setStatus} />
      </div>

      {isIdle ? (
        <DashboardEmpty projectId={projectId} />
      ) : (
        <>
          {/* ── Metrics Bar ── */}
          <div className="px-5 py-2 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--panel-bg)]/80">
            <AgentMetricsBar startedAt={startedAt} />
            <CheckpointIndicators />
          </div>

          {/* ── Desktop: Canvas (6 rows) + Tabbed Console (6 rows) ── */}
          <div className="hidden md:grid md:grid-rows-2 flex-1 min-h-0" style={{ gridTemplateRows: '1fr 1fr' }}>
            {/* Canvas — row 1 of 2 (50%) */}
            <div className="min-h-0 relative overflow-hidden">
              <AgentCanvas onNodeClick={handleNodeClick} />
              {selectedAgentId && selectedPos && (
                <AgentDetailPanel
                  agentId={selectedAgentId}
                  onClose={() => { selectAgent(null); setSelectedPos(null); }}
                  position={selectedPos}
                />
              )}
            </div>

            {/* Tabbed Console — row 2 of 2 (50%) */}
            <div className="flex flex-col min-h-0 border-t border-[var(--border-subtle)] bg-[var(--panel-bg)]/95">
              {/* Tab bar */}
              <div className="flex items-center shrink-0 border-b border-[var(--border-subtle)] bg-[var(--tab-bar-bg)]/80">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`tab-btn rounded-none border-0 border-b-2 px-5 py-3 uppercase tracking-wider ${activeTab === tab.key ? 'active' : ''}`}
                  >
                    <span className="text-[10px] mr-1.5">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {activeTab === 'logs' && <AgentLogPanel projectId={projectId} />}
                {activeTab === 'progress' && <AgentProgressPanel />}
                {activeTab === 'files' && <AgentFilesPanel onFileClick={setPreviewFile} />}
              </div>
            </div>
          </div>

          {/* ── Mobile layout ── */}
          <div className="md:hidden flex flex-col flex-1 min-h-0">
            {/* Mobile canvas — 45% */}
            <div className="relative h-[45%] min-h-[180px] shrink-0 overflow-hidden">
              <AgentCanvas onNodeClick={handleNodeClick} />
              {selectedAgentId && selectedPos && (
                <AgentDetailPanel
                  agentId={selectedAgentId}
                  onClose={() => { selectAgent(null); setSelectedPos(null); }}
                  position={selectedPos}
                />
              )}
            </div>

            {/* Mobile tabs — 55% */}
            <div className="flex flex-col flex-1 min-h-0 border-t border-[var(--border-subtle)] bg-[var(--panel-bg)]/95">
              <div className="flex shrink-0 border-b border-[var(--border-subtle)] bg-[var(--tab-bar-bg)]/80">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`tab-btn flex-1 rounded-none border-0 border-b-2 py-2.5 uppercase tracking-wider ${
                      activeTab === tab.key ? 'active' : ''
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                {activeTab === 'logs' && <AgentLogPanel projectId={projectId} />}
                {activeTab === 'progress' && <AgentProgressPanel />}
                {activeTab === 'files' && <AgentFilesPanel onFileClick={setPreviewFile} />}
              </div>
            </div>
          </div>
        </>
      )}

      {previewFile && <FilePreviewModal file={previewFile} projectId={projectId} onClose={() => setPreviewFile(null)} />}
    </div>
  );
}

/* ═══════════ Progress Panel (bottom console center column) ═══════════ */

/** @description Per-agent progress bars — full-height tabbed view */
function AgentProgressPanel() {
  const agents = useDashboardStore((s) => s.agents);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {agents
          .filter((a) => a.type !== 'orchestrator')
          .map((agent) => (
            <div key={agent.id} className="group">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: agent.color, boxShadow: `0 0 8px ${agent.color}50` }} />
                  <span className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider font-medium" style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}>
                    {agent.type as string}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-[var(--text-tertiary)] font-medium" style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}>
                    {agent.status === 'working' ? 'ACTIVE' : agent.status === 'done' ? 'DONE' : agent.status === 'error' ? 'FAIL' : 'IDLE'}
                  </span>
                  <span className="text-[12px] font-bold tabular-nums" style={{ color: agent.color, fontFamily: "var(--font-display, 'Syne', sans-serif)" }}>
                    {Math.round(agent.progress)}%
                  </span>
                </div>
              </div>
              <div className="h-[5px] bg-[var(--muted-border)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${agent.progress}%`, backgroundColor: agent.color, boxShadow: `0 0 12px ${agent.color}60` }}
                />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
