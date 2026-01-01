import { PollCategory } from '@/app/lib/types';
import PollCard from './PollCard';

interface PollListProps {
  categories: PollCategory[];
}

export default function PollList({ categories }: PollListProps) {
  return (
    <div className="space-y-8">
      {categories.map((category) => (
        <section key={category.categoryId}>
          <h2 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-zinc-100">
            {category.categoryName}
          </h2>
          <div className="space-y-4">
            {category.polls.map((poll) => (
              <PollCard key={poll.pollId} poll={poll} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}   