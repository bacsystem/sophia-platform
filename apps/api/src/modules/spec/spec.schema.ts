import { z } from 'zod';

export const GenerateSpecParamsSchema = z.object({
  id: z.string().uuid(),
});

export const SpecStreamQuerySchema = z.object({
  jobId: z.string().uuid(),
});

export const SpecParamsSchema = z.object({
  id: z.string().uuid(),
});

export const SpecVersionParamsSchema = z.object({
  id: z.string().uuid(),
  version: z.coerce.number().int().positive(),
});

export const UpdateSpecBodySchema = z.object({
  files: z.object({
    spec: z.string().min(1).max(50000),
    dataModel: z.string().min(1).max(50000),
    apiDesign: z.string().min(1).max(50000),
  }),
});

export type GenerateSpecParams = z.infer<typeof GenerateSpecParamsSchema>;
export type SpecStreamQuery = z.infer<typeof SpecStreamQuerySchema>;
export type SpecParams = z.infer<typeof SpecParamsSchema>;
export type SpecVersionParams = z.infer<typeof SpecVersionParamsSchema>;
export type UpdateSpecBody = z.infer<typeof UpdateSpecBodySchema>;
