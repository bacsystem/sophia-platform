import fs from 'node:fs/promises';
import path from 'node:path';
import prisma from '../lib/prisma.js';
import { getRedisClient } from '../lib/redis.js';
import { runAgent } from './base-agent.js';
import { buildTaskPrompt } from './context-builder.js';
import { emitEvent, buildEvent } from '../websocket/ws.emitter.js';
import { getNextLayers, AGENT_GRAPH } from './dependency-graph.js';
import type { LayerNode } from './dependency-graph.js';

import { fileURLToPath } from 'node:url';

const PAUSE_POLL_MS = 2000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKILLS_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'skills');
const PROJECTS_BASE_DIR = path.resolve(
  process.env.PROJECTS_BASE_DIR ?? path.join(__dirname, '..', '..', '..', '..', 'projects'),
);

/**
 * @description Composes a complete agent system prompt by prepending shared skill files
 * before the agent-specific system.md content.
 * Order: conventions → anti-patterns → output-format → agent system.md
 */
export function composeSystemPrompt(sharedSkills: string[], agentSystemMd: string): string {
  if (sharedSkills.length === 0) return agentSystemMd;
  return [...sharedSkills, agentSystemMd].join('\n\n---\n\n');
}

/**
 * @description Loads all shared skill files from skills/_shared/ directory.
 * Must be called once per pipeline run (not per layer).
 * Order: conventions.md → anti-patterns.md → output-format.md
 */
export async function loadSharedSkills(): Promise<string[]> {
  const sharedFiles = ['conventions.md', 'anti-patterns.md', 'output-format.md'];
  return Promise.all(sharedFiles.map((f) => readSkillFile(`_shared/${f}`)));
}

const MAX_MEMORY_CHARS = 20_000; // ≈ 5000 tokens at 4 chars/token

/**
 * @description Appends a memory section for a completed agent layer to project_memory.md.
 * Creates the memory directory and file if they don't exist.
 * Caps the total file at MAX_MEMORY_CHARS by discarding oldest sections first.
 */
