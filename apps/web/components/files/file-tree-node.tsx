'use client';

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
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
} from 'lucide-react';
import { getFileIcon as getSharedFileIcon } from '@sophia/shared';
import type { FileTreeNodeData } from '@/lib/file-tree-builder';

const AGENT_COLORS: Record<string, string> = {
  'dba-agent': 'bg-blue-500',
  'seed-agent': 'bg-teal-500',
  'backend-agent': 'bg-green-500',
  'frontend-agent': 'bg-purple-500',
  'qa-agent': 'bg-orange-500',
  'security-agent': 'bg-red-500',
  'docs-agent': 'bg-yellow-500',
  'deploy-agent': 'bg-cyan-500',
  'integration-agent': 'bg-pink-500',
};

const ICON_COMPONENTS: Record<string, typeof File> = {
  FileCode, Database, Gem, FileJson, FileText, Settings, Palette, Lock, File,
};

function getFileIcon(extension?: string) {
  if (!extension) return { icon: File, className: 'text-gray-500' };
  const entry = getSharedFileIcon(extension);
  const IconComp = ICON_COMPONENTS[entry.component] ?? File;
  return { icon: IconComp, className: entry.colorClass };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileTreeNodeProps {
  node: FileTreeNodeData;
  depth: number;
  selectedId: string | null;
  expandedDirs: Set<string>;
  onSelect: (node: FileTreeNodeData) => void;
  onToggleDir: (dirId: string) => void;
}

/** @description Individual tree node — file or collapsible directory */
export function FileTreeNode({
  node,
  depth,
  selectedId,
  expandedDirs,
  onSelect,
  onToggleDir,
}: FileTreeNodeProps) {
  const isDir = node.type === 'directory';
  const isExpanded = expandedDirs.has(node.id);
  const isSelected = node.id === selectedId;

  const handleClick = () => {
    if (isDir) {
      onToggleDir(node.id);
    } else {
      onSelect(node);
    }
  };

  const { icon: IconComponent, className: iconClass } = isDir
    ? { icon: isExpanded ? FolderOpen : Folder, className: 'text-[var(--accent-400)]' }
    : getFileIcon(node.extension);

  const agentColor = node.agentType ? AGENT_COLORS[node.agentType] : null;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-left text-sm rounded transition-colors ${
          isSelected
            ? 'bg-[rgba(var(--accent-rgb)/0.20)] text-[var(--text-primary)]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--row-hover)] hover:text-[var(--text-primary)]'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {isDir && (
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-[var(--text-tertiary)]" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[var(--text-tertiary)]" />
            )}
          </span>
        )}
        {!isDir && <span className="w-4 h-4 shrink-0" />}

        <IconComponent className={`w-4 h-4 shrink-0 ${iconClass}`} />

        <span className="truncate flex-1">{node.name}</span>

        {agentColor && (
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${agentColor}`}
            title={node.agentType}
          />
        )}

        {node.sizeBytes != null && !isDir && (
          <span className="text-xs text-[var(--text-tertiary)] shrink-0">{formatSize(node.sizeBytes)}</span>
        )}
      </button>

      {isDir && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedDirs={expandedDirs}
              onSelect={onSelect}
              onToggleDir={onToggleDir}
            />
          ))}
        </div>
      )}
    </>
  );
}
