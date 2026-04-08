/** @description Unified file icon map — Lucide component names + SVG paths for Canvas rendering. Shared between M5 Dashboard and M6 File Manager. */

export interface FileIconEntry {
  /** Lucide React component name (e.g. 'FileCode', 'Database') */
  component: string;
  /** Tailwind color class for the icon */
  colorClass: string;
  /** Hex color for Canvas rendering */
  color: string;
  /** SVG path data (d attribute) for Canvas ctx.fill()/ctx.stroke() — viewBox 0 0 24 24 */
  svgPath: string;
}

const FILE_ICON_MAP: Record<string, FileIconEntry> = {
  '.ts': {
    component: 'FileCode',
    colorClass: 'text-blue-400',
    color: '#60a5fa',
    svgPath: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z M14 2v6h6 M10 12l-2 2 2 2 M14 12l2 2-2 2',
  },
  '.tsx': {
    component: 'FileCode',
    colorClass: 'text-blue-400',
    color: '#60a5fa',
    svgPath: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z M14 2v6h6 M10 12l-2 2 2 2 M14 12l2 2-2 2',
  },
  '.js': {
    component: 'FileCode',
    colorClass: 'text-yellow-400',
    color: '#facc15',
    svgPath: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z M14 2v6h6 M10 12l-2 2 2 2 M14 12l2 2-2 2',
  },
  '.jsx': {
    component: 'FileCode',
    colorClass: 'text-yellow-400',
    color: '#facc15',
    svgPath: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z M14 2v6h6 M10 12l-2 2 2 2 M14 12l2 2-2 2',
  },
  '.sql': {
    component: 'Database',
    colorClass: 'text-emerald-400',
    color: '#34d399',
    svgPath: 'M4 7c0 1.1 3.6 2 8 2s8-.9 8-2-3.6-2-8-2-8 .9-8 2Zm0 0v5c0 1.1 3.6 2 8 2s8-.9 8-2V7m-16 5v5c0 1.1 3.6 2 8 2s8-.9 8-2v-5',
  },
  '.prisma': {
    component: 'Gem',
    colorClass: 'text-purple-400',
    color: '#c084fc',
    svgPath: 'M6 3h12l4 6-10 13L2 9Z M11 3l1 10 M2 9h20 M6.5 3 12 13m5.5-10L12 13',
  },
  '.json': {
    component: 'FileJson',
    colorClass: 'text-amber-400',
    color: '#fbbf24',
    svgPath: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z M14 2v6h6 M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1 M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1',
  },
  '.md': {
    component: 'FileText',
    colorClass: 'text-gray-400',
    color: '#9ca3af',
    svgPath: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  },
  '.yml': {
    component: 'Settings',
    colorClass: 'text-rose-400',
    color: '#fb7185',
    svgPath: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  },
  '.yaml': {
    component: 'Settings',
    colorClass: 'text-rose-400',
    color: '#fb7185',
    svgPath: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  },
  '.css': {
    component: 'Palette',
    colorClass: 'text-sky-400',
    color: '#38bdf8',
    svgPath: 'M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 10 10c0 2.5-2 4.5-4.5 4.5H15a2.5 2.5 0 0 0-2 4c-1 1-3.5 1.5-5 .5C4 19 2 16 2 12Z M12 2a4 4 0 0 0 0 4 M19 10a4 4 0 0 0-4 0 M8 20a4 4 0 0 0 0-4 M5 10a4 4 0 0 0 4 0',
  },
  '.env': {
    component: 'Lock',
    colorClass: 'text-orange-400',
    color: '#fb923c',
    svgPath: 'M5 11a7 7 0 0 1 14 0v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-2Zm2-1V8a5 5 0 0 1 10 0v2',
  },
};

const DEFAULT_ICON: FileIconEntry = {
  component: 'File',
  colorClass: 'text-gray-500',
  color: '#6b7280',
  svgPath: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z M14 2v6h6',
};

/** @description Get the file icon entry for a given filename or extension */
export function getFileIcon(filename: string): FileIconEntry {
  const ext = filename.includes('.') ? `.${filename.split('.').pop()!.toLowerCase()}` : '';
  return FILE_ICON_MAP[ext] ?? DEFAULT_ICON;
}

export { FILE_ICON_MAP, DEFAULT_ICON };
