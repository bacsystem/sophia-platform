import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken, type AccessTokenPayload } from '../../lib/jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: AccessTokenPayload;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = request.cookies.access_token;

  if (!token) {
    reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'No autenticado',
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    request.user = payload;
  } catch {
    reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'No autenticado',
    });
  }
}
