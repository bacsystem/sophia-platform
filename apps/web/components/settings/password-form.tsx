'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, ChevronDown } from 'lucide-react';

const passwordSchema = z
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

type PasswordFormData = z.infer<typeof passwordSchema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** @description Password change form — collapsible section with current + new password */
export function PasswordForm() {
  const [open, setOpen] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const onSubmit = async (data: PasswordFormData) => {
    setServerError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${API_URL}/api/settings/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        setServerError(body.message ?? 'Error al cambiar contraseña');
        return;
      }
      reset();
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setOpen(false);
      }, 2000);
    } catch {
      setServerError('Error de conexión');
    }
  };

  return (
    <section className="glass rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
        aria-expanded={open}
        aria-controls="password-form-content"
      >
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5 text-[var(--accent-400)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Cambiar Contraseña</h2>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-[var(--text-tertiary)] transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div id="password-form-content" className="px-6 pb-6 space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Current password */}
            <div>
              <label htmlFor="currentPassword" className="block text-sm text-[var(--text-secondary)] mb-1.5">
                Contraseña actual
              </label>
              <div className="relative">
                <input
                  id="currentPassword"
                  type={showCurrent ? 'text' : 'password'}
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-sm pr-10"
                  {...register('currentPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-disabled)] hover:text-[var(--text-secondary)] transition-colors"
                  aria-pressed={showCurrent}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="text-xs text-red-400 mt-1">{errors.currentPassword.message}</p>
              )}
            </div>

            {/* New password */}
            <div>
              <label htmlFor="newPassword" className="block text-sm text-[var(--text-secondary)] mb-1.5">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showNew ? 'text' : 'password'}
                  className="w-full bg-[var(--surface-header)] border border-[var(--muted-border)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] text-sm placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[rgba(var(--accent-rgb)/0.50)] focus:ring-1 focus:ring-[rgba(var(--accent-rgb)/0.30)] pr-10"
                  {...register('newPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-disabled)] hover:text-[var(--text-secondary)] transition-colors"
                  aria-pressed={showNew}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-xs text-red-400 mt-1">{errors.newPassword.message}</p>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm text-[var(--text-secondary)] mb-1.5">
                Confirmar nueva contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                className="w-full bg-[var(--surface-header)] border border-[var(--muted-border)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] text-sm placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[rgba(var(--accent-rgb)/0.50)] focus:ring-1 focus:ring-[rgba(var(--accent-rgb)/0.30)]"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-red-400 mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            {serverError && (
              <p className="text-sm text-red-400">{serverError}</p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium btn-primary rounded-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Cambiar Contraseña
              </button>
              {success && (
                <span className="flex items-center gap-1 text-[var(--color-success)] text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Actualizada
                </span>
              )}
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
