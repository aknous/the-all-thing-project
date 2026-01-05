'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getTodayPolls } from '@/lib/api';
import { PollCategory, Poll } from '@/lib/types';
import { PublicLayout } from '@/components/PublicLayout';
import PollList from '@/components/PollList';
import { getCachedCategories, setCachedCategories } from '@/lib/categoryCache';

// Helper to find category by key (searches both parent and subcategories)
function findCategoryByKey(categories: PollCategory[], key: string): PollCategory | null {
  for (const cat of categories) {
    if (cat.categoryKey === key) return cat;
    if (cat.subCategories) {
      const found = findCategoryByKey(cat.subCategories, key);
      if (found) return found;
    }
  }
  return null;
}

export default function PollsPage() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');
  const [categories, setCategories] = useState<PollCategory[]>(() => getCachedCategories() || []);
  const [loading, setLoading] = useState(() => !getCachedCategories());
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [visibleSections, setVisibleSections] = useState<string[]>([]);

  useEffect(() => {
    // Only fetch if not already cached (lazy init handled the cache check)
    if (categories.length > 0) {
      return;
    }

    getTodayPolls()
      .then((data) => {
        setCategories(data.categories);
        setCachedCategories(data.categories);
      })
      .catch((err) => {
        console.error('Failed to fetch polls:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [categories.length]);

  // Sync selectedCategory with URL parameter, default to 'featured'
  const effectiveCategory = categoryParam || selectedCategory || 'featured';

  // Track visible sections with intersection observer
  useEffect(() => {
    if (!effectiveCategory) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible: string[] = [];
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.target.id) {
            visible.push(entry.target.id);
          }
        });
        
        if (visible.length > 0) {
          setVisibleSections(visible);
        }
      },
      {
        rootMargin: '-100px 0px -66% 0px',
        threshold: 0,
      }
    );

    // Observe all category sections
    const sections = document.querySelectorAll('[id]');
    sections.forEach((section) => {
      if (section.id) {
        observer.observe(section);
      }
    });

    return () => observer.disconnect();
  }, [effectiveCategory, categories]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto"></div>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading polls...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-900">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">Failed to load polls</p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  // Extract featured polls from all categories, grouped by their original category
  const extractFeaturedPolls = (cats: PollCategory[]): PollCategory[] => {
    const categoriesWithFeatured: PollCategory[] = [];
    
    const recurse = (categories: PollCategory[]) => {
      categories.forEach(cat => {
        const featuredInCategory = cat.polls.filter(poll => poll.featured);
        if (featuredInCategory.length > 0) {
          categoriesWithFeatured.push({
            ...cat,
            polls: featuredInCategory,
            subCategories: [], // Don't show subcategories in featured view
          });
        }
        if (cat.subCategories) {
          recurse(cat.subCategories);
        }
      });
    };
    recurse(cats);
    
    return categoriesWithFeatured;
  };

  // Filter categories based on selection
  const displayCategories = effectiveCategory 
    ? (() => {
        // Special handling for "featured" category
        if (effectiveCategory === 'featured') {
          return extractFeaturedPolls(categories);
        }
        
        const category = findCategoryByKey(categories, effectiveCategory);
        if (!category) return [];
        
        // If category has subcategories, show all of them (this is a parent category)
        if (category.subCategories && category.subCategories.length > 0) {
          return category.subCategories;
        }
        
        // Otherwise, show just this category (it's a child category)
        return [category];
      })()
    : categories;

  const selectedCategoryData = effectiveCategory 
    ? (effectiveCategory === 'featured' ? null : findCategoryByKey(categories, effectiveCategory))
    : null;

  return (
    <PublicLayout 
      categories={categories}
      onCategoryChange={setSelectedCategory}
      activeCategory={effectiveCategory}
      visibleSections={visibleSections}
    >
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-zinc-900 dark:text-zinc-100">
          {effectiveCategory === 'featured' ? 'Featured Polls' : selectedCategoryData ? selectedCategoryData.categoryName : "Today's Polls"}
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-8">
          {effectiveCategory === 'featured' 
            ? "Our handpicked selection of today's most important polls."
            : selectedCategoryData 
              ? `Polls in ${selectedCategoryData.categoryName}`
              : "Vote on today's questions and see how others are thinking."
          }
        </p>
        
        {displayCategories.length === 0 || displayCategories.every(cat => cat.polls.length === 0) ? (
          <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <p className="text-zinc-600 dark:text-zinc-400">
              No polls available {selectedCategoryData ? 'in this category' : 'today'}.
            </p>
          </div>
        ) : (
          <PollList categories={displayCategories} />
        )}
      </div>
    </PublicLayout>
  );
}
