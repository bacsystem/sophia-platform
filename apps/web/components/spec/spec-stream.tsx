'use client';

import { useMemo } from 'react';
import { Loader2, CheckCircle2, XCircle, FileText, Database, Plug } from 'lucide-react';
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

  if (status === 'idle') return null;

  const files = ['spec.md', 'data-model.md', 'api-design.md'];

  return (
    <div className="space-y-4">
      {/* File progress indicators */}
      <div className="flex gap-3">
        {files.map((file) => {
          const meta = FILE_META[file]!;
          const fs = fileStatus[file];
          return (
            <div
              key={file}
              className={[
                'flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors',
                fs === 'valid' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' :
                fs === 'invalid' ? 'border-red-500/40 bg-red-500/10 text-red-400' :
                fs === 'streaming' ? 'border-violet-500/40 bg-violet-500/10 text-violet-300' :
                'border-white/10 bg-white/5 text-white/40',
              ].join(' ')}
            >
              {fs === 'valid' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
               fs === 'invalid' ? <XCircle className="w-3.5 h-3.5" /> :
               fs === 'streaming' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
               <meta.Icon className="w-3.5 h-3.5" />}
              {meta.label}
            </div>
          );
        })}
      </div>

      {/* Live text preview of the currently streaming file */}
      {currentFile && accumulatedContent[currentFile] && (
        <div className="rounded-xl bg-black/40 border border-white/10 p-4 max-h-64 overflow-y-auto">
          <pre className="text-xs text-white/70 font-mono whitespace-pre-wrap leading-relaxed">
            {accumulatedContent[currentFile]}
            <span className="animate-pulse">▋</span>
          </pre>
        </div>
      )}

      {/* Status messages */}
      {status === 'connecting' && (
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="w-4 h-4 animate-spin" />
          Conectando…
        </div>
      )}

      {status === 'done' && (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="w-4 h-4" />
          Spec generado correctamente
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <XCircle className="w-4 h-4" />
          {errorMessage ?? 'Error durante la generación'}
        </div>
      )}
    </div>
  );
}
