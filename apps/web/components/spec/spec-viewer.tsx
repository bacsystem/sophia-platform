'use client';

import { useState } from 'react';
import { AlertTriangle, Pencil, FileText, Database, Plug } from 'lucide-react';
import { SpecEditor } from './spec-editor';
import { PremiumMarkdown } from '@/components/ui/premium-markdown';

export interface SpecFiles {
  spec: string;
  dataModel: string;
  apiDesign: string;
}

type DocTab = 'spec' | 'dataModel' | 'apiDesign';

const TABS: { value: DocTab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'spec', label: 'spec.md', Icon: FileText },
  { value: 'dataModel', label: 'data-model.md', Icon: Database },
  { value: 'apiDesign', label: 'api-design.md', Icon: Plug },
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
      <div className="flex items-center justify-between border-b border-[var(--muted-border)]">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-mono transition-colors ${
                activeTab === tab.value
                  ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent-400)] -mb-px bg-[rgba(var(--accent-rgb)/0.06)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-header)]'
              }`}
            >
              <tab.Icon className="w-3.5 h-3.5" />
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
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-[var(--muted-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-disabled)] transition-colors mb-px"
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
        <div className="rounded-xl bg-[var(--surface-console)] border border-[var(--muted-border)] max-h-[700px] overflow-y-auto min-h-[200px]">
          {activeContent ? (
            <div className="p-6 md:p-8">
              <PremiumMarkdown source={activeContent} />
            </div>
          ) : (
            <p className="text-[var(--text-tertiary)] text-sm text-center py-12">Sin contenido en este documento</p>
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
