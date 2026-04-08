'use client';

import { useState, useCallback, useMemo } from 'react';
import { Files } from 'lucide-react';
import type { FileTreeNodeData } from '@/lib/file-tree-builder';
import { FileTreeNode } from './file-tree-node';
import { FileSearch } from './file-search';

interface FileTreeProps {
  tree: FileTreeNodeData[];
  totalFiles: number;
  totalSizeBytes: number;
  selectedFileId: string | null;
  onSelectFile: (node: FileTreeNodeData) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function collectAllDirIds(nodes: FileTreeNodeData[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.type === 'directory') {
      ids.push(node.id);
      if (node.children) ids.push(...collectAllDirIds(node.children));
    }
  }
  return ids;
}

function filterTree(nodes: FileTreeNodeData[], query: string): FileTreeNodeData[] {
  const lower = query.toLowerCase();
  const result: FileTreeNodeData[] = [];

  for (const node of nodes) {
    if (node.type === 'file') {
      if (node.name.toLowerCase().includes(lower)) {
        result.push(node);
      }
    } else if (node.children) {
      const filtered = filterTree(node.children, query);
      if (filtered.length > 0) {
        result.push({ ...node, children: filtered });
      }
    }
  }

  return result;
}

/** @description Collapsible file tree sidebar with search and stats */
export function FileTree({
  tree,
  totalFiles,
  totalSizeBytes,
  selectedFileId,
  onSelectFile,
}: FileTreeProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(
    () => new Set(collectAllDirIds(tree)),
  );
  const [searchQuery, setSearchQuery] = useState('');

  const handleToggleDir = useCallback((dirId: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirId)) {
        next.delete(dirId);
      } else {
        next.add(dirId);
      }
      return next;
    });
  }, []);

  const displayTree = useMemo(
    () => (searchQuery ? filterTree(tree, searchQuery) : tree),
    [tree, searchQuery],
  );

  // When searching, expand all matching dirs
  const displayExpanded = useMemo(() => {
    if (!searchQuery) return expandedDirs;
    return new Set(collectAllDirIds(displayTree));
  }, [searchQuery, displayTree, expandedDirs]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <Files className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-medium text-white">Archivos</span>
          <span className="text-xs text-white/30 ml-auto">
            {totalFiles} archivos &middot; {formatSize(totalSizeBytes)}
          </span>
        </div>
        <FileSearch onSearch={setSearchQuery} />
      </div>

      <div className="flex-1 overflow-y-auto p-1">
        {displayTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-white/30 text-sm">
              {searchQuery ? 'No se encontraron archivos' : 'Sin archivos generados'}
            </p>
          </div>
        ) : (
          displayTree.map((node) => (
            <FileTreeNode
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedFileId}
              expandedDirs={displayExpanded}
              onSelect={onSelectFile}
              onToggleDir={handleToggleDir}
            />
          ))
        )}
      </div>
    </div>
  );
}
