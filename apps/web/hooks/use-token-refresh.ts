'use client';

import { useEffect, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Proactive refresh threshold — renew at 80% of TTL. */
const REFRESH_THRESHOLD = 0.8;

/**
 * @description Proactive token refresh hook. Fetches session expiry from
 * GET /api/auth/session, sets a timer at ~80% of the access token TTL,
 * and calls POST /api/auth/refresh proactively. Falls back to the existing
 * reactive refresh (post-401) on failure.
 */
export function useTokenRefresh() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const scheduleRefresh = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/session`, {
          credentials: 'include',
        });

        if (!res.ok) return; // Not authenticated or error — no-op

        const body = (await res.json()) as { data: { expiresAt: string } };
        const expiresAt = new Date(body.data.expiresAt).getTime();
        const now = Date.now();
        const ttlMs = expiresAt - now;

        if (ttlMs <= 0) return; // Already expired — reactive refresh will handle it

        const delayMs = Math.max(ttlMs * REFRESH_THRESHOLD, 5000); // Min 5s delay

        timerRef.current = setTimeout(async () => {
          if (!mountedRef.current) return;

          try {
            const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
              method: 'POST',
              credentials: 'include',
            });

            if (refreshRes.ok && mountedRef.current) {
              // Re-arm timer for the new token
              void scheduleRefresh();
            }
            // If refresh fails, no-op — reactive refresh handles it
          } catch {
            // Network error — no-op, fallback to reactive refresh
          }
        }, delayMs);
      } catch {
        // Session fetch failed — no-op
      }
    };

    void scheduleRefresh();

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
