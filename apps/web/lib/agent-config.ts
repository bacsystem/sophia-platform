/** @description Agent configuration — positions, colors, radii per agent type for Canvas rendering */

import type { AgentName } from '@sophia/shared';

export type AgentType = AgentName | 'orchestrator';

export interface AgentConfig {
  type: AgentType;
  label: string;
  color: string;
  radius: number;
  /** Logical position on a 700×500 canvas (scaled at render time) */
  cx: number;
  cy: number;
}

export const AGENT_CONFIGS: Record<AgentType, AgentConfig> = {
  orchestrator: { type: 'orchestrator', label: 'Orchestrator', color: '#5b8dee', radius: 38, cx: 350, cy: 40 },
  dba:          { type: 'dba',          label: 'DBA',          color: '#f59e0b', radius: 28, cx: 120, cy: 140 },
  seed:         { type: 'seed',         label: 'Seed',         color: '#84cc16', radius: 24, cx: 280, cy: 140 },
  backend:      { type: 'backend',      label: 'Backend',      color: '#a855f7', radius: 28, cx: 120, cy: 260 },
  frontend:     { type: 'frontend',     label: 'Frontend',     color: '#06d6a0', radius: 28, cx: 280, cy: 260 },
  qa:           { type: 'qa',           label: 'QA',           color: '#10b981', radius: 28, cx: 440, cy: 260 },
  security:     { type: 'security',     label: 'Security',     color: '#ef4444', radius: 24, cx: 120, cy: 380 },
  docs:         { type: 'docs',         label: 'Docs',         color: '#f97316', radius: 26, cx: 280, cy: 380 },
  deploy:       { type: 'deploy',       label: 'Deploy',       color: '#6366f1', radius: 26, cx: 440, cy: 380 },
  integration:  { type: 'integration',  label: 'Integration',  color: '#ec4899', radius: 26, cx: 350, cy: 470 },
};

/** Sequential pipeline connections: from → to */
export const AGENT_CONNECTIONS: Array<[AgentType, AgentType]> = [
  ['orchestrator', 'dba'],
  ['dba', 'seed'],
  ['seed', 'backend'],
  ['backend', 'frontend'],
  ['frontend', 'qa'],
  ['qa', 'security'],
  ['security', 'docs'],
  ['docs', 'deploy'],
  ['deploy', 'integration'],
];

/** Pipeline layer order (0-indexed) */
export const LAYER_AGENTS: AgentName[] = [
  'dba', 'seed', 'backend', 'frontend', 'qa', 'security', 'docs', 'deploy', 'integration',
];

/** Logical canvas dimensions (scaled to actual size at render) */
export const CANVAS_LOGICAL_WIDTH = 700;
export const CANVAS_LOGICAL_HEIGHT = 500;
