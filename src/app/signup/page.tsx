'use client';

import React, { useState, Suspense, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { supabase } from '@/lib/supabaseClient';

// Debounce function
function debounce<T extends unknown[], R>(
  func: (...args: T) => R, 
  waitFor: number
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: T) => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };

  return debounced as (...args: T) => void;
}

function SignupForm() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  // Consolidated error/feedback message for username field
  const [usernameFeedback, setUsernameFeedback] = useState<string | null>(null);
  const [usernameFeedbackType, setUsernameFeedbackType] = useState<'error' | 'success' | 'info' | null>(null);

  // General form error message (for email, age, or submission errors)
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checkUsernameAvailability = useCallback(
    debounce(async (currentUsername: string) => {
      setUsernameFeedback(null); // Clear previous specific username feedback
      setUsernameFeedbackType(null);

      if (!currentUsername || currentUsername.length < 6) {
        setUsernameAvailable(null);
        if (currentUsername.length > 0) { // Only show length error if user typed something
          setUsernameFeedback('Username must be at least 6 characters.');
          setUsernameFeedbackType('error');
        }
        setIsCheckingUsername(false);
        return;
      }
      
      setIsCheckingUsername(true);
      setUsernameFeedback('Checking username...');
      setUsernameFeedbackType('info');

      const { data, error } = await supabase
        .from('profiles') // Should be user_profile_with_score if using the view for this check
        .select('username')
        .eq('username', currentUsername)
        .maybeSingle();

      setIsCheckingUsername(false);
      if (error) {
        console.error('Error checking username:', error.message);
        setUsernameFeedback('Could not verify username. Try again.');
        setUsernameFeedbackType('error');
        setUsernameAvailable(null); 
      } else if (data) {
        setUsernameAvailable(false);
        setUsernameFeedback('Username is already taken.');
        setUsernameFeedbackType('error');
      } else {
        setUsernameAvailable(true);
        setUsernameFeedback('Username is available!');
        setUsernameFeedbackType('success');
      }
    }, 500), 
    [supabase]
  );

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUsername = e.target.value;
    setUsername(newUsername);
    setUsernameAvailable(null); // Reset availability status on change
    setFormErrorMessage(null); // Clear general form errors when username changes
    if (newUsername.trim() === '') {
        setUsernameFeedback(null); // Clear feedback if username is empty
        setUsernameFeedbackType(null);
        setIsCheckingUsername(false); // Stop checking if input is cleared
    } else {
        checkUsernameAvailability(newUsername);
    }
  };

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormErrorMessage(null); // Clear previous general form errors

    // Final check for username state before submitting
    if (username.length < 6) {
        setFormErrorMessage('Username must be at least 6 characters.');
        return;
    }
    if (usernameAvailable === false) {
      setFormErrorMessage('This username is taken. Please choose another.');
      return;
    }
    if (isCheckingUsername || (username.length >= 6 && usernameAvailable === null) ) {
      setFormErrorMessage('Please wait for username check to complete or resolve issues.');
      return;
    }
    if (!email) {
      setFormErrorMessage('Email is required.');
      return;
    }
    if (!agreedToTerms) {
      setFormErrorMessage('You must agree to the Terms and Conditions and Privacy Policy to create an account.');
      return;
    }

    setIsLoading(true);
    setSuccessMessage(null);

    const dummyPassword = Math.random().toString(36).slice(-16);

    const { error } = await supabase.auth.signUp({
      email,
      password: dummyPassword,
      options: {
        data: {
          username: username,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    });

    setIsLoading(false);
    if (error) {
      if (error.message.includes('User already registered')) {
        setFormErrorMessage('This email is already registered. Please try logging in.');
      } else {
        setFormErrorMessage(error.message);
      }
    } else {
      setSuccessMessage(
        'Signup successful! Please check your email for a confirmation link to activate your account.'
      );
      setEmail('');
      setUsername('');
      setUsernameAvailable(null);
      setUsernameFeedback(null);
      setUsernameFeedbackType(null);
    }
  };

  return (
    <div className="p-8 bg-white rounded shadow-md w-full max-w-sm">
      <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">
        Create Account
      </h1>
      
      {successMessage && (
        <p className="text-sm text-green-600 mb-4 text-center">{successMessage}</p>
      )}
      {formErrorMessage && !successMessage && (
        <p className="text-sm text-red-600 mb-4 text-center">{formErrorMessage}</p>
      )}

      {!successMessage && (
        <form onSubmit={handleSignup} noValidate>
          <div className="mb-4">
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={username}
              onChange={handleUsernameChange}
              required
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 text-gray-800"
              placeholder="YourUsername"
              aria-describedby="username-feedback"
            />
            {/* Dedicated space for username feedback messages */}
            <div id="username-feedback" className="min-h-[1.25rem] mt-1 text-xs">
              {usernameFeedback && (
                <p className={
                  usernameFeedbackType === 'error' ? 'text-red-600' :
                  usernameFeedbackType === 'success' ? 'text-green-600' :
                  'text-gray-500' // for info like "Checking..."
                }>
                  {usernameFeedback}
                </p>
              )}
            </div>
          </div>
          
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
          
          <div className="mb-4">
            <div className="flex items-center">
              <input
                id="terms-agreement"
                name="terms-agreement"
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                disabled={isLoading}
                className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <label htmlFor="terms-agreement" className="ml-2 block text-sm text-gray-900">
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-red-600 hover:text-red-500">
                  Terms and Conditions
                </a>
                {' '}and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-red-600 hover:text-red-500">
                  Privacy Policy
                </a>.
              </label>
            </div>
          </div>
          
          <button
            type="submit"
            className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            disabled={isLoading || isCheckingUsername || (username.length >=6 && usernameAvailable === false) || !agreedToTerms}
          >
            {isLoading ? 'Creating Account...' : 'Create Account & Send Confirmation'}
          </button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <a href="/login" className="font-medium text-red-600 hover:text-red-500">
          Log in
        </a>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Suspense fallback={<div className="text-center text-gray-500">Loading...</div>}>
        <SignupForm />
      </Suspense>
    </div>
  );
} 