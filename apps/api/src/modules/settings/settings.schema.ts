import { z } from 'zod';

/** @description Zod schema for saving an Anthropic API key */
export const saveApiKeySchema = z.object({
  apiKey: z
    .string()
    .regex(
      /^sk-ant-api03-[A-Za-z0-9_-]{90,110}$/,
      'Formato de API key inválido. Debe comenzar con sk-ant-api03-',
    ),
});

/** @description Zod schema for updating user profile name */
export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Mínimo 2 caracteres')
    .max(100, 'Máximo 100 caracteres'),
});

/** @description Zod schema for changing password */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Contraseña actual requerida'),
    newPassword: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
      .regex(/[a-z]/, 'Debe contener al menos una minúscula')
      .regex(/[0-9]/, 'Debe contener al menos un número'),
    confirmPassword: z.string().min(1, 'Confirmar contraseña requerida'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

/** @description Zod schema for daily usage query params */
export const dailyUsageQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export type SaveApiKeyInput = z.infer<typeof saveApiKeySchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type DailyUsageQuery = z.infer<typeof dailyUsageQuerySchema>;
