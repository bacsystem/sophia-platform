'use client';

import Link from 'next/link';
import { User, Palette } from 'lucide-react';
import { ApiKeySection } from './api-key-section';
import { UsageOverview } from './usage-overview';
import { UsageChart } from './usage-chart';

/** @description Client-side settings page — manages API key and usage sections */
export function SettingsClient() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-2xl font-bold tracking-wide text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)" }}
          >
            Configuración
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Gestiona tu API key y consumo de tokens
          </p>
        </div>

        <Link
          href="/settings/profile"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-[var(--muted-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[rgba(var(--accent-rgb)/0.35)] hover:bg-[rgba(var(--accent-rgb)/0.05)] transition-all"
        >
          <User className="w-4 h-4" />
          Perfil y Apariencia
          <Palette className="w-3.5 h-3.5 opacity-60" />
        </Link>
      </div>

      <div className="space-y-6">
        <ApiKeySection />
        <UsageOverview />
        <UsageChart />
      </div>
    </div>
  );
}
