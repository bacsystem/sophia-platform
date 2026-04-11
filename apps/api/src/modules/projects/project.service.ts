import prisma from '../../lib/prisma.js';
import { getRedisClient } from '../../lib/redis.js';
import { enqueueAgentRun } from '../../queue/agent-queue.js';
import { getProjectDir } from '../../agents/orchestrator.js';
import { verifyBeforeResume } from '../../agents/pipeline-recovery.js';
import type { CreateProjectInput, UpdateProjectInput, ListProjectsQuery } from './project.schema.js';

/** Maps currentLayer number to a human-readable layer name. */
function getLayerName(layer: number): string {
  const map: Record<number, string> = {
    1: 'Database',
    1.5: 'Seed Data',
    2: 'Backend',
    3: 'Frontend',
    4: 'Testing',
    4.5: 'Security',
    5: 'Docs',
    6: 'Deployment',
    7: 'Integration',
  };
  return map[layer] ?? 'Unknown';
}

/** Formats a raw Prisma project row into a DTO. */
function formatProject(p: {
  id: string;
  userId: string;
  name: string;
  description: string;
  stack: string;
  status: string;
  progress: number;
  currentLayer: number;
  config: unknown;
  tokensUsed: number;
  errorMessage: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    userId: p.userId,
    name: p.name,
    description: p.description,
    stack: p.stack,
    status: p.status,
    progress: p.progress,
    currentLayer: p.currentLayer,
    currentLayerName: getLayerName(p.currentLayer),
    config: p.config,
    tokensUsed: p.tokensUsed,
    errorMessage: p.errorMessage,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Creates a new project for the given user. */
export async function createProject(userId: string, input: CreateProjectInput) {
  const project = await prisma.project.create({
    data: {
      userId,
      name: input.name,
      description: input.description,
      stack: input.stack,
      config: input.config as object,
    },
  });
  return formatProject(project);
}

/** Lists projects for the given user with pagination, search and status filter. */
export async function listProjects(userId: string, query: ListProjectsQuery) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 12;
  const skip = (page - 1) * limit;

  const where = {
    userId,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? { name: { contains: query.search, mode: 'insensitive' as const } }
      : {}),
  };

  const [projects, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.project.count({ where }),
  ]);

  return {
    data: projects.map(formatProject),
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

/** Gets a single project by id, enforcing ownership. Returns 404 for deleted projects. */
export async function getProject(userId: string, id: string) {
  const project = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    include: {
      specs: {
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  });

  if (!project) {
    return { error: 'NOT_FOUND', message: 'Proyecto no encontrado', status: 404 };
  }
  if (project.userId !== userId) {
    return { error: 'FORBIDDEN', message: 'No tienes acceso a este proyecto', status: 403 };
  }

  const spec = project.specs[0] ?? null;
  return {
    data: {
      ...formatProject(project),
      spec: spec
        ? {
            id: spec.id,
            version: spec.version,
            content: spec.content,
            createdAt: spec.createdAt.toISOString(),
          }
        : null,
    },
  };
}

/** Updates a project. Only allowed when status is idle. */
export async function updateProject(userId: string, id: string, input: UpdateProjectInput) {
  const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });

  if (!project) {
    return { error: 'NOT_FOUND', message: 'Proyecto no encontrado', status: 404 };
  }
  if (project.userId !== userId) {
    return { error: 'FORBIDDEN', message: 'No tienes acceso a este proyecto', status: 403 };
  }
  if (project.status !== 'idle') {
    return {
      error: 'PROJECT_NOT_EDITABLE',
      message: "Solo se puede editar en estado 'idle'",
      status: 400,
    };
  }

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.stack !== undefined ? { stack: input.stack } : {}),
      ...(input.config !== undefined ? { config: input.config as object } : {}),
    },
  });

  return { data: formatProject(updated) };
}

/** Soft-deletes a project. Cannot delete a running project. */
export async function deleteProject(userId: string, id: string) {
  const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });

  if (!project) {
    return { error: 'NOT_FOUND', message: 'Proyecto no encontrado', status: 404 };
  }
  if (project.userId !== userId) {
    return { error: 'FORBIDDEN', message: 'No tienes acceso a este proyecto', status: 403 };
  }
  if (['running', 'pausing', 'paused'].includes(project.status)) {
    return {
      error: 'CANNOT_DELETE_RUNNING',
      message: 'No se puede eliminar un proyecto en ejecución',
      status: 400,
    };
  }

  await prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
  return { data: { message: 'Proyecto eliminado' } };
}

