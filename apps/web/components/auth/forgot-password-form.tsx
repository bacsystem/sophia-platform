'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';

const forgotPasswordFormSchema = z.object({
  email: z.string().email('Email inválido'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordFormSchema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordFormSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setServerError(null);

    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setSent(true);
        return;
      }

      const body = await res.json();
      setServerError(body.message ?? 'Error al enviar solicitud');
    } catch {
      setServerError('Error de conexión');
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl bg-green-500/10 border border-green-500/20 p-6 text-center space-y-3">
        <CheckCircle2 className="mx-auto text-green-400" size={32} />
        <p className="text-sm text-green-300">
          Si el email existe, recibirás instrucciones para restablecer tu contraseña.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {serverError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
          <p className="text-sm text-red-400">{serverError}</p>
        </div>
      )}

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

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-primary w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Enviando...
          </>
        ) : (
          'Enviar instrucciones'
        )}
      </button>
    </form>
  );
}
