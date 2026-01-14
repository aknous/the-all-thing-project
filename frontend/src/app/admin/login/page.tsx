'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { setAdminKey } from '@/lib/adminAuth';

export default function AdminLogin() {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  const addLog = (message: string) => {
    const logEntry = `${new Date().toLocaleTimeString()}: ${message}`;
    console.log(logEntry);
    setDebugLog(prev => {
      const updated = [...prev, logEntry];
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('adminLoginDebug', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const clearDebugLog = () => {
    setDebugLog([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('adminLoginDebug');
    }
  };

  // Load debug log from localStorage only on client
  useEffect(() => {
    setMounted(true);
    
    // Capture any errors that happen during render
    const errorHandler = (event: ErrorEvent) => {
      const errorMsg = `ERROR: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
      console.error(errorMsg);
      localStorage.setItem('adminPageError', errorMsg);
    };
    
    window.addEventListener('error', errorHandler);
    
    const saved = localStorage.getItem('adminLoginDebug');
    if (saved) {
      try {
        setDebugLog(JSON.parse(saved));
      } catch {
        // Ignore parse errors
      }
    }
    
    // Check for captured errors
    const pageError = localStorage.getItem('adminPageError');
    if (pageError) {
      addLog(`CAPTURED ERROR: ${pageError}`);
      localStorage.removeItem('adminPageError');
    }
    
    // Load layout debug info if present
    const layoutDebug = localStorage.getItem('adminLayoutDebug');
    if (layoutDebug) {
      try {
        const layoutInfo = JSON.parse(layoutDebug);
        addLog(`LAYOUT DEBUG: ${layoutInfo.message}`);
        addLog(`  - Timestamp: ${layoutInfo.timestamp}`);
        addLog(`  - Path: ${layoutInfo.pathname}`);
        addLog(`  - isAuthenticated: ${layoutInfo.isAuthenticated}`);
        addLog(`  - sessionStorage key exists: ${!!layoutInfo.sessionStorageKey}`);
        addLog(`  - sessionStorage key length: ${layoutInfo.sessionStorageKey?.length || 0}`);
      } catch {
        // Ignore parse errors
      }
    }
    
    return () => {
      window.removeEventListener('error', errorHandler);
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      addLog(`Starting login attempt to: ${apiUrl}/admin/categories`);
      addLog(`Key length: ${key.length} characters`);
      addLog('Using header: x-admin-key');
      
      // Test the key by fetching categories
      addLog('Sending fetch request...');
      const response = await fetch(`${apiUrl}/admin/categories`, {
        headers: {
          'x-admin-key': key,
        },
      });

      addLog(`Response received - Status: ${response.status}, OK: ${response.ok}`);

      if (!response.ok) {
        const errorText = await response.text();
        addLog(`Error response body: ${errorText}`);
        const errorMessage = `Login failed (${response.status}): ${errorText}`;
        setError(errorMessage);
        setLoading(false);
        return;
      }

      // Key is valid, store it and redirect
      addLog('Login successful! Storing key...');
      setAdminKey(key);
      
      addLog('Redirecting to /admin...');
      router.push('/admin');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      addLog(`EXCEPTION CAUGHT: ${errorMessage}`);
      addLog(`Error stack: ${err instanceof Error ? err.stack : 'no stack'}`);
      setError(errorMessage);
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

        {/* Debug Log - only render on client to avoid hydration mismatch */}
        {mounted && debugLog.length > 0 && (
          <div className="mt-4 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Debug Log:</h3>
              <button
                type="button"
                onClick={clearDebugLog}
                className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Clear Log
              </button>
            </div>
            <div className="text-xs font-mono space-y-1">
              {debugLog.map((log, i) => (
                <div key={i} className="text-zinc-700 dark:text-zinc-300 break-all">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
