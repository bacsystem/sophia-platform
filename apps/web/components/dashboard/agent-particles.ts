/** @description Particle system — neon data-stream particles traveling along active connections */

import type { RenderContext } from './agent-canvas-renderer';
import type { AgentNode } from '@/hooks/use-dashboard-store';
import { CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT } from '@/lib/agent-config';

export interface ActiveConnection {
  from: AgentNode;
  to: AgentNode;
}

export interface Particle {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  progress: number;
  speed: number;
  createdAt: number;
  size: number;
}

const PARTICLE_LIFETIME_MS = 1400;
const SPAWN_INTERVAL_MS = 150;
const MAX_PARTICLES = 40;

export interface ParticleSystem {
  particles: Particle[];
  lastSpawnTime: number;
}

/** @description Creates a new empty particle system */
export function createParticleSystem(): ParticleSystem {
  return { particles: [], lastSpawnTime: 0 };
}

/** @description Updates particles — spawns on random active connections, advances existing */
export function updateParticles(
  system: ParticleSystem,
  activeConnections: ActiveConnection[],
  now: number,
): void {
  if (activeConnections.length > 0 && now - system.lastSpawnTime > SPAWN_INTERVAL_MS && system.particles.length < MAX_PARTICLES) {
    const conn = activeConnections[Math.floor(Math.random() * activeConnections.length)];
    system.particles.push({
      fromX: conn.from.cx,
      fromY: conn.from.cy,
      toX: conn.to.cx,
      toY: conn.to.cy,
      color: conn.to.color,
      progress: 0,
      speed: 1 / PARTICLE_LIFETIME_MS,
      createdAt: now,
      size: 2 + Math.random() * 2.5,
    });
    system.lastSpawnTime = now;
  }

  system.particles = system.particles.filter((p) => {
    p.progress = Math.min(1, (now - p.createdAt) * p.speed);
    return p.progress < 1;
  });
}

/** @description Renders particles with ease-in-out motion, glow, and bright core */
export function drawParticles(rc: RenderContext, system: ParticleSystem): void {
  const { ctx, width, height } = rc;
  const sx = width / CANVAS_LOGICAL_WIDTH;
  const sy = height / CANVAS_LOGICAL_HEIGHT;
  const scale = Math.min(sx, sy);

  for (const p of system.particles) {
    const t = p.progress;
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const hx = (p.fromX + (p.toX - p.fromX) * ease) * sx;
    const hy = (p.fromY + (p.toY - p.fromY) * ease) * sy;
    const alpha = t < 0.1 ? t * 10 : t > 0.85 ? (1 - t) * 6.67 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Outer glow
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12 * scale;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(hx, hy, p.size * scale, 0, Math.PI * 2);
    ctx.fill();

    // Bright white core
    ctx.shadowBlur = 0;
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(hx, hy, p.size * scale * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
