'use client';

/** @description DashboardEmpty — idle state shown before project generation starts */

import { Cpu } from 'lucide-react';

interface DashboardEmptyProps {
  projectId: string;
}

/** @description Empty state for the dashboard when project has not started generating */
export function DashboardEmpty({ projectId: _projectId }: DashboardEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
        <Cpu className="w-8 h-8 text-white/30" />
      </div>
      <div>
        <h2 className="text-sm font-medium text-white/60">Dashboard de Agentes</h2>
        <p className="text-xs text-white/30 mt-1 max-w-sm">
          Inicia la generación del proyecto para ver el progreso de los agentes en tiempo real.
          El canvas se activará cuando el primer agente comience a trabajar.
        </p>
      </div>
    </div>
  );
}
