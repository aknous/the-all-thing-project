import { PollCategory } from '@/app/lib/types';
import PollCard from './PollCard';

interface PollListProps {
  categories: PollCategory[];
}

function CategorySection({ category, depth = 0 }: { category: PollCategory; depth?: number }) {
  const hasPolls = category.polls && category.polls.length > 0;
  const hasSubCategories = category.subCategories && category.subCategories.length > 0;
  
  // Determine heading size based on depth
  const headingClass = depth === 0 
    ? "text-2xl font-bold mb-4" 
    : "text-xl font-semibold mb-3 ml-4";
  
  return (
    <div className={depth > 0 ? "ml-4 mt-6" : ""}>
      <h2 className={`${headingClass} text-zinc-900 dark:text-zinc-100`}>
        {category.categoryName}
      </h2>
      
      {/* Polls in this category */}
      {hasPolls && (
        <div className="space-y-4">
          {category.polls.map((poll) => (
            <PollCard key={poll.pollId} poll={poll} />
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
          <CategorySection category={category} />
        </section>
      ))}
    </div>
  );
}   