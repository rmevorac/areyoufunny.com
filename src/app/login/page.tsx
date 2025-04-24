'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// Inner component that uses useSearchParams
function LoginForm() {
  const [password, setPassword] = useState('');
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div className="p-8 bg-white rounded shadow-md w-full max-w-sm">
      <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Enter Password</h1>
      
      <form action="/api/login" method="POST">
        <div className="mb-4">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 text-gray-800"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 mb-4 text-center">{error}</p>
        )}
        
        <button
          type="submit"
          className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
        >
           Enter
        </button>
      </form>
    </div>
  );
}

// Main page component wraps LoginForm in Suspense
export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
       {/* Wrap the component using useSearchParams in Suspense */}
      <Suspense fallback={<div className="text-center text-gray-500">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
} 