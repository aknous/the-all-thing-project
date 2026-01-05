'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/adminAuth';
import Link from 'next/link';

interface Template {
  id: string;
  categoryId: string;
  key: string;
  title: string;
  question: string | null;
  pollType: 'SINGLE' | 'RANKED';
  maxRank: number | null;
  audience: string;
  durationDays: number;
  isActive: boolean;
  options?: Array<{
    id: string;
    label: string;
    sortOrder: number;
  }>;
}

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

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      
      const [templatesRes, categoriesRes] = await Promise.all([
        adminFetch(`${API_URL}/admin/templates`),
        adminFetch(`${API_URL}/admin/categories`),
      ]);

      const templatesData = await templatesRes.json();
      const categoriesData = await categoriesRes.json();

      setTemplates(templatesData.templates || []);
      
      // Flatten categories including subcategories
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
      
      setCategories(flattenCategories(categoriesData.categories || []));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (templateId: string, currentActive: boolean) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      await adminFetch(`${API_URL}/admin/templates/${templateId}/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      
      // Update local state
      setTemplates(templates.map(t => 
        t.id === templateId ? { ...t, isActive: !currentActive } : t
      ));
    } catch (error) {
      console.error('Failed to toggle template:', error);
      alert('Failed to update template status');
    }
  };

  const deleteTemplate = async (template: Template) => {
    const templateTitle = template.title;
    const forceDelete = confirm(
      `Are you sure you want to delete "${templateTitle}"?\n\n` +
      `This will also delete all related instances and plans.\n\n` +
      `Click OK to confirm deletion.`
    );
    
    if (!forceDelete) return;

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const response = await adminFetch(`${API_URL}/admin/templates/${template.id}?force=true`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete template');
      }

      const result = await response.json();
      
      // Show success message with cascade info
      alert(
        `Template deleted successfully!\n\n` +
        `Deleted: ${result.deletedTemplate.title}\n` +
        `Also removed:\n` +
        `- ${result.cascadeDeleted.instances} poll instance(s)\n` +
        `- ${result.cascadeDeleted.plans} plan(s)\n` +
        `- ${result.cascadeDeleted.votes} vote(s)`
      );
      
      // Remove from local state
      setTemplates(templates.filter(t => t.id !== template.id));
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert(`Failed to delete template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const filteredTemplates = templates.filter(t => {
    if (filterCategory && t.categoryId !== filterCategory) return false;
    if (filterActive === 'active' && !t.isActive) return false;
    if (filterActive === 'inactive' && t.isActive) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading templates...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Poll Templates
        </h1>
        <Link
          href="/admin/templates/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Create Template
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 mb-6">
        <div className="flex gap-4">
          <div className="flex-1">
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

          <div className="flex-1">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Status
            </label>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg
                       bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            >
              <option value="all">All Templates</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Templates List */}
      <div className="space-y-4">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <p className="text-zinc-600 dark:text-zinc-400">No templates found</p>
          </div>
        ) : (
          filteredTemplates.map((template) => {
            const category = categories.find(c => c.id === template.categoryId);
            
            return (
              <div
                key={template.id}
                className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        {template.title}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        template.isActive
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}>
                        {template.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                        {template.pollType}
                      </span>
                    </div>
                    
                    <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                      <p><span className="font-medium">ID:</span> <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">{template.id}</code></p>
                      <p><span className="font-medium">Key:</span> {template.key}</p>
                      <p><span className="font-medium">Category:</span> {category?.name || 'Unknown'}</p>
                      {template.question && <p><span className="font-medium">Question:</span> {template.question}</p>}
                      <p><span className="font-medium">Duration:</span> {template.durationDays} day{template.durationDays !== 1 ? 's' : ''}</p>
                      {template.pollType === 'RANKED' && template.maxRank && (
                        <p><span className="font-medium">Max Rank:</span> {template.maxRank}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/admin/templates/${template.id}`}
                      className="px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 
                               text-zinc-900 dark:text-zinc-100 rounded-lg transition-colors"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => toggleActive(template.id, template.isActive)}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                        template.isActive
                          ? 'bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'bg-green-100 dark:bg-green-900/20 hover:bg-green-200 dark:hover:bg-green-900/30 text-green-700 dark:text-green-400'
                      }`}
                    >
                      {template.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => deleteTemplate(template)}
                      className="px-3 py-2 text-sm bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30 
                               text-red-700 dark:text-red-400 rounded-lg transition-colors"
                      title="Delete template"
                    >
                      Delete
                    </button>
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
