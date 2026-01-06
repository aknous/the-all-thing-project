'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/adminAuth';

interface Preset {
  id: string;
  name: string;
  description: string | null;
  options: Array<{ optionId: string; label: string; sortOrder: number }>;
  createdAt: string;
  updatedAt: string;
}

export default function PresetsPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const res = await adminFetch(`${API_URL}/admin/presets`);
      const data = await res.json();
      setPresets(data.presets || []);
    } catch (error) {
      console.error('Failed to load presets:', error);
    } finally {
      setLoading(false);
    }
  };

  const deletePreset = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      await adminFetch(`${API_URL}/admin/presets/${id}`, {
        method: 'DELETE',
      });
      alert('Preset deleted successfully');
      await loadPresets();
    } catch (error) {
      console.error('Failed to delete preset:', error);
      alert('Failed to delete preset');
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
    <div className="max-w-5xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Preset Option Sets
        </h1>
      </div>

      <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 mb-6">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Presets are reusable option sets that can be applied when creating poll templates. 
          Create presets from the template creation page using the &quot;Save as Preset&quot; button.
        </p>
      </div>

      {presets.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <p className="text-zinc-500 dark:text-zinc-400">
            No presets yet. Create your first preset from the template creation page.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {presets.map(preset => (
            <div
              key={preset.id}
              className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            >
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {preset.name}
                    </h3>
                    {preset.description && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                        {preset.description}
                      </p>
                    )}
                    <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-2">
                      {preset.options.length} options
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => setExpandedId(expandedId === preset.id ? null : preset.id)}
                      className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/20 hover:bg-blue-200 dark:hover:bg-blue-900/30
                               text-blue-700 dark:text-blue-400 rounded transition-colors"
                    >
                      {expandedId === preset.id ? 'Hide' : 'View'} Options
                    </button>
                    <button
                      onClick={() => deletePreset(preset.id, preset.name)}
                      className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30
                               text-red-700 dark:text-red-400 rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {expandedId === preset.id && (
                  <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Options:</h4>
                    <div className="space-y-1">
                      {preset.options
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((option, idx) => (
                          <div
                            key={idx}
                            className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded text-sm text-zinc-700 dark:text-zinc-300"
                          >
                            {idx + 1}. {option.label}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
