import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/'; // Default redirect to home

  if (code) {
    // Create a response object that we can modify
    const response = NextResponse.redirect(`${origin}${next}`);

    // Create a Supabase client configured to use cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({ name, value: '', ...options });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Session created and cookies are set on the response object
      return response;
    }

    console.error('[Auth Callback] Error exchanging code for session:', error.message);
    // Redirect to an error page or login with an error message
    const errorUrl = new URL('/login', origin);
    errorUrl.searchParams.set('error', 'auth_callback_failed');
    errorUrl.searchParams.set('error_description', error.message);
    return NextResponse.redirect(errorUrl);
  }

  // If no code is present, redirect to an error page or login
  console.warn('[Auth Callback] No code found in request');
  const noCodeErrorUrl = new URL('/login', origin);
  noCodeErrorUrl.searchParams.set('error', 'auth_callback_missing_code');
  return NextResponse.redirect(noCodeErrorUrl);
} 