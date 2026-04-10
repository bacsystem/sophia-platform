'use client';

import { useMemo } from 'react';
import { Loader2, CheckCircle2, XCircle, FileText, Database, Plug, Sparkles } from 'lucide-react';
import type { UseSpecStreamState } from '@/hooks/use-spec-stream';

const FILE_META: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  'spec.md': { label: 'Spec', Icon: FileText },
  'data-model.md': { label: 'Data Model', Icon: Database },
  'api-design.md': { label: 'API Design', Icon: Plug },
};

interface SpecStreamProps {
  streamState: UseSpecStreamState;
}

/** @description Displays real-time spec generation progress with per-file status indicators and live text preview. */
export function SpecStream({ streamState }: SpecStreamProps) {
  const { status, events, currentFile, accumulatedContent, errorMessage } = streamState;

  // Build per-file validation results from events
  const fileStatus = useMemo(() => {
    const result: Record<string, 'pending' | 'streaming' | 'valid' | 'invalid'> = {};
    for (const ev of events) {
      if (ev.type === 'start') result[ev.file] = 'streaming';
      if (ev.type === 'validated') result[ev.file] = ev.valid ? 'valid' : 'invalid';
    }
    return result;
  }, [events]);

  // Count progress
  const totalFiles = 3;
  const completedFiles = useMemo(
    () => Object.values(fileStatus).filter((s) => s === 'valid' || s === 'invalid').length,
    [fileStatus],
  );

  if (status === 'idle') return null;

  const files = ['spec.md', 'data-model.md', 'api-design.md'];

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--accent-400)] animate-pulse" />
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            {status === 'connecting' ? 'Conectando…' :
             status === 'done' ? 'Generación completa' :
             status === 'error' ? 'Error' :
             `Generando (${completedFiles}/${totalFiles})`}
          </span>
        </div>
        {/* Progress bar */}
        {status === 'streaming' && (
          <div className="flex-1 h-1 bg-[var(--muted-border)] rounded-full overflow-hidden max-w-48">
            <div
              className="h-full bg-[linear-gradient(90deg,var(--accent-500),var(--accent-400))] rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.max(5, (completedFiles / totalFiles) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* File progress indicators */}
      <div className="grid grid-cols-3 gap-2">
        {files.map((file) => {
          const meta = FILE_META[file]!;
          const fs = fileStatus[file];
          const isCurrent = currentFile === file;
          return (
            <div
              key={file}
              className={[
                'flex items-center gap-2 text-sm px-3 py-2.5 rounded-xl border transition-all duration-300',
                fs === 'valid'
                  ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400'
                  : fs === 'invalid'
                    ? 'border-red-500/30 bg-red-500/[0.06] text-red-400'
                    : isCurrent
                      ? 'border-[rgba(var(--accent-rgb)/0.40)] bg-[rgba(var(--accent-rgb)/0.08)] text-[var(--accent-300)] shadow-lg shadow-[rgba(var(--accent-rgb)/0.05)]'
                      : 'border-[var(--muted-border)] bg-[var(--surface-header)] text-[var(--text-disabled)]',
              ].join(' ')}
            >
              {fs === 'valid' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : fs === 'invalid' ? (
                <XCircle className="w-4 h-4 shrink-0" />
              ) : isCurrent ? (
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
              ) : (
                <meta.Icon className="w-4 h-4 shrink-0 opacity-50" />
              )}
              <span className="text-xs font-medium truncate">{meta.label}</span>
            </div>
          );
        })}
      </div>

      {/* Live text preview of the currently streaming file */}
      {currentFile && accumulatedContent[currentFile] && (
        <div className="rounded-xl bg-[var(--surface-console)] border border-[var(--muted-border)] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-header)] border-b border-[var(--muted-border)]">
            <Loader2 className="w-3 h-3 text-[var(--accent-400)] animate-spin" />
            <span className="text-[11px] font-mono text-[rgba(var(--accent-rgb)/0.60)]">
              {FILE_META[currentFile]?.label ?? currentFile}
            </span>
            <span className="text-[11px] text-[var(--text-disabled)] ml-auto">
              {accumulatedContent[currentFile].length.toLocaleString()} chars
            </span>
          </div>
          <div className="p-4 max-h-72 overflow-y-auto">
            <pre className="text-[13px] text-[var(--text-secondary)] font-mono whitespace-pre-wrap leading-relaxed">
              {accumulatedContent[currentFile]}
              <span className="inline-block w-2 h-4 bg-[rgba(var(--accent-rgb)/0.80)] animate-pulse rounded-sm ml-0.5 align-text-bottom" />
            </pre>
          </div>
        </div>
      )}

      {/* Status messages */}
      {status === 'done' && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 text-sm text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Spec generado correctamente
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/[0.06] border border-red-500/20 text-sm text-red-400">
          <XCircle className="w-4 h-4 shrink-0" />
          {errorMessage ?? 'Error durante la generación'}
        </div>
      )}
    </div>
  );
}
