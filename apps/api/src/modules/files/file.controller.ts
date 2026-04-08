import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  getProjectForUser,
  getFileTree,
  getFileContent,
  getRawFile,
  downloadProject,
} from './file.service.js';
import { projectParamsSchema, fileParamsSchema } from './file.schema.js';

/** @description GET /api/projects/:id/files — file tree for a project */
export async function getFileTreeHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const parsed = projectParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    reply.status(422).send({ error: 'VALIDATION_ERROR', message: 'ID de proyecto inválido', errors: parsed.error.errors });
    return;
  }

  try {
    await getProjectForUser(parsed.data.id, request.user.sub);
  } catch {
    reply.status(404).send({ error: 'NOT_FOUND', message: 'Proyecto no encontrado' });
    return;
  }

  const tree = await getFileTree(parsed.data.id);
  reply.send({ data: tree });
}

/** @description GET /api/projects/:id/files/:fileId — file content with syntax info */
export async function getFileContentHandler(
  request: FastifyRequest<{ Params: { id: string; fileId: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const parsed = fileParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    reply.status(422).send({ error: 'VALIDATION_ERROR', message: 'Parámetros inválidos', errors: parsed.error.errors });
    return;
  }

  try {
    await getProjectForUser(parsed.data.id, request.user.sub);
  } catch {
    reply.status(404).send({ error: 'NOT_FOUND', message: 'Proyecto no encontrado' });
    return;
  }

  // Determine cache headers based on project status
  const project = await getProjectForUser(parsed.data.id, request.user.sub);

  try {
    const fileData = await getFileContent(parsed.data.id, parsed.data.fileId);

    // Cache-Control + ETag
    if (project.status === 'done') {
      reply.header('Cache-Control', 'private, max-age=3600');
    } else {
      reply.header('Cache-Control', 'private, no-cache');
    }
    reply.header('ETag', `"${fileData.createdAt}"`);

    reply.send({ data: fileData });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND' || error.code === 'FILE_NOT_FOUND') {
      reply.status(404).send({ error: 'FILE_NOT_FOUND', message: error.message });
      return;
    }
    if (error.code === 'FORBIDDEN') {
      reply.status(403).send({ error: 'FORBIDDEN', message: 'Ruta de archivo inválida' });
      return;
    }
    throw err;
  }
}

/** @description GET /api/projects/:id/files/:fileId/raw — individual file download */
export async function getRawFileHandler(
  request: FastifyRequest<{ Params: { id: string; fileId: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const parsed = fileParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    reply.status(422).send({ error: 'VALIDATION_ERROR', message: 'Parámetros inválidos', errors: parsed.error.errors });
    return;
  }

  try {
    await getProjectForUser(parsed.data.id, request.user.sub);
  } catch {
    reply.status(404).send({ error: 'NOT_FOUND', message: 'Proyecto no encontrado' });
    return;
  }

  try {
    const { stream, name } = await getRawFile(parsed.data.id, parsed.data.fileId);
    reply.header('Content-Disposition', `attachment; filename="${name}"`);
    reply.type('application/octet-stream');
    reply.send(stream);
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND' || error.code === 'FILE_NOT_FOUND') {
      reply.status(404).send({ error: 'FILE_NOT_FOUND', message: 'Archivo no encontrado en disco' });
      return;
    }
    if (error.code === 'FORBIDDEN') {
      reply.status(403).send({ error: 'FORBIDDEN', message: 'Ruta de archivo inválida' });
      return;
    }
    throw err;
  }
}

/** @description GET /api/projects/:id/download — ZIP download */
export async function downloadHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const parsed = projectParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    reply.status(422).send({ error: 'VALIDATION_ERROR', message: 'ID de proyecto inválido', errors: parsed.error.errors });
    return;
  }

  try {
    await getProjectForUser(parsed.data.id, request.user.sub);
  } catch {
    reply.status(404).send({ error: 'NOT_FOUND', message: 'Proyecto no encontrado' });
    return;
  }

  try {
    const { archive, zipName } = await downloadProject(parsed.data.id);
    reply.header('Content-Disposition', `attachment; filename="${zipName}"`);
    reply.type('application/zip');
    reply.send(archive);
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'INVALID_STATUS') {
      reply.status(400).send({ error: 'INVALID_STATUS', message: error.message });
      return;
    }
    throw err;
  }
}
