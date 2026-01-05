import { PollCategory } from './types';

let cachedCategories: PollCategory[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function getCachedCategories(): PollCategory[] | null {
  const now = Date.now();
  if (cachedCategories && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedCategories;
  }
  return null;
}

export function setCachedCategories(categories: PollCategory[]): void {
  cachedCategories = categories;
  cacheTimestamp = Date.now();
}

export function clearCategoryCache(): void {
  cachedCategories = null;
  cacheTimestamp = 0;
}
