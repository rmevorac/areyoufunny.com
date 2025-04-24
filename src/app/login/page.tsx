'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  
  // Get error message from URL query params (if redirected from API)
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Enter Password</h1>
        
        {/* Form submits directly to the API route */} 
        <form action="/api/login" method="POST">
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              id="password"
              name="password" // Name must match formData key in API route
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
    </div>
  );
} 