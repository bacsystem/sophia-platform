'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Loader2, CheckCircle2 } from 'lucide-react';

const profileSchema = z.object({
  name: z
    .string()
    .min(2, 'Mínimo 2 caracteres')
    .max(100, 'Máximo 100 caracteres'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** @description Profile form — edit user display name */
export function ProfileForm() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const body = await res.json();
      const profile = body.data.profile;
      setEmail(profile.email);
      reset({ name: profile.name });
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onSubmit = async (data: ProfileFormData) => {
    setServerError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${API_URL}/api/settings/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        setServerError(body.message ?? 'Error al guardar');
        return;
      }
      const body = await res.json();
      reset({ name: body.data.name });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setServerError('Error de conexión');
    }
  };

  if (loading) {
    return (
      <section className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Cargando perfil...</span>
        </div>
      </section>
    );
  }

  return (
    <section className="glass rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <User className="w-5 h-5 text-[var(--accent-400)]" />
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Perfil</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="profileEmail" className="block text-sm text-[var(--text-secondary)] mb-1.5">
            Email
          </label>
          <input
            id="profileEmail"
            type="email"
            value={email}
            disabled
            className="w-full bg-[var(--surface-header)] border border-[var(--muted-border)] rounded-xl px-4 py-2.5 text-[var(--text-disabled)] text-sm cursor-not-allowed"
          />
          <p className="text-xs text-[var(--text-disabled)] mt-1">El email no se puede cambiar</p>
        </div>

        <div>
          <label htmlFor="profileName" className="block text-sm text-[var(--text-secondary)] mb-1.5">
            Nombre
          </label>
          <input
            id="profileName"
            type="text"
              className="w-full bg-[var(--surface-header)] border border-[var(--muted-border)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] text-sm placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[rgba(var(--accent-rgb)/0.50)] focus:ring-1 focus:ring-[rgba(var(--accent-rgb)/0.30)]"
            {...register('name')}
          />
          {errors.name && (
            <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>
          )}
        </div>

        {serverError && (
          <p className="text-sm text-red-400">{serverError}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="btn-primary px-4 py-2 text-sm font-medium rounded-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar
          </button>
          {success && (
            <span className="flex items-center gap-1 text-[var(--color-success)] text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Guardado
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
