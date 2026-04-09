import fs from 'node:fs/promises';
import path from 'node:path';
import prisma from '../lib/prisma.js';
import { runAgent } from './base-agent.js';
import { buildTaskPrompt } from './context-builder.js';
import { emitEvent, buildEvent } from '../websocket/ws.emitter.js';

const PROJECTS_BASE_DIR = process.env.PROJECTS_BASE_DIR ?? './projects';
const PAUSE_POLL_MS = 2000;

/** Layer definitions: ordered list of all 9 agents */
const LAYERS = [
  { type: 'dba-agent',         layer: 1,   systemFile: 'dba-agent/system.md',         taskFile: 'dba-agent/task.md' },
  { type: 'seed-agent',        layer: 1.5, systemFile: 'seed-agent/system.md',        taskFile: 'seed-agent/task.md' },
  { type: 'backend-agent',     layer: 2,   systemFile: 'backend-agent/system.md',     taskFile: 'backend-agent/task.md' },
  { type: 'frontend-agent',    layer: 3,   systemFile: 'frontend-agent/system.md',    taskFile: 'frontend-agent/task.md' },
  { type: 'qa-agent',          layer: 4,   systemFile: 'qa-agent/system.md',          taskFile: 'qa-agent/task.md' },
  { type: 'security-agent',    layer: 4.5, systemFile: 'security-agent/system.md',    taskFile: 'security-agent/task.md' },
  { type: 'docs-agent',        layer: 5,   systemFile: 'docs-agent/system.md',        taskFile: 'docs-agent/task.md' },
  { type: 'deploy-agent',      layer: 6,   systemFile: 'deploy-agent/system.md',      taskFile: 'deploy-agent/task.md' },
  { type: 'integration-agent', layer: 7,   systemFile: 'integration-agent/system.md', taskFile: 'integration-agent/task.md' },
] as const;

const SKILLS_DIR = path.resolve(process.cwd(), 'skills');

/**
 * @description Resolves the absolute project directory for a projectId.
 */
export function getProjectDir(projectId: string): string {
  return path.resolve(PROJECTS_BASE_DIR, projectId);
}

/**
 * @description Reads a skill prompt file from the skills/ directory.
 */
async function readSkillFile(relativePath: string): Promise<string> {
  return fs.readFile(path.join(SKILLS_DIR, relativePath), 'utf8');
}

/**
 * @description Checks if the project has been signalled to pause via Redis flag.
 * The flag is a Redis key: `project:pause:{projectId}`
 */
async function isPaused(projectId: string): Promise<boolean> {
  const { createClient } = await import('redis');
  const client = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' });
  await client.connect();
  const val = await client.get(`project:pause:${projectId}`);
  await client.disconnect();
  return val === '1';
}

/**
 * @description Waits until the pause flag is cleared or a timeout is reached.
 * Returns false if cancelled (pause never lifted after 1h).
 */
