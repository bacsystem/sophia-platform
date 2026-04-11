import type { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import {
  createProjectHandler,
  listProjectsHandler,
  getProjectHandler,
  updateProjectHandler,
  deleteProjectHandler,
  startProjectHandler,
  pauseProjectHandler,
  continueProjectHandler,
  retryProjectHandler,
  resumeProjectHandler,
} from './project.controller.js';

/** Routes for the M2 Projects module. All routes require authentication. */
export async function projectRoutes(app: FastifyInstance) {
  app.get('/projects', { preHandler: [authenticate] }, listProjectsHandler);
  app.post('/projects', { preHandler: [authenticate] }, createProjectHandler);

  app.get<{ Params: { id: string } }>(
    '/projects/:id',
    { preHandler: [authenticate] },
    getProjectHandler,
  );
  app.patch<{ Params: { id: string } }>(
    '/projects/:id',
    { preHandler: [authenticate] },
    updateProjectHandler,
  );
  app.delete<{ Params: { id: string } }>(
    '/projects/:id',
    { preHandler: [authenticate] },
    deleteProjectHandler,
  );
  app.post<{ Params: { id: string } }>(
    '/projects/:id/start',
    { preHandler: [authenticate] },
    startProjectHandler,
  );
  app.post<{ Params: { id: string } }>(
    '/projects/:id/pause',
    { preHandler: [authenticate] },
    pauseProjectHandler,
  );
  app.post<{ Params: { id: string } }>(
    '/projects/:id/continue',
    { preHandler: [authenticate] },
    continueProjectHandler,
  );
  app.post<{ Params: { id: string } }>(
    '/projects/:id/retry',
    { preHandler: [authenticate] },
    retryProjectHandler,
  );
  app.post<{ Params: { id: string } }>(
    '/projects/:id/resume',
    { preHandler: [authenticate] },
    resumeProjectHandler,
  );
}
