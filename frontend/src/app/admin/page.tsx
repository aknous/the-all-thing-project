'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/adminAuth';
import { getEasternToday } from '@/lib/dateUtils';
import Link from 'next/link';

interface Stats {
  categoriesCount: number;
  templatesCount: number;
  activeTemplatesCount: number;
  openInstancesCount: number;
}

interface Analytics {
  totalVotes: number;
  uniqueInstances: number;
  todayVotes: number;
  todayInstances: number;
  dailyBreakdown: Array<{
    date: string;
    votes: number;
    instances: number;
  }>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      
      console.log('[Dashboard] Starting to load stats from:', API_URL);
      
      // Get today's date in Eastern Time
      const today = getEasternToday();

      console.log('[Dashboard] Fetching data...');
      
      const [categoriesRes, templatesRes, instancesRes] = await Promise.all([
        adminFetch(`${API_URL}/admin/categories`),
        adminFetch(`${API_URL}/admin/templates`),
        adminFetch(`${API_URL}/admin/instances?pollDate=${today}`),
      ]);
      
      // Fetch analytics separately so it doesn't break the whole dashboard if it fails
      let analyticsRes = null;
      try {
        analyticsRes = await adminFetch(`${API_URL}/admin/analytics`);
      } catch (err) {
        console.error('[Dashboard] Analytics fetch failed:', err);
      }

      console.log('[Dashboard] Responses received');
      console.log('[Dashboard] Categories status:', categoriesRes.status);
      console.log('[Dashboard] Templates status:', templatesRes.status);
      console.log('[Dashboard] Instances status:', instancesRes.status);
      console.log('[Dashboard] Analytics status:', analyticsRes.status);

      const categoriesData = await categoriesRes.json();
      const templatesData = await templatesRes.json();
      const instancesData = await instancesRes.json();
      const analyticsData = analyticsRes ? await analyticsRes.json() : null;

      console.log('[Dashboard] Analytics data:', analyticsData);

      const categories = categoriesData.categories || [];
      const templates = templatesData.templates || [];
      const instances = instancesData.instances || [];
      const openInstances = instances.filter((i: { status: string }) => i.status === 'OPEN');

      setStats({
        categoriesCount: categories.length,
        templatesCount: templates.length,
        activeTemplatesCount: templates.filter((t: { isActive: boolean }) => t.isActive).length,
        openInstancesCount: openInstances.length,
      });

      if (analyticsData) {
        setAnalytics(analyticsData);
      }
      console.log('[Dashboard] Stats loaded successfully');
    } catch (error) {
      console.error('[Dashboard] Failed to load stats:', error);
      console.error('[Dashboard] Error details:', error instanceof Error ? error.message : String(error));
      console.error('[Dashboard] Error stack:', error instanceof Error ? error.stack : 'no stack');
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

      {/* Voting Analytics */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Voting Analytics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Total Votes</p>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {analytics?.totalVotes?.toLocaleString() || '0'}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Polls Voted On</p>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {analytics?.uniqueInstances || '0'}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Votes Today</p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {analytics?.todayVotes.toLocaleString() || 0}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Polls Voted Today</p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {analytics?.todayInstances || 0}
            </p>
          </div>
        </div>

        {/* Recent activity */}
        {analytics && analytics.dailyBreakdown.length > 0 && (
          <div className="mt-6 bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Recent Activity (Last 30 Days)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left py-2 px-3 text-zinc-600 dark:text-zinc-400">Date</th>
                    <th className="text-right py-2 px-3 text-zinc-600 dark:text-zinc-400">Votes</th>
                    <th className="text-right py-2 px-3 text-zinc-600 dark:text-zinc-400">Polls</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.dailyBreakdown.slice(0, 10).map((day) => (
                    <tr key={day.date} className="border-b border-zinc-100 dark:border-zinc-800/50">
                      <td className="py-2 px-3 text-zinc-900 dark:text-zinc-100">
                        {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </td>
                      <td className="py-2 px-3 text-right text-zinc-900 dark:text-zinc-100">
                        {day.votes.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right text-zinc-900 dark:text-zinc-100">
                        {day.instances}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          System Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
