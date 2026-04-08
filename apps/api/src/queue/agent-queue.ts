import { Queue } from 'bullmq';

export interface AgentJob {
  projectId: string;
  userId: string;
}

const connection = {
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
};

/** @description BullMQ queue for agent execution jobs. One job = full pipeline for a project. */
export const agentQueue = new Queue<AgentJob>('agent-runner', {
  connection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

/**
 * @description Enqueues a full agent pipeline run for a project.
 * Job timeout is 60 minutes (the entire 9-layer pipeline).
 */
export async function enqueueAgentRun(projectId: string, userId: string): Promise<string> {
  const job = await agentQueue.add(
    'run',
    { projectId, userId },
    { jobId: `project-${projectId}` },
  );
  return job.id!;
}
