'use client';

import { PollCategory } from '@/app/lib/types';

interface SidebarProps {
  categories: PollCategory[];
  activeCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

export default function Sidebar({ categories, activeCategory, onSelectCategory }: SidebarProps) {
  return (
    <aside className="w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex-shrink-0">
      <div className="sticky top-0 h-screen overflow-y-auto p-6">
        <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
          Categories
        </h2>
        
        <nav className="space-y-1">
          {/* All Polls option */}
          <button
            onClick={() => onSelectCategory(null)}
            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
              activeCategory === null
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            All Polls
          </button>

          {/* Category list */}
          {categories
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((category) => (
              <button
                key={category.categoryId}
                onClick={() => onSelectCategory(category.categoryId)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  activeCategory === category.categoryId
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {category.categoryName}
              </button>
            ))}
        </nav>
      </div>
    </aside>
  );
}
