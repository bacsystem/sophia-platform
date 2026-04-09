import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  GenerateSpecParamsSchema,
  SpecStreamQuerySchema,
  SpecParamsSchema,
  SpecVersionParamsSchema,
  UpdateSpecBodySchema,
} from './spec.schema.js';
import {
  startSpecGeneration,
  subscribeToSpecJob,
  getSpec,
  getSpecVersions,
  getSpecVersion,
  updateSpec,
} from './spec.service.js';
import { initSseStream, sendSseEvent, endSseStream } from './spec.stream.js';

/** Starts spec generation for a project and returns a jobId (202). */
export async function generateSpecHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const params = GenerateSpecParamsSchema.safeParse(request.params);
  if (!params.success) {
    reply.status(422).send({ error: 'VALIDATION_ERROR', message: 'ID de proyecto inválido', errors: params.error.errors });
    return;
  }

  try {
    const result = await startSpecGeneration(params.data.id, request.user.sub);
    reply.status(202).send({ data: result });
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string; retryAfter?: number };
    const status = e.status ?? 500;
    const body: Record<string, unknown> = { error: e.code ?? 'INTERNAL_ERROR', message: e.message ?? 'Error interno' };
    if (e.retryAfter) body.retryAfter = e.retryAfter;
    reply.status(status).send(body);
  }
}

/** SSE stream for spec generation progress. */
export async function specStreamHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const params = SpecParamsSchema.safeParse(request.params);
  const query = SpecStreamQuerySchema.safeParse(request.query);

  if (!params.success || !query.success) {
    reply.status(422).send({ error: 'VALIDATION_ERROR', message: 'Parámetros inválidos' });
    return;
  }

  initSseStream(reply, request);

  const unsubscribe = subscribeToSpecJob(
    query.data.jobId,
    params.data.id,
    (event) => sendSseEvent(reply, event),
  );

  if (unsubscribe === null) {
    // Job not found — send error event and close
    sendSseEvent(reply, { type: 'error', file: '', message: 'Job no encontrado', retryable: false });
    endSseStream(reply);
    return;
  }

  // Keep the connection open; close when client disconnects or job finishes
  await new Promise<void>((resolve) => {
    request.raw.on('close', () => {
      unsubscribe();
      resolve();
    });
    // Check if job is already done (unsubscribe returned a no-op)
    // The job completion emits 'done' or 'error' events — client closes after receiving them
    // Fallback: close after 5 minutes for safety
    const maxTimeout = setTimeout(() => {
      unsubscribe();
      endSseStream(reply);
      resolve();
    }, 5 * 60 * 1000);
    request.raw.once('close', () => clearTimeout(maxTimeout));
  });
}

/** Returns the current (latest) spec for a project. */
export async function getSpecHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const params = SpecParamsSchema.safeParse(request.params);
  if (!params.success) {
    reply.status(422).send({ error: 'VALIDATION_ERROR', message: 'ID de proyecto inválido', errors: params.error.errors });
    return;
  }

  try {
    const result = await getSpec(params.data.id, request.user.sub);
    reply.send({ data: result });
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    reply.status(e.status ?? 500).send({ error: e.code ?? 'INTERNAL_ERROR', message: e.message ?? 'Error interno' });
  }
}

/** Lists all spec versions for a project. */
export async function getSpecVersionsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const params = SpecParamsSchema.safeParse(request.params);
  if (!params.success) {
    reply.status(422).send({ error: 'VALIDATION_ERROR', message: 'ID de proyecto inválido', errors: params.error.errors });
    return;
  }

  try {
    const result = await getSpecVersions(params.data.id, request.user.sub);
    reply.send({ data: result });
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    reply.status(e.status ?? 500).send({ error: e.code ?? 'INTERNAL_ERROR', message: e.message ?? 'Error interno' });
  }
}

/** Returns a specific spec version. */
export async function getSpecVersionHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const params = SpecVersionParamsSchema.safeParse(request.params);
  if (!params.success) {
    reply.status(422).send({ error: 'VALIDATION_ERROR', message: 'Parámetros inválidos', errors: params.error.errors });
    return;
  }

  try {
    const result = await getSpecVersion(params.data.id, params.data.version, request.user.sub);
    reply.send({ data: result });
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    reply.status(e.status ?? 500).send({ error: e.code ?? 'INTERNAL_ERROR', message: e.message ?? 'Error interno' });
  }
}

/** Saves a manual spec edit as a new version. */
export async function updateSpecHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const params = SpecParamsSchema.safeParse(request.params);
  const body = UpdateSpecBodySchema.safeParse(request.body);

  if (!params.success || !body.success) {
    const errors = [...(params.error?.errors ?? []), ...(body.error?.errors ?? [])];
    reply.status(422).send({ error: 'VALIDATION_ERROR', message: 'Request inválido', errors });
    return;
  }

  try {
    const result = await updateSpec(params.data.id, request.user.sub, body.data);
    reply.send({ data: result });
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    reply.status(e.status ?? 500).send({ error: e.code ?? 'INTERNAL_ERROR', message: e.message ?? 'Error interno' });
  }
}
