'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getTodayPolls } from '@/app/lib/api';
import { PollCategory } from '@/app/lib/types';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import PollList from '@/components/PollList';
import Breadcrumbs from '@/components/Breadcrumbs';

// Helper to find category by key (searches both parent and subcategories)
function findCategoryByKey(categories: PollCategory[], key: string): PollCategory | null {
  for (const cat of categories) {
    if (cat.categoryKey === key) return cat;
    if (cat.subCategories) {
      const found = findCategoryByKey(cat.subCategories, key);
      if (found) return found;
    }
  }
  return null;
}

// Helper to find parent category for a given category
function findParentCategory(categories: PollCategory[], childId: string): PollCategory | null {
  for (const cat of categories) {
    if (cat.subCategories) {
      for (const subCat of cat.subCategories) {
        if (subCat.categoryId === childId) {
          return cat;
        }
      }
      // Recursively search deeper
      const found = findParentCategory(cat.subCategories, childId);
      if (found) return found;
    }
  }
  return null;
}

export default function CategoryPage() {
  const params = useParams();
  const categoryKey = params?.categoryKey as string;
  
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

  const selectedCategory = findCategoryByKey(categories, categoryKey);

  if (!selectedCategory) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <Header />
        <div className="flex">
          <Sidebar categories={categories} />
          <main className="flex-1 p-8">
            <p className="text-zinc-600 dark:text-zinc-400">Category not found</p>
          </main>
        </div>
      </div>
    );
  }

  // Build breadcrumb trail
  const breadcrumbItems = [{ label: 'All Polls', href: '/polls' }];
  
  // If this is a subcategory, add parent to breadcrumbs
  if (selectedCategory.parentCategoryId) {
    const parentCategory = findParentCategory(categories, selectedCategory.categoryId);
    if (parentCategory) {
      breadcrumbItems.push({
        label: parentCategory.categoryName,
        href: `/polls/${parentCategory.categoryKey}`
      });
    }
  }
  
  // Add current category
  breadcrumbItems.push({ label: selectedCategory.categoryName });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <div className="flex">
        <Sidebar categories={categories} />
        <main className="flex-1 px-6 py-8">
          <div className="max-w-3xl mx-auto">
          <Breadcrumbs items={breadcrumbItems} />
          <PollList 
            categories={[selectedCategory]}
          />
          </div>
        </main>
      </div>
    </div>
  );
}
