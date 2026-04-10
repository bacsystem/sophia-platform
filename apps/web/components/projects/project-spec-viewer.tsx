'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, FileText, Zap } from 'lucide-react';
import type { Project } from '@sophia/shared';
import { useSpecStream } from '@/hooks/use-spec-stream';
import { SpecStream } from '@/components/spec/spec-stream';
import { SpecViewer, type SpecFiles } from '@/components/spec/spec-viewer';
import { SpecVersionSelector, type VersionInfo } from '@/components/spec/spec-version-selector';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** sessionStorage key for persisting active job across tab switches. */
function jobStorageKey(projectId: string): string {
  return `spec-job:${projectId}`;
}

interface SpecData {
  version: number;
  files: SpecFiles;
  source: string;
  valid: boolean;
  createdAt: string;
}

interface ProjectSpecViewerProps {
  project: Project;
}

/** @description Orchestrates the full spec lifecycle: generate, stream, view, edit, version select. */
export function ProjectSpecViewer({ project }: ProjectSpecViewerProps) {
  const [spec, setSpec] = useState<SpecData | null>(null);
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(jobStorageKey(project.id));
  });
  const [isStarting, setIsStarting] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  const streamState = useSpecStream(activeJobId ? project.id : null, activeJobId);

  const fetchSpec = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/projects/${project.id}/spec`, {
        credentials: 'include',
      });
      if (res.status === 404) {
        setSpec(null);
      } else if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? 'Error al cargar spec');
      } else {
        const body = await res.json() as { data: SpecData };
        setSpec(body.data);
        setSelectedVersion(body.data.version);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  }, [project.id]);

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects/${project.id}/spec/versions`, {
        credentials: 'include',
      });
      if (res.ok) {
        const body = await res.json() as { data: VersionInfo[] };
        setVersions(body.data);
      }
    } catch {
      // Non-critical — version list is optional
    }
  }, [project.id]);

  // Initial fetch — skip if there's an active generation job (spec may not exist yet in DB)
  const hadJobAtMount = useRef(!!activeJobId);
  useEffect(() => {
    if (!hadJobAtMount.current) {
      void fetchSpec();
    } else {
      setIsLoading(false);
    }
    void fetchVersions();
  }, [fetchSpec, fetchVersions]);

  // When stream completes → refetch latest spec
  useEffect(() => {
    if (streamState.status === 'done' && streamState.completedVersion !== null) {
      setActiveJobId(null);
      sessionStorage.removeItem(jobStorageKey(project.id));
      void fetchSpec();
      void fetchVersions();
    }
    if (streamState.status === 'error') {
      // Job lost (e.g., server restart) — clear and try to load saved spec
      setActiveJobId(null);
      sessionStorage.removeItem(jobStorageKey(project.id));
      void fetchSpec();
      void fetchVersions();
    }
  }, [streamState.status, streamState.completedVersion, fetchSpec, fetchVersions, project.id]);

  const handleVersionChange = async (version: number) => {
    setSelectedVersion(version);
    try {
      const res = await fetch(`${API_URL}/api/projects/${project.id}/spec/${version}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const body = await res.json() as { data: SpecData };
        setSpec(body.data);
      }
    } catch {
      // Keep current spec displayed
    }
  };

  const handleGenerate = async () => {
    setIsStarting(true);
    setShowRegenConfirm(false);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/projects/${project.id}/spec/generate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? 'Error al iniciar generación');
      }
      const body = await res.json() as { data: { jobId: string } };
      setActiveJobId(body.data.jobId);
      sessionStorage.setItem(jobStorageKey(project.id), body.data.jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al iniciar generación');
    } finally {
      setIsStarting(false);
    }
  };

  const handleSave = async (files: SpecFiles) => {
    const res = await fetch(`${API_URL}/api/projects/${project.id}/spec`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(body.message ?? 'Error al guardar spec');
    }
    const body = await res.json() as { data: SpecData };
    setSpec(body.data);
    setSelectedVersion(body.data.version);
    void fetchVersions();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  // Active generation job — show stream
  if (activeJobId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--text-secondary)] font-medium">Generando especificación técnica…</p>
          {streamState.status === 'error' && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setActiveJobId(null); sessionStorage.removeItem(jobStorageKey(project.id)); void handleGenerate(); }}
                className="text-xs text-[var(--accent-400)] hover:text-[var(--accent-300)] font-medium"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={() => { setActiveJobId(null); sessionStorage.removeItem(jobStorageKey(project.id)); }}
                className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
        <SpecStream streamState={streamState} />
      </div>
    );
  }

  // No spec yet
  if (!spec) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
        <FileText className="w-8 h-8 text-[var(--text-disabled)] mb-2" />
        <div>
          <p className="text-[var(--text-secondary)] text-sm mb-1">Sin spec generado</p>
          <p className="text-[var(--text-disabled)] text-xs">
            Genera la especificación técnica con IA — se crean 3 documentos: Spec, Modelo de datos y API Design
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isStarting}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Generar Spec
        </button>
        {error && <p className="text-red-400 text-xs">{error}</p>}
      </div>
    );
  }

  // Has spec — show full viewer
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SpecVersionSelector
          versions={versions}
          selectedVersion={selectedVersion ?? spec.version}
          onChange={(v) => void handleVersionChange(v)}
        />
        <button
          type="button"
          onClick={() => setShowRegenConfirm(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[rgba(var(--accent-rgb)/0.40)] text-[var(--accent-400)] hover:bg-[rgba(var(--accent-rgb)/0.10)] transition-colors"
        >
          <Zap className="w-3 h-3" />
          Regenerar
        </button>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {/* Regenerate confirmation modal */}
      {showRegenConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4 border border-[var(--muted-border)]">
            <p className="text-[var(--text-primary)] font-medium">¿Regenerar spec?</p>
            <p className="text-[var(--text-secondary)] text-sm">
              Se creará una nueva versión. La versión actual se conserva y puedes volver a ella en cualquier momento.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowRegenConfirm(false)}
                className="px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={isStarting}
                className="btn-primary inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg font-medium disabled:opacity-50"
              >
                {isStarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                Regenerar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spec document viewer/editor */}
      <SpecViewer
        files={spec.files}
        valid={spec.valid}
        onSave={handleSave}
      />
    </div>
  );
}
