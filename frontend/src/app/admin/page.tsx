'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/app/lib/adminAuth';
import Link from 'next/link';

interface Stats {
  categoriesCount: number;
  templatesCount: number;
  activeTemplatesCount: number;
  openInstancesCount: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      
      const [categoriesRes, templatesRes] = await Promise.all([
        adminFetch(`${API_URL}/admin/categories`),
        adminFetch(`${API_URL}/admin/templates`),
      ]);

      const categoriesData = await categoriesRes.json();
      const templatesData = await templatesRes.json();

      const categories = categoriesData.categories || [];
      const templates = templatesData.templates || [];

      setStats({
        categoriesCount: categories.length,
        templatesCount: templates.length,
        activeTemplatesCount: templates.filter((t: { isActive: boolean }) => t.isActive).length,
        openInstancesCount: 0, // Can add later with instances endpoint
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">
        Dashboard
      </h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Categories</p>
          <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {stats?.categoriesCount || 0}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Total Templates</p>
          <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {stats?.templatesCount || 0}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Active Templates</p>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
            {stats?.activeTemplatesCount || 0}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Open Polls</p>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {stats?.openInstancesCount || 0}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Quick Actions
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/admin/templates"
            className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg 
                     hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">
              Manage Templates
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Create and edit poll templates
            </p>
          </Link>

          <Link
            href="/admin/categories"
            className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg 
                     hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">
              Manage Categories
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Organize polls into categories
            </p>
          </Link>

          <Link
            href="/admin/operations"
            className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg 
                     hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">
              Operations
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Rollover, close polls, snapshots
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
