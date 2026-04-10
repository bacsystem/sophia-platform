'use client';

/** @description AgentFilesPanel — real-time file list with Framer Motion animations, folder grouping, and file preview */

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCode,
  Database,
  Gem,
  FileJson,
  FileText,
  Settings,
  Palette,
  Lock,
  File,
  ChevronDown,
  ChevronRight,
  FolderOpen,
} from 'lucide-react';
import { useDashboardStore, type GeneratedFile } from '@/hooks/use-dashboard-store';
import { getFileIcon } from '@sophia/shared';

interface AgentFilesPanelProps {
  onFileClick?: (file: GeneratedFile) => void;
}

const ICON_MAP: Record<string, typeof FileCode> = {
  FileCode,
  Database,
  Gem,
  FileJson,
  FileText,
  Settings,
  Palette,
  Lock,
  File,
};

/** @description Panel de archivos generados con agrupación por carpeta y animaciones de entrada */
export function AgentFilesPanel({ onFileClick }: AgentFilesPanelProps) {
  const files = useDashboardStore((s) => s.files);
  const totalFiles = useDashboardStore((s) => s.totalFiles);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const groups: Record<string, GeneratedFile[]> = {};
    for (const file of files) {
      const parts = file.path.split('/');
      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(file);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [files]);

  const toggleFolder = (folder: string) => {
    setCollapsed((prev) => ({ ...prev, [folder]: !prev[folder] }));
  };

  return (
    <div className="flex flex-col h-full console-surface">
      {/* Console-style header */}
      <div className="flex items-center justify-between px-3 py-1.5 console-header">
        <span className="text-[9px] tracking-[0.15em] uppercase text-[var(--accent-500)] font-semibold" style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}>
          ▸ Files
        </span>
        <span className="text-[10px] text-[var(--text-secondary)] font-medium" style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}>
          {totalFiles}
        </span>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto px-3 py-1">
        {files.length === 0 && (
          <p className="text-[var(--text-tertiary)] text-[10px] text-center py-4" style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}>
            No files yet
          </p>
        )}

        <AnimatePresence mode="popLayout">
          {grouped.map(([folder, folderFiles]) => (
            <div key={folder} className="mb-2">
              <button
                onClick={() => toggleFolder(folder)}
                className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors w-full text-left py-1"
                aria-label={`${collapsed[folder] ? 'Expandir' : 'Colapsar'} carpeta ${folder}`}
                aria-expanded={!collapsed[folder]}
              >
                {collapsed[folder] ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                <FolderOpen className="w-3 h-3" />
                <span className="truncate">{folder}</span>
                <span className="text-[var(--text-tertiary)] ml-auto">{folderFiles.length}</span>
              </button>

              {!collapsed[folder] && (
                <div className="ml-4 space-y-0.5">
                  {folderFiles.map((file) => (
                    <FileEntry
                      key={file.path}
                      file={file}
                      onClick={() => onFileClick?.(file)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FileEntry({ file, onClick }: { file: GeneratedFile; onClick: () => void }) {
  const iconInfo = getFileIcon(file.name);
  const IconComponent = ICON_MAP[iconInfo.component] ?? File;
  const [isNew, setIsNew] = useState(true);

  // Remove "NEW" badge after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => setIsNew(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className="flex items-center gap-2 text-xs w-full text-left py-1 px-1 rounded row-hover-bg transition-colors group"
    >
      <IconComponent className={`w-3.5 h-3.5 shrink-0 ${iconInfo.colorClass}`} />
      <span className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] truncate">
        {file.name}
      </span>
      <span className="text-[var(--text-tertiary)] text-[10px] shrink-0">
        {file.agentType}
      </span>
      {isNew && (
        <span className="bg-[var(--color-success-subtle)] text-[var(--color-success)] text-[10px] px-1 rounded shrink-0">
          NEW
        </span>
      )}
    </motion.button>
  );
}
