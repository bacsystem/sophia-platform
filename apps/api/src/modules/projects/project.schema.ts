import { z } from 'zod';

const REQUIRED_AGENTS = ['seed', 'security', 'integration'] as const;
const GENERATOR_AGENTS = ['dba', 'backend', 'frontend', 'qa', 'docs', 'deploy'] as const;
const ALL_AGENTS = [...REQUIRED_AGENTS, ...GENERATOR_AGENTS] as const;

export const CreateProjectSchema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres').max(100, 'Máximo 100 caracteres'),
  description: z.string().min(20, 'Mínimo 20 caracteres').max(5000, 'Máximo 5000 caracteres'),
  stack: z.enum(['node-nextjs', 'laravel-nextjs', 'python-nextjs']),
  config: z.object({
    model: z.enum(['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5']),
    agents: z
      .array(z.enum(ALL_AGENTS))
      .min(1, 'Selecciona al menos un agente')
      .refine(
        (agents) => REQUIRED_AGENTS.every((a) => agents.includes(a)),
        'seed, security e integration son obligatorios',
      )
      .refine(
        (agents) => GENERATOR_AGENTS.some((a) => agents.includes(a)),
        'Debe incluir al menos un agente generador (dba, backend, frontend, qa, docs o deploy)',
      ),
  }),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres').max(100, 'Máximo 100 caracteres').optional(),
  description: z
    .string()
    .min(20, 'Mínimo 20 caracteres')
    .max(5000, 'Máximo 5000 caracteres')
    .optional(),
  stack: z.enum(['node-nextjs', 'laravel-nextjs', 'python-nextjs']).optional(),
  config: z
    .object({
      model: z.enum(['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5']),
      agents: z
        .array(z.enum(ALL_AGENTS))
        .min(1, 'Selecciona al menos un agente')
        .refine(
          (agents) => REQUIRED_AGENTS.every((a) => agents.includes(a)),
          'seed, security e integration son obligatorios',
        )
        .refine(
          (agents) => GENERATOR_AGENTS.some((a) => agents.includes(a)),
          'Debe incluir al menos un agente generador',
        ),
    })
    .optional(),
});

export const ListProjectsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(12),
  status: z.enum(['idle', 'running', 'paused', 'done', 'error']).optional(),
  search: z.string().max(200).optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof ListProjectsQuerySchema>;
