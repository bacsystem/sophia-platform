import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import type { FastifyRequest } from 'fastify';
import prisma from '../lib/prisma.js';
import { authenticateWsRequest, verifyProjectOwnership } from './ws.auth.js';
import { registerConnection, unregisterConnection, buildEvent } from './ws.emitter.js';

/**
 * @description WebSocket route for streaming agent events.
 * Endpoint: GET /ws/projects/:id
 * Auth: access_token cookie (JWT)
 * On connect: replays recent logs since ?since=<ISO> query param if provided
 */
export async function wsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/ws/projects/:id',
    { websocket: true },
    async (socket: WebSocket, req: FastifyRequest<{ Params: { id: string } }>) => {
      const projectId = req.params.id;

      // Authenticate
      let userId: string;
      try {
        userId = await authenticateWsRequest(req);
        await verifyProjectOwnership(userId, projectId);
      } catch (err) {
        const reason = (err instanceof Error ? err.message : 'Unauthorized').slice(0, 123);
        req.log.warn({ projectId, reason, hasCookies: !!req.cookies?.access_token }, 'WS auth failed');
        socket.close(4401, reason);
        return;
      }

      // Register connection for event broadcasting
      registerConnection(projectId, socket);

      // Replay missed events if ?since=<ISO> is provided
      const since = (req.query as Record<string, string>).since;
      if (since) {
        try {
          const sinceDate = new Date(since);
          const logs = await prisma.agentLog.findMany({
            where: { projectId, createdAt: { gt: sinceDate } },
            orderBy: { createdAt: 'asc' },
            take: 500,
            include: { agent: { select: { type: true, layer: true } } },
          });

          for (const log of logs) {
            const eventType =
              log.type === 'error' ? 'agent:failed'
              : log.type === 'complete' ? 'agent:completed'
              : 'agent:progress';

            const event = buildEvent(eventType as Parameters<typeof buildEvent>[0], projectId, {
                  agentType: log.agent.type,
                  layer: log.agent.layer,
                  message: log.message,
                });
            // Override timestamp with the log's actual timestamp for replay
            event.timestamp = log.createdAt.toISOString();
            socket.send(JSON.stringify(event));
          }
        } catch {
          // Non-fatal — replay failure shouldn't close the connection
        }
      }

      // Send initial connected confirmation
      socket.send(
        JSON.stringify(
          buildEvent('agent:progress', projectId, { message: 'connected' }),
        ),
      );

      socket.on('close', () => {
        unregisterConnection(projectId, socket);
      });

      socket.on('error', () => {
        unregisterConnection(projectId, socket);
      });
    },
  );
}
