'use client';

/** @description Zustand store for dashboard state — agents, logs, files, metrics, UI */

import { create } from 'zustand';
import type { ProjectStatus, AgentName } from '@sophia/shared';
import { AGENT_CONFIGS, type AgentType } from '@/lib/agent-config';

export type AgentNodeStatus = 'idle' | 'queued' | 'working' | 'done' | 'error' | 'paused';

export interface AgentNode {
  id: string;
  type: AgentType;
  status: AgentNodeStatus;
  progress: number;
  currentTask: string | null;
  tokensUsed: number;
  filesCreated: number;
  startedAt: string | null;
  completedAt: string | null;
  color: string;
  cx: number;
  cy: number;
  radius: number;
}

export interface AgentLog {
  id: string;
  agentType: string;
  level: 'info' | 'ok' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

export interface GeneratedFile {
  path: string;
  name: string;
  agentType: string;
  createdAt: string;
  size?: number;
}

export interface DashboardSnapshot {
  agents: AgentNode[];
  logs: AgentLog[];
  files: GeneratedFile[];
  progress: number;
  currentLayer: number;
  currentLayerName: string;
  status: ProjectStatus;
  tokensUsed: number;
  totalFiles: number;
  activeAgents: number;
}

const MAX_LOGS = 200;

function buildInitialAgents(): AgentNode[] {
  const agentTypes: AgentType[] = [
    'orchestrator', 'dba', 'seed', 'backend', 'frontend',
    'qa', 'security', 'docs', 'deploy', 'integration',
  ];
  return agentTypes.map((type) => {
    const cfg = AGENT_CONFIGS[type];
    return {
      id: type,
      type,
      status: 'idle' as const,
      progress: 0,
      currentTask: null,
      tokensUsed: 0,
      filesCreated: 0,
      startedAt: null,
      completedAt: null,
      color: cfg.color,
      cx: cfg.cx,
      cy: cfg.cy,
      radius: cfg.radius,
    };
  });
}

interface DashboardStore {
  // Agents
  agents: AgentNode[];
  updateAgent: (agentId: string, update: Partial<AgentNode>) => void;

  // Logs (ring buffer)
  logs: AgentLog[];
  addLog: (log: AgentLog) => void;

  // Files
  files: GeneratedFile[];
  addFile: (file: GeneratedFile) => void;

  // Project metrics
  progress: number;
  currentLayer: number;
  currentLayerName: string;
  status: ProjectStatus;
  tokensUsed: number;
  totalFiles: number;
  activeAgents: number;

  // Execution plan
  executionPlan: string | null;

  // UI state
  connected: boolean;
  scrollPaused: boolean;
  unreadCount: number;
  selectedAgentId: string | null;
  activeTab: 'logs' | 'progress' | 'files';

  // Actions
  setConnected: (connected: boolean) => void;
  setScrollPaused: (paused: boolean) => void;
  resetUnread: () => void;
  selectAgent: (agentId: string | null) => void;
  setActiveTab: (tab: 'logs' | 'progress' | 'files') => void;
  setProgress: (progress: number) => void;
  setCurrentLayer: (layer: number, name: string) => void;
  setStatus: (status: ProjectStatus) => void;
  setTokensUsed: (tokens: number) => void;
  setTotalFiles: (count: number) => void;
  setActiveAgents: (count: number) => void;
  setExecutionPlan: (plan: string) => void;
  applySnapshot: (snapshot: DashboardSnapshot) => void;
  reset: () => void;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  // Agents
  agents: buildInitialAgents(),
  updateAgent: (agentId, update) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === agentId ? { ...a, ...update } : a)),
    })),

  // Logs
  logs: [],
  addLog: (log) =>
    set((state) => {
      if (state.logs.some((l) => l.id === log.id)) return state;
      const next = [...state.logs, log];
      return {
        logs: next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next,
        unreadCount: state.scrollPaused ? state.unreadCount + 1 : 0,
      };
    }),

  // Files
  files: [],
  addFile: (file) =>
    set((state) => ({
      files: [...state.files, file],
      totalFiles: state.totalFiles + 1,
    })),

  // Metrics
  progress: 0,
  currentLayer: 0,
  currentLayerName: '',
  status: 'idle',
  tokensUsed: 0,
  totalFiles: 0,
  activeAgents: 0,
  executionPlan: null as string | null,

  // UI
  connected: false,
  scrollPaused: false,
  unreadCount: 0,
  selectedAgentId: null,
  activeTab: 'logs',

  // Actions
  setConnected: (connected) => set({ connected }),
  setScrollPaused: (scrollPaused) => set(scrollPaused ? { scrollPaused } : { scrollPaused, unreadCount: 0 }),
  resetUnread: () => set({ unreadCount: 0 }),
  selectAgent: (selectedAgentId) => set({ selectedAgentId }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setProgress: (progress) => set({ progress }),
  setCurrentLayer: (layer, name) => set({ currentLayer: layer, currentLayerName: name }),
  setStatus: (status) => set({ status }),
  setTokensUsed: (tokensUsed) => set({ tokensUsed }),
  setTotalFiles: (totalFiles) => set({ totalFiles }),
  setActiveAgents: (count) => set({ activeAgents: count }),
  setExecutionPlan: (plan: string) => set({ executionPlan: plan }),

  applySnapshot: (snapshot) =>
    set((state) => {
      // Merge snapshot logs with live logs, deduplicating by id
      const snapshotIds = new Set(snapshot.logs.map((l) => l.id));
      const liveLogs = state.logs.filter((l) => !snapshotIds.has(l.id));
      const merged = [...snapshot.logs, ...liveLogs];
      const deduped = merged
        .filter((l, i, arr) => arr.findIndex((x) => x.id === l.id) === i)
        .slice(-MAX_LOGS);
      return {
        agents: snapshot.agents,
        logs: deduped,
        files: snapshot.files,
        progress: snapshot.progress,
        currentLayer: snapshot.currentLayer,
        currentLayerName: snapshot.currentLayerName,
        status: snapshot.status,
        tokensUsed: snapshot.tokensUsed,
        totalFiles: snapshot.totalFiles,
        activeAgents: snapshot.activeAgents,
      };
    }),

  reset: () =>
    set({
      agents: buildInitialAgents(),
      logs: [],
      files: [],
      progress: 0,
      currentLayer: 0,
      currentLayerName: '',
      status: 'idle',
      tokensUsed: 0,
      totalFiles: 0,
      activeAgents: 0,
      connected: false,
      scrollPaused: false,
      unreadCount: 0,
      selectedAgentId: null,
      activeTab: 'logs',
    }),
}));
