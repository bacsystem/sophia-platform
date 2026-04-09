'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import type { Project, ProjectStatus, ProjectListMeta } from '@sophia/shared';
import { ProjectCard } from './project-card';
import { ProjectEmptyState } from './project-empty-state';
import { DeleteProjectDialog } from './delete-project-dialog';

type FilterTab = 'all' | ProjectStatus;

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'running', label: 'En progreso' },
  { value: 'done', label: 'Completados' },
  { value: 'error', label: 'Con error' },
  { value: 'paused', label: 'Pausados' },
  { value: 'idle', label: 'Pendientes' },
];

interface ProjectGridProps {
  initialProjects: Project[];
  initialMeta: ProjectListMeta;
}

/** @description Client-side project grid with search, status filters and pagination */
export function ProjectGrid({ initialProjects, initialMeta }: ProjectGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [meta, setMeta] = useState<ProjectListMeta>(initialMeta);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  const fetchProjects = useCallback(
    async (opts: { page?: number; search?: string; status?: FilterTab }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(opts.page ?? 1),
          limit: '12',
        });
        if (opts.search) params.set('search', opts.search);
        if (opts.status && opts.status !== 'all') params.set('status', opts.status);

        const res = await fetch(`${API_URL}/api/projects?${params.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const body = await res.json();
        setProjects(body.data ?? []);
        setMeta(body.meta ?? meta);
      } finally {
        setLoading(false);
      }
    },
    [API_URL, meta],
  );

  const handleSearch = (value: string) => {
    setSearch(value);
    void fetchProjects({ search: value, status: activeFilter, page: 1 });
  };

  const handleFilter = (filter: FilterTab) => {
    setActiveFilter(filter);
    void fetchProjects({ search, status: filter, page: 1 });
  };

  const handlePage = (page: number) => {
    void fetchProjects({ search, status: activeFilter, page });
  };

  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const handleDeleteSuccess = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setMeta((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
    setDeleteTarget(null);
    setDeleteSuccess(true);
    setTimeout(() => setDeleteSuccess(false), 3000);
    router.refresh();
  };

  const isEmpty = projects.length === 0 && !loading && !search && activeFilter === 'all';

  return (
    <>
      {/* Delete success toast */}
      {deleteSuccess && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-sm text-green-400">
          Proyecto eliminado exitosamente
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar proyectos..."
            className="glass-input w-full pl-9 pr-4 py-2.5 rounded-xl text-sm"
          />
        </div>
        <Link
          href="/projects/new"
          className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nuevo proyecto
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap mb-6">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleFilter(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeFilter === tab.value
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isEmpty ? (
        <ProjectEmptyState />
      ) : (
        <>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass rounded-2xl p-5 animate-pulse h-36" />
              ))}
            </div>
          ) : (
            <>
              {projects.length === 0 ? (
                <p className="text-center text-white/40 py-16 text-sm">
                  No se encontraron proyectos.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.map((p) => (
                    <ProjectCard key={p.id} project={p} onDelete={() => setDeleteTarget(p)} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Pagination */}
          {meta.pages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {Array.from({ length: meta.pages }).map((_, i) => {
                const page = i + 1;
                const isActive = page === meta.page;
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => handlePage(page)}
                    aria-label={`Página ${page}`}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                        : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-white/10'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Delete dialog */}
      {deleteTarget && (
        <DeleteProjectDialog
          project={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onSuccess={() => handleDeleteSuccess(deleteTarget.id)}
        />
      )}
    </>
  );
}
