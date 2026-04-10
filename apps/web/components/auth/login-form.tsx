'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

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
        router.push('/projects');
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
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {serverError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
          <p className="text-sm text-red-400">{serverError}</p>
          {isLocked && (
            <p className="mt-1 font-mono text-lg font-bold text-red-300">
              {formatCountdown(retryAfter)}
            </p>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="label-premium block mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            {...register('email')}
            className="glass-input w-full rounded-xl px-4 py-3 text-sm"
          />
          {errors.email && <p className="error-text">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="label-premium block mb-1.5">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              {...register('password')}
              className="glass-input w-full rounded-xl px-4 py-3 pr-11 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={showPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {errors.password && <p className="error-text">{errors.password.message}</p>}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register('rememberMe')}
              className="w-4 h-4 rounded border-[var(--text-tertiary)] bg-[var(--surface-header)] text-[var(--accent-500)] focus:ring-[rgba(var(--accent-rgb)/0.40)] focus:ring-offset-0"
            />
            <span className="text-sm text-[var(--text-secondary)]">Recordarme</span>
          </label>
          <a href="/forgot-password" className="link-premium text-sm">
            ¿Olvidaste tu contraseña?
          </a>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || isLocked}
        className="btn-primary w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white mt-2"
      >
        {(() => {
          if (isLocked) return `Bloqueado (${formatCountdown(retryAfter)})`;
          if (isSubmitting) return <><Loader2 size={16} className="animate-spin" />Iniciando sesión...</>;
          return 'Iniciar sesión';
        })()}
      </button>
    </form>
  );
}
