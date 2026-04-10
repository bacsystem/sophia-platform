'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, use } from 'react';
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

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
  readonly searchParams: Promise<{ token?: string }>;
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
      <div className="space-y-5 text-center">
        <div className="rounded-2xl bg-[var(--color-success-subtle)] border border-[rgba(5,150,105,0.20)] p-6 space-y-3">
          <CheckCircle2 className="mx-auto text-[var(--color-success)]" size={32} />
          <p className="text-sm text-[var(--color-success)]">Contraseña actualizada exitosamente.</p>
        </div>
        <a href="/login" className="link-premium text-sm">
          Ir al login →
        </a>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="space-y-5 text-center">
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-6 space-y-3">
          <AlertCircle className="mx-auto text-red-400" size={32} />
          <p className="text-sm text-red-300">{serverError ?? 'Token inválido o expirado'}</p>
        </div>
        <a href="/forgot-password" className="link-premium text-sm">
          Solicitar nuevo enlace
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
          <p className="text-sm text-red-400">{serverError}</p>
        </div>
      )}

      <div>
        <label htmlFor="password" className="label-premium block mb-1.5">
          Nueva contraseña
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
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

      <div>
        <label htmlFor="confirmPassword" className="label-premium block mb-1.5">
          Confirmar nueva contraseña
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Repite tu contraseña"
            {...register('confirmPassword')}
            className="glass-input w-full rounded-xl px-4 py-3 pr-11 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}
            aria-pressed={showConfirm}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {errors.confirmPassword && <p className="error-text">{errors.confirmPassword.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-primary w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white mt-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Actualizando...
          </>
        ) : (
          'Restablecer contraseña'
        )}
      </button>
    </form>
  );
}
