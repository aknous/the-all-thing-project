'use client';

import { useEffect, useState } from 'react';
import { getTodayPolls } from '@/app/lib/api';
import { PollCategory } from '@/app/lib/types';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import PollList from '@/components/PollList';

export default function PollsPage() {
  const [categories, setCategories] = useState<PollCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTodayPolls()
      .then((data) => setCategories(data.categories))
      .catch((err) => {
        console.error('Failed to fetch polls:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading polls...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">Failed to load polls</p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <div className="flex">
        <Sidebar categories={categories} />
        <main className="flex-1 px-6 py-8">
          <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-zinc-900 dark:text-zinc-100">
            All Polls
          </h1>
          {categories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-zinc-600 dark:text-zinc-400">
                No polls available.
              </p>
            </div>
          ) : (
            <PollList categories={categories} />
          )}
          </div>
        </main>
      </div>
    </div>
  );
}
