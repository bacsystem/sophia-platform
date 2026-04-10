import path from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '../../lib/prisma.js';
import { getAnthropicClient } from '../../lib/anthropic.js';
import { checkRateLimit } from '../../lib/redis.js';
import { validateSpecOutput, type DocType } from './spec.validator.js';
import type { SseEvent } from './spec.stream.js';
import type { UpdateSpecBody } from './spec.schema.js';

// ---------------------------------------------------------------------------
// Prompt directory — resolve relative to this file (works in both src and dist)
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// apps/api/src/modules/spec → 5 levels up → repo root → skills/spec-agent
const SPEC_AGENT_DIR = path.resolve(__dirname, '../../../../../skills/spec-agent');

const RETRY_DELAYS_MS = [1000, 2000, 4000];
const MAX_RETRIES = 3;
const DOC_TIMEOUT_MS = 90_000;
const RATE_LIMIT_PROJECT = { max: 10, windowSecs: 3600 };
const RATE_LIMIT_USER = { max: 50, windowSecs: 86400 };

// ---------------------------------------------------------------------------
// In-memory job store (MVP — single process)
// ---------------------------------------------------------------------------
interface SpecJob {
  jobId: string;
  projectId: string;
  status: 'running' | 'done' | 'error';
  events: SseEvent[];
  listeners: Set<(event: SseEvent) => void>;
}

const jobs = new Map<string, SpecJob>();

/** TTL for completed/errored jobs — 10 minutes. */
const JOB_TTL_MS = 10 * 60 * 1000;

