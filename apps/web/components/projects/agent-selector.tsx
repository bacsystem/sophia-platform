'use client';

import type { AgentName } from '@sophia/shared';

interface AgentOption {
  value: AgentName;
  label: string;
  description: string;
  required: boolean;
}

const AGENT_OPTIONS: AgentOption[] = [
  { value: 'dba', label: 'DBA', description: 'Base de datos', required: false },
  { value: 'seed', label: 'Seed', description: 'Datos de prueba', required: true },
  { value: 'backend', label: 'Backend', description: 'API y lógica', required: false },
  { value: 'frontend', label: 'Frontend', description: 'Interfaz de usuario', required: false },
  { value: 'qa', label: 'QA', description: 'Tests automatizados', required: false },
  { value: 'security', label: 'Security', description: 'Auditoría de seguridad', required: true },
  { value: 'docs', label: 'Docs', description: 'Documentación', required: false },
  { value: 'deploy', label: 'Deploy', description: 'Despliegue', required: false },
  { value: 'integration', label: 'Integration', description: 'Validación cross-layer', required: true },
];

interface AgentSelectorProps {
  value: AgentName[];
  onChange: (value: AgentName[]) => void;
  error?: string;
}

/** @description Checkbox grid for selecting optional agents; required agents always active and disabled */
export function AgentSelector({ value, onChange, error }: AgentSelectorProps) {
  const toggle = (agent: AgentName, required: boolean) => {
    if (required) return;
    if (value.includes(agent)) {
      onChange(value.filter((a) => a !== agent));
    } else {
      onChange([...value, agent]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {AGENT_OPTIONS.map((option) => {
          const isSelected = value.includes(option.value) || option.required;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggle(option.value, option.required)}
              disabled={option.required}
              aria-pressed={isSelected}
              className={`flex items-center gap-2.5 p-3 rounded-lg border text-left transition-all duration-150 ${
                option.required
                    ? 'border-[rgba(var(--accent-rgb)/0.25)] bg-[rgba(var(--accent-rgb)/0.08)] cursor-default opacity-80'
                    : isSelected
                    ? 'border-[rgba(var(--accent-rgb)/0.45)] bg-[rgba(var(--accent-rgb)/0.08)] hover:bg-[rgba(var(--accent-rgb)/0.12)]'
                    : 'border-[var(--muted-border)] bg-[var(--surface-header)] hover:border-[rgba(var(--accent-rgb)/0.25)] hover:bg-[var(--row-hover)]'
              }`}
            >
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  isSelected ? 'bg-[var(--accent-500)] border-[var(--accent-400)]' : 'border-[var(--text-tertiary)]'
                }`}
              >
                {isSelected && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text-primary)] leading-tight">{option.label}</p>
                <p className="text-[10px] text-[var(--text-tertiary)] leading-tight truncate">{option.description}</p>
              </div>
              {option.required && (
                <span className="ml-auto shrink-0 text-[9px] font-bold text-[var(--accent-400)] uppercase tracking-wide">
                  req
                </span>
              )}
            </button>
          );
        })}
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
