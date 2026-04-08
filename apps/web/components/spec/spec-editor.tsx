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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-colors disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" />
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Guardar versión
        </button>
      </div>
    </div>
  );
}
