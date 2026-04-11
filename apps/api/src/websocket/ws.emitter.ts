import type { WebSocket } from '@fastify/websocket';
import Redis from 'ioredis';

export type AgentEventType =
  | 'agent:started'
  | 'agent:progress'
  | 'agent:completed'
  | 'agent:failed'
  | 'agent:warning'
  | 'plan:generated'
  | 'quality:gate'
  | 'checkpoint:result'
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
  tokensUsed?: number;
  filesCount?: number;
  coveragePercent?: number;
  covered?: number;
  total?: number;
  missing?: string[];
  passed?: boolean;
  rerunCount?: number;
  threshold?: number;
  status?: string;
  details?: unknown[];
  reason?: string;
  timestamp: string;
}

const REDIS_CHANNEL = 'sophia:agent-events';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// Map of projectId → set of active WS connections (API server process only)
const connections = new Map<string, Set<WebSocket>>();

// Redis publisher — used by both worker and server processes
let publisher: Redis | null = null;

function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true });
    publisher.on('error', (err) => {
      console.warn('[ws.emitter] Redis publisher error:', err.message);
    });
  }
  return publisher;
}

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
 * @description Broadcasts an event to local WS connections for a project.
 */
function broadcastToLocal(event: AgentEvent): void {
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
 * @description Emits an event via Redis Pub/Sub so both API server and worker
 * processes can produce events that reach WebSocket clients.
 */
export function emitEvent(event: AgentEvent): void {
  // Publish to Redis — the subscriber in the API server broadcasts to WS clients
  const pub = getPublisher();
  pub.publish(REDIS_CHANNEL, JSON.stringify(event)).catch((err) => {
    console.warn('[ws.emitter] Redis publish failed:', (err as Error).message);
    // Fallback: try local broadcast (works if emitter is in-process with WS)
    broadcastToLocal(event);
  });
}

/**
 * @description Subscribes to Redis channel and broadcasts events to local WS clients.
 * Must be called once from the API server process at startup.
 */
export function startEventSubscriber(): void {
  const subscriber = new Redis(REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true });
  subscriber.on('error', (err) => {
    console.warn('[ws.emitter] Redis subscriber error:', err.message);
  });

  subscriber.subscribe(REDIS_CHANNEL).then(() => {
    console.log('[ws.emitter] Subscribed to agent events channel');
  }).catch((err) => {
    console.error('[ws.emitter] Failed to subscribe:', (err as Error).message);
  });

  subscriber.on('message', (_channel: string, message: string) => {
    try {
      const event = JSON.parse(message) as AgentEvent;
      broadcastToLocal(event);
    } catch {
      // Ignore malformed messages
    }
  });
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
