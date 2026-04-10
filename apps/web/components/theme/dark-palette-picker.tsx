'use client';

import { useDarkPalette, type DarkPaletteId } from '@/hooks/use-dark-palette';

/** @description Picker de paleta oscura — muestra swatches de los 3 tonos base de cada paleta */
export function DarkPalettePicker() {
  const { palette, setPalette, palettes } = useDarkPalette();

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {palettes.map((p) => {
          const isActive = palette === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPalette(p.id as DarkPaletteId)}
              aria-label={`Paleta ${p.label}${isActive ? ' (activa)' : ''}`}
              aria-pressed={isActive}
              className={`group relative flex flex-col gap-2 p-3 rounded-xl border transition-all duration-200 text-left ${
                isActive
                  ? 'border-[rgba(var(--accent-rgb)/0.40)] bg-[rgba(var(--accent-rgb)/0.06)] shadow-[0_0_14px_rgba(var(--accent-rgb)/0.10)]'
                  : 'border-[var(--muted-border)] hover:border-[rgba(var(--accent-rgb)/0.20)] hover:bg-[rgba(var(--accent-rgb)/0.03)]'
              }`}
            >
              {/* Swatch strip — 3 colores base de cada paleta */}
              <div className="flex gap-1 h-7 rounded-md overflow-hidden w-full">
                {p.preview.map((color, idx) => (
                  <div
                    key={idx}
                    className="flex-1 rounded-sm"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                ))}
              </div>

              {/* Label + check */}
              <div className="flex items-center justify-between gap-1">
                <span
                  className="text-[11px] font-semibold leading-none"
                  style={{
                    fontFamily: "var(--font-mono, 'Space Mono', monospace)",
                    color: isActive ? 'var(--accent-500)' : 'var(--text-secondary)',
                  }}
                >
                  {p.label}
                </span>
                {isActive && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: 'var(--accent-500)', flexShrink: 0 }}
                    aria-hidden="true"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </div>

              {/* Description */}
              <p
                className="text-[10px] leading-snug"
                style={{
                  fontFamily: "var(--font-mono, 'Space Mono', monospace)",
                  color: 'var(--text-tertiary)',
                }}
              >
                {p.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Info note */}
      <p
        className="text-[10px] text-[var(--text-disabled)]"
        style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}
      >
        Solo activo en modo oscuro. La selección persiste entre sesiones.
      </p>
    </div>
  );
}
