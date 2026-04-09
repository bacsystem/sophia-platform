import type { Metadata } from 'next';
import { SettingsClient } from '../../../components/settings/settings-client';

export const metadata: Metadata = {
  title: 'Configuración | Sophia',
  description: 'Gestiona tu API key, uso de tokens y perfil',
};

/** @description Settings page — server component shell, delegates to client */
export default function SettingsPage() {
  return <SettingsClient />;
}
