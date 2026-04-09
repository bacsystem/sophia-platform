import type { WebSocket } from '@fastify/websocket';

export type AgentEventType =
  | 'agent:started'
  | 'agent:progress'
  | 'agent:completed'
  | 'agent:failed'
  | 'project:paused'
  | 'project:done'
  | 'project:error';

export interface AgentEvent {
  type: AgentEventType;
  projectId: string;
  agentType?: string;
  layer?: number;
  layerName?: string;
  progress?: number; // 0–100
  message?: string;
  lastFile?: string | null;
  timestamp: string;
}

// Map of projectId → set of active WS connections
const connections = new Map<string, Set<WebSocket>>();

/**
 * @description Registers a WebSocket connection for a project's event stream.
 */
export function registerConnection(projectId: string, ws: WebSocket): void {
  if (!connections.has(projectId)) {
    connections.set(projectId, new Set());
  }
  connections.get(projectId)!.add(ws);
}

/**
 * @description Removes a WebSocket connection when it closes.
 */
export function unregisterConnection(projectId: string, ws: WebSocket): void {
  const set = connections.get(projectId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) connections.delete(projectId);
}

/**
 * @description Emits an event to all active WS connections for a project.
 * Dead connections are cleaned up automatically.
 */
export function emitEvent(event: AgentEvent): void {
  const set = connections.get(event.projectId);
  if (!set || set.size === 0) return;

  const payload = JSON.stringify(event);
  for (const ws of set) {
    try {
      if (ws.readyState === 1 /* OPEN */) {
        ws.send(payload);
      } else {
        set.delete(ws);
      }
    } catch {
      set.delete(ws);
    }
  }
}

/**
 * @description Builds an AgentEvent with the current timestamp.
 */
export function buildEvent(
  type: AgentEventType,
  projectId: string,
  extra: Partial<Omit<AgentEvent, 'type' | 'projectId' | 'timestamp'>> = {},
): AgentEvent {
  return { type, projectId, timestamp: new Date().toISOString(), ...extra };
}
