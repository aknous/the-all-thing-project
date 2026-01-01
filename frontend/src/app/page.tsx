'use client';

import { useEffect, useState } from 'react';
import { getTodayPolls } from '@/app/lib/api';
import { PollCategory } from '@/app/lib/types';
import Header from '@/components/Header';
import PollList from '@/components/PollList';

export default function Home() {
  const [categories, setCategories] = useState<PollCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

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

  // Filter categories based on active selection
  // If a category is selected, find it and show it with its subcategories
  const filteredCategories = activeCategory
    ? (() => {
        // Helper to recursively find a category
        const findCategory = (cats: PollCategory[], targetId: string): PollCategory | null => {
          for (const cat of cats) {
            if (cat.categoryId === targetId) return cat;
            if (cat.subCategories) {
              const found = findCategory(cat.subCategories, targetId);
              if (found) return found;
            }
          }
          return null;
        };
        
        const found = findCategory(categories, activeCategory);
        return found ? [found] : [];
      })()
    : categories;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <Header
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
      />

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {filteredCategories.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-600 dark:text-zinc-400">
              No polls available.
            </p>
          </div>
        ) : (
          <PollList categories={filteredCategories} />
        )}
      </main>
    </div>
  );
}
