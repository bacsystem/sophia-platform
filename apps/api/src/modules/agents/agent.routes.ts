import type { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { listAgentsHandler, listLogsHandler } from './agent.controller.js';

/**
 * @description Routes for the M4 Agent Runner module.
 * GET /api/projects/:id/agents — list agents + progress
 * GET /api/projects/:id/logs  — paginated agent logs
 * (start/pause/continue/retry are handled in project.routes.ts → project.service.ts)
 */
export async function agentRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>(
    '/projects/:id/agents',
    { preHandler: [authenticate] },
    listAgentsHandler,
  );

  app.get<{ Params: { id: string }; Querystring: Record<string, string> }>(
    '/projects/:id/logs',
    { preHandler: [authenticate] },
    listLogsHandler,
  );
}
