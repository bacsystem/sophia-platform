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
        <div className="flex items-center gap-2 text-white/50">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Cargando perfil...</span>
        </div>
      </section>
    );
  }

  return (
    <section className="glass rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <User className="w-5 h-5 text-violet-400" />
        <h2 className="text-lg font-semibold text-white">Perfil</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="profileEmail" className="block text-sm text-white/60 mb-1.5">
            Email
          </label>
          <input
            id="profileEmail"
            type="email"
            value={email}
            disabled
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white/40 text-sm cursor-not-allowed"
          />
          <p className="text-xs text-white/30 mt-1">El email no se puede cambiar</p>
        </div>

        <div>
          <label htmlFor="profileName" className="block text-sm text-white/60 mb-1.5">
            Nombre
          </label>
          <input
            id="profileName"
            type="text"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
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
            className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-xl hover:bg-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar
          </button>
          {success && (
            <span className="flex items-center gap-1 text-green-400 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Guardado
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
