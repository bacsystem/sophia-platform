import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import prisma from '../../lib/prisma.js';

const PROJECTS_BASE_DIR = process.env.PROJECTS_BASE_DIR ?? './projects';

/** @description Max file size displayed in viewer (1 MB) */
const MAX_PREVIEW_BYTES = 1_048_576;

export interface FileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  extension?: string;
  sizeBytes?: number;
  agentType?: string;
  createdAt?: string;
  children?: FileTreeNode[];
}

/** @description Validate project ownership and return project */
export async function getProjectForUser(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, userId: true, status: true, name: true },
  });
  if (!project || project.userId !== userId) {
    throw Object.assign(new Error('Project not found'), { code: 'NOT_FOUND' });
  }
  return project;
}

/** @description Build file tree from generated_files for a project */
export async function getFileTree(projectId: string) {
  const files = await prisma.generatedFile.findMany({
    where: { projectId },
    orderBy: { path: 'asc' },
    include: { agent: { select: { type: true } } },
  });

  const root: FileTreeNode[] = [];
  const dirMap = new Map<string, FileTreeNode>();

  for (const file of files) {
    const parts = file.path.split('/');
    let currentChildren = root;

    // Create intermediate directories
    for (let i = 0; i < parts.length - 1; i++) {
      const dirPath = parts.slice(0, i + 1).join('/');
      let dirNode = dirMap.get(dirPath);
      if (!dirNode) {
        dirNode = {
          id: `dir-${dirPath}`,
          name: parts[i],
          type: 'directory',
          children: [],
        };
        dirMap.set(dirPath, dirNode);
        currentChildren.push(dirNode);
      }
      currentChildren = dirNode.children!;
    }

    // Add file node
    const ext = path.extname(file.name);
    currentChildren.push({
      id: file.id,
      name: file.name,
      type: 'file',
      extension: ext || undefined,
      sizeBytes: file.sizeBytes,
      agentType: file.agent.type,
      createdAt: file.createdAt.toISOString(),
    });
  }

  const totalFiles = files.length;
  const totalSizeBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);

  return { tree: root, totalFiles, totalSizeBytes };
}

/** @description Read file content with path traversal prevention */
export async function getFileContent(projectId: string, fileId: string) {
  const file = await prisma.generatedFile.findFirst({
    where: { id: fileId, projectId },
    include: { agent: { select: { type: true } } },
  });

  if (!file) {
    throw Object.assign(new Error('File not found'), { code: 'NOT_FOUND' });
  }

  const projectDir = path.resolve(PROJECTS_BASE_DIR, projectId);
  const filePath = path.resolve(projectDir, file.path);

  // Path traversal prevention
  if (!filePath.startsWith(projectDir + path.sep) && filePath !== projectDir) {
    throw Object.assign(new Error('Invalid file path'), { code: 'FORBIDDEN' });
  }

  let content: string;
  let truncated = false;
  try {
    const stat = await fs.stat(filePath);
    if (stat.size > MAX_PREVIEW_BYTES) {
      const buffer = Buffer.alloc(MAX_PREVIEW_BYTES);
      const fh = await fs.open(filePath, 'r');
      try {
        await fh.read(buffer, 0, MAX_PREVIEW_BYTES, 0);
      } finally {
        await fh.close();
      }
      content = buffer.toString('utf-8');
      truncated = true;
    } else {
      content = await fs.readFile(filePath, 'utf-8');
    }
  } catch {
    throw Object.assign(new Error('File not found on disk'), { code: 'FILE_NOT_FOUND' });
  }

  const lineCount = content.split('\n').length;
  const ext = path.extname(file.name);

  return {
    id: file.id,
    name: file.name,
    path: file.path,
    content,
    extension: ext || undefined,
    sizeBytes: file.sizeBytes,
    agentType: file.agent.type,
    createdAt: file.createdAt.toISOString(),
    lineCount,
    truncated,
  };
}

/** @description Get raw file stream for individual download with path traversal prevention */
export async function getRawFile(projectId: string, fileId: string) {
  const file = await prisma.generatedFile.findFirst({
    where: { id: fileId, projectId },
  });

  if (!file) {
    throw Object.assign(new Error('File not found'), { code: 'NOT_FOUND' });
  }

  const projectDir = path.resolve(PROJECTS_BASE_DIR, projectId);
  const filePath = path.resolve(projectDir, file.path);

  // Path traversal prevention
  if (!filePath.startsWith(projectDir + path.sep) && filePath !== projectDir) {
    throw Object.assign(new Error('Invalid file path'), { code: 'FORBIDDEN' });
  }

  if (!existsSync(filePath)) {
    throw Object.assign(new Error('File not found on disk'), { code: 'FILE_NOT_FOUND' });
  }

  const stream = createReadStream(filePath);
  return { stream, name: file.name };
}

/** @description Generate ZIP stream of project files — only when status is done or paused */
export async function downloadProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { status: true, name: true },
  });

  if (!project) {
    throw Object.assign(new Error('Project not found'), { code: 'NOT_FOUND' });
  }

  if (project.status !== 'done' && project.status !== 'paused') {
    throw Object.assign(
      new Error('Project must be completed or paused to download'),
      { code: 'INVALID_STATUS' },
    );
  }

  const files = await prisma.generatedFile.findMany({
    where: { projectId },
    select: { path: true },
  });

  const projectDir = path.resolve(PROJECTS_BASE_DIR, projectId);
  const archive = archiver('zip', { zlib: { level: 6 } });

  for (const file of files) {
    const filePath = path.resolve(projectDir, file.path);
    // Path traversal prevention
    if (filePath.startsWith(projectDir + path.sep) && existsSync(filePath)) {
      archive.file(filePath, { name: file.path });
    }
  }

  // Slug the project name for the filename
  const slug = project.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const zipName = `${slug}-sophia.zip`;

  archive.finalize();

  return { archive, zipName };
}
