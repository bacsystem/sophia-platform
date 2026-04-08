import prisma from '../../lib/prisma.js';
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
  if (project.status === 'running') {
    return {
      error: 'CANNOT_DELETE_RUNNING',
      message: 'No se puede eliminar un proyecto en ejecución',
      status: 400,
    };
  }

  await prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
  return { data: { message: 'Proyecto eliminado' } };
}

/** Transitions project status with validation. */
async function transitionStatus(
  userId: string,
  id: string,
  fromStatus: string[],
  toStatus: string,
  errorCode: string,
  errorMessage: string,
) {
  const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });

  if (!project) {
    return { error: 'NOT_FOUND', message: 'Proyecto no encontrado', status: 404 };
  }
  if (project.userId !== userId) {
    return { error: 'FORBIDDEN', message: 'No tienes acceso a este proyecto', status: 403 };
  }
  if (!fromStatus.includes(project.status)) {
    return { error: errorCode, message: errorMessage, status: 400 };
  }

  const updated = await prisma.project.update({
    where: { id },
    data: { status: toStatus },
  });

  return { data: { id: updated.id, status: updated.status } };
}

/** Stub: changes status to running. M4 will replace with real logic. */
export async function startProject(userId: string, id: string) {
  return transitionStatus(
    userId,
    id,
    ['idle'],
    'running',
    'INVALID_STATE_TRANSITION',
    "Solo se puede iniciar desde estado 'idle'",
  );
}

/** Stub: changes status to paused. M4 will replace with real logic. */
export async function pauseProject(userId: string, id: string) {
  return transitionStatus(
    userId,
    id,
    ['running'],
    'paused',
    'INVALID_STATE_TRANSITION',
    'Solo se puede pausar un proyecto en ejecución',
  );
}

/** Stub: changes status back to running from paused. M4 will replace with real logic. */
export async function continueProject(userId: string, id: string) {
  return transitionStatus(
    userId,
    id,
    ['paused'],
    'running',
    'INVALID_STATE_TRANSITION',
    'Solo se puede continuar un proyecto pausado',
  );
}

/** Stub: retries from error state. M4 will replace with real logic. */
export async function retryProject(userId: string, id: string) {
  return transitionStatus(
    userId,
    id,
    ['error'],
    'running',
    'INVALID_STATE_TRANSITION',
    "Solo se puede reintentar desde estado 'error'",
  );
}
