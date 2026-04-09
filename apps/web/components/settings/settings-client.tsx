'use client';

import { ApiKeySection } from './api-key-section';
import { UsageOverview } from './usage-overview';
import { UsageChart } from './usage-chart';
import { ProfileForm } from './profile-form';
import { PasswordForm } from './password-form';

/** @description Client-side settings page — manages API key, usage, profile sections */
export function SettingsClient() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Configuración</h1>
        <p className="text-white/50 text-sm mt-1">
          Gestiona tu API key, uso de tokens y perfil
        </p>
      </div>

      <div className="space-y-6">
        <ApiKeySection />
        <UsageOverview />
        <UsageChart />
        <ProfileForm />
        <PasswordForm />
      </div>
    </div>
  );
}
