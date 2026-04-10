'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Copy, Download, Check, AlertTriangle } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const AGENT_LABELS: Record<string, { label: string; className: string }> = {
  'dba-agent': { label: 'DBA', className: 'bg-blue-500/20 text-blue-400' },
  'seed-agent': { label: 'Seed', className: 'bg-teal-500/20 text-teal-400' },
  'backend-agent': { label: 'Backend', className: 'bg-green-500/20 text-green-400' },
  'frontend-agent': { label: 'Frontend', className: 'bg-purple-500/20 text-purple-400' },
  'qa-agent': { label: 'QA', className: 'bg-orange-500/20 text-orange-400' },
  'security-agent': { label: 'Security', className: 'bg-red-500/20 text-red-400' },
  'docs-agent': { label: 'Docs', className: 'bg-yellow-500/20 text-yellow-500' },
  'deploy-agent': { label: 'Deploy', className: 'bg-cyan-500/20 text-cyan-400' },
  'integration-agent': { label: 'Integration', className: 'bg-pink-500/20 text-pink-400' },
};

const EXT_TO_LANG: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.json': 'json',
  '.md': 'markdown',
  '.sql': 'sql',
  '.prisma': 'prisma',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.css': 'css',
  '.html': 'html',
  '.env': 'shell',
  '.sh': 'shell',
  '.bash': 'shell',
  '.dockerfile': 'dockerfile',
  '.toml': 'toml',
  '.xml': 'xml',
  '.graphql': 'graphql',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface FileData {
  id: string;
  name: string;
  path: string;
  content: string | null;
  binary?: boolean;
  extension?: string;
  sizeBytes: number;
  agentType: string;
  createdAt: string;
  lineCount: number;
  truncated?: boolean;
}

interface FileViewerProps {
  projectId: string;
  fileId: string;
}

const LINE_HEIGHT = 20;
const VIRTUAL_THRESHOLD = 500;

/** @description File content viewer with shiki syntax highlighting, copy, and download */
export function FileViewer({ projectId, fileId }: FileViewerProps) {
  const [file, setFile] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setHighlightedHtml(null);

    fetch(`${API_URL}/api/projects/${projectId}/files/${fileId}`, {
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) throw new Error('FILE_NOT_FOUND');
        return res.json();
      })
      .then((body) => {
        if (!cancelled) setFile(body.data as FileData);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, fileId]);

  // Highlight with shiki (async import to code-split)
  useEffect(() => {
    if (!file || file.binary || !file.content) return;
    let cancelled = false;
    const lang = file.extension ? EXT_TO_LANG[file.extension] ?? 'text' : 'text';

    import('shiki')
      .then(({ codeToHtml }) =>
        codeToHtml(file.content!, {
          lang,
          theme: 'github-dark',
        }),
      )
      .then((html) => {
        if (!cancelled) setHighlightedHtml(html);
      })
      .catch(() => {
        // Fallback: no highlighting
        if (!cancelled) setHighlightedHtml(null);
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  const lines = useMemo(() => (file?.content ?? '').split('\n'), [file]);
  const useVirtual = lines.length > VIRTUAL_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => LINE_HEIGHT,
    overscan: 20,
    enabled: useVirtual,
  });

  const handleCopy = useCallback(async () => {
    if (!file || file.content == null) return;
    await navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [file]);

  const handleDownload = useCallback(() => {
    if (!file) return;
    window.location.href = `${API_URL}/api/projects/${projectId}/files/${fileId}/raw`;
  }, [file, projectId, fileId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-[var(--accent-500)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
        <p className="text-[var(--text-secondary)] text-sm">No se pudo cargar el archivo</p>
      </div>
    );
  }

  const agent = AGENT_LABELS[file.agentType] ?? { label: file.agentType, className: 'bg-[var(--surface-header)] text-[var(--text-secondary)]' };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[var(--muted-border)]">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h3 className="text-sm font-medium text-[var(--text-primary)] truncate">{file.name}</h3>
          <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium shrink-0 ${agent.className}`}>
            {agent.label}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--text-disabled)] shrink-0">
          <span>{file.lineCount} líneas</span>
          <span>{formatSize(file.sizeBytes)}</span>
          <span>{formatDate(file.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--row-hover)] transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-[var(--color-success)]" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--row-hover)] transition-colors"
            aria-label="Descargar archivo"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Truncation warning */}
      {file.truncated && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-warn-subtle)] border-b border-[rgba(217,119,6,0.20)]">
          <AlertTriangle className="w-4 h-4 text-[var(--color-warn)] shrink-0" />
          <span className="text-xs text-[var(--color-warn)]">
            Archivo demasiado grande para preview completo (&gt;1MB). Mostrando contenido truncado.
          </span>
        </div>
      )}

      {/* Binary file info */}
      {file.binary && (
        <div className="flex flex-col items-center justify-center flex-1 text-center p-6 gap-3">
          <AlertTriangle className="w-8 h-8 text-[var(--text-disabled)]" />
          <p className="text-[var(--text-secondary)] text-sm">Archivo binario — no se puede previsualizar</p>
          <p className="text-[var(--text-tertiary)] text-xs">{file.name} · {formatSize(file.sizeBytes)}</p>
          <button
            type="button"
            onClick={handleDownload}
            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--muted-border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--row-hover)] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar archivo
          </button>
        </div>
      )}

      {/* Code content */}
      {!file.binary && <div ref={scrollRef} className="flex-1 overflow-auto">
        {useVirtual ? (
          <div
            className="font-mono text-[13px] leading-5"
            style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
          >
            {virtualizer.getVirtualItems().map((vRow) => (
              <div
                key={vRow.index}
                className="flex absolute w-full"
                style={{
                  height: `${vRow.size}px`,
                  transform: `translateY(${vRow.start}px)`,
                }}
              >
                <span className="w-12 shrink-0 text-right pr-3 text-[var(--text-disabled)] select-none text-xs leading-5">
                  {vRow.index + 1}
                </span>
                <pre className="flex-1 text-[var(--text-primary)] whitespace-pre overflow-x-auto">
                  {lines[vRow.index]}
                </pre>
              </div>
            ))}
          </div>
        ) : highlightedHtml ? (
          <div className="flex">
            <div className="shrink-0 py-3 pr-3 text-right select-none border-r border-[var(--muted-border)]">
              {lines.map((_, i) => (
                <div key={i} className="text-xs leading-5 text-[var(--text-disabled)] px-2">
                  {i + 1}
                </div>
              ))}
            </div>
            <div
              className="flex-1 py-3 pl-4 overflow-x-auto [&_pre]:!bg-transparent [&_code]:!bg-transparent [&_pre]:!p-0 [&_pre]:!m-0"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          </div>
        ) : (
          <div className="flex">
            <div className="shrink-0 py-3 pr-3 text-right select-none border-r border-[var(--muted-border)]">
              {lines.map((_, i) => (
                <div key={i} className="text-xs leading-5 text-[var(--text-disabled)] px-2">
                  {i + 1}
                </div>
              ))}
            </div>
            <pre className="flex-1 py-3 pl-4 font-mono text-[13px] leading-5 text-[var(--text-primary)] overflow-x-auto whitespace-pre">
              {file.content}
            </pre>
          </div>
        )}
      </div>}
    </div>
  );
}
