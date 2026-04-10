'use client';

import type { ProjectStack } from '@sophia/shared';

interface StackOption {
  value: ProjectStack;
  label: string;
  description: string;
  badge: string;
  color: string;
}

const STACK_OPTIONS: StackOption[] = [
  {
    value: 'node-nextjs',
    label: 'Node.js + Next.js',
    description: 'API Fastify + frontend Next.js 15',
    badge: 'TS',
    color: 'from-yellow-500/20 to-green-500/20 border-yellow-500/30',
  },
  {
    value: 'laravel-nextjs',
    label: 'Laravel + Next.js',
    description: 'API Laravel 11 + frontend Next.js 15',
    badge: 'PHP',
    color: 'from-red-500/20 to-orange-500/20 border-red-500/30',
  },
  {
    value: 'python-nextjs',
    label: 'Python + Next.js',
    description: 'API FastAPI + frontend Next.js 15',
    badge: 'PY',
    color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
  },
];

interface StackSelectorProps {
  value: ProjectStack | '';
  onChange: (value: ProjectStack) => void;
  error?: string;
}

/** @description Card-based stack selector for project creation/edit */
export function StackSelector({ value, onChange, error }: StackSelectorProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {STACK_OPTIONS.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`relative p-4 rounded-xl border text-left transition-all duration-200 bg-gradient-to-br ${option.color} ${
                isSelected
                    ? 'border-[rgba(var(--accent-rgb)/0.55)] shadow-[0_0_0_2px_rgba(var(--accent-rgb)/0.20)]'
                    : 'border-[var(--muted-border)] hover:border-[rgba(var(--accent-rgb)/0.30)]'
              }`}
              aria-pressed={isSelected}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{option.label}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{option.description}</p>
                </div>
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--surface-header)] text-[var(--text-secondary)]">
                  {option.badge}
                </span>
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--accent-500)]" />
              )}
            </button>
          );
        })}
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
