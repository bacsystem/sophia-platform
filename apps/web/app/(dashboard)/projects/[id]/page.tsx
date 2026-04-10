import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Project } from '@sophia/shared';
import { ProjectDetail } from '@/components/projects/project-detail';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function fetchProject(id: string): Promise<Project | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;
  const refreshToken = cookieStore.get('refresh_token')?.value;

  const cookieHeader = [
    accessToken ? `access_token=${accessToken}` : null,
    refreshToken ? `refresh_token=${refreshToken}` : null,
  ]
    .filter(Boolean)
    .join('; ');

  try {
    const res = await fetch(`${API_URL}/api/projects/${id}`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (res.status === 404 || res.status === 403) return null;
    if (!res.ok) return null;
    const body = await res.json();
    return body.data ?? null;
  } catch {
    return null;
  }
}

/** @description Project detail page — fetches project and renders ProjectDetail */
export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await fetchProject(id);

  if (!project) notFound();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Mis proyectos
      </Link>

      <ProjectDetail project={project} />
    </div>
  );
}
