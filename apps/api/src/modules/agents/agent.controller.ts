import type { FastifyRequest, FastifyReply } from 'fastify';
import { listAgents, listLogs, getProjectForUser } from './agent.service.js';
import { logsQuerySchema } from './agent.schema.js';

/** @description GET /api/projects/:id/agents — returns all agents for a project. */
export async function listAgentsHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    await getProjectForUser(request.params.id, request.user.sub);
  } catch {
    reply.status(404).send({ error: 'NOT_FOUND', message: 'Proyecto no encontrado' });
    return;
  }

  const agents = await listAgents(request.params.id);
  reply.send({ data: agents });
}

/** @description GET /api/projects/:id/logs — returns paginated agent logs. */
export async function listLogsHandler(
  request: FastifyRequest<{ Params: { id: string }; Querystring: Record<string, string> }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    await getProjectForUser(request.params.id, request.user.sub);
  } catch {
    reply.status(404).send({ error: 'NOT_FOUND', message: 'Proyecto no encontrado' });
    return;
  }

  const parsed = logsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    reply.status(422).send({ error: 'VALIDATION_ERROR', errors: parsed.error.errors });
    return;
  }

  const { page, limit, agentType, type } = parsed.data;
  const result = await listLogs(request.params.id, page, limit, agentType, type);
  reply.send(result);
}
