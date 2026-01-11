'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { adminFetch } from '@/lib/adminAuth';

interface Instance {
  id: string;
  templateId: string;
  categoryId: string;
  pollDate: string;
  closeDate: string;
  title: string;
  question: string | null;
  pollType: 'SINGLE' | 'RANKED';
  maxRank: number | null;
  audience: string;
  status: 'OPEN' | 'CLOSED';
  options: Array<{
    id: string;
    label: string;
    sortOrder: number;
  }>;
}

interface Category {
  id: string;
  name: string;
  displayName: string; // Full hierarchical display name
}

interface CategoryResponse {
  id: string;
  name: string;
  subCategories?: CategoryResponse[];
}

export default function InstanceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const instanceId = params.id as string;

  const [instance, setInstance] = useState<Instance | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState('');

  const loadData = useCallback(async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      
      const [instanceRes, categoriesRes] = await Promise.all([
        adminFetch(`${API_URL}/admin/instances/${instanceId}`),
        adminFetch(`${API_URL}/admin/categories`),
      ]);

      const instanceData = await instanceRes.json();
      const categoriesData = await categoriesRes.json();

      setInstance(instanceData.instance);
      setSelectedCategory(instanceData.instance.categoryId);

      // Flatten categories with full hierarchical paths
      const flattenCategories = (cats: CategoryResponse[], parentPath: string = ''): Category[] => {
        const result: Category[] = [];
        for (const cat of cats) {
          const displayName = parentPath ? `${parentPath} - ${cat.name}` : cat.name;
          result.push({ id: cat.id, name: cat.name, displayName: displayName });
          if (cat.subCategories && cat.subCategories.length > 0) {
            result.push(...flattenCategories(cat.subCategories, displayName));
          }
        }
        return result;
      };
      
      setCategories(flattenCategories(categoriesData.categories || []));
    } catch (error) {
      console.error('Failed to load data:', error);
      alert('Failed to load instance');
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateCategory = async () => {
    if (!selectedCategory || selectedCategory === instance?.categoryId) {
      return;
    }

    setSaving(true);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      await adminFetch(`${API_URL}/admin/instances/${instanceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: selectedCategory }),
      });

      alert('Category updated successfully');
      loadData();
    } catch (error) {
      console.error('Failed to update category:', error);
      alert('Failed to update category');
    } finally {
      setSaving(false);
    }
  };

  const closeInstance = async () => {
    if (!confirm('Close this poll and create a snapshot? This cannot be undone.')) {
      return;
    }

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      await adminFetch(`${API_URL}/admin/instances/${instanceId}/close`, {
        method: 'POST',
      });

      alert('Poll closed successfully');
      loadData();
    } catch (error) {
      console.error('Failed to close instance:', error);
      alert('Failed to close poll');
    }
  };

  const replaceInstance = async () => {
    if (!confirm('Replace this poll with a new one from the current template/plan? The current poll will be closed and a new one created.')) {
      return;
    }

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      await adminFetch(`${API_URL}/admin/instances/${instanceId}/replace`, {
        method: 'POST',
      });

      alert('Poll replaced successfully');
      loadData();
    } catch (error) {
      console.error('Failed to replace instance:', error);
      alert('Failed to replace poll');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-600 dark:text-zinc-400">Instance not found</p>
      </div>
    );
  }

  const category = categories.find(c => c.id === instance.categoryId);

  return (
    <div className="max-w-3xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Instance Details
        </h1>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700
                   text-zinc-900 dark:text-zinc-100 rounded-lg transition-colors"
        >
          Back
        </button>
      </div>

      <div className="space-y-6">
        {/* Instance Info */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Poll Information</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Title
              </label>
              <p className="text-zinc-900 dark:text-zinc-100">{instance.title}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Status
              </label>
              <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                instance.status === 'OPEN'
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}>
                {instance.status}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Poll Type
              </label>
              <p className="text-zinc-900 dark:text-zinc-100">{instance.pollType}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Category
              </label>
              <p className="text-zinc-900 dark:text-zinc-100">{category?.name || 'Unknown'}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Poll Date
              </label>
              <p className="text-zinc-900 dark:text-zinc-100">{instance.pollDate}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Close Date
              </label>
              <p className="text-zinc-900 dark:text-zinc-100">{instance.closeDate}</p>
            </div>

            {instance.question && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Question
                </label>
                <p className="text-zinc-900 dark:text-zinc-100">{instance.question}</p>
              </div>
            )}

            {instance.pollType === 'RANKED' && instance.maxRank && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Max Rank
                </label>
                <p className="text-zinc-900 dark:text-zinc-100">{instance.maxRank}</p>
              </div>
            )}
          </div>
        </div>

        {/* Options */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Options</h2>
          
          <div className="space-y-2">
            {instance.options.map((option, index) => (
              <div key={option.id} className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">#{index + 1}</span>
                <span className="text-zinc-900 dark:text-zinc-100">{option.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Update Category */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Update Category</h2>
          
          <div className="flex gap-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg
                       bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.displayName}
                </option>
              ))}
            </select>
            
            <button
              onClick={updateCategory}
              disabled={saving || selectedCategory === instance.categoryId}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
            >
              {saving ? 'Updating...' : 'Update'}
            </button>
          </div>
        </div>

        {/* Actions */}
        {instance.status === 'OPEN' && (
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Actions</h2>
            
            <div className="flex gap-3">
              <button
                onClick={closeInstance}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Close Poll
              </button>
              
              <button
                onClick={replaceInstance}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
              >
                Replace with New
              </button>
            </div>
            
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <strong>Close:</strong> Closes this poll and creates a results snapshot.<br/>
              <strong>Replace:</strong> Closes this poll and creates a new one from the current template/plan settings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
