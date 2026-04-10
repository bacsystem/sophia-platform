'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AppearanceSection } from './appearance-section';
import { ProfileForm } from './profile-form';
import { PasswordForm } from './password-form';

/** @description Client-side profile & appearance settings page */
export function ProfileSettingsClient() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="space-y-1">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Configuración
        </Link>
        <h1
          className="text-2xl font-bold tracking-wide text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)" }}
        >
          Perfil y Apariencia
        </h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          Personaliza tu perfil, contraseña y preferencias visuales
        </p>
      </div>

      <div className="space-y-6">
        <AppearanceSection />
        <ProfileForm />
        <PasswordForm />
      </div>
    </div>
  );
}