export async function appendProjectMemory(
  projectDir: string,
  layer: number,
  agentType: string,
  summary: string,
): Promise<void> {
  const memoryDir = path.join(projectDir, 'memory');
  const memoryFile = path.join(memoryDir, 'project_memory.md');

  await fs.mkdir(memoryDir, { recursive: true });

  let existing = '';
  try {
    existing = await fs.readFile(memoryFile, 'utf8');
  } catch {
    // File doesn't exist yet — start fresh
  }

  const section = `\n## Layer ${layer}: ${agentType}\n### Summary\n${summary.trim()}\n`;
  let combined = existing + section;

  // Cap at MAX_MEMORY_CHARS by removing oldest layer sections
  if (combined.length > MAX_MEMORY_CHARS) {
    const sections = combined.split(/\n(?=## Layer )/);
    while (combined.length > MAX_MEMORY_CHARS && sections.length > 1) {
      sections.shift(); // remove oldest section
      combined = sections.join('\n## Layer ');
    }
  }

  await fs.writeFile(memoryFile, combined, 'utf8');
}

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
  const redis = getRedisClient();
  const val = await redis.get(`project:pause:${projectId}`);
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
 * @description Writes the latest spec content from the DB into the project directory
 * so agents can read spec.md, data-model.md, and api-design.md via the readFile tool.
 */
async function materializeSpec(projectId: string, projectDir: string): Promise<void> {
  const spec = await prisma.projectSpec.findFirst({
    where: { projectId },
    orderBy: { version: 'desc' },
    select: { content: true },
  });
  if (!spec?.content) return;

  const content = spec.content as Record<string, string>;
  const files: [string, string | undefined][] = [
    ['spec.md', content.spec],
    ['data-model.md', content.dataModel],
    ['api-design.md', content.apiDesign],
  ];

  for (const [name, text] of files) {
    if (text && text.length > 0) {
      await fs.writeFile(path.join(projectDir, name), text, 'utf8');
    }
  }
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

  // Materialize spec files from DB into the project directory so agents can read them
  await materializeSpec(projectId, projectDir);

  // Load shared skills once for the entire pipeline (not per layer)
  const sharedSkills = await loadSharedSkills();

  // Build set of already-completed layers for retry support
  const completedAgents = await prisma.agent.findMany({
    where: { projectId, status: 'completed' },
    select: { layer: true },
  });
  const completedLayerNums = new Set<number>(completedAgents.map((a) => a.layer));

  // Update project status to 'running'
  await prisma.project.update({
    where: { id: projectId },
    data: { status: 'running' },
  });

  const totalLayers = AGENT_GRAPH.length;

  try {
    while (true) {
      const batch = getNextLayers(completedLayerNums);
      if (batch.length === 0) break;

      // Check pause before starting this batch
      if (await isPaused(projectId)) {
        const firstLayer = batch[0];
        const lastGenFile = await prisma.generatedFile.findFirst({
          where: { projectId },
          orderBy: { createdAt: 'desc' },
          select: { path: true },
        });
        emitEvent(buildEvent('project:paused', projectId, {
          agentType: firstLayer.type,
          layer: firstLayer.layer,
          layerName: firstLayer.type.replace('-agent', ''),
          lastFile: lastGenFile?.path ?? null,
        }));
        await prisma.project.update({ where: { id: projectId }, data: { status: 'paused' } });

        const resumed = await waitForResume(projectId);
        if (!resumed) {
          throw new Error('Pipeline cancelled: pause timeout exceeded');
        }

        await prisma.project.update({ where: { id: projectId }, data: { status: 'running' } });
        for (const layerDef of batch) {
          emitEvent(buildEvent('agent:started', projectId, { agentType: layerDef.type, layer: layerDef.layer, message: 'Resumed' }));
        }
      }

      // Run all batch layers in parallel
      await Promise.all(batch.map((layerDef: LayerNode) => runLayer(layerDef, {
        projectId,
        projectDir,
        sharedSkills,
        completedLayers: new Set(completedLayerNums),
      })));

      // Mark all batch layers as completed
      for (const layerDef of batch) {
        completedLayerNums.add(layerDef.layer);
      }

      // Update progress after each batch
      const pipelineProgress = Math.round((completedLayerNums.size / totalLayers) * 100);
      const lastLayer = batch[batch.length - 1];
      await prisma.project.update({
        where: { id: projectId },
        data: { progress: pipelineProgress, currentLayer: lastLayer.layer },
      });
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

interface RunLayerContext {
  projectId: string;
  projectDir: string;
  sharedSkills: string[];
  /** Layers completed before this batch started — passed to context-builder for parallel-safe injection */
  completedLayers: Set<number>;
}

/**
 * @description Runs a single agent layer end-to-end: upsert agent record, build prompts,
 * execute runAgent, track files, append memory, emit progress.
 */
async function runLayer(layerDef: LayerNode, ctx: RunLayerContext): Promise<void> {
  const { projectId, projectDir, sharedSkills, completedLayers } = ctx;

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

  // Read skill prompts and compose with shared skills
  const agentSystemMd = await readSkillFile(layerDef.systemFile);
  const systemPrompt = composeSystemPrompt(sharedSkills, agentSystemMd);
  const taskTemplate = await readSkillFile(layerDef.taskFile);

  // Build task prompt with context from prior layers
  const taskPrompt = await buildTaskPrompt({
    projectId,
    projectDir,
    completedLayers,
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

  // Append layer completion to project memory (non-fatal)
  appendProjectMemory(projectDir, layerDef.layer, layerDef.type, result.summary).catch(() => { /* non-fatal */ });

  emitEvent(buildEvent('agent:completed', projectId, {
    agentType: layerDef.type,
    layer: layerDef.layer,
    tokensUsed: result.tokensInput + result.tokensOutput,
    filesCount: result.filesCreated.length,
  }));
}
