'use client';

/** @description UserProfileMenu — avatar dropdown with user info, settings link, and logout */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Settings, User, ChevronDown } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface UserInfo {
  name: string;
  email: string;
}

/** @description Avatar + dropdown menu for user profile, config, and logout */
export function UserProfileMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch user info on mount
  useEffect(() => {
    fetch(`${API_URL}/api/auth/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (body?.data) {
          setUser({ name: body.data.name ?? body.data.email, email: body.data.email });
        }
      })
      .catch(() => {});
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleLogout = useCallback(async () => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {
      // Continue with client-side cleanup
    } finally {
      router.push('/login');
    }
  }, [router]);

  const initials = user?.name
    ? user.name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('')
    : '?';

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Menú de perfil"
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-[var(--row-hover)] text-[var(--text-secondary)]"
      >
        {/* Avatar */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ background: `linear-gradient(135deg, var(--accent-500), var(--accent-400))` }}
          aria-hidden="true"
        >
          {initials}
        </div>
        <span
          className="text-[12px] font-medium text-[var(--text-secondary)] hidden sm:block max-w-[100px] truncate"
          style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)" }}
        >
          {user?.name ?? '...'}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--text-tertiary)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-56 rounded-xl overflow-hidden z-50"
          style={{
            background: 'var(--surface-console)',
            border: '1px solid var(--muted-border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.20), 0 2px 8px rgba(0,0,0,0.10)',
          }}
          role="menu"
        >
          {/* User info header */}
          <div className="px-4 py-3 border-b border-[var(--muted-border)]">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ background: `linear-gradient(135deg, var(--accent-500), var(--accent-400))` }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p
                  className="text-xs font-bold text-[var(--text-primary)] truncate"
                  style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)" }}
                >
                  {user?.name ?? '—'}
                </p>
                <p
                  className="text-[10px] text-[var(--text-tertiary)] truncate"
                  style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}
                >
                  {user?.email ?? '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--row-hover)] transition-colors w-full"
              style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}
            >
              <Settings className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Configuración
            </Link>

            <Link
              href="/settings/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--row-hover)] transition-colors w-full"
              style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}
            >
              <User className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Mi perfil
            </Link>
          </div>

          {/* Logout */}
          <div className="border-t border-[var(--muted-border)] py-1">
            <button
              onClick={handleLogout}
              disabled={loading}
              role="menuitem"
              className="flex items-center gap-3 px-4 py-2.5 text-xs text-[var(--color-error)] hover:bg-[var(--color-error-subtle)] transition-colors w-full disabled:opacity-50"
              style={{ fontFamily: "var(--font-mono, 'Space Mono', monospace)" }}
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {loading ? 'Cerrando sesión...' : 'Cerrar sesión'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
