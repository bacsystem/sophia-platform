import { z } from 'zod';

/** @description Query params for GET /api/projects/:id/logs */
export const logsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  agentType: z.string().optional(),
  type: z.string().optional(),
});

/** @description Body for POST /api/projects/:id/agents/retry */
export const retryBodySchema = z.object({
  fromLayer: z.number().min(1).max(7).optional(),
});
