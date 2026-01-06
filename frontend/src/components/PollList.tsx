import { PollCategory } from '@/lib/types';
import PollCard from './PollCard';

interface PollListProps {
  categories: PollCategory[];
}

// Helper to find parent category
function findParentCategory(categories: PollCategory[], childId: string): PollCategory | null {
  for (const cat of categories) {
    if (cat.subCategories) {
      for (const subCat of cat.subCategories) {
        if (subCat.categoryId === childId) {
          return cat;
        }
      }
      // Recursively search deeper
      const found = findParentCategory(cat.subCategories, childId);
      if (found) return found;
    }
  }
  return null;
}

function CategorySection({ 
  category, 
  allCategories,
  depth = 0 
}: { 
  category: PollCategory;
  allCategories: PollCategory[];
  depth?: number;
}) {
  const hasPolls = category.polls && category.polls.length > 0;
  const hasSubCategories = category.subCategories && category.subCategories.length > 0;
  
  // Determine heading size based on depth
  const headingClass = depth === 0 
    ? "text-2xl font-bold mb-4" 
    : "text-xl font-semibold mb-3 ml-4";
  
  return (
    <div id={category.categoryKey} className={depth > 0 ? "ml-4 mt-6" : "mt-6 scroll-mt-20"}>
      <div className="mb-4 pb-3 border-b-2 border-midnight-500/50">
        <h2 className={`${headingClass} dark:text-white text-black  bg-clip-text`}>
          {category.categoryName}
        </h2>
      </div>
      
      {/* Polls in this category */}
      {hasPolls && (
        <div className="space-y-4">
          {category.polls.map((poll) => (
            <PollCard 
              key={poll.pollId} 
              poll={poll}
              category={category}
              allCategories={allCategories}
            />
          ))}
        </div>
      )}
      
      {/* Sub-categories */}
      {hasSubCategories && (
        <div className={hasPolls ? "mt-6 space-y-6" : "space-y-6"}>
          {category.subCategories!.map((subCategory) => (
            <CategorySection 
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

export default function PollList({ categories }: PollListProps) {
  return (
    <div className="space-y-8">
      {categories.map((category) => (
        <section key={category.categoryId}>
          <CategorySection 
            category={category}
            allCategories={categories}
          />
        </section>
      ))}
    </div>
  );
}   