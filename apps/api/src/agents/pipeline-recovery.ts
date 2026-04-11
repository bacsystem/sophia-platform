import prisma from '../lib/prisma.js';
import { emitEvent, buildEvent } from '../websocket/ws.emitter.js';
import { verifyBatchOutput } from './batch-verifier.js';
import { AGENT_GRAPH } from './dependency-graph.js';

/** Threshold in minutes — pipelines not updated for longer than this are considered interrupted. */
const STALE_THRESHOLD_MINUTES = 5;

export interface InterruptedPipeline {
  id: string;
  projectId: string;
  currentLayer: number;
  completedLayers: number[];
  startedAt: Date;
  updatedAt: Date;
}

/**
 * @description Detects pipelines that are still marked as 'running' but have not been updated
 * within the STALE_THRESHOLD_MINUTES window, indicating a worker crash or restart.
 * Marks detected pipelines as 'interrupted'.
 */
export async function detectInterruptedPipelines(): Promise<InterruptedPipeline[]> {
  const threshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);

  const stale = await prisma.pipelineState.findMany({
    where: {
      status: 'running',
      updatedAt: { lt: threshold },
    },
  });

  if (stale.length === 0) return [];

  // Mark all as interrupted
  await prisma.pipelineState.updateMany({
    where: { id: { in: stale.map((s) => s.id) } },
    data: { status: 'interrupted' },
  });

  // Also update project status
  await Promise.allSettled(
    stale.map((s) =>
      prisma.project.update({
        where: { id: s.projectId },
        data: { status: 'error', errorMessage: 'Pipeline interrupted — worker restarted' },
      }),
    ),
  );

  return stale.map((s) => ({
    id: s.id,
    projectId: s.projectId,
    currentLayer: s.currentLayer,
    completedLayers: (s.completedLayers as number[]) ?? [],
    startedAt: s.startedAt,
    updatedAt: s.updatedAt,
  }));
}

/**
 * @description Verifies the last completed layer's output integrity before allowing resume.
 * Returns true if verification passes or if there's nothing to verify.
 */
export async function verifyBeforeResume(projectId: string, completedLayers: number[], projectDir: string): Promise<{ ok: boolean; reason?: string }> {
  if (completedLayers.length === 0) return { ok: true };

  const lastLayer = Math.max(...completedLayers);
  const layerDef = AGENT_GRAPH.find((l) => l.layer === lastLayer);
  if (!layerDef) return { ok: true };

  try {
    const verification = await verifyBatchOutput(layerDef, projectDir);
    if (verification.status === 'fail') {
      return {
        ok: false,
        reason: `Verification failed for layer ${lastLayer} (${layerDef.type}): ${verification.details.map((d) => d.message).join('; ')}`,
      };
    }
    return { ok: true };
  } catch {
    // Verification error is non-fatal — allow resume
    return { ok: true };
  }
}

/**
 * @description Emits pipeline:interrupted WebSocket events for each detected interrupted pipeline.
 */
export function emitInterruptedEvents(interrupted: InterruptedPipeline[]): void {
  for (const p of interrupted) {
    emitEvent(buildEvent('pipeline:interrupted', p.projectId, {
      lastCompletedLayer: p.currentLayer,
      interruptedAt: p.updatedAt.toISOString(),
    }));
  }
}
