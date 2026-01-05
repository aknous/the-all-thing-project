'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
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

export default function EditCategoryPage() {
  const router = useRouter();
  const params = useParams();
  const categoryId = params.id as string;

  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    key: '',
    name: '',
    sortOrder: '0',
    parentCategoryId: '',
  });

  const loadData = useCallback(async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      
      const [categoryRes, categoriesRes] = await Promise.all([
        adminFetch(`${API_URL}/admin/categories/${categoryId}`),
        adminFetch(`${API_URL}/admin/categories`),
      ]);

      const categoryData = await categoryRes.json();
      const categoriesData = await categoriesRes.json();

      setCategory(categoryData.category);
      
      // Populate form
      const c = categoryData.category;
      setFormData({
        key: c.key,
        name: c.name,
        sortOrder: c.sortOrder.toString(),
        parentCategoryId: c.parentCategoryId || '',
      });

      // Flatten categories for parent selection (exclude self and descendants)
      const flattenCategories = (cats: CategoryResponse[], excludeId: string): Category[] => {
        const result: Category[] = [];
        for (const cat of cats) {
          if (cat.id !== excludeId) {
            result.push({
              id: cat.id,
              key: cat.key,
              name: cat.name,
              sortOrder: cat.sortOrder,
              parentCategoryId: cat.parentCategoryId,
            });
            if (cat.subCategories && cat.subCategories.length > 0) {
              result.push(...flattenCategories(cat.subCategories, excludeId));
            }
          }
        }
        return result;
      };
      
      setCategories(flattenCategories(categoriesData.categories || [], categoryId));
    } catch (error) {
      console.error('Failed to load data:', error);
      alert('Failed to load category');
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

      await adminFetch(`${API_URL}/admin/categories/${categoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      alert('Category updated successfully');
      router.push('/admin/categories');
    } catch (error) {
      console.error('Failed to update category:', error);
      alert('Failed to update category');
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

  if (!category) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-600 dark:text-zinc-400">Category not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">
        Edit Category
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
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Cannot select self or subcategories as parent
            </p>
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
            {saving ? 'Saving...' : 'Save Changes'}
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
