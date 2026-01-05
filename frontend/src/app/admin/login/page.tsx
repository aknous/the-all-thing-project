'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { setAdminKey } from '@/lib/adminAuth';

export default function AdminLogin() {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      console.log('Testing admin key against:', `${apiUrl}/admin/categories`);
      
      // Test the key by fetching categories
      const response = await fetch(`${apiUrl}/admin/categories`, {
        headers: {
          'X-Admin-Key': key,
        },
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Login failed:', errorText);
        throw new Error(`Invalid admin key (${response.status})`);
      }

      // Key is valid, store it and redirect
      setAdminKey(key);
      router.push('/admin');
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Invalid admin key. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md p-8 bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-zinc-100">
          Admin Login
        </h1>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label 
              htmlFor="adminKey" 
              className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300"
            >
              Admin Key
            </label>
            <input
              id="adminKey"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg 
                       bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter admin key"
              required
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !key}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700
                     text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your admin key is stored in your browser session and will be cleared when you close the browser.
          </p>
        </div>
      </div>
    </div>
  );
}
