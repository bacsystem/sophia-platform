'use client';

/** @description DashboardLayout — responsive desktop/mobile layout composing all dashboard panels */

import { useState, useCallback } from 'react';
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
import { AgentListMobile } from './agent-list-mobile';
import { DashboardEmpty } from './dashboard-empty';

interface DashboardLayoutProps {
  projectId: string;
  projectName: string;
  startedAt: string | null;
}

/** @description Main dashboard view — orchestrates canvas, panels, metrics, and controls */
export function DashboardLayout({ projectId, projectName, startedAt }: DashboardLayoutProps) {
  const status = useDashboardStore((s) => s.status);
  const activeTab = useDashboardStore((s) => s.activeTab);
  const setActiveTab = useDashboardStore((s) => s.setActiveTab);
  const selectedAgentId = useDashboardStore((s) => s.selectedAgentId);
  const selectAgent = useDashboardStore((s) => s.selectAgent);

  const [previewFile, setPreviewFile] = useState<GeneratedFile | null>(null);

  // Connect WebSocket
  useWebSocket({ projectId });

  const handleNodeClick = useCallback(
    (node: AgentNode) => {
      selectAgent(selectedAgentId === node.id ? null : node.id);
    },
    [selectedAgentId, selectAgent],
  );

  const isIdle = status === 'idle';

  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">{projectName}</h1>
        <AgentControls projectId={projectId} status={status} />
      </div>

      {/* Metrics Bar */}
      <AgentMetricsBar startedAt={startedAt} />

      {isIdle ? (
        <DashboardEmpty projectId={projectId} />
      ) : (
        <>
          {/* Desktop layout */}
          <div className="hidden md:grid md:grid-cols-[1fr_340px] gap-4 flex-1 min-h-0">
            {/* Left column — Canvas */}
            <div className="flex flex-col gap-4 min-h-0">
              <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden min-h-[300px]">
                <AgentCanvas onNodeClick={handleNodeClick} />
              </div>
              {selectedAgentId && (
                <AgentDetailPanel
                  agentId={selectedAgentId}
                  onClose={() => selectAgent(null)}
                />
              )}
            </div>

            {/* Right column — Tabs */}
            <div className="flex flex-col min-h-0 rounded-xl border border-white/10 bg-white/[0.02]">
              {/* Tab switcher */}
              <div className="flex border-b border-white/10">
                <button
                  onClick={() => setActiveTab('logs')}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    activeTab === 'logs'
                      ? 'text-white border-b-2 border-blue-500'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  Logs
                </button>
                <button
                  onClick={() => setActiveTab('files')}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    activeTab === 'files'
                      ? 'text-white border-b-2 border-blue-500'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  Archivos
                </button>
              </div>
              <div className="flex-1 overflow-auto min-h-0">
                {activeTab === 'logs' ? (
                  <AgentLogPanel />
                ) : (
                  <AgentFilesPanel onFileClick={setPreviewFile} />
                )}
              </div>
            </div>
          </div>

          {/* Mobile layout */}
          <div className="md:hidden flex flex-col gap-4 flex-1 min-h-0">
            <AgentListMobile onAgentClick={handleNodeClick} />
            <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] overflow-auto min-h-0">
              {/* Tab switcher */}
              <div className="flex border-b border-white/10 sticky top-0 bg-gray-950 z-10">
                <button
                  onClick={() => setActiveTab('logs')}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    activeTab === 'logs'
                      ? 'text-white border-b-2 border-blue-500'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  Logs
                </button>
                <button
                  onClick={() => setActiveTab('files')}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    activeTab === 'files'
                      ? 'text-white border-b-2 border-blue-500'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  Archivos
                </button>
              </div>
              <div className="min-h-0">
                {activeTab === 'logs' ? (
                  <AgentLogPanel />
                ) : (
                  <AgentFilesPanel onFileClick={setPreviewFile} />
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          projectId={projectId}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
