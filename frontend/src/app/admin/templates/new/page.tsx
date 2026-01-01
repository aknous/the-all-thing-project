'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/app/lib/adminAuth';

interface Category {
  id: string;
  key: string;
  name: string;
  sortOrder: number;
}

interface CategoryResponse {
  id: string;
  key: string;
  name: string;
  sortOrder: number;
  subCategories?: CategoryResponse[];
}

interface OptionInput {
  label: string;
  sortOrder: number;
}

export default function NewTemplatePage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    categoryId: '',
    key: '',
    title: '',
    question: '',
    pollType: 'SINGLE' as 'SINGLE' | 'RANKED',
    maxRank: '',
    audience: 'public',
    durationDays: '1',
    isActive: true,
  });

  const [options, setOptions] = useState<OptionInput[]>([
    { label: '', sortOrder: 0 },
    { label: '', sortOrder: 1 },
  ]);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const res = await adminFetch(`${API_URL}/admin/categories`);
      const data = await res.json();
      
      // Flatten categories
      const flattenCategories = (cats: CategoryResponse[]): Category[] => {
        const result: Category[] = [];
        for (const cat of cats) {
          result.push({
            id: cat.id,
            key: cat.key,
            name: cat.name,
            sortOrder: cat.sortOrder,
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
    
    // Validation
    if (!formData.categoryId || !formData.key || !formData.title) {
      alert('Please fill in all required fields');
      return;
    }

    const validOptions = options.filter(o => o.label.trim());
    if (validOptions.length < 2) {
      alert('Please provide at least 2 options');
      return;
    }

    setSaving(true);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const payload = {
        categoryId: formData.categoryId,
        key: formData.key,
        title: formData.title,
        question: formData.question || null,
        pollType: formData.pollType,
        maxRank: formData.pollType === 'RANKED' && formData.maxRank ? parseInt(formData.maxRank) : null,
        audience: formData.audience,
        durationDays: parseInt(formData.durationDays),
        isActive: formData.isActive,
        options: validOptions,
      };

      await adminFetch(`${API_URL}/admin/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      alert('Template created successfully');
      router.push('/admin/templates');
    } catch (error) {
      console.error('Failed to create template:', error);
      alert('Failed to create template');
      setSaving(false);
    }
  };

  const addOption = () => {
    setOptions([...options, { label: '', sortOrder: options.length }]);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, label: string) => {
    setOptions(options.map((opt, i) => i === index ? { ...opt, label } : opt));
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">
        Create Template
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Basic Information</h2>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Category *
            </label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg
                       bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              required
            >
              <option value="">Select a category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

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
              placeholder="my-poll-key"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg
                       bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              placeholder="Poll title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Question (optional)
            </label>
            <input
              type="text"
              value={formData.question}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg
                       bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              placeholder="Additional question text"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Poll Type
              </label>
              <select
                value={formData.pollType}
                onChange={(e) => setFormData({ ...formData, pollType: e.target.value as 'SINGLE' | 'RANKED' })}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg
                         bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="SINGLE">Single Choice</option>
                <option value="RANKED">Ranked Choice (IRV)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Duration (days)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={formData.durationDays}
                onChange={(e) => setFormData({ ...formData, durationDays: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg
                         bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          {formData.pollType === 'RANKED' && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Max Rank (optional)
              </label>
              <input
                type="number"
                min="1"
                value={formData.maxRank}
                onChange={(e) => setFormData({ ...formData, maxRank: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg
                         bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                placeholder="Leave empty for unlimited"
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Active (creates daily instances)
            </label>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Options</h2>
            <button
              type="button"
              onClick={addOption}
              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Add Option
            </button>
          </div>

          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={option.label}
                  onChange={(e) => updateOption(index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg
                           bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  placeholder={`Option ${index + 1}`}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="px-3 py-2 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30
                             text-red-700 dark:text-red-400 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
          >
            {saving ? 'Creating...' : 'Create Template'}
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
