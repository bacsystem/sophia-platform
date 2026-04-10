/** @description Agent configuration — positions, colors, modes per agent type for Canvas rendering */

import type { AgentName } from '@sophia/shared';

export type AgentType = AgentName | 'orchestrator';

export type AgentMode = 'orchestrate' | 'write' | 'execute';

export interface AgentConfig {
  type: AgentType;
  label: string;
  sub: string;
  color: string;
  mode: AgentMode;
  layer: number;
  radius: number;
  /** Logical position on a 1000×620 canvas (scaled at render time) */
  cx: number;
  cy: number;
}

export const AGENT_CONFIGS: Record<AgentType, AgentConfig> = {
  orchestrator: { type: 'orchestrator', label: 'Agente Principal', sub: 'Pipeline Control', color: '#00d4ff', mode: 'orchestrate', layer: 0, radius: 32, cx: 500, cy: 58 },
  dba:          { type: 'dba',          label: 'DBA Agent',        sub: 'PostgreSQL',       color: '#ffb800', mode: 'write',       layer: 1, radius: 26, cx: 100, cy: 235 },
  seed:         { type: 'seed',         label: 'Seed Agent',       sub: 'Data Seeder',      color: '#84cc16', mode: 'write',       layer: 2, radius: 26, cx: 300, cy: 235 },
  backend:      { type: 'backend',      label: 'Backend Dev',      sub: 'Fastify + Prisma', color: '#a855f7', mode: 'write',       layer: 3, radius: 26, cx: 500, cy: 235 },
  frontend:     { type: 'frontend',     label: 'Frontend Dev',     sub: 'Next.js 15',       color: '#06d6a0', mode: 'write',       layer: 4, radius: 26, cx: 700, cy: 235 },
  qa:           { type: 'qa',           label: 'QA Agent',         sub: 'Testing E2E',      color: '#00ff9d', mode: 'execute',     layer: 5, radius: 26, cx: 900, cy: 235 },
  security:     { type: 'security',     label: 'Security',         sub: 'Audit & Scan',     color: '#ff3d6b', mode: 'execute',     layer: 6, radius: 26, cx: 175, cy: 475 },
  docs:         { type: 'docs',         label: 'Docs Agent',       sub: 'Documentation',    color: '#ff7c3d', mode: 'write',       layer: 7, radius: 26, cx: 400, cy: 475 },
  deploy:       { type: 'deploy',       label: 'Deploy Agent',     sub: 'Docker + CI/CD',   color: '#4f8ef7', mode: 'execute',     layer: 8, radius: 26, cx: 625, cy: 475 },
  integration:  { type: 'integration',  label: 'Integration',      sub: 'Cross-layer',      color: '#ec4899', mode: 'execute',     layer: 9, radius: 26, cx: 850, cy: 475 },
};

/** Connection map: hub-spoke from orchestrator + sequential pipeline */
export const AGENT_CONNECTIONS: Array<[AgentType, AgentType]> = [
  // Hub-spoke: orchestrator → row 1
  ['orchestrator', 'dba'],
  ['orchestrator', 'seed'],
  ['orchestrator', 'backend'],
  ['orchestrator', 'frontend'],
  ['orchestrator', 'qa'],
  // Sequential pipeline
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
export const CANVAS_LOGICAL_WIDTH = 1000;
export const CANVAS_LOGICAL_HEIGHT = 700;

/** Floating log messages shown near working nodes */
export const FLOAT_MESSAGES = [
  '→ Service created', '→ Migration OK', '→ Test pass',
  '→ Component ready', '→ Schema valid', '→ Spec parsed',
  '→ File written', '→ Index created', '→ Route added',
  '→ Processing...', '→ Validated ✓', '→ Task done',
];
