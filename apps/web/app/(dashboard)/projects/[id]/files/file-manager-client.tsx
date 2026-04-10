'use client';

import { useState, useCallback } from 'react';
import type { Project } from '@sophia/shared';
import type { FileTreeNodeData } from '@/lib/file-tree-builder';
import { FileTree } from '@/components/files/file-tree';
import { FileViewer } from '@/components/files/file-viewer';
import { FileBreadcrumb } from '@/components/files/file-breadcrumb';
import { DownloadButton } from '@/components/files/download-button';
import { FileCode } from 'lucide-react';

interface FileManagerClientProps {
  project: Project;
  tree: FileTreeNodeData[];
  totalFiles: number;
  totalSizeBytes: number;
}

/** @description Client-side file manager layout — tree sidebar + viewer panel */
export function FileManagerClient({ project, tree, totalFiles, totalSizeBytes }: FileManagerClientProps) {
  const [selectedFile, setSelectedFile] = useState<FileTreeNodeData | null>(null);

  const handleSelectFile = useCallback((node: FileTreeNodeData) => {
    if (node.type === 'file') {
      setSelectedFile(node);
    }
  }, []);

  const handleBreadcrumbNavigate = useCallback(
    (path: string) => {
      // Find directory in tree and expand it
      const dirId = `dir-${path}`;
      const dirNode = findNode(tree, dirId);
      if (dirNode) {
        // Just scroll to dir — selecting a dir is not a file action
      }
    },
    [tree],
  );

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--muted-border)]">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{project.name}</h2>
          <span className="text-xs text-[var(--text-disabled)]">Archivos generados</span>
        </div>
        <DownloadButton
          projectId={project.id}
          projectStatus={project.status}
          totalSizeBytes={totalSizeBytes}
        />
      </div>

      {/* Breadcrumb */}
      {selectedFile && (
          <div className="px-4 py-2 border-b border-[var(--muted-border)] bg-[var(--surface-header)]">
          <FileBreadcrumb
            path={selectedFile.path}
            onNavigate={handleBreadcrumbNavigate}
          />
        </div>
      )}

      {/* Main content — sidebar + viewer */}
      <div className="flex flex-col md:flex-row" style={{ minHeight: '60vh' }}>
        {/* Tree sidebar */}
          <div className="w-full md:w-72 lg:w-80 border-b md:border-b-0 md:border-r border-[var(--muted-border)] shrink-0 max-h-[40vh] md:max-h-none overflow-hidden">
          <FileTree
            tree={tree}
            totalFiles={totalFiles}
            totalSizeBytes={totalSizeBytes}
            selectedFileId={selectedFile?.id ?? null}
            onSelectFile={handleSelectFile}
          />
        </div>

        {/* Viewer panel */}
        <div className="flex-1 min-w-0">
          {selectedFile ? (
            <FileViewer projectId={project.id} fileId={selectedFile.id} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center">
              <FileCode className="w-12 h-12 text-[var(--text-disabled)] mb-3" />
              <p className="text-[var(--text-disabled)] text-sm">Selecciona un archivo del árbol para ver su contenido</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function findNode(nodes: FileTreeNodeData[], id: string): FileTreeNodeData | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}
