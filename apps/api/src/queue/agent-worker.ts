import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import type { AgentJob } from './agent-queue.js';
import { runPipeline } from '../agents/orchestrator.js';
import { detectInterruptedPipelines, emitInterruptedEvents } from '../agents/pipeline-recovery.js';

const QUEUE_NAME = 'agent-runner';
const CONCURRENCY = 3;

const connection = {
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
};

/**
 * @description BullMQ worker that processes agent pipeline jobs.
 * Each job runs the full 9-layer pipeline for a project.
 * Concurrency is capped at 3 to avoid Anthropic rate limits.
 */
export function startWorker(): Worker<AgentJob> {
  // T033: Detect interrupted pipelines on startup (non-blocking)
  detectInterruptedPipelines()
    .then((interrupted) => {
      if (interrupted.length > 0) {
        console.log(`[worker] Detected ${interrupted.length} interrupted pipeline(s)`);
        emitInterruptedEvents(interrupted);
      }
    })
    .catch((err) => {
      console.error('[worker] Failed to detect interrupted pipelines:', err.message);
    });

  const worker = new Worker<AgentJob>(
    QUEUE_NAME,
    async (job: Job<AgentJob>) => {
      const { projectId, userId } = job.data;
      console.log(`[worker] Starting pipeline for project ${projectId}`);
      await runPipeline(projectId, userId);
      console.log(`[worker] Pipeline completed for project ${projectId}`);
    },
    {
      connection,
      concurrency: CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[worker] Worker error:', err.message);
  });

  return worker;
}
