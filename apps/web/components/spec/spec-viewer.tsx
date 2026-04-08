'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, Pencil } from 'lucide-react';
import { SpecEditor } from './spec-editor';
import '@uiw/react-md-editor/markdown-editor.css';

// MDEditor.Markdown — read-only markdown renderer (client-only)
const MarkdownPreview = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default.Markdown),
  { ssr: false },
);

export interface SpecFiles {
  spec: string;
  dataModel: string;
  apiDesign: string;
}

type DocTab = 'spec' | 'dataModel' | 'apiDesign';

const TABS: { value: DocTab; label: string }[] = [
  { value: 'spec', label: 'spec.md' },
  { value: 'dataModel', label: 'data-model.md' },
  { value: 'apiDesign', label: 'api-design.md' },
];

interface SpecViewerProps {
  files: SpecFiles;
  valid: boolean;
  onSave: (files: SpecFiles) => Promise<void>;
}

/** @description Tabbed markdown viewer and editor for spec, data model, and API design documents. Shows validity badge for incomplete specs. */
export function SpecViewer({ files, valid, onSave }: SpecViewerProps) {
  const [activeTab, setActiveTab] = useState<DocTab>('spec');
  const [editMode, setEditMode] = useState(false);
  const [editedFiles, setEditedFiles] = useState<SpecFiles>({ ...files });
  const [isSaving, setIsSaving] = useState(false);

  // Reset edited files when parent files change (e.g. after version change)
  const hasEdited =
    editedFiles.spec !== files.spec ||
    editedFiles.dataModel !== files.dataModel ||
    editedFiles.apiDesign !== files.apiDesign;

  const handleFileChange = (value: string) => {
    setEditedFiles((prev) => ({ ...prev, [activeTab]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedFiles);
      setEditMode(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedFiles({ ...files });
    setEditMode(false);
  };

  const activeContent = editMode ? editedFiles[activeTab] : files[activeTab];

  return (
    <div className="space-y-4">
      {/* Validity badge */}
      {!valid && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Generación incompleta — algunos documentos no superaron la validación</span>
        </div>
      )}

      {/* Sub-tab bar + edit toggle */}
      <div className="flex items-center justify-between border-b border-white/10">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 text-xs font-mono transition-colors ${
                activeTab === tab.value
                  ? 'text-white border-b-2 border-violet-400 -mb-px'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {!editMode && (
          <button
            type="button"
            onClick={() => {
              setEditedFiles({ ...files });
              setEditMode(true);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-colors mb-px"
            aria-label="Editar documento"
          >
            <Pencil className="w-3 h-3" />
            Editar
          </button>
        )}
      </div>

      {/* Content area */}
      {editMode ? (
        <SpecEditor
          content={activeContent}
          onChange={handleFileChange}
          onSave={handleSave}
          onCancel={handleCancel}
          isSaving={isSaving}
        />
      ) : (
        <div
          className="rounded-xl bg-black/20 border border-white/10 p-4 max-h-[600px] overflow-y-auto min-h-[200px]"
          data-color-mode="dark"
        >
          {activeContent ? (
            <MarkdownPreview
              source={activeContent}
              style={{ background: 'transparent', color: 'rgba(255,255,255,0.8)' }}
            />
          ) : (
            <p className="text-white/30 text-sm text-center py-8">Sin contenido en este documento</p>
          )}
        </div>
      )}

      {/* Unsaved changes indicator */}
      {editMode && hasEdited && (
        <p className="text-xs text-amber-400/70">● Cambios no guardados en otros documentos</p>
      )}
    </div>
  );
}
