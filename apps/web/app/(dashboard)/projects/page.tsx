import { cookies } from 'next/headers';
import type { Project, ProjectListMeta } from '@sophia/shared';
import { ProjectGrid } from '@/components/projects/project-grid';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function fetchProjects(): Promise<{ projects: Project[]; meta: ProjectListMeta }> {
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
    const res = await fetch(`${API_URL}/api/projects?page=1&limit=12`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return { projects: [], meta: { total: 0, page: 1, limit: 12, pages: 0 } };
    const body = await res.json();
    return { projects: body.data ?? [], meta: body.meta ?? { total: 0, page: 1, limit: 12, pages: 0 } };
  } catch {
    return { projects: [], meta: { total: 0, page: 1, limit: 12, pages: 0 } };
  }
}

/** @description Projects list page — server component that fetches initial data */
export default async function ProjectsPage() {
  const { projects, meta } = await fetchProjects();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mis proyectos</h1>
          <p className="text-sm text-white/40 mt-1">
            {meta.total > 0 ? `${meta.total} proyecto${meta.total !== 1 ? 's' : ''}` : 'Sin proyectos aún'}
          </p>
        </div>
      </div>

      <ProjectGrid initialProjects={projects} initialMeta={meta} />
    </div>
  );
}
