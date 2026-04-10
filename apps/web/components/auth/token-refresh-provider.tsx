'use client';

import { useTokenRefresh } from '@/hooks/use-token-refresh';

/** @description Invisible client component that runs proactive token refresh in the dashboard. */
export function TokenRefreshProvider() {
  useTokenRefresh();
  return null;
}
