import type { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { listTemplatesHandler } from './template.controller.js';

/** Routes for the templates module. */
export async function templateRoutes(app: FastifyInstance) {
  app.get('/templates', { preHandler: [authenticate] }, listTemplatesHandler);
}
