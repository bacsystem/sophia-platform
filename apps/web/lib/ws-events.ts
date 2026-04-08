/** @description WebSocket event types for dashboard real-time updates. Mirrors backend ws.emitter.ts types. */

export type AgentEventType =
  | 'agent:started'
  | 'agent:progress'
  | 'agent:completed'
  | 'agent:failed'
  | 'agent:paused'
  | 'pipeline:completed'
  | 'pipeline:failed';

export interface AgentEvent {
  type: AgentEventType;
  projectId: string;
  agentType?: string;
  layer?: number;
  progress?: number;
  message?: string;
  timestamp: string;
}

export type AgentStatusEvent = AgentEvent & {
  type: 'agent:started' | 'agent:completed' | 'agent:failed' | 'agent:paused';
  agentType: string;
  layer: number;
};

export type AgentProgressEvent = AgentEvent & {
  type: 'agent:progress';
  agentType: string;
  layer: number;
  progress: number;
  message: string;
};

export type FileCreatedEvent = AgentEvent & {
  type: 'agent:progress';
  agentType: string;
  message: string;
};

export type ProjectDoneEvent = AgentEvent & {
  type: 'pipeline:completed';
};

export type ProjectErrorEvent = AgentEvent & {
  type: 'pipeline:failed';
  message: string;
};

export type ProjectPausedEvent = AgentEvent & {
  type: 'agent:paused';
  agentType: string;
};