/** Schedules cleanup of a completed job after TTL. */
function scheduleJobCleanup(jobId: string): void {
  setTimeout(() => {
    jobs.delete(jobId);
  }, JOB_TTL_MS).unref();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Reads a prompt template file from the spec-agent skills directory. */
async function readPrompt(filename: string): Promise<string> {
  return readFile(path.join(SPEC_AGENT_DIR, filename), 'utf-8');
}

/** Replaces {variable} placeholders in a prompt template. */
function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

/** Emits an SSE event to the job's buffered history and all live listeners. */
function emitJobEvent(job: SpecJob, event: SseEvent): void {
  job.events.push(event);
  for (const listener of job.listeners) {
    try {
      listener(event);
    } catch {
      // Ignore listener errors — client may have disconnected
    }
  }
}

/** Returns the next available version number for a project's spec. */
async function getNextVersion(projectId: string): Promise<number> {
  const latest = await prisma.projectSpec.findFirst({
    where: { projectId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}

/**
 * Calls Claude for one document with streaming on the first attempt.
 * Retries up to MAX_RETRIES times for API errors or validation failures.
 * Returns the final content and validity status.
 */
async function generateDocument(
  anthropic: Anthropic,
  systemPrompt: string,
  userPrompt: string,
  docType: DocType,
  onChunk: (text: string) => void,
): Promise<{ content: string; valid: boolean; missingRequirements: string[] }> {
  let lastContent = '';
  let currentPrompt = userPrompt;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(new Error(`Timeout after ${DOC_TIMEOUT_MS / 1000}s`)), DOC_TIMEOUT_MS);

    try {
      let accumulated = '';

      if (attempt === 0) {
        // First attempt: use streaming
        const stream = anthropic.messages.stream(
          {
            model: 'claude-sonnet-4-6',
            max_tokens: 16000,
            system: systemPrompt,
            messages: [{ role: 'user', content: currentPrompt }],
          },
          { signal: ac.signal },
        );

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            accumulated += event.delta.text;
            onChunk(event.delta.text);
          }
        }
      } else {
        // Retries: non-streaming (validation feedback included in prompt)
        const message = await anthropic.messages.create(
          {
            model: 'claude-sonnet-4-6',
            max_tokens: 16000,
            system: systemPrompt,
            messages: [{ role: 'user', content: currentPrompt }],
          },
          { signal: ac.signal },
        );
        const block = message.content.find((b) => b.type === 'text');
        accumulated = block?.type === 'text' ? block.text : '';
      }

      lastContent = accumulated;
      const result = validateSpecOutput(accumulated, docType);

      if (result.valid) {
        return { content: accumulated, valid: true, missingRequirements: [] };
      }

      // Validation failed — build corrective prompt for next retry
      currentPrompt =
        `${userPrompt}\n\n---\n` +
        `ATENCIÓN: El documento anterior fue rechazado por faltarle las siguientes secciones obligatorias:\n` +
        result.missingRequirements.map((r) => `- ${r}`).join('\n') +
        `\nPor favor incluye todas las secciones faltantes en tu nueva respuesta.`;
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
        // C3: auth errors → immediate fail, no retry
        throw Object.assign(new Error('ANTHROPIC_AUTH_ERROR'), {
          code: 'ANTHROPIC_AUTH_ERROR',
          retryable: false,
        });
      }
      if (err instanceof Anthropic.RateLimitError) {
        // C3: rate limit → retry after backoff
        const delay = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      if (attempt < MAX_RETRIES - 1) {
        // Transient error → retry
        const delay = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      // All retries exhausted
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Exhausted retries — return last content as invalid (C1)
  const finalResult = validateSpecOutput(lastContent, docType);
  return {
    content: lastContent,
    valid: false,
    missingRequirements: finalResult.missingRequirements,
  };
}

/** Background generation runner — runs 3 sequential Claude calls. */
async function runGeneration(job: SpecJob, project: {
  id: string;
  name: string;
  description: string;
  stack: string;
  config: unknown;
}): Promise<void> {
  const specContent: Record<string, string> = { spec: '', dataModel: '', apiDesign: '' };
  let allValid = true;

  try {
    const anthropic = getAnthropicClient();

    const [systemPrompt, specPromptTpl, dataModelPromptTpl, apiDesignPromptTpl] = await Promise.all([
      readPrompt('system.md'),
      readPrompt('spec.md'),
      readPrompt('data-model.md'),
      readPrompt('api-design.md'),
    ]);

    const baseVars: Record<string, string> = {
      'project.name': project.name,
      'project.description': project.description,
      'project.stack': project.stack,
      'project.config': JSON.stringify(project.config),
    };

    // --- Document 1: spec.md ---
    emitJobEvent(job, { type: 'start', file: 'spec.md', step: 1, totalSteps: 3 });
    const specResult = await generateDocument(
      anthropic,
      systemPrompt,
      fillTemplate(specPromptTpl, baseVars),
      'spec',
      (chunk) => emitJobEvent(job, { type: 'chunk', file: 'spec.md', content: chunk }),
    );
    specContent.spec = specResult.content;
    if (!specResult.valid) allValid = false;
    emitJobEvent(job, { type: 'validated', file: 'spec.md', valid: specResult.valid });

    // --- Document 2: data-model.md ---
    emitJobEvent(job, { type: 'start', file: 'data-model.md', step: 2, totalSteps: 3 });
    const dataModelResult = await generateDocument(
      anthropic,
      systemPrompt,
      fillTemplate(dataModelPromptTpl, { ...baseVars, 'spec.content': specContent.spec }),
      'dataModel',
      (chunk) => emitJobEvent(job, { type: 'chunk', file: 'data-model.md', content: chunk }),
    );
    specContent.dataModel = dataModelResult.content;
    if (!dataModelResult.valid) allValid = false;
    emitJobEvent(job, { type: 'validated', file: 'data-model.md', valid: dataModelResult.valid });

    // --- Document 3: api-design.md ---
    emitJobEvent(job, { type: 'start', file: 'api-design.md', step: 3, totalSteps: 3 });
    const apiDesignResult = await generateDocument(
      anthropic,
      systemPrompt,
      fillTemplate(apiDesignPromptTpl, {
        ...baseVars,
        'spec.content': specContent.spec,
        'dataModel.content': specContent.dataModel,
      }),
      'apiDesign',
      (chunk) => emitJobEvent(job, { type: 'chunk', file: 'api-design.md', content: chunk }),
    );
    specContent.apiDesign = apiDesignResult.content;
    if (!apiDesignResult.valid) allValid = false;
    emitJobEvent(job, { type: 'validated', file: 'api-design.md', valid: apiDesignResult.valid });

    // --- Save to DB ---
    const nextVersion = await getNextVersion(job.projectId);
    await prisma.projectSpec.create({
      data: {
        projectId: job.projectId,
        version: nextVersion,
        content: {
          spec: specContent.spec,
          dataModel: specContent.dataModel,
          apiDesign: specContent.apiDesign,
        },
        source: 'generated',
        valid: allValid,
      },
    });

    emitJobEvent(job, {
      type: 'done',
      version: nextVersion,
      files: ['spec.md', 'data-model.md', 'api-design.md'],
    });
    job.status = 'done';
    scheduleJobCleanup(job.jobId);
  } catch (err) {
    const isAuthError = (err as { code?: string }).code === 'ANTHROPIC_AUTH_ERROR';
    const isConfigError = (err as Error).message?.includes('ANTHROPIC_API_KEY');
    const rawMessage = (err as Error).message ?? 'Error desconocido';

    // Classify error for user-facing message
    let userMessage: string;
    let retryable: boolean;
    if (isAuthError) {
      userMessage = 'Error de autenticación con Anthropic API';
      retryable = false;
    } else if (isConfigError) {
      userMessage = 'El servicio de generación no está disponible';
      retryable = false;
    } else {
      userMessage = rawMessage;
      retryable = true;
    }

    // Try to save partial content (C1 — save what we have with valid:false)
    const hasPartial =
      specContent.spec.length > 0 ||
      specContent.dataModel.length > 0 ||
      specContent.apiDesign.length > 0;

    if (hasPartial) {
      try {
        const nextVersion = await getNextVersion(job.projectId);
        await prisma.projectSpec.create({
          data: {
            projectId: job.projectId,
            version: nextVersion,
            content: specContent,
            source: 'generated',
            valid: false,
          },
        });
      } catch {
        // Ignore DB error during error path
      }
    }

    // Determine which file failed
    const failedFile =
      specContent.spec === '' ? 'spec.md' :
      specContent.dataModel === '' ? 'data-model.md' :
      'api-design.md';

    emitJobEvent(job, {
      type: 'error',
      file: failedFile,
      message: userMessage,
      retryable,
    });
    job.status = 'error';
    scheduleJobCleanup(job.jobId);
  }
}

// ---------------------------------------------------------------------------
// Public API — HU-11 Generate + Stream
// ---------------------------------------------------------------------------

/**
 * @description Validates project ownership/state, checks rate limits, creates
 * an in-memory job, and kicks off background spec generation. Returns the jobId
 * immediately (202 pattern).
 */
export async function startSpecGeneration(
  projectId: string,
  userId: string,
): Promise<{ jobId: string; message: string }> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
  });

  if (!project) {
    throw Object.assign(new Error('Proyecto no encontrado'), { code: 'PROJECT_NOT_FOUND', status: 404 });
  }
  if (project.status !== 'idle') {
    throw Object.assign(
      new Error("Solo se puede generar spec de un proyecto en estado 'idle'"),
      { code: 'INVALID_STATE', status: 400 },
    );
  }
  if (project.description.length < 20) {
    throw Object.assign(
      new Error('La descripción debe tener al menos 20 caracteres'),
      { code: 'DESCRIPTION_TOO_SHORT', status: 422 },
    );
  }

  // Pre-validate ANTHROPIC_API_KEY before background job
  if (!process.env.ANTHROPIC_API_KEY) {
    throw Object.assign(
      new Error('El servicio de generación no está disponible: falta configuración del sistema'),
      { code: 'SERVICE_UNAVAILABLE', status: 503 },
    );
  }

  // Rate limits
  const rl1 = await checkRateLimit(`spec:gen:${projectId}`, RATE_LIMIT_PROJECT.max, RATE_LIMIT_PROJECT.windowSecs);
  if (!rl1.allowed) {
    throw Object.assign(
      new Error('Máximo 10 generaciones por hora por proyecto'),
      { code: 'GENERATION_LIMIT', status: 429, retryAfter: rl1.retryAfter },
    );
  }
  const rl2 = await checkRateLimit(`spec:gen:user:${userId}`, RATE_LIMIT_USER.max, RATE_LIMIT_USER.windowSecs);
  if (!rl2.allowed) {
    throw Object.assign(
      new Error('Máximo 50 generaciones por día por usuario'),
      { code: 'GENERATION_LIMIT', status: 429, retryAfter: rl2.retryAfter },
    );
  }

  const jobId = randomUUID();
  const job: SpecJob = {
    jobId,
    projectId,
    status: 'running',
    events: [],
    listeners: new Set(),
  };
  jobs.set(jobId, job);

  // Kick off background generation (intentionally not awaited)
  void runGeneration(job, project);

  return { jobId, message: 'Generación iniciada' };
}

