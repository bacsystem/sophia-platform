'use client';

import { CheckCircle2, XCircle, ChevronDown } from 'lucide-react';

export interface VersionInfo {
  version: number;
  createdAt: string;
  source: string;
  valid: boolean;
}

interface SpecVersionSelectorProps {
  versions: VersionInfo[];
  selectedVersion: number;
  onChange: (version: number) => void;
}

/** @description Dropdown selector for spec versions, showing validity status and source. */
export function SpecVersionSelector({ versions, selectedVersion, onChange }: SpecVersionSelectorProps) {
  if (versions.length === 0) return null;

  return (
    <div className="relative inline-flex items-center gap-2">
      <span className="text-xs text-[var(--text-tertiary)]">Versión</span>
      <div className="relative">
        <select
          value={selectedVersion}
          onChange={(e) => onChange(Number(e.target.value))}
          className="select-themed appearance-none pl-3 pr-8 py-1.5 text-sm focus:outline-none focus:border-[rgba(var(--accent-rgb)/0.50)] cursor-pointer"
          aria-label="Seleccionar versión de spec"
        >
          {versions.map((v) => {
            const date = new Date(v.createdAt).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            });
            const label = `v${v.version} — ${date}${v.source === 'manual' ? ' (manual)' : ''}`;
            return (
              <option key={v.version} value={v.version}>
                {label}
              </option>
            );
          })}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)] pointer-events-none" />
      </div>
      {/* Validity indicator for selected version */}
      {(() => {
        const selected = versions.find((v) => v.version === selectedVersion);
        if (!selected) return null;
        return selected.valid ? (
          <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" aria-label="Spec válido" />
        ) : (
          <XCircle className="w-4 h-4 text-amber-400" aria-label="Spec con advertencias" />
        );
      })()}
    </div>
  );
}
