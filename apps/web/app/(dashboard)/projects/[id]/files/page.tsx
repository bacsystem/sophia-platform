import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Project } from '@sophia/shared';
import type { FileTreeNodeData } from '@/lib/file-tree-builder';
import { FileManagerClient } from './file-manager-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface FileTreeResponse {
  data: {
    tree: FileTreeNodeData[];
    totalFiles: number;
    totalSizeBytes: number;
  };
}

async function fetchProject(id: string, cookieHeader: string): Promise<Project | null> {
  try {
    const res = await fetch(`${API_URL}/api/projects/${id}`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.data ?? null;
  } catch {
    return null;
  }
}

async function fetchFileTree(projectId: string, cookieHeader: string): Promise<FileTreeResponse['data'] | null> {
  try {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/files`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.data ?? null;
  } catch {
    return null;
  }
}

/** @description File manager page — tree sidebar + file viewer panel */
export default async function FileManagerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;
  const refreshToken = cookieStore.get('refresh_token')?.value;

  const cookieHeader = [
    accessToken ? `access_token=${accessToken}` : null,
    refreshToken ? `refresh_token=${refreshToken}` : null,
  ]
    .filter(Boolean)
    .join('; ');

  const [project, fileData] = await Promise.all([
    fetchProject(id, cookieHeader),
    fetchFileTree(id, cookieHeader),
  ]);

  if (!project) notFound();

  return (
    <div className="space-y-4">
      <Link
        href={`/projects/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al proyecto
      </Link>

      <FileManagerClient
        project={project}
        tree={fileData?.tree ?? []}
        totalFiles={fileData?.totalFiles ?? 0}
        totalSizeBytes={fileData?.totalSizeBytes ?? 0}
      />
    </div>
  );
}
