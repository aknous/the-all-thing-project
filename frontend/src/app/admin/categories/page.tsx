'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/adminAuth';
import Link from 'next/link';

interface Category {
  id: string;
  key: string;
  name: string;
  sortOrder: number;
  parentCategoryId: string | null;
  subCategories?: Category[];
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const res = await adminFetch(`${API_URL}/admin/categories`);
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderCategory = (category: Category, depth = 0) => {
    return (
      <div key={category.id}>
        <div className={`bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 ${
          depth > 0 ? 'ml-8' : ''
        }`}>
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {depth > 0 && <span className="text-zinc-400">↳</span>}
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {category.name}
                </h3>
                <span className="px-2 py-1 text-xs font-medium rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  Sort: {category.sortOrder}
                </span>
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                <p><span className="font-medium">ID:</span> <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">{category.id}</code></p>
                <p><span className="font-medium">Key:</span> {category.key}</p>
              </div>
            </div>

            <Link
              href={`/admin/categories/${category.id}`}
              className="px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 
                       text-zinc-900 dark:text-zinc-100 rounded-lg transition-colors"
            >
              Edit
            </Link>
          </div>
        </div>

        {category.subCategories && category.subCategories.length > 0 && (
          <div className="mt-2 space-y-2">
            {category.subCategories.map(sub => renderCategory(sub, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading categories...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Categories
        </h1>
        <Link
          href="/admin/categories/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Create Category
        </Link>
      </div>

      <div className="space-y-4">
        {categories.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <p className="text-zinc-600 dark:text-zinc-400">No categories found</p>
          </div>
        ) : (
          categories.map(category => renderCategory(category))
        )}
      </div>
    </div>
  );
}
