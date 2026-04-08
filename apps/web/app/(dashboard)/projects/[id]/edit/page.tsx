import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Project } from '@sophia/shared';
import { ProjectForm } from '@/components/projects/project-form';

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
    if (!res.ok) return null;
    const body = await res.json();
    return body.data ?? null;
  } catch {
    return null;
  }
}

/** @description Edit project page — fetches project and renders ProjectForm in edit mode */
export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await fetchProject(id);

  if (!project) notFound();

  // Only editable when idle
  if (project.status !== 'idle') notFound();

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-slide-up">
      <div className="space-y-1">
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {project.name}
        </Link>
        <h1 className="text-2xl font-bold text-white">Editar proyecto</h1>
        <p className="text-sm text-white/40">
          Solo se puede editar un proyecto en estado pendiente.
        </p>
      </div>

      <div className="glass rounded-2xl p-6 sm:p-8">
        <ProjectForm project={project} />
      </div>
    </div>
  );
}
