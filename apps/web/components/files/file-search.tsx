'use client';

import { Search, X } from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';

interface FileSearchProps {
  onSearch: (query: string) => void;
}

/** @description Search input for filtering files by name */
export function FileSearch({ onSearch }: FileSearchProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);
      onSearch(value);
    },
    [onSearch],
  );

  const handleClear = useCallback(() => {
    setQuery('');
    onSearch('');
    inputRef.current?.focus();
  }, [onSearch]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Buscar archivos..."
        className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-[var(--surface-header)] border border-[var(--muted-border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[rgba(var(--accent-rgb)/0.50)] focus:ring-1 focus:ring-[rgba(var(--accent-rgb)/0.25)]"
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Limpiar búsqueda"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
