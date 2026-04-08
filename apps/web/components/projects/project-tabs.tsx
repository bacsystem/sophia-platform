'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Project } from '@sophia/shared';
import { ProjectSpecViewer } from './project-spec-viewer';

type Tab = 'dashboard' | 'files' | 'logs' | 'spec';

const TABS: { value: Tab; label: string }[] = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'files', label: 'Archivos' },
  { value: 'logs', label: 'Logs' },
  { value: 'spec', label: 'Spec' },
];

interface ProjectTabsProps {
  project: Project;
}

/** @description Tabbed interface: Dashboard/Archivos/Logs placeholders + Spec viewer */
export function ProjectTabs({ project }: ProjectTabsProps) {
  const [active, setActive] = useState<Tab>('dashboard');

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-white/10">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActive(tab.value)}
            className={`px-5 py-3 text-sm font-medium transition-colors ${
              active === tab.value
                ? 'text-white border-b-2 border-violet-400 -mb-px'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {active === 'dashboard' && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-white/30 text-sm">Dashboard disponible en M5</p>
          </div>
        )}
        {active === 'files' && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Link
              href={`/projects/${project.id}/files`}
              className="text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors"
            >
              Abrir gestor de archivos →
            </Link>
          </div>
        )}
        {active === 'logs' && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-white/30 text-sm">Logs de agentes disponibles en M4</p>
          </div>
        )}
        {active === 'spec' && <ProjectSpecViewer project={project} />}
      </div>
    </div>
  );
}