async function waitForResume(projectId: string): Promise<boolean> {
  const MAX_WAIT = 60 * 60 * 1000; // 1 hour
  const started = Date.now();
  while (Date.now() - started < MAX_WAIT) {
    await sleep(PAUSE_POLL_MS);
    if (!(await isPaused(projectId))) return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @description Determines the layer number to start from for a retry.
 * Returns the layer number of the first non-completed agent, or 1 if none found.
 */
async function getStartLayer(projectId: string): Promise<number> {
  const completedAgents = await prisma.agent.findMany({
    where: { projectId, status: 'completed' },
    select: { layer: true },
    orderBy: { layer: 'asc' },
  });
  if (completedAgents.length === 0) return 1;

  const completedLayers = new Set(completedAgents.map((a) => a.layer));
  const nextLayer = LAYERS.find((l) => !completedLayers.has(l.layer));
  return nextLayer ? nextLayer.layer : 1;
}

/**
 * @description Main pipeline orchestrator.
 * Runs all 9 agent layers sequentially for a project.
 * On retry, skips layers whose agents are already completed in the DB.
 */
export async function runPipeline(projectId: string, _userId: string): Promise<void> {
  const projectDir = getProjectDir(projectId);

  // Ensure project directory exists
  await fs.mkdir(projectDir, { recursive: true });

  // Determine start layer (supports retry from failed layer)
  const startLayer = await getStartLayer(projectId);

  // Update project status to 'running'
  await prisma.project.update({
    where: { id: projectId },
    data: { status: 'running' },
  });

  const totalLayers = LAYERS.length;
  // Count already-completed layers to calculate progress correctly
  let completedLayers = LAYERS.filter((l) => l.layer < startLayer).length;

  try {
    for (const layerDef of LAYERS) {
      // Skip layers already completed (retry support)
      if (layerDef.layer < startLayer) continue;

      // Check pause before starting each layer
      if (await isPaused(projectId)) {
        // Find last generated file for this project
        const lastGenFile = await prisma.generatedFile.findFirst({
          where: { projectId },
          orderBy: { createdAt: 'desc' },
          select: { path: true },
        });
        emitEvent(buildEvent('project:paused', projectId, {
          agentType: layerDef.type,
          layer: layerDef.layer,
          layerName: layerDef.type.replace('-agent', ''),
          lastFile: lastGenFile?.path ?? null,
        }));
        await prisma.project.update({ where: { id: projectId }, data: { status: 'paused' } });

        const resumed = await waitForResume(projectId);
        if (!resumed) {
          throw new Error('Pipeline cancelled: pause timeout exceeded');
        }

        await prisma.project.update({ where: { id: projectId }, data: { status: 'running' } });
        emitEvent(buildEvent('agent:started', projectId, { agentType: layerDef.type, layer: layerDef.layer, message: 'Resumed' }));
      }

      // Get or create agent record
      const agent = await prisma.agent.upsert({
        where: { uq_agents_project_type: { projectId, type: layerDef.type } },
        create: {
          projectId,
          type: layerDef.type,
          layer: layerDef.layer,
          status: 'running',
          startedAt: new Date(),
        },
        update: {
          status: 'running',
          progress: 0,
          error: null,
          startedAt: new Date(),
          completedAt: null,
        },
      });

      // Read skill prompts
      const systemPrompt = await readSkillFile(layerDef.systemFile);
      const taskTemplate = await readSkillFile(layerDef.taskFile);

      // Build task prompt with context from prior layers
      const taskPrompt = await buildTaskPrompt({
        projectId,
        projectDir,
        currentLayer: layerDef.layer,
        taskTemplate,
      });

      // Run the agent
      const result = await runAgent({
        agentId: agent.id,
        projectId,
        agentType: layerDef.type,
        layer: layerDef.layer,
        systemPrompt,
        taskPrompt,
        projectDir,
      });

      // Track generated files in DB
      if (result.filesCreated.length > 0) {
        await Promise.allSettled(
          result.filesCreated.map(async (filePath) => {
            const absPath = path.join(projectDir, filePath);
            let size = 0;
            try {
              const stat = await fs.stat(absPath);
              size = stat.size;
            } catch { /* file may have been removed */ }

            await prisma.generatedFile.upsert({
              where: { uq_generated_files_project_path: { projectId, path: filePath } },
              create: {
                projectId,
                agentId: agent.id,
                name: path.basename(filePath),
                path: filePath,
                sizeBytes: size,
                layer: layerDef.layer,
              },
              update: {
                agentId: agent.id,
                sizeBytes: size,
              },
            }).catch(() => { /* non-fatal */ });
          }),
        );
      }

      completedLayers++;
      const pipelineProgress = Math.round((completedLayers / totalLayers) * 100);

      // Persist progress and currentLayer in DB
      await prisma.project.update({
        where: { id: projectId },
        data: { progress: pipelineProgress, currentLayer: layerDef.layer },
      });

      emitEvent(buildEvent('agent:completed', projectId, {
        agentType: layerDef.type,
        layer: layerDef.layer,
        progress: pipelineProgress,
      }));
    }

    // All layers done
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'done', progress: 100 },
    });

    emitEvent(buildEvent('project:done', projectId, { progress: 100 }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'error', errorMessage: message },
    });

    emitEvent(buildEvent('project:error', projectId, { message }));
    throw err;
  }
}
