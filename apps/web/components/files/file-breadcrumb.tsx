'use client';

import { ChevronRight } from 'lucide-react';

interface FileBreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
}

/** @description Breadcrumb navigation for current file path */
export function FileBreadcrumb({ path, onNavigate }: FileBreadcrumbProps) {
  const parts = path.split('/');

  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto" aria-label="File path">
      {parts.map((part, index) => {
        const fullPath = parts.slice(0, index + 1).join('/');
        const isLast = index === parts.length - 1;

        return (
          <span key={fullPath} className="flex items-center gap-1 shrink-0">
            {index > 0 && <ChevronRight className="w-3 h-3 text-[var(--text-disabled)]" />}
            {isLast ? (
              <span className="text-[var(--text-primary)] font-medium">{part}</span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(fullPath)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {part}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
