import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_ALLOWLIST = ['/api/auth/login', '/api/auth/refresh'];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/api')) {
    const method = request.method.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      if (API_ALLOWLIST.includes(pathname)) {
        return NextResponse.next();
      }

      const cookieToken = request.cookies.get('csrf_token')?.value || null;
      const headerToken = request.headers.get('x-csrf-token') || null;
      if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return new NextResponse(JSON.stringify({ error: 'CSRF check failed' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return NextResponse.next();
  }

  if (pathname.startsWith('/backend-api')) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('ngrok-skip-browser-warning', 'true');

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/backend-api/:path*'],
};
