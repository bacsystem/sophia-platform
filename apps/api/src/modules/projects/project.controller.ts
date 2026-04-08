import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  ListProjectsQuerySchema,
} from './project.schema.js';
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  startProject,
  pauseProject,
  continueProject,
  retryProject,
} from './project.service.js';

/** Creates a new project for the authenticated user. */
export async function createProjectHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parsed = CreateProjectSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.status(422).send({
      error: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      errors: parsed.error.errors,
    });
    return;
  }

  const result = await createProject(request.user.sub, parsed.data);
  reply.status(201).send({ data: result });
}

/** Lists projects for the authenticated user. */
export async function listProjectsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parsed = ListProjectsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    reply.status(422).send({
      error: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      errors: parsed.error.errors,
    });
    return;
  }

  const result = await listProjects(request.user.sub, parsed.data);
  reply.status(200).send(result);
}

/** Gets a single project by id. */
export async function getProjectHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const result = await getProject(request.user.sub, request.params.id);
  if ('error' in result) {
    reply.status(result.status as number).send({ error: result.error, message: result.message });
    return;
  }
  reply.status(200).send(result);
}

/** Updates a project (only allowed in idle state). */
export async function updateProjectHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const parsed = UpdateProjectSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.status(422).send({
      error: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      errors: parsed.error.errors,
    });
    return;
  }

  const result = await updateProject(request.user.sub, request.params.id, parsed.data);
  if ('error' in result) {
    reply.status(result.status as number).send({ error: result.error, message: result.message });
    return;
  }
  reply.status(200).send(result);
}

/** Soft-deletes a project. */
export async function deleteProjectHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const result = await deleteProject(request.user.sub, request.params.id);
  if ('error' in result) {
    reply.status(result.status as number).send({ error: result.error, message: result.message });
    return;
  }
  reply.status(200).send(result);
}

/** Stub: starts project generation (M4 replaces). */
export async function startProjectHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const result = await startProject(request.user.sub, request.params.id);
  if ('error' in result) {
    reply.status(result.status as number).send({ error: result.error, message: result.message });
    return;
  }
  reply.status(200).send(result);
}

/** Stub: pauses project generation (M4 replaces). */
export async function pauseProjectHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const result = await pauseProject(request.user.sub, request.params.id);
  if ('error' in result) {
    reply.status(result.status as number).send({ error: result.error, message: result.message });
    return;
  }
  reply.status(200).send(result);
}

/** Stub: continues paused project (M4 replaces). */
export async function continueProjectHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const result = await continueProject(request.user.sub, request.params.id);
  if ('error' in result) {
    reply.status(result.status as number).send({ error: result.error, message: result.message });
    return;
  }
  reply.status(200).send(result);
}

/** Stub: retries from error state (M4 replaces). */
export async function retryProjectHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const result = await retryProject(request.user.sub, request.params.id);
  if ('error' in result) {
    reply.status(result.status as number).send({ error: result.error, message: result.message });
    return;
  }
  reply.status(200).send(result);
}


