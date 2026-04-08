import { z } from 'zod';

/** @description Params for project-scoped file endpoints */
export const projectParamsSchema = z.object({
  id: z.string().uuid(),
});

/** @description Params for single-file endpoints */
export const fileParamsSchema = z.object({
  id: z.string().uuid(),
  fileId: z.string().uuid(),
});
