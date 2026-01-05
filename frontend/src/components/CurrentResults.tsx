'use client';

import { PollType, CurrentPollResults } from '@/lib/types';

interface CurrentResultsProps {
  pollType: PollType;
  results: CurrentPollResults;
}

export default function CurrentResults({ pollType, results }: CurrentResultsProps) {
  if (!results || !results.found) {
    return <div className="text-gray-500 dark:text-gray-400">No results available</div>;
  }

  if (pollType === 'SINGLE') {
    return <SinglePollResults results={results} />;
  }

  if (pollType === 'RANKED') {
    return <RankedPollResults results={results} />;
  }

  return null;
}

function SinglePollResults({ results }: { results: CurrentPollResults }) {
  const totalVotes = results.totalVotes || 0;
  
  if (totalVotes === 0) {
    return <div className="text-gray-500 dark:text-gray-400">No votes yet</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Current Results</h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </span>
      </div>
      
      {results.results?.map((option) => {
        const percentage = totalVotes > 0 ? (option.count / totalVotes) * 100 : 0;
        
        return (
          <div key={option.optionId} className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {option.label}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {option.count} ({percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-linear-to-r from-emerald-600 to-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RankedPollResults({ results }: { results: CurrentPollResults }) {
  const totalBallots = results.totalBallots || 0;
  
  if (totalBallots === 0) {
    return <div className="text-gray-500 dark:text-gray-400">No votes yet</div>;
  }

  // Extract first-choice counts from rankBreakdown
  const firstChoiceCounts: { optionId: string; label: string; count: number }[] = [];
  
  if (results.rankBreakdown && results.options) {
    for (const option of results.options) {
      const firstChoiceCount = results.rankBreakdown[option.optionId]?.[1] || 0;
      firstChoiceCounts.push({
        optionId: option.optionId,
        label: option.label,
        count: firstChoiceCount,
      });
    }
    
    // Sort by count descending
    firstChoiceCounts.sort((a, b) => b.count - a.count);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Current First-Choice Rankings</h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {totalBallots} {totalBallots === 1 ? 'ballot' : 'ballots'}
        </span>
      </div>
      
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        Showing first-choice votes only. Full ranked-choice results will be available after the poll closes.
      </div>
      
      {firstChoiceCounts.map((option) => {
        const percentage = totalBallots > 0 ? (option.count / totalBallots) * 100 : 0;
        
        return (
          <div key={option.optionId} className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {option.label}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {option.count} ({percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-linear-to-r from-emerald-600 to-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
