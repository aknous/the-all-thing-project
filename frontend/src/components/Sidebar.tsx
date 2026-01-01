'use client';

import Image from 'next/image';
import Link from 'next/link';
import { PollCategory } from '@/app/lib/types';

interface SidebarProps {
  categories: PollCategory[];
  activeCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

function CategoryNavItem({ 
  category, 
  activeCategory, 
  onSelectCategory,
  depth = 0 
}: { 
  category: PollCategory; 
  activeCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  depth?: number;
}) {
  const isActive = activeCategory === category.categoryId;
  const hasSubCategories = category.subCategories && category.subCategories.length > 0;
  
  return (
    <div>
      <button
        onClick={() => onSelectCategory(category.categoryId)}
        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
          depth > 0 ? 'ml-4 text-sm' : ''
        } ${
          isActive
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
            : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
      >
        {depth > 0 && '↳ '}{category.categoryName}
      </button>
      
      {hasSubCategories && (
        <div className="mt-1 space-y-1">
          {category.subCategories!
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((subCategory) => (
              <CategoryNavItem
                key={subCategory.categoryId}
                category={subCategory}
                activeCategory={activeCategory}
                onSelectCategory={onSelectCategory}
                depth={depth + 1}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ categories, activeCategory, onSelectCategory }: SidebarProps) {
  return (
    <aside className="w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex-shrink-0">
      <div className="sticky top-0 h-screen overflow-y-auto">
        {/* Logo */}
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <Link href="/" className="block">
            <Image
              src="/TheAllThingProject-LogoFull-White.png"
              alt="The All Thing Project"
              width={300}
              height={75}
              priority
              className="h-14 w-auto"
            />
          </Link>
        </div>

        {/* Navigation */}
        <div className="p-6">
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

            {/* Category list with subcategories */}
            {categories
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((category) => (
                <CategoryNavItem
                  key={category.categoryId}
                  category={category}
                  activeCategory={activeCategory}
                  onSelectCategory={onSelectCategory}
                />
              ))}
          </nav>
        </div>
      </div>
    </aside>
  );
}
