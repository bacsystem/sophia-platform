'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import { ColorThemePicker } from '@/components/theme/color-theme-picker';
import { DarkPalettePicker } from '@/components/theme/dark-palette-picker';

const MODE_OPTIONS = [
  { value: 'light',  label: 'Claro',   Icon: Sun },
  { value: 'dark',   label: 'Oscuro',  Icon: Moon },
  { value: 'system', label: 'Sistema', Icon: Monitor },
] as const;

/** @description Appearance settings — theme mode + color theme picker */
export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="glass-card rounded-xl p-6 space-y-6">
      {/* Header */}
      <div>
        <h2
          className="text-base font-bold tracking-wide text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)" }}
        >
          Apariencia
        </h2>
        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
          Personaliza el modo de visualización y el tema de colores
        </p>
      </div>

      {/* Mode selector */}
      <div>
        <p
          className="text-xs font-semibold tracking-widest uppercase text-[var(--text-tertiary)] mb-3"
          style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}
        >
          Modo
        </p>
        <div className="flex gap-2">
          {MODE_OPTIONS.map(({ value, label, Icon }) => {
            const isActive = mounted && theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                aria-pressed={isActive}
                aria-label={`Modo ${label}`}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                  isActive
                    ? 'bg-[rgba(var(--accent-rgb)/0.08)] text-[var(--accent-500)] border-[rgba(var(--accent-rgb)/0.25)] shadow-[0_0_12px_rgba(var(--accent-rgb)/0.08)]'
                    : 'text-[var(--text-tertiary)] border-[var(--border-subtle)] hover:text-[var(--text-secondary)] hover:bg-[rgba(var(--accent-rgb)/0.04)]'
                }`}
                style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Color theme picker */}
      <div>
        <p
          className="text-xs font-semibold tracking-widest uppercase text-[var(--text-tertiary)] mb-3"
          style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}
        >
          Color
        </p>
        <ColorThemePicker />
      </div>

      {/* Dark palette picker — only visible when dark mode is active */}
      {mounted && theme !== 'light' && (
        <div>
          <p
            className="text-xs font-semibold tracking-widest uppercase text-[var(--text-tertiary)] mb-1"
            style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}
          >
            Paleta oscura
          </p>
          <p className="text-[10px] text-[var(--text-disabled)] mb-3">
            Fondos y superficies del modo oscuro
          </p>
          <DarkPalettePicker />
        </div>
      )}

      {/* Semantic color preview */}
      <div>
        <p
          className="text-xs font-semibold tracking-widest uppercase text-[var(--text-tertiary)] mb-3"
          style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}
        >
          Semánticos
        </p>
        <div className="grid grid-cols-2 gap-2">
          {SEMANTIC_TOKENS.map(({ name, bgVar, textVar, label }) => (
            <div
              key={name}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--muted-border)]"
            >
              <div
                className="w-8 h-8 rounded-md shrink-0"
                style={{ backgroundColor: `var(${bgVar})`, border: `1.5px solid var(${textVar})` }}
                aria-hidden="true"
              />
              <div>
                <p
                  className="text-[11px] font-semibold"
                  style={{ color: `var(${textVar})`, fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}
                >
                  {name}
                </p>
                <p
                  className="text-[10px] text-[var(--text-disabled)]"
                  style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}
                >
                  {label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Typography hierarchy preview */}
      <div>
        <p
          className="text-xs font-semibold tracking-widest uppercase text-[var(--text-tertiary)] mb-3"
          style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}
        >
          Tipografía
        </p>
        <div className="space-y-2 bg-[var(--surface-header)] rounded-lg px-4 py-3 border border-[var(--muted-border)]">
          {TYPOGRAPHY_TOKENS.map(({ colorVar, label, size }) => (
            <div key={colorVar} className="flex items-center justify-between">
              <span
                className={size}
                style={{
                  color: `var(${colorVar})`,
                  fontFamily: "var(--font-mono, 'Space Mono', monospace)",
                }}
              >
                {label}
              </span>
              <span
                className="text-[10px] text-[var(--text-disabled)]"
                style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}
              >
                {colorVar}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SEMANTIC_TOKENS = [
  { name: 'Success', bgVar: '--color-success-subtle', textVar: '--color-success', label: 'completado, ok' },
  { name: 'Warning', bgVar: '--color-warn-subtle',    textVar: '--color-warn',    label: 'atención, precaución' },
  { name: 'Error',   bgVar: '--color-error-subtle',   textVar: '--color-error',   label: 'fallo, crítico' },
  { name: 'Info',    bgVar: '--color-info-subtle',    textVar: '--color-info',    label: 'información, neutro' },
] as const;

const TYPOGRAPHY_TOKENS = [
  { colorVar: '--text-primary',   label: 'Primario — texto principal',     size: 'text-[13px]' },
  { colorVar: '--text-secondary', label: 'Secundario — subtítulos',         size: 'text-[12px]' },
  { colorVar: '--text-tertiary',  label: 'Terciario — metadatos, labels',  size: 'text-[11px]' },
  { colorVar: '--text-disabled',  label: 'Disabled — contenido inactivo',  size: 'text-[10px]' },
] as const;
