'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { PollCategory } from '@/lib/types';

interface SidebarProps {
  categories: PollCategory[];
}

// Helper to find parent category by child ID
function findParentCategory(categories: PollCategory[], childId: string): PollCategory | null {
  for (const cat of categories) {
    if (cat.subCategories) {
      for (const subCat of cat.subCategories) {
        if (subCat.categoryId === childId) {
          return cat;
        }
      }
    }
  }
  return null;
}

function CategoryNavItem({ 
  category,
  allCategories,
  depth = 0 
}: { 
  category: PollCategory;
  allCategories: PollCategory[];
  depth?: number;
}) {
  const params = useParams();
  const router = useRouter();
  const categoryKey = params?.categoryKey as string | undefined;
  
  const isActive = categoryKey === category.categoryKey;
  const hasSubCategories = category.subCategories && category.subCategories.length > 0;
  
  const handleClick = () => {
    router.push(`/polls/${category.categoryKey}`);
  };
  
  return (
    <div>
      <button
        onClick={handleClick}
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
                allCategories={allCategories}
                depth={depth + 1}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ categories }: SidebarProps) {
  const router = useRouter();
  const params = useParams();
  const hasActivePath = params?.parentCategory || params?.subCategory;

  return (
    <aside className="w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex-shrink-0 relative z-10">
      <div className="sticky top-0 h-screen overflow-y-auto">
        {/* Navigation */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
            Categories
          </h2>
          
          <nav className="space-y-1">
            {/* All Polls option */}
            <button
              onClick={() => router.push('/polls')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                !hasActivePath
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
                  allCategories={categories}
                />
              ))}
          </nav>
        </div>
      </div>
    </aside>
  );
}
