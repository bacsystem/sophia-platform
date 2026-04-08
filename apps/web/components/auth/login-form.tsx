'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const loginFormSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
  rememberMe: z.boolean().default(false),
});

type LoginFormData = z.infer<typeof loginFormSchema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number>(0);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { rememberMe: false },
  });

  // Countdown timer
  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = setInterval(() => {
      setRetryAfter((prev) => {
        if (prev <= 1) {
          setServerError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAfter]);

  const formatCountdown = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (res.ok) {
        router.push('/');
        return;
      }

      const body = await res.json();

      if (res.status === 429 && body.retryAfter) {
        setRetryAfter(body.retryAfter);
      }

      setServerError(body.message ?? 'Error al iniciar sesión');
    } catch {
      setServerError('Error de conexión');
    }
  };

  const isLocked = retryAfter > 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
      {serverError && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {serverError}
          {isLocked && (
            <p className="mt-1 font-mono text-lg font-bold">
              {formatCountdown(retryAfter)}
            </p>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              {...register('rememberMe')}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Recordarme
          </label>
          <a
            href="/forgot-password"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            Olvidé mi contraseña
          </a>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || isLocked}
        className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
      >
        {isLocked
          ? `Bloqueado (${formatCountdown(retryAfter)})`
          : isSubmitting
            ? 'Iniciando sesión...'
            : 'Iniciar sesión'}
      </button>
    </form>
  );
}
