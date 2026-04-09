'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** @description Logout button — revokes refresh token and redirects to /login */
export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Continue with client-side cleanup even if request fails
    } finally {
      router.push('/login');
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      aria-label="Cerrar sesión"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/8 transition-colors disabled:opacity-50"
    >
      <LogOut className="w-4 h-4" />
      <span className="hidden sm:inline">{loading ? 'Cerrando...' : 'Salir'}</span>
    </button>
  );
}
