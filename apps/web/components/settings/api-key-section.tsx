'use client';

import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Key, Eye, EyeOff, Loader2, Trash2, ShieldCheck, AlertCircle } from 'lucide-react';

const apiKeySchema = z.object({
  apiKey: z
    .string()
    .regex(
      /^sk-ant-api03-[A-Za-z0-9_-]{90,110}$/,
      'Formato inválido. Debe comenzar con sk-ant-api03-',
    ),
});

type ApiKeyFormData = z.infer<typeof apiKeySchema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface ApiKeyStatus {
  configured: boolean;
  last4: string | null;
  verifiedAt: string | null;
}

/** @description API Key management — save, verify, delete Anthropic API key */
export function ApiKeySection() {
  const [status, setStatus] = useState<ApiKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ApiKeyFormData>({
    resolver: zodResolver(apiKeySchema),
  });

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const body = await res.json();
      setStatus(body.data.apiKey);
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const onSubmit = async (data: ApiKeyFormData) => {
    setServerError(null);
    try {
      const res = await fetch(`${API_URL}/api/settings/api-key`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) {
        setServerError(body.message ?? 'Error al guardar');
        return;
      }
      setStatus(body.data);
      reset();
      setShowKey(false);
    } catch {
      setServerError('Error de conexión');
    }
  };

  const handleVerify = async () => {
    setServerError(null);
    setVerifying(true);
    try {
      const res = await fetch(`${API_URL}/api/settings/api-key/verify`, {
        method: 'POST',
        credentials: 'include',
      });
      const body = await res.json();
      if (!res.ok) {
        setServerError(body.message ?? 'Error al verificar');
        return;
      }
      setStatus((prev) => prev ? { ...prev, verifiedAt: body.data.verifiedAt } : prev);
    } catch {
      setServerError('Error de conexión');
    } finally {
      setVerifying(false);
    }
  };

  const handleDelete = async () => {
    setServerError(null);
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/settings/api-key`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json();
        setServerError(body.message ?? 'Error al eliminar');
        return;
      }
      setStatus({ configured: false, last4: null, verifiedAt: null });
    } catch {
      setServerError('Error de conexión');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <section className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Cargando...</span>
        </div>
      </section>
    );
  }

  return (
    <section className="glass rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Key className="w-5 h-5 text-[var(--accent-400)]" />
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">API Key de Anthropic</h2>
      </div>

      {serverError && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {status?.configured ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-[var(--surface-header)] rounded-xl px-4 py-3">
            <div>
              <p className="text-[var(--text-primary)] text-sm font-medium font-mono">
                sk-ant-...{status.last4}
              </p>
              {status.verifiedAt && (
                <p className="text-xs text-green-400 flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3 h-3" />
                  Verificada {new Date(status.verifiedAt).toLocaleDateString('es')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="px-3 py-1.5 text-xs font-medium text-[var(--accent-300)] bg-[rgba(var(--accent-rgb)/0.10)] rounded-lg hover:bg-[rgba(var(--accent-rgb)/0.20)] transition-colors disabled:opacity-50"
                aria-label="Verificar API key"
              >
                {verifying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  'Verificar'
                )}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting}
                className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                aria-label="Eliminar API key"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <p className="text-xs text-[var(--text-disabled)]">
            Puedes reemplazar tu API key guardando una nueva.
          </p>

          {showDeleteConfirm && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 space-y-2">
              <p className="text-sm text-red-300">
                ¿Seguro? No podrás ejecutar proyectos sin ella.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    handleDelete();
                  }}
                  disabled={deleting}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Eliminar'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] bg-[var(--surface-header)] rounded-lg hover:bg-[var(--row-hover)] transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-300">
            Configura tu API key de Anthropic para ejecutar proyectos.
          </p>
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--accent-400)] hover:text-[var(--accent-300)] underline mt-1 inline-block"
          >
            Obtener una API key en console.anthropic.com
          </a>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label htmlFor="apiKey" className="block text-sm text-[var(--text-secondary)] mb-1.5">
            {status?.configured ? 'Reemplazar API Key' : 'API Key'}
          </label>
          <div className="relative">
            <input
              id="apiKey"
              type={showKey ? 'text' : 'password'}
              placeholder="sk-ant-api03-..."
              className="w-full bg-[var(--surface-header)] border border-[var(--muted-border)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] text-sm placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[rgba(var(--accent-rgb)/0.50)] focus:ring-1 focus:ring-[rgba(var(--accent-rgb)/0.30)] pr-10"
              {...register('apiKey')}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              aria-label={showKey ? 'Ocultar API key' : 'Mostrar API key'}
              aria-pressed={showKey}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.apiKey && (
            <p className="text-xs text-red-400 mt-1">{errors.apiKey.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary px-4 py-2 text-sm font-medium rounded-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {status?.configured ? 'Actualizar API Key' : 'Guardar API Key'}
        </button>
      </form>

      <p className="text-xs text-[var(--text-disabled)]">
        Tu API key se encripta con AES-256-GCM y nunca se muestra completa.
      </p>
    </section>
  );
}
