import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/backend-api')) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('ngrok-skip-browser-warning', 'true');

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  const langParam = request.nextUrl.searchParams.get('lang');
  const hasLangCookie = request.cookies.has('i18nextLng');

  let response = NextResponse.next();

  if (langParam === 'fr' || langParam === 'ar') {
    response.cookies.set('i18nextLng', langParam, { path: '/' });
  } else if (!hasLangCookie) {
    const acceptLanguage = request.headers.get('accept-language') || '';
    const prefersArabic = acceptLanguage.toLowerCase().includes('ar');
    const detectedLang = prefersArabic ? 'ar' : 'fr';
    response.cookies.set('i18nextLng', detectedLang, { path: '/' });
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
