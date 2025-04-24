import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// Remove import for next/headers cookies if not needed elsewhere
// import { cookies } from 'next/headers'; 

const AUTH_COOKIE_NAME = 'site-auth'; // Should match API route

export function middleware(request: NextRequest) {
  // 1. Get the specific cookie from the request object
  const authCookie = request.cookies.get(AUTH_COOKIE_NAME);

  const { pathname } = request.nextUrl;

  // 2. If trying to access the login page or API route, allow it
  if (pathname.startsWith('/login') || pathname.startsWith('/api/login')) {
    return NextResponse.next();
  }

  // 3. If no auth cookie or its value isn't what we expect (e.g., 'true'), redirect
  if (!authCookie || authCookie.value !== 'true') { 
    console.log(`No valid auth cookie found for path: ${pathname}, redirecting to /login`);
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 4. If cookie exists and is valid, allow the request to proceed
  console.log(`Valid auth cookie found for path: ${pathname}, allowing request.`);
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api routes that *don't* need protection (if any, e.g. public status check)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * 
     * This ensures the middleware runs on all pages and relevant API routes,
     * but skips static assets and framework internals.
     */
    '/((?!api/public|_next/static|_next/image|favicon.ico).*)',
  ],
}; 