import type { FastifyRequest, FastifyReply } from 'fastify';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.schema.js';
import * as authService from './auth.service.js';

export async function registerHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = registerSchema.safeParse(request.body);
  if (!result.success) {
    return reply.status(422).send({
      error: 'VALIDATION_ERROR',
      message: 'Error de validación',
      errors: result.error.errors.map((e) => ({ path: e.path.map(String), message: e.message })),
    });
  }

  return authService.register(result.data, request.ip, reply);
}

export async function loginHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = loginSchema.safeParse(request.body);
  if (!result.success) {
    return reply.status(422).send({
      error: 'VALIDATION_ERROR',
      message: 'Error de validación',
      errors: result.error.errors.map((e) => ({ path: e.path.map(String), message: e.message })),
    });
  }

  return authService.login(result.data, reply);
}

export async function refreshHandler(request: FastifyRequest, reply: FastifyReply) {
  // Extract ALL refresh_token values from cookie header (handles duplicates)
  const cookieHeader = request.headers.cookie ?? '';
  const allRefreshTokens = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.startsWith('refresh_token='))
    .map((s) => s.slice('refresh_token='.length));

  return authService.refresh(allRefreshTokens.length > 0 ? allRefreshTokens : [request.cookies.refresh_token].filter(Boolean) as string[], reply);
}

export async function logoutHandler(request: FastifyRequest, reply: FastifyReply) {
  return authService.logout(request.cookies.refresh_token, reply);
}

export async function forgotPasswordHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = forgotPasswordSchema.safeParse(request.body);
  if (!result.success) {
    return reply.status(422).send({
      error: 'VALIDATION_ERROR',
      message: 'Error de validación',
      errors: result.error.errors.map((e) => ({ path: e.path.map(String), message: e.message })),
    });
  }

  return authService.forgotPassword(result.data.email, reply);
}

export async function resetPasswordHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = resetPasswordSchema.safeParse(request.body);
  if (!result.success) {
    return reply.status(422).send({
      error: 'VALIDATION_ERROR',
      message: 'Error de validación',
      errors: result.error.errors.map((e) => ({ path: e.path.map(String), message: e.message })),
    });
  }

  return authService.resetPassword(result.data, reply);
}

export async function getMeHandler(request: FastifyRequest, reply: FastifyReply) {
  return authService.getMe(request.user.sub, reply);
}

export async function getSessionHandler(request: FastifyRequest, reply: FastifyReply) {
  return authService.getSession(request.cookies.access_token, reply);
}
