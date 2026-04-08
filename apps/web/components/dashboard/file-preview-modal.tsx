'use client';

/** @description FilePreviewModal — modal with file content and shiki syntax highlighting */

import { useEffect, useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import type { GeneratedFile } from '@/hooks/use-dashboard-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface FilePreviewModalProps {
  file: GeneratedFile;
  projectId: string;
  onClose: () => void;
}

/** @description Modal overlay showing file content with syntax highlighting via shiki */
export function FilePreviewModal({ file, projectId, onClose }: FilePreviewModalProps) {
  const [content, setContent] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Fetch file content
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_URL}/api/projects/${projectId}/files/${encodeURIComponent(file.path)}`,
          { credentials: 'include' },
        );
        if (res.ok) {
          const body = await res.json();
          setContent(body.data?.content ?? '');
        } else {
          setContent('// Error loading file content');
        }
      } catch {
        setContent('// Error loading file content');
      }
      setLoading(false);
    }
    load();
  }, [projectId, file.path]);

  // Syntax highlight with shiki
  useEffect(() => {
    if (content === null) return;

    async function highlight() {
      try {
        const { codeToHtml } = await import('shiki');
        const lang = getLang(file.name);
        const html = await codeToHtml(content!, {
          lang,
          theme: 'github-dark',
        });
        setHighlighted(html);
      } catch {
        // Fallback: plain text
        setHighlighted(
          `<pre class="p-4 text-sm"><code>${escapeHtml(content!)}</code></pre>`,
        );
      }
    }
    highlight();
  }, [content, file.name]);

  const handleCopy = async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Vista previa: ${file.path}`}
    >
      <div className="bg-gray-900 border border-white/10 rounded-xl shadow-2xl w-[90vw] max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div>
            <h3 className="text-sm font-medium text-white">{file.name}</h3>
            <p className="text-xs text-white/40">{file.path}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="text-white/40 hover:text-white/70 transition-colors p-1"
              aria-label="Copiar contenido"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white/70 transition-colors p-1"
              aria-label="Cerrar vista previa"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : (
            <div
              className="text-sm [&_pre]:p-4 [&_pre]:m-0 [&_pre]:bg-transparent [&_code]:text-xs"
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function getLang(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    json: 'json',
    sql: 'sql',
    prisma: 'prisma',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
    css: 'css',
    html: 'html',
    env: 'shell',
    sh: 'shell',
    dockerfile: 'dockerfile',
  };
  return map[ext] ?? 'text';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
