import type { Metadata } from 'next';
import { ProfileSettingsClient } from '../../../../components/settings/profile-settings-client';

export const metadata: Metadata = {
  title: 'Perfil y Apariencia | Sophia',
  description: 'Gestiona tu perfil, contraseña y preferencias de apariencia',
};

/** @description Profile & appearance settings page */
export default function ProfileSettingsPage() {
  return <ProfileSettingsClient />;
}
