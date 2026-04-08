import prisma from '../../lib/prisma.js';
import type { Prisma } from '@prisma/client';

/** @description Returns all agents for a project with filesCreated count. */
export async function listAgents(projectId: string) {
  const agents = await prisma.agent.findMany({
    where: { projectId },
    orderBy: { layer: 'asc' },
    include: {
      _count: { select: { generatedFiles: true } },
    },
  });

  return agents.map((a) => ({
    id: a.id,
    type: a.type,
    status: a.status,
    progress: a.progress,
    currentTask: a.currentTask,
    tokensInput: a.tokensInput,
    tokensOutput: a.tokensOutput,
    layer: a.layer,
    filesCreated: a._count.generatedFiles,
    error: a.error,
    startedAt: a.startedAt,
    completedAt: a.completedAt,
  }));
}

/** @description Returns paginated logs for a project, optionally filtered by agentType and/or log type. */
export async function listLogs(
  projectId: string,
  page: number,
  limit: number,
  agentType?: string,
  type?: string,
) {
  const where: Prisma.AgentLogWhereInput = { projectId };

  if (agentType) {
    where.agent = { type: agentType };
  }
  if (type) {
    where.type = type;
  }

  const [logs, total] = await Promise.all([
    prisma.agentLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { agent: { select: { type: true } } },
    }),
    prisma.agentLog.count({ where }),
  ]);

  return {
    data: logs.map((l) => ({
      id: l.id,
      agentId: l.agentId,
      agentType: l.agent.type,
      type: l.type,
      message: l.message,
      createdAt: l.createdAt,
    })),
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

/** @description Returns a project by ID, verifying user ownership. Throws if not found or unauthorized. */
export async function getProjectForUser(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, userId: true, status: true },
  });
  if (!project || project.userId !== userId) {
    throw Object.assign(new Error('Project not found'), { code: 'NOT_FOUND' });
  }
  return project;
}
