export interface FileTreeNodeData {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  extension?: string;
  sizeBytes?: number;
  agentType?: string;
  createdAt?: string;
  children?: FileTreeNodeData[];
}

/** @description Build nested tree from flat file paths (client-side fallback) */
export function buildFileTree(
  files: { id: string; name: string; path: string; sizeBytes: number; agentType: string; createdAt: string }[],
): FileTreeNodeData[] {
  const root: FileTreeNodeData[] = [];
  const dirMap = new Map<string, FileTreeNodeData>();

  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sorted) {
    const parts = file.path.split('/');
    let currentChildren = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const dirPath = parts.slice(0, i + 1).join('/');
      let dirNode = dirMap.get(dirPath);
      if (!dirNode) {
        dirNode = {
          id: `dir-${dirPath}`,
          name: parts[i],
          path: dirPath,
          type: 'directory',
          children: [],
        };
        dirMap.set(dirPath, dirNode);
        currentChildren.push(dirNode);
      }
      currentChildren = dirNode.children!;
    }

    const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : undefined;
    currentChildren.push({
      id: file.id,
      name: file.name,
      path: file.path,
      type: 'file',
      extension: ext,
      sizeBytes: file.sizeBytes,
      agentType: file.agentType,
      createdAt: file.createdAt,
    });
  }

  return root;
}

/** @description Flatten tree for search filtering */
export function flattenTree(nodes: FileTreeNodeData[], parentPath = ''): FileTreeNodeData[] {
  const result: FileTreeNodeData[] = [];
  for (const node of nodes) {
    const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;
    if (node.type === 'file') {
      result.push({ ...node, name: fullPath });
    }
    if (node.children) {
      result.push(...flattenTree(node.children, fullPath));
    }
  }
  return result;
}
