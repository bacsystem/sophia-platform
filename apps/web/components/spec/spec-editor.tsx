'use client';

import dynamic from 'next/dynamic';
import { Loader2, Save, X } from 'lucide-react';
import '@uiw/react-md-editor/markdown-editor.css';

// SSR-incompatible — loaded only on client
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

interface SpecEditorProps {
  content: string;
  onChange: (value: string) => void;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

/** @description Markdown editor using @uiw/react-md-editor for editing spec documents. */
export function SpecEditor({ content, onChange, onSave, onCancel, isSaving = false }: SpecEditorProps) {
  const handleSave = async () => {
    await onSave();
  };

  return (
    <div className="space-y-3" data-color-mode="dark">
      <MDEditor
        value={content}
        onChange={(val) => onChange(val ?? '')}
        height={480}
        preview="live"
        className="!bg-transparent"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-[var(--muted-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-disabled)] transition-colors disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" />
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg font-medium disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Guardar versión
        </button>
      </div>
    </div>
  );
}