/** Enqueues the agent pipeline and transitions project to 'running'. */
export async function startProject(userId: string, id: string) {
  const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
  if (!project) return { error: 'NOT_FOUND', message: 'Proyecto no encontrado', status: 404 };
  if (project.userId !== userId) return { error: 'FORBIDDEN', message: 'No tienes acceso a este proyecto', status: 403 };
  if (!['idle', 'error'].includes(project.status)) {
    return { error: 'INVALID_STATE_TRANSITION', message: "Solo se puede iniciar desde estado 'idle' o 'error'", status: 400 };
  }

  const spec = await prisma.projectSpec.findFirst({ where: { projectId: id }, orderBy: { version: 'desc' } });
  if (!spec) {
    return { error: 'NO_SPEC', message: 'El proyecto debe tener spec generado antes de iniciar', status: 400 };
  }

  await prisma.project.update({ where: { id }, data: { status: 'running' } });
  const jobId = await enqueueAgentRun(id, userId);

  return { data: { id, status: 'running', jobId } };
}

/** Sets Redis pause flag so the orchestrator pauses before the next layer. */
export async function pauseProject(userId: string, id: string) {
  const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
  if (!project) return { error: 'NOT_FOUND', message: 'Proyecto no encontrado', status: 404 };
  if (project.userId !== userId) return { error: 'FORBIDDEN', message: 'No tienes acceso a este proyecto', status: 403 };
  if (project.status !== 'running') {
    return { error: 'INVALID_STATE_TRANSITION', message: 'Solo se puede pausar un proyecto en ejecución', status: 400 };
  }

  const redis = getRedisClient();
  await redis.set(`project:pause:${id}`, '1', 'EX', 3600); // auto-expire 1h

  return { data: { id, status: 'pausing' } };
}

/** Clears Redis pause flag so the orchestrator resumes. */
export async function continueProject(userId: string, id: string) {
  const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
  if (!project) return { error: 'NOT_FOUND', message: 'Proyecto no encontrado', status: 404 };
  if (project.userId !== userId) return { error: 'FORBIDDEN', message: 'No tienes acceso a este proyecto', status: 403 };
  if (!['paused', 'pausing', 'running'].includes(project.status)) {
    return { error: 'INVALID_STATE_TRANSITION', message: 'Solo se puede continuar un proyecto pausado o en proceso de pausar', status: 400 };
  }

  const redis = getRedisClient();
  await redis.del(`project:pause:${id}`);

  return { data: { id, status: 'running' } };
}

/** Re-enqueues the pipeline from error state. */
export async function retryProject(userId: string, id: string) {
  const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
  if (!project) return { error: 'NOT_FOUND', message: 'Proyecto no encontrado', status: 404 };
  if (project.userId !== userId) return { error: 'FORBIDDEN', message: 'No tienes acceso a este proyecto', status: 403 };
  if (project.status !== 'error') {
    return { error: 'INVALID_STATE_TRANSITION', message: "Solo se puede reintentar desde estado 'error'", status: 400 };
  }

  await prisma.project.update({ where: { id }, data: { status: 'running' } });
  const jobId = await enqueueAgentRun(id, userId);

  return { data: { id, status: 'running', jobId } };
}

/**
 * T034: Resumes an interrupted pipeline from the last completed checkpoint.
 * Returns 409 if the project does not have an interrupted pipeline state.
 */
export async function resumeProject(userId: string, id: string) {
  const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
  if (!project) return { error: 'NOT_FOUND', message: 'Proyecto no encontrado', status: 404 };
  if (project.userId !== userId) return { error: 'FORBIDDEN', message: 'No tienes acceso a este proyecto', status: 403 };

  // Find the latest interrupted pipeline state for this project
  const pipelineState = await prisma.pipelineState.findFirst({
    where: { projectId: id, status: 'interrupted' },
    orderBy: { updatedAt: 'desc' },
  });

  if (!pipelineState) {
    return { error: 'NOT_INTERRUPTED', message: 'No hay pipeline interrumpido para reanudar', status: 409 };
  }

  // T037: Verify integrity of last completed layer before resuming
  const completedLayers = (pipelineState.completedLayers as number[]) ?? [];
  const projectDir = getProjectDir(id);
  const verification = await verifyBeforeResume(id, completedLayers, projectDir);
  if (!verification.ok) {
    return {
      error: 'VERIFICATION_FAILED',
      message: verification.reason ?? 'La verificación del último checkpoint falló. Usa retry en su lugar.',
      status: 409,
    };
  }

  // Mark pipeline state as resumed
  await prisma.pipelineState.update({
    where: { id: pipelineState.id },
    data: { status: 'resumed' },
  });

  await prisma.project.update({ where: { id }, data: { status: 'running', errorMessage: null } });
  const jobId = await enqueueAgentRun(id, userId);

  return {
    data: {
      id,
      status: 'running',
      jobId,
      resumedFrom: {
        layer: pipelineState.currentLayer,
        completedLayers: pipelineState.completedLayers,
      },
    },
  };
}
