'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/app/lib/adminAuth';
import { getEasternToday } from '@/app/lib/dateUtils';
import Link from 'next/link';

interface Instance {
  id: string;
  templateId: string;
  categoryId: string;
  pollDate: string;
  closeDate: string;
  title: string;
  question: string | null;
  pollType: 'SINGLE' | 'RANKED';
  status: 'OPEN' | 'CLOSED';
  voteCount?: number;
}

interface Category {
  id: string;
  name: string;
}

interface Template {
  id: string;
  title: string;
}

export default function InstancesPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterTemplate, setFilterTemplate] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      
      // Get today's date in Eastern Time
      const today = getEasternToday();
      setFilterDate(today);
      
      const [instancesRes, categoriesRes, templatesRes] = await Promise.all([
        adminFetch(`${API_URL}/admin/instances?pollDate=${today}`),
        adminFetch(`${API_URL}/admin/categories`),
        adminFetch(`${API_URL}/admin/templates`),
      ]);

      const instancesData = await instancesRes.json();
      const categoriesData = await categoriesRes.json();
      const templatesData = await templatesRes.json();

      setInstances(instancesData.instances || []);
      
      // Flatten categories
      const flattenCategories = (cats: { id: string; name: string; subCategories?: unknown[] }[]): Category[] => {
        const result: Category[] = [];
        for (const cat of cats) {
          result.push({ id: cat.id, name: cat.name });
          if (cat.subCategories && Array.isArray(cat.subCategories)) {
            result.push(...flattenCategories(cat.subCategories as { id: string; name: string; subCategories?: unknown[] }[]));
          }
        }
        return result;
      };
      
      setCategories(flattenCategories(categoriesData.categories || []));
      setTemplates(templatesData.templates || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInstancesForDate = async (date: string) => {
    if (!date) return;
    
    setLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const res = await adminFetch(`${API_URL}/admin/instances?pollDate=${date}`);
      const data = await res.json();
      setInstances(data.instances || []);
    } catch (error) {
      console.error('Failed to load instances:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (date: string) => {
    setFilterDate(date);
    loadInstancesForDate(date);
  };

  const closeInstance = async (instanceId: string) => {
    if (!confirm('Close this poll and create a snapshot? This cannot be undone.')) {
      return;
    }

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      await adminFetch(`${API_URL}/admin/instances/${instanceId}/close`, {
        method: 'POST',
      });
      
      alert('Poll closed successfully');
      loadInstancesForDate(filterDate);
    } catch (error) {
      console.error('Failed to close instance:', error);
      alert('Failed to close poll');
    }
  };

  const filteredInstances = instances.filter(inst => {
    if (filterStatus !== 'all' && inst.status !== filterStatus) return false;
    if (filterCategory && inst.categoryId !== filterCategory) return false;
    if (filterTemplate && inst.templateId !== filterTemplate) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading instances...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Poll Instances
        </h1>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Poll Date
            </label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg
                       bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg
                       bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            >
              <option value="all">All Status</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg
                       bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Template
            </label>
            <select
              value={filterTemplate}
              onChange={(e) => setFilterTemplate(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg
                       bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            >
              <option value="">All Templates</option>
              {templates.map(tmpl => (
                <option key={tmpl.id} value={tmpl.id}>{tmpl.title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Instances List */}
      <div className="space-y-4">
        {filteredInstances.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <p className="text-zinc-600 dark:text-zinc-400">No instances found for this date</p>
          </div>
        ) : (
          filteredInstances.map((instance) => {
            const category = categories.find(c => c.id === instance.categoryId);
            const template = templates.find(t => t.id === instance.templateId);
            
            return (
              <div
                key={instance.id}
                className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        {instance.title}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        instance.status === 'OPEN'
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}>
                        {instance.status}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                        {instance.pollType}
                      </span>
                    </div>
                    
                    <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                      <p><span className="font-medium">ID:</span> <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">{instance.id}</code></p>
                      <p><span className="font-medium">Category:</span> {category?.name || 'Unknown'}</p>
                      <p><span className="font-medium">Template:</span> {template?.title || 'Unknown'}</p>
                      <p><span className="font-medium">Poll Date:</span> {instance.pollDate}</p>
                      <p><span className="font-medium">Close Date:</span> {instance.closeDate}</p>
                      {instance.question && <p><span className="font-medium">Question:</span> {instance.question}</p>}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/admin/instances/${instance.id}`}
                      className="px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 
                               text-zinc-900 dark:text-zinc-100 rounded-lg transition-colors"
                    >
                      View
                    </Link>
                    {instance.status === 'OPEN' && (
                      <button
                        onClick={() => closeInstance(instance.id)}
                        className="px-3 py-2 text-sm bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30 
                                 text-red-700 dark:text-red-400 rounded-lg transition-colors"
                      >
                        Close
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
