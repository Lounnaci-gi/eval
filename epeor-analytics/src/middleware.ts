import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware — ajoute le header `ngrok-skip-browser-warning` à toutes les
 * requêtes proxy vers /backend-api/*.
 * Sans ce header, ngrok Free peut servir une page HTML d'avertissement
 * au lieu de passer la requête au backend FastAPI.
 */
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('ngrok-skip-browser-warning', 'true');

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: '/backend-api/:path*',
};
