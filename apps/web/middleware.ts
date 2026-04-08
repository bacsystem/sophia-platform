import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static assets and API proxy
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;

  // No tokens at all → redirect to login
  if (!accessToken && !refreshToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Has access token → allow (token validation happens server-side)
  if (accessToken) {
    return NextResponse.next();
  }

  // No access token but has refresh → try to refresh
  if (refreshToken) {
    try {
      const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { Cookie: `refresh_token=${refreshToken}` },
      });

      if (refreshRes.ok) {
        const response = NextResponse.next();
        // Forward Set-Cookie headers from refresh response
        const setCookies = refreshRes.headers.getSetCookie();
        for (const cookie of setCookies) {
          response.headers.append('Set-Cookie', cookie);
        }
        return response;
      }
    } catch {
      // Refresh failed, redirect to login
    }

    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
