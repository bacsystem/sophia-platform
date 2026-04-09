import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  saveApiKeySchema,
  updateProfileSchema,
  changePasswordSchema,
  dailyUsageQuerySchema,
} from './settings.schema.js';
import {
  getSettings,
  saveApiKey,
  deleteApiKey,
  verifyApiKey,
  getUsage,
  getDailyUsage,
  updateProfile,
  changePassword,
} from './settings.service.js';

/** @description Returns user settings (API key status + profile) */
export async function getSettingsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const result = await getSettings(request.user.sub);
  reply.send(result);
}

/** @description Saves and verifies an Anthropic API key */
export async function saveApiKeyHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parsed = saveApiKeySchema.safeParse(request.body);
  if (!parsed.success) {
    reply.status(422).send({
      error: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      errors: parsed.error.errors,
    });
    return;
  }

  const result = await saveApiKey(request.user.sub, parsed.data);
  if ('error' in result) {
    if (result.error === 'TOO_MANY_ATTEMPTS') {
      reply.status(429).send({
        error: result.error,
        message: result.message,
        retryAfter: result.retryAfter,
      });
    } else {
      reply.status(result.status as number).send({
        error: result.error,
        message: result.message,
      });
    }
    return;
  }

  reply.send(result);
}

/** @description Deletes the stored API key */
export async function deleteApiKeyHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const result = await deleteApiKey(request.user.sub);
  if ('error' in result) {
    reply.status(result.status as number).send({
      error: result.error,
      message: result.message,
    });
    return;
  }

  reply.send(result);
}

/** @description Verifies the stored API key with Anthropic */
export async function verifyApiKeyHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const result = await verifyApiKey(request.user.sub);
  if ('error' in result) {
    if (result.error === 'TOO_MANY_ATTEMPTS') {
      reply.status(429).send({
        error: result.error,
        message: result.message,
        retryAfter: result.retryAfter,
      });
    } else {
      reply.status(result.status as number).send({
        error: result.error,
        message: result.message,
      });
    }
    return;
  }

  reply.send(result);
}

/** @description Returns token usage totals and per-project breakdown */
export async function getUsageHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const result = await getUsage(request.user.sub);
  reply.send(result);
}

/** @description Returns daily token usage for chart rendering */
export async function getDailyUsageHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parsed = dailyUsageQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    reply.status(422).send({
      error: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      errors: parsed.error.errors,
    });
    return;
  }

  const result = await getDailyUsage(request.user.sub, parsed.data);
  reply.send(result);
}

/** @description Updates user profile name */
export async function updateProfileHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parsed = updateProfileSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.status(422).send({
      error: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      errors: parsed.error.errors,
    });
    return;
  }

  const result = await updateProfile(request.user.sub, parsed.data);
  reply.send(result);
}

/** @description Changes user password with current-password verification */
export async function changePasswordHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parsed = changePasswordSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.status(422).send({
      error: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      errors: parsed.error.errors,
    });
    return;
  }

  const result = await changePassword(request.user.sub, parsed.data);
  if ('error' in result) {
    reply.status(result.status as number).send({
      error: result.error,
      message: result.message,
    });
    return;
  }

  reply.send(result);
}
