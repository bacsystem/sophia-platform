'use client';

import { Palette } from 'lucide-react';
import { useColorTheme, type ColorThemeId } from '@/hooks/use-color-theme';

/** Section shown in Settings > Perfil for picking the UI color theme. */
export function ColorThemePicker() {
  const { theme, setTheme, themes } = useColorTheme();

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, var(--accent-500), var(--accent-400))` }}
        >
          <Palette className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3
            className="text-sm font-bold tracking-wide text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)" }}
          >
            Tema de color
          </h3>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            Aplica el acento de color a todo el sistema
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
        {themes.map((t) => {
          const isActive = theme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id as ColorThemeId)}
              title={t.label}
              aria-label={`Tema ${t.label}${isActive ? ' (activo)' : ''}`}
              aria-pressed={isActive}
              className="group flex flex-col items-center gap-2 p-2 rounded-xl transition-all duration-200 hover:bg-[var(--row-hover)]"
            >
              {/* Color swatch */}
              <div
                className="relative w-9 h-9 rounded-full transition-all duration-200"
                style={{
                  background: `linear-gradient(135deg, ${t.color}, ${t.secondary})`,
                  boxShadow: isActive
                    ? `0 0 0 3px var(--bg-surface), 0 0 0 5px ${t.color}, 0 0 20px ${t.color}55`
                    : `0 2px 8px ${t.color}44`,
                  transform: isActive ? 'scale(1.12)' : undefined,
                }}
              >
                {isActive && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className="text-[10px] leading-none transition-colors duration-200"
                style={{
                  fontFamily: "var(--font-mono, 'Space Mono', monospace)",
                  color: isActive ? t.color : 'var(--text-tertiary)',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
