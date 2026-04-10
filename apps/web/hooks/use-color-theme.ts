'use client';

import { useEffect, useState, useCallback } from 'react';

export const COLOR_THEMES = [
  { id: 'emerald', label: 'Esmeralda', color: '#10b981', secondary: '#34d399' },
  { id: 'violet',  label: 'Violeta',   color: '#8b5cf6', secondary: '#a78bfa' },
  { id: 'blue',    label: 'Azul',      color: '#3b82f6', secondary: '#60a5fa' },
  { id: 'cyan',    label: 'Cian',      color: '#06b6d4', secondary: '#22d3ee' },
  { id: 'orange',  label: 'Naranja',   color: '#f97316', secondary: '#fb923c' },
  { id: 'rose',    label: 'Rosa',      color: '#f43f5e', secondary: '#fb7185' },
  { id: 'amber',   label: 'Ámbar',     color: '#f59e0b', secondary: '#fbbf24' },
] as const;

export type ColorThemeId = (typeof COLOR_THEMES)[number]['id'];

const STORAGE_KEY = 'sophia-color-theme';

/** Reads the persisted color theme and applies it to the <html> element. */
function applyColorTheme(id: ColorThemeId) {
  if (id === 'emerald') {
    delete document.documentElement.dataset.colorTheme;
  } else {
    document.documentElement.dataset.colorTheme = id;
  }
}

/** Hook for reading and setting the app color theme. */
export function useColorTheme() {
  const [theme, setThemeState] = useState<ColorThemeId>('emerald');

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) ?? 'emerald') as ColorThemeId;
    const valid = COLOR_THEMES.some((t) => t.id === saved) ? saved : 'emerald';
    setThemeState(valid);
    applyColorTheme(valid);
  }, []);

  const setTheme = useCallback((id: ColorThemeId) => {
    setThemeState(id);
    localStorage.setItem(STORAGE_KEY, id);
    applyColorTheme(id);
  }, []);

  return { theme, setTheme, themes: COLOR_THEMES };
}
