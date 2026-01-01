'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PollCategory } from '@/app/lib/types';

interface HeaderProps {
  categories: PollCategory[];
  activeCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

export default function Header({ categories, activeCategory, onSelectCategory }: HeaderProps) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  
  // Only show top-level categories (those without a parent)
  const topLevelCategories = categories.filter(cat => !cat.parentCategoryId);
  
  return (
    <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center">
              <Image
                src="/TheAllThingProject-LogoFull-White.png"
                alt="The All Thing Project"
                width={300}
                height={75}
                priority
                className="h-12 w-auto"
              />
            </Link>
            
            <div className="hidden md:flex space-x-4">
              <button
                onClick={() => onSelectCategory(null)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeCategory === null
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                All Polls
              </button>
              
              {topLevelCategories.map((category) => {
                const hasSubCategories = category.subCategories && category.subCategories.length > 0;
                
                return (
                  <div
                    key={category.categoryId}
                    className="relative"
                    onMouseEnter={() => setHoveredCategory(category.categoryId)}
                    onMouseLeave={() => setHoveredCategory(null)}
                  >
                    <button
                      onClick={() => onSelectCategory(category.categoryId)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeCategory === category.categoryId
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {category.categoryName}
                      {hasSubCategories && (
                        <span className="ml-1 text-xs">▼</span>
                      )}
                    </button>
                    
                    {/* Dropdown for subcategories */}
                    {hasSubCategories && hoveredCategory === category.categoryId && (
                      <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg py-1 z-50">
                        {category.subCategories!.map((subCategory) => (
                          <button
                            key={subCategory.categoryId}
                            onClick={() => onSelectCategory(subCategory.categoryId)}
                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                              activeCategory === subCategory.categoryId
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                          >
                            {subCategory.categoryName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
