'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/adminAuth';

interface Category {
  id: string;
  key: string;
  name: string;
  sortOrder: number;
  parentCategoryId: string | null;
}

interface CategoryResponse {
  id: string;
  key: string;
  name: string;
  sortOrder: number;
  parentCategoryId: string | null;
  subCategories?: CategoryResponse[];
}

export default function NewCategoryPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    key: '',
    name: '',
    sortOrder: '0',
    parentCategoryId: '',
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const res = await adminFetch(`${API_URL}/admin/categories`);
      const data = await res.json();
      
      // Flatten categories for parent selection
      const flattenCategories = (cats: CategoryResponse[]): Category[] => {
        const result: Category[] = [];
        for (const cat of cats) {
          result.push({
            id: cat.id,
            key: cat.key,
            name: cat.name,
            sortOrder: cat.sortOrder,
            parentCategoryId: cat.parentCategoryId,
          });
          if (cat.subCategories && cat.subCategories.length > 0) {
            result.push(...flattenCategories(cat.subCategories));
          }
        }
        return result;
      };
      
      setCategories(flattenCategories(data.categories || []));
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.key || !formData.name) {
      alert('Please fill in all required fields');
      return;
    }

    setSaving(true);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const payload = {
        key: formData.key,
        name: formData.name,
        sortOrder: parseInt(formData.sortOrder),
        parentCategoryId: formData.parentCategoryId || null,
      };

      await adminFetch(`${API_URL}/admin/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      alert('Category created successfully');
      router.push('/admin/categories');
    } catch (error) {
      console.error('Failed to create category:', error);
      alert('Failed to create category');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">
        Create Category
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Key * (lowercase, no spaces)
            </label>
            <input
              type="text"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/\s/g, '-') })}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg
                       bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              placeholder="my-category"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg
                       bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              placeholder="My Category"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Parent Category (optional)
            </label>
            <select
              value={formData.parentCategoryId}
              onChange={(e) => setFormData({ ...formData, parentCategoryId: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg
                       bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            >
              <option value="">None (Top Level)</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Sort Order
            </label>
            <input
              type="number"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg
                       bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Lower numbers appear first
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
          >
            {saving ? 'Creating...' : 'Create Category'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700
                     text-zinc-900 dark:text-zinc-100 font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
