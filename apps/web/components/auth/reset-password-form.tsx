'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, use } from 'react';

const resetPasswordFormSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/\d/, 'Debe tener al menos un número'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordFormSchema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface ResetPasswordFormProps {
  searchParams: Promise<{ token?: string }>;
}

export function ResetPasswordForm({ searchParams }: ResetPasswordFormProps) {
  const params = use(searchParams);
  const token = params.token;

  const [state, setState] = useState<'form' | 'success' | 'error'>(
    token ? 'form' : 'error',
  );
  const [serverError, setServerError] = useState<string | null>(
    token ? null : 'Token inválido o expirado',
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordFormSchema),
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setServerError(null);

    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, password: data.password }),
      });

      if (res.ok) {
        setState('success');
        return;
      }

      const body = await res.json();
      if (body.error === 'INVALID_TOKEN') {
        setState('error');
        setServerError('Token inválido o expirado');
      } else {
        setServerError(body.message ?? 'Error al restablecer contraseña');
      }
    } catch {
      setServerError('Error de conexión');
    }
  };

  if (state === 'success') {
    return (
      <div className="mt-8 space-y-4 text-center">
        <div className="rounded-md bg-green-50 p-6">
          <p className="text-sm text-green-700">
            Contraseña actualizada exitosamente.
          </p>
        </div>
        <a
          href="/login"
          className="inline-block font-medium text-indigo-600 hover:text-indigo-500"
        >
          Ir al login
        </a>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="mt-8 space-y-4 text-center">
        <div className="rounded-md bg-red-50 p-6">
          <p className="text-sm text-red-700">
            {serverError ?? 'Token inválido o expirado'}
          </p>
        </div>
        <a
          href="/forgot-password"
          className="inline-block font-medium text-indigo-600 hover:text-indigo-500"
        >
          Solicitar nuevo enlace
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
      {serverError && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Nueva contraseña
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register('password')}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
            Confirmar nueva contraseña
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register('confirmPassword')}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
      >
        {isSubmitting ? 'Actualizando...' : 'Restablecer contraseña'}
      </button>
    </form>
  );
}
