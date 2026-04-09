/** @description WebSocket event types for dashboard real-time updates. Mirrors backend ws.emitter.ts types. */

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
  progress?: number;
  message?: string;
  timestamp: string;
}

export type AgentStatusEvent = AgentEvent & {
  type: 'agent:started' | 'agent:completed' | 'agent:failed';
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
  type: 'project:done';
};

export type ProjectErrorEvent = AgentEvent & {
  type: 'project:error';
  message: string;
};

export type ProjectPausedEvent = AgentEvent & {
  type: 'project:paused';
  agentType: string;
};
