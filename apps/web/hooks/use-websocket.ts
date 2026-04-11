'use client';

/** @description WebSocket hook with reconnection, replay via lastEventId, and typed event dispatch */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { AgentEvent } from '@/lib/ws-events';
import { LAYER_AGENTS, AGENT_CONFIGS, type AgentType } from '@/lib/agent-config';
import { useDashboardStore } from '@/hooks/use-dashboard-store';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

interface UseWebSocketOptions {
  projectId: string;
  enabled?: boolean;
}

interface UseWebSocketReturn {
  connected: boolean;
  reconnecting: boolean;
  disconnect: () => void;
}

/** @description Connects to project WebSocket, dispatches events to Zustand store, auto-reconnects */
export function useWebSocket({ projectId, enabled = true }: UseWebSocketOptions): UseWebSocketReturn {
  const [reconnecting, setReconnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const lastEventIdRef = useRef<string>('');
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const reconnectAttemptsRef = useRef(0);

  const store = useDashboardStore;

  const handleEvent = useCallback((event: AgentEvent) => {
    lastEventIdRef.current = event.timestamp;
    const state = store.getState();
    // Backend emits 'dba-agent', 'seed-agent', etc. Store uses 'dba', 'seed', etc.
    const agentType = event.agentType?.replace(/-agent$/, '') ?? undefined;

    switch (event.type) {
      case 'agent:started': {
        if (agentType) {
          state.updateAgent(agentType, {
            status: 'working',
            startedAt: event.timestamp,
            currentTask: event.message ?? null,
          });
          state.updateAgent('orchestrator', { status: 'working' });
          const layerIdx = LAYER_AGENTS.indexOf(agentType as typeof LAYER_AGENTS[number]);
          if (layerIdx >= 0) {
            const label = AGENT_CONFIGS[agentType as AgentType]?.label ?? agentType;
            state.setCurrentLayer(layerIdx + 1, label);
          }
          // Mark previous agents as queued→done is handled by completed events
          state.setActiveAgents(state.agents.filter((a) => a.status === 'working').length + 1);
        }
        state.addLog({
          id: `${event.timestamp}-started`,
          agentType: agentType ?? 'system',
          level: 'info',
          message: event.message ?? `${agentType} started`,
          timestamp: event.timestamp,
        });
        break;
      }

      case 'agent:progress': {
        if (agentType) {
          state.updateAgent(agentType, {
            progress: event.progress ?? 0,
            currentTask: event.message ?? null,
          });
          // Check if message indicates a file creation
          if (event.message?.startsWith('Created ') || event.message?.startsWith('createFile:')) {
            const filePath = event.message.replace(/^(Created |createFile: ?)/, '');
            const fileName = filePath.split('/').pop() ?? filePath;
            state.addFile({
              path: filePath,
              name: fileName,
              agentType: agentType,
              createdAt: event.timestamp,
            });
            if (agentType) {
              const agent = state.agents.find((a) => a.id === agentType);
              if (agent) {
                state.updateAgent(agentType, { filesCreated: agent.filesCreated + 1 });
              }
            }
          }
        }
        // Calculate overall progress
        const doneCount = state.agents.filter((a) => a.status === 'done').length;
        const workingProgress = event.progress ?? 0;
        const totalProgress = Math.round(((doneCount * 100 + workingProgress) / 9) * 100) / 100;
        state.setProgress(Math.min(totalProgress, 100));

        if (event.message) {
          state.addLog({
            id: `${event.timestamp}-progress`,
            agentType: agentType ?? 'system',
            level: 'info',
            message: event.message,
            timestamp: event.timestamp,
          });
        }
        break;
      }

      case 'agent:completed': {
        if (agentType) {
          state.updateAgent(agentType, {
            status: 'done',
            progress: 100,
            completedAt: event.timestamp,
            currentTask: null,
            tokensUsed: event.tokensUsed ?? 0,
            filesCreated: event.filesCount ?? 0,
          });
          state.setActiveAgents(
            Math.max(0, state.agents.filter((a) => a.status === 'working').length - 1),
          );
          // Accumulate global tokens
          if (event.tokensUsed) {
            state.setTokensUsed(state.tokensUsed + event.tokensUsed);
          }
          // Update global file count
          if (event.filesCount) {
            state.setTotalFiles(state.totalFiles + event.filesCount);
          }
        }
        // Update pipeline progress from backend
        if (event.progress !== undefined) {
          state.setProgress(event.progress);
        }
        state.addLog({
          id: `${event.timestamp}-completed`,
          agentType: agentType ?? 'system',
          level: 'ok',
          message: event.message ?? `${agentType} completed`,
          timestamp: event.timestamp,
        });
        break;
      }

      case 'agent:failed': {
        if (agentType) {
          state.updateAgent(agentType, {
            status: 'error',
            currentTask: event.message ?? null,
          });
        }
        state.setStatus('error');
        state.addLog({
          id: `${event.timestamp}-failed`,
          agentType: agentType ?? 'system',
          level: 'error',
          message: event.message ?? `${agentType} failed`,
          timestamp: event.timestamp,
        });
        break;
      }

      case 'project:paused': {
        if (agentType) {
          state.updateAgent(agentType, { status: 'paused' });
        }
        state.setStatus('paused');
        // Mark all working agents as paused
        for (const a of state.agents) {
          if (a.status === 'working') {
            state.updateAgent(a.id, { status: 'paused' });
          }
        }
        state.addLog({
          id: `${event.timestamp}-paused`,
          agentType: agentType ?? 'system',
          level: 'warn',
          message: event.message ?? 'Pipeline paused',
          timestamp: event.timestamp,
        });
        break;
      }

      case 'project:done': {
        state.setStatus('done');
        state.setProgress(100);
        state.updateAgent('orchestrator', { status: 'done', progress: 100 });
        state.addLog({
          id: `${event.timestamp}-pipeline-done`,
          agentType: 'system',
          level: 'ok',
          message: event.message ?? 'Pipeline completed successfully',
          timestamp: event.timestamp,
        });
        break;
      }

      case 'plan:generated': {
        if (event.message) {
          state.setExecutionPlan(event.message);
        }
        state.addLog({
          id: `${event.timestamp}-plan`,
          agentType: 'planner',
          level: 'ok',
          message: 'Execution plan generated',
          timestamp: event.timestamp,
        });
        break;
      }

      case 'checkpoint:result': {
        const payload = event as unknown as Record<string, unknown>;
        state.setCheckpoint({
          layer: (payload.layer as number) ?? 0,
          agentType: (payload.agentType as string) ?? '',
          status: (payload.status as 'pass' | 'warn' | 'fail') ?? 'pass',
          details: (payload.details as Array<{ severity: 'CRITICAL' | 'MEDIUM' | 'LOW'; message: string; file?: string }>) ?? [],
        });
        const level = payload.status === 'fail' ? 'error' : payload.status === 'warn' ? 'warn' : 'ok';
        state.addLog({
          id: `${event.timestamp}-checkpoint-${payload.layer}`,
          agentType: (payload.agentType as string) ?? 'system',
          level,
          message: `Checkpoint ${payload.agentType}: ${payload.status}`,
          timestamp: event.timestamp,
        });
        break;
      }

      case 'project:error': {
        state.setStatus('error');
        state.updateAgent('orchestrator', { status: 'error' });
        state.addLog({
          id: `${event.timestamp}-pipeline-failed`,
          agentType: 'system',
          level: 'error',
          message: event.message ?? 'Pipeline failed',
          timestamp: event.timestamp,
        });
        break;
      }

      case 'pipeline:interrupted': {
        const payload = event as unknown as Record<string, unknown>;
        state.setStatus('error');
        state.setInterruptedInfo({
          lastCompletedLayer: (payload.lastCompletedLayer as number) ?? 0,
          interruptedAt: (payload.interruptedAt as string) ?? event.timestamp,
        });
        state.addLog({
          id: `${event.timestamp}-interrupted`,
          agentType: 'system',
          level: 'error',
          message: `Pipeline interrupted at layer ${payload.lastCompletedLayer ?? '?'}`,
          timestamp: event.timestamp,
        });
        break;
      }

      case 'pipeline:resumed': {
        const payload = event as unknown as Record<string, unknown>;
        state.setStatus('running');
        state.setInterruptedInfo(null);
        state.addLog({
          id: `${event.timestamp}-resumed`,
          agentType: 'system',
          level: 'ok',
          message: `Pipeline resumed from layer ${payload.resumeFromLayer ?? '?'}`,
          timestamp: event.timestamp,
        });
        break;
      }
    }
  }, [store]);

  const connect = useCallback(() => {
    if (!projectId || !enabled) return;

    const url = new URL(`${WS_BASE}/ws/projects/${projectId}`);
    if (lastEventIdRef.current) {
      url.searchParams.set('since', lastEventIdRef.current);
    }

    const ws = new WebSocket(url.toString());
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      store.getState().setConnected(true);
      setReconnecting(false);
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (e) => {
      if (!mountedRef.current) return;
      try {
        const event = JSON.parse(e.data as string) as AgentEvent;
        handleEvent(event);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = (e) => {
      if (!mountedRef.current) return;
      store.getState().setConnected(false);
      // Normal closure — don't reconnect
      if (e.code === 1000) return;
      // Auth error — try refreshing the token once, then reconnect
      if (e.code === 4401) {
        if (reconnectAttemptsRef.current >= 1) return; // already tried once after refresh
        reconnectAttemptsRef.current += 1;
        fetch(`${API_URL}/api/auth/refresh`, { method: 'POST', credentials: 'include' })
          .then((res) => {
            if (res.ok && mountedRef.current) {
              reconnectTimerRef.current = setTimeout(() => {
                if (mountedRef.current) connect();
              }, 500);
            }
          })
          .catch(() => { /* give up */ });
        return;
      }
      // Cap reconnect attempts to avoid infinite loop
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) return;
      reconnectAttemptsRef.current += 1;
      setReconnecting(true);
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, RECONNECT_DELAY_MS);
    };

    ws.onerror = () => {
      // onclose will fire after onerror
      ws.close();
    };
  }, [projectId, enabled, handleEvent, store]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      store.getState().setConnected(false);
    };
  }, [connect, store]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    store.getState().setConnected(false);
  }, [store]);

  const connected = useDashboardStore((s) => s.connected);

  return { connected, reconnecting, disconnect };
}
