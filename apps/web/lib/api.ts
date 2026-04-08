const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T; status: number }> {
  const url = `${API_URL}${path}`;
  const opts: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  let res = await fetch(url, opts);

  // If 401, attempt silent refresh then retry
  if (res.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshTokens();
    }

    const refreshed = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (refreshed) {
      res = await fetch(url, opts);
    } else {
      // Redirect to login
      if (globalThis.window !== undefined) {
        globalThis.window.location.href = '/login';
      }
      throw new Error('Session expired');
    }
  }

  const body = await res.json();

  if (!res.ok) {
    const err = new Error((body.message as string | undefined) ?? 'Request failed') as Error & { status: number; error?: string };
    err.status = res.status;
    if (body.error) err.error = body.error as string;
    throw err;
  }

  return { data: body.data as T, status: res.status };
}
