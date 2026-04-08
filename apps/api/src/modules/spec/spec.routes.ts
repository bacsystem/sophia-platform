import type { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import {
  generateSpecHandler,
  specStreamHandler,
  getSpecHandler,
  getSpecVersionsHandler,
  getSpecVersionHandler,
  updateSpecHandler,
} from './spec.controller.js';

/** Routes for the spec engine module (HU-11, HU-12). */
export async function specRoutes(app: FastifyInstance) {
  // HU-11 — Generate + Stream
  app.post('/projects/:id/spec/generate', { preHandler: [authenticate] }, generateSpecHandler);
  app.get('/projects/:id/spec/stream', { preHandler: [authenticate] }, specStreamHandler);

  // HU-12 — View + Edit
  app.get('/projects/:id/spec', { preHandler: [authenticate] }, getSpecHandler);
  app.get('/projects/:id/spec/versions', { preHandler: [authenticate] }, getSpecVersionsHandler);
  app.get('/projects/:id/spec/:version', { preHandler: [authenticate] }, getSpecVersionHandler);
  app.put('/projects/:id/spec', { preHandler: [authenticate] }, updateSpecHandler);
}
