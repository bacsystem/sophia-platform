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
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Buscar archivos..."
        className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25"
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Limpiar búsqueda"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
