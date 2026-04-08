import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Project } from '@sophia/shared';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';

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

/** @description Dashboard page — real-time agent monitoring for a project */
export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await fetchProject(id);

  if (!project) notFound();

  const startedAt = project.status !== 'idle' ? project.updatedAt : null;

  return (
    <DashboardLayout
      projectId={project.id}
      projectName={project.name}
      startedAt={startedAt}
    />
  );
}
