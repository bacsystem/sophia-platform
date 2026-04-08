import type { FastifyRequest, FastifyReply } from 'fastify';
import { listTemplates } from './template.service.js';

/** Lists all system templates. */
export async function listTemplatesHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const result = await listTemplates();
  reply.status(200).send(result);
}
