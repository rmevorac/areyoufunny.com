import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Name for the authentication cookie
const AUTH_COOKIE_NAME = 'site-auth';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const password = formData.get('password') as string;

    // Get the password from environment variables
    const sitePassword = process.env.SITE_PASSWORD;

    if (!sitePassword) {
      console.error('SITE_PASSWORD environment variable is not set.');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    if (password === sitePassword) {
      // Passwords match - create response first
      const response = NextResponse.redirect(new URL('/', request.url)); 
      
      // Set the cookie on the response object
      response.cookies.set(AUTH_COOKIE_NAME, 'true', {
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production', 
        path: '/', 
        maxAge: 60 * 60 * 24 * 7, 
        sameSite: 'lax',
      });

      console.log('Login successful, setting cookie and redirecting.');
      return response; // Return the response with the cookie set
    } else {
      // Passwords don't match - redirect back to login with an error query param
      console.log('Login failed: Incorrect password.');
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'Incorrect password');
      return NextResponse.redirect(loginUrl);
    }
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
} 