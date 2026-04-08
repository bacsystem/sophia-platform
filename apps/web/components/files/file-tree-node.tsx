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

const EXTENSION_ICONS: Record<string, { icon: typeof File; className: string }> = {
  '.ts': { icon: FileCode, className: 'text-blue-400' },
  '.tsx': { icon: FileCode, className: 'text-blue-400' },
  '.js': { icon: FileCode, className: 'text-yellow-400' },
  '.jsx': { icon: FileCode, className: 'text-yellow-400' },
  '.sql': { icon: Database, className: 'text-emerald-400' },
  '.prisma': { icon: Gem, className: 'text-indigo-400' },
  '.json': { icon: FileJson, className: 'text-amber-400' },
  '.md': { icon: FileText, className: 'text-gray-400' },
  '.yml': { icon: Settings, className: 'text-pink-400' },
  '.yaml': { icon: Settings, className: 'text-pink-400' },
  '.css': { icon: Palette, className: 'text-sky-400' },
  '.env': { icon: Lock, className: 'text-red-400' },
};

function getFileIcon(extension?: string) {
  if (!extension) return { icon: File, className: 'text-white/40' };
  return EXTENSION_ICONS[extension] ?? { icon: File, className: 'text-white/40' };
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
    ? { icon: isExpanded ? FolderOpen : Folder, className: 'text-violet-400' }
    : getFileIcon(node.extension);

  const agentColor = node.agentType ? AGENT_COLORS[node.agentType] : null;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-left text-sm rounded transition-colors ${
          isSelected
            ? 'bg-violet-500/20 text-white'
            : 'text-white/70 hover:bg-white/5 hover:text-white'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {isDir && (
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-white/40" />
            ) : (
              <ChevronRight className="w-3 h-3 text-white/40" />
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
          <span className="text-xs text-white/30 shrink-0">{formatSize(node.sizeBytes)}</span>
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
