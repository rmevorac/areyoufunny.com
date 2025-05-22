import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
// Remove import for next/headers cookies if not needed elsewhere
// import { cookies } from 'next/headers'; 

// const AUTH_COOKIE_NAME = 'site-auth'; // This is no longer used with Supabase session handling

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // console.log(`[Middleware] Running for path: ${pathname}`);

  // Allow public access to specific paths (e.g., home, content pages)
  // Add any other paths that should be public without authentication.
  if (pathname === '/' || pathname.startsWith('/sets')) {
    return NextResponse.next(); 
  }

  // Allow access to auth-related paths, and API routes (implicitly allowed by matcher)
  if (pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/auth/callback')) {
    return NextResponse.next();
  }

  // Create an outgoing response object before invoking Supabase
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // If the cookie is set, update the request and response cookies
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          // If the cookie is removed, update the request and response cookies
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Refresh session if expired - important to keep session client-side updated
  const { data: { session } } = await supabase.auth.getSession();

  // If no session (user is not logged in) for any other path, redirect to login page
  if (!session) {
    // console.log(`[Middleware] No session, redirecting to /login from ${pathname}`);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // console.log(`[Middleware] Session found for ${pathname}, allowing request.`);
  // If session exists, allow the request to proceed
  return response; // Return the (potentially modified) response
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
     * Explicitly handled public paths like '/', '/sets' will pass through this matcher
     * and then be allowed by the logic within the middleware function.
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 