/**
 * @description Subscribes an SSE client to a spec generation job. Sends all
 * buffered events immediately, then registers for future events. Returns an
 * unsubscribe function, or null if the job is not found.
 */
export function subscribeToSpecJob(
  jobId: string,
  projectId: string,
  onEvent: (event: SseEvent) => void,
): (() => void) | null {
  const job = jobs.get(jobId);
  if (!job || job.projectId !== projectId) return null;

  // Replay buffered events (C2 reconnection)
  for (const event of job.events) {
    try {
      onEvent(event);
    } catch {
      // Ignore
    }
  }

  if (job.status !== 'running') {
    return () => { /* already done */ };
  }

  job.listeners.add(onEvent);
  return () => {
    job.listeners.delete(onEvent);
  };
}

// ---------------------------------------------------------------------------
// Job recovery — when in-memory job is lost (server restart)
// ---------------------------------------------------------------------------

/**
 * @description Checks if a spec exists in DB for a project. Used as fallback
 * when an SSE client reconnects but the in-memory job was lost (e.g., after
 * server restart in dev). Returns the latest version or null.
 */
export async function recoverSpecJob(
  projectId: string,
): Promise<{ version: number } | null> {
  const spec = await prisma.projectSpec.findFirst({
    where: { projectId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  return spec ? { version: spec.version } : null;
}

// ---------------------------------------------------------------------------
// Public API — HU-12 View / Edit Spec (T017)
// ---------------------------------------------------------------------------

/** @description Returns the latest spec version for a project. Throws 404 if none. */
export async function getSpec(projectId: string, userId: string) {
  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!project) {
    throw Object.assign(new Error('Proyecto no encontrado'), { code: 'PROJECT_NOT_FOUND', status: 404 });
  }

  const spec = await prisma.projectSpec.findFirst({
    where: { projectId },
    orderBy: { version: 'desc' },
  });
  if (!spec) {
    throw Object.assign(new Error('Este proyecto no tiene spec generado'), { code: 'NO_SPEC', status: 404 });
  }

  const content = spec.content as { spec?: string; dataModel?: string; apiDesign?: string };
  return {
    version: spec.version,
    files: {
      spec: content.spec ?? '',
      dataModel: content.dataModel ?? '',
      apiDesign: content.apiDesign ?? '',
    },
    source: spec.source,
    valid: spec.valid,
    createdAt: spec.createdAt,
  };
}

/** @description Lists all spec versions for a project (summary, no content). */
export async function getSpecVersions(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!project) {
    throw Object.assign(new Error('Proyecto no encontrado'), { code: 'PROJECT_NOT_FOUND', status: 404 });
  }

  const specs = await prisma.projectSpec.findMany({
    where: { projectId },
    orderBy: { version: 'desc' },
    select: { version: true, createdAt: true, source: true, valid: true },
  });

  return specs;
}

/** @description Returns a specific spec version by number. Throws 404 if not found. */
export async function getSpecVersion(projectId: string, version: number, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!project) {
    throw Object.assign(new Error('Proyecto no encontrado'), { code: 'PROJECT_NOT_FOUND', status: 404 });
  }

  const spec = await prisma.projectSpec.findUnique({
    where: { uq_project_specs_version: { projectId, version } },
  });
  if (!spec) {
    throw Object.assign(new Error('Versión no encontrada'), { code: 'VERSION_NOT_FOUND', status: 404 });
  }

  const content = spec.content as { spec?: string; dataModel?: string; apiDesign?: string };
  return {
    version: spec.version,
    files: {
      spec: content.spec ?? '',
      dataModel: content.dataModel ?? '',
      apiDesign: content.apiDesign ?? '',
    },
    source: spec.source,
    valid: spec.valid,
    createdAt: spec.createdAt,
  };
}

/** @description Saves a manual edit as a new spec version. Returns the new version number. */
export async function updateSpec(
  projectId: string,
  userId: string,
  body: UpdateSpecBody,
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!project) {
    throw Object.assign(new Error('Proyecto no encontrado'), { code: 'PROJECT_NOT_FOUND', status: 404 });
  }

  const nextVersion = await getNextVersion(projectId);
  const spec = await prisma.projectSpec.create({
    data: {
      projectId,
      version: nextVersion,
      content: {
        spec: body.files.spec,
        dataModel: body.files.dataModel,
        apiDesign: body.files.apiDesign,
      },
      source: 'manual',
      valid: true,
    },
    select: { version: true, source: true, createdAt: true },
  });

  return spec;
}
