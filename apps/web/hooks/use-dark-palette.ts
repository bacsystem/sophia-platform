'use client';

import { useEffect, useState, useCallback } from 'react';

export const DARK_PALETTES = [
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Azul marino profundo — predeterminado',
    preview: ['#080808', '#0a1220', '#0d1117'],
  },
  {
    id: 'carbon',
    label: 'Carbon',
    description: 'Negro puro neutro — sin tinte de color',
    preview: ['#080808', '#0e0e0e', '#111111'],
  },
  {
    id: 'slate',
    label: 'Slate',
    description: 'Gris azulado frío — moderno y equilibrado',
    preview: ['#0a0c10', '#0e1219', '#12161f'],
  },
  {
    id: 'graphite',
    label: 'Graphite',
    description: 'Carbón cálido — suave para los ojos',
    preview: ['#0c0b09', '#131110', '#181614'],
  },
  {
    id: 'abyss',
    label: 'Abyss',
    description: 'Negro púrpura profundo — dramático',
    preview: ['#070510', '#0a0818', '#0d0b1a'],
  },
  {
    id: 'forest',
    label: 'Forest',
    description: 'Negro verde oscuro — natural y enfocado',
    preview: ['#050e07', '#081208', '#0b1810'],
  },
] as const;

export type DarkPaletteId = (typeof DARK_PALETTES)[number]['id'];

const STORAGE_KEY = 'sophia-dark-palette';

/** Applies the dark palette data attribute to <html> */
function applyDarkPalette(id: DarkPaletteId) {
  if (id === 'midnight') {
    delete document.documentElement.dataset.darkPalette;
  } else {
    document.documentElement.dataset.darkPalette = id;
  }
}

/** Hook for reading and setting the dark background palette. */
export function useDarkPalette() {
  const [palette, setPaletteState] = useState<DarkPaletteId>('midnight');

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) ?? 'midnight') as DarkPaletteId;
    const valid = DARK_PALETTES.some((p) => p.id === saved) ? saved : 'midnight';
    setPaletteState(valid);
    applyDarkPalette(valid);
  }, []);

  const setPalette = useCallback((id: DarkPaletteId) => {
    setPaletteState(id);
    localStorage.setItem(STORAGE_KEY, id);
    applyDarkPalette(id);
  }, []);

  return { palette, setPalette, palettes: DARK_PALETTES };
}
