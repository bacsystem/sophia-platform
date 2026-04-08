import type { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import {
  getFileTreeHandler,
  getFileContentHandler,
  getRawFileHandler,
  downloadHandler,
} from './file.controller.js';

/** @description File management routes — tree, content, raw download, ZIP */
export async function fileRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>(
    '/projects/:id/files',
    { preHandler: [authenticate] },
    getFileTreeHandler,
  );

  app.get<{ Params: { id: string; fileId: string } }>(
    '/projects/:id/files/:fileId',
    { preHandler: [authenticate] },
    getFileContentHandler,
  );

  app.get<{ Params: { id: string; fileId: string } }>(
    '/projects/:id/files/:fileId/raw',
    { preHandler: [authenticate] },
    getRawFileHandler,
  );

  app.get<{ Params: { id: string } }>(
    '/projects/:id/download',
    { preHandler: [authenticate] },
    downloadHandler,
  );
}
