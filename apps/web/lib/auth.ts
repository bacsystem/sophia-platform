const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export async function getSession(cookieHeader: string): Promise<SessionUser | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });

    if (!res.ok) return null;

    const body = await res.json();
    return body.data as SessionUser;
  } catch {
    return null;
  }
}

export function isAuthenticated(user: SessionUser | null): user is SessionUser {
  return user !== null;
}
