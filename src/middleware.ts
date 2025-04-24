import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// Remove import for next/headers cookies if not needed elsewhere
// import { cookies } from 'next/headers'; 

const AUTH_COOKIE_NAME = 'site-auth'; // Should match API route

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log(`[Middleware] Running for path: ${pathname}`); // Log entry

  // Log cookie presence and value
  const authCookie = request.cookies.get(AUTH_COOKIE_NAME);
  console.log(`[Middleware] Auth cookie (${AUTH_COOKIE_NAME}):`, authCookie);

  // 2. If trying to access the login page itself, allow it
  if (pathname.startsWith('/login')) {
    console.log('[Middleware] Path is /login, allowing.');
    return NextResponse.next();
  }

  // 3. If no auth cookie or its value isn't what we expect (e.g., 'true'), redirect
  if (!authCookie || authCookie.value !== 'true') { 
    console.log(`[Middleware] No valid auth cookie found for path: ${pathname}, redirecting to /login`);
    const loginUrl = new URL('/login', request.url);
    // Add a query param to indicate the original attempted path (optional, for debugging)
    // loginUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. If cookie exists and is valid, allow the request to proceed
  console.log(`[Middleware] Valid auth cookie found for path: ${pathname}, allowing request.`);
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     *
     * This ensures the middleware runs on pages but skips API routes,
     * static assets, and framework internals.
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 