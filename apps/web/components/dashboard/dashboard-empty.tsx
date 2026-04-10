'use client';

/** @description DashboardEmpty — idle state shown before project generation starts */

import { Cpu } from 'lucide-react';

interface DashboardEmptyProps {
  projectId: string;
}

/** @description Empty state for the dashboard when project has not started generating */
export function DashboardEmpty({ projectId: _projectId }: DashboardEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center py-16">
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-[var(--surface-header)] border border-[var(--muted-border)] flex items-center justify-center">
          <Cpu className="w-9 h-9 text-[rgba(var(--accent-rgb)/0.30)]" />
        </div>
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[rgba(var(--accent-rgb)/0.20)] border border-[rgba(var(--accent-rgb)/0.30)] animate-pulse" />
      </div>
      <div>
        <h2 className="text-sm font-bold tracking-wider text-[var(--text-secondary)] uppercase" style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)" }}>
          Dashboard de Agentes
        </h2>
        <p className="text-xs text-[var(--text-disabled)] mt-2 max-w-sm leading-relaxed" style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}>
          Inicia la generación del proyecto para ver el progreso de los agentes en tiempo real.
          El canvas se activará cuando el primer agente comience a trabajar.
        </p>
      </div>
    </div>
  );
}
