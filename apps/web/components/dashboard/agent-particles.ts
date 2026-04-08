/** @description Particle system — particles traveling along active connections */

import type { RenderContext } from './agent-canvas-renderer';
import type { AgentNode } from '@/hooks/use-dashboard-store';
import { CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT } from '@/lib/agent-config';

export interface Particle {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  progress: number; // 0 → 1
  speed: number;
  createdAt: number;
}

const PARTICLE_LIFETIME_MS = 2000;
const PARTICLE_RADIUS = 3;
const SPAWN_INTERVAL_MS = 400;

export interface ParticleSystem {
  particles: Particle[];
  lastSpawnTime: number;
}

/** @description Creates a new empty particle system */
export function createParticleSystem(): ParticleSystem {
  return { particles: [], lastSpawnTime: 0 };
}

/** @description Updates the particle system — spawns new particles on active connections, advances existing */
export function updateParticles(
  system: ParticleSystem,
  activeFromNode: AgentNode | null,
  activeToNode: AgentNode | null,
  now: number,
): void {
  // Spawn new particles on active connection
  if (activeFromNode && activeToNode && now - system.lastSpawnTime > SPAWN_INTERVAL_MS) {
    system.particles.push({
      fromX: activeFromNode.cx,
      fromY: activeFromNode.cy,
      toX: activeToNode.cx,
      toY: activeToNode.cy,
      color: activeToNode.color,
      progress: 0,
      speed: 1 / PARTICLE_LIFETIME_MS,
      createdAt: now,
    });
    system.lastSpawnTime = now;
  }

  // Update positions and remove expired
  system.particles = system.particles.filter((p) => {
    const age = now - p.createdAt;
    p.progress = Math.min(1, age * p.speed);
    return p.progress < 1;
  });
}

/** @description Renders all particles in the system */
export function drawParticles(rc: RenderContext, system: ParticleSystem): void {
  const { ctx, width, height } = rc;
  const sx = width / CANVAS_LOGICAL_WIDTH;
  const sy = height / CANVAS_LOGICAL_HEIGHT;
  const scale = Math.min(sx, sy);

  for (const p of system.particles) {
    const x = (p.fromX + (p.toX - p.fromX) * p.progress) * sx;
    const y = (p.fromY + (p.toY - p.fromY) * p.progress) * sy;
    const alpha = 1 - p.progress * 0.5;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, PARTICLE_RADIUS * scale, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.restore();
  }
}
