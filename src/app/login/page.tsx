'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(''); // For OTP input
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [otpSent, setOtpSent] = useState(false); // To manage OTP input visibility

  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const initialError = searchParams.get('error'); // Keep for errors like from auth callback

  const handleRequestOtp = async () => {
    if (!email) {
      setErrorMessage('Email is required.');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // Do not create a new user on login
      },
    });

    setIsLoading(false);
    if (error) {
      // Check for the specific error message from Supabase
      if (error.message.includes('Signups not allowed for otp') || 
          error.message.toLowerCase().includes('user not found') || 
          error.message.toLowerCase().includes('no user found with this email')) {
        setErrorMessage('This email address is not registered. Please sign up or try a different email.');
      } else {
        setErrorMessage(error.message); // Show other errors as is
      }
    } else {
      setSuccessMessage('OTP has been sent to your email. Please enter it below.');
      setOtpSent(true);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) {
      setErrorMessage('Please enter the OTP.');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    });

    setIsLoading(false);
    if (error) {
      setErrorMessage(`Error verifying OTP: ${error.message}`);
    } else if (data.session) {
      // On successful login, redirect to the home page or a dashboard
      const redirectedFrom = searchParams.get('redirectedFrom') || '/';
      router.push(redirectedFrom);
      router.refresh(); // Refresh server components to reflect login state
    } else {
      setErrorMessage('Could not verify OTP. Invalid or expired token.');
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (otpSent) {
      handleVerifyOtp();
    } else {
      handleRequestOtp();
    }
  };

  return (
    <div className="p-8 bg-white rounded shadow-md w-full max-w-sm">
      <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">
        {otpSent ? 'Enter OTP' : 'Login'}
      </h1>
      
      {successMessage && !errorMessage && !initialError && (
        <p className="text-sm text-green-600 mb-4 text-center">{successMessage}</p>
      )}
      {(initialError || errorMessage) && (
          <p className="text-sm text-red-600 mb-4 text-center">{initialError || errorMessage}</p>
      )}

      <form onSubmit={handleSubmit}>
        {!otpSent && (
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 text-gray-800"
              placeholder="you@example.com"
            />
          </div>
        )}

        {otpSent && (
          <div className="mb-4">
            <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">One-Time Password</label>
            <input
              type="text"
              id="otp"
              name="otp"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 text-gray-800"
              placeholder="123456"
            />
          </div>
        )}
        
        <button
          type="submit"
          className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading 
            ? (otpSent ? 'Verifying OTP...' : 'Sending OTP...') 
            : (otpSent ? 'Verify OTP & Login' : 'Send OTP')}
        </button>
      </form>

      {!otpSent && (
        <p className="mt-4 text-center text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <a href="/signup" className="font-medium text-red-600 hover:text-red-500">
            Sign up
          </a>
        </p>
      )}
      {otpSent && (
         <button 
            onClick={() => { 
                setOtpSent(false); 
                setErrorMessage(''); 
                setSuccessMessage(''); 
                setOtp('');
            }}
            disabled={isLoading}
            className="mt-2 w-full text-sm text-gray-600 hover:text-red-500 focus:outline-none"
        >
            Change email
        </button>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Suspense fallback={<div className="text-center text-gray-500">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
} 