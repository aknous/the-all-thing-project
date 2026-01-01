'use client';

import { useEffect, useState } from 'react';
import { getPollHistory } from '@/app/lib/api';
import { PollResult } from '@/app/lib/types';

interface PollHistorySidebarProps {
  templateId: string;
  pollTitle: string;
  onClose: () => void;
}

export default function PollHistorySidebar({ templateId, pollTitle, onClose }: PollHistorySidebarProps) {
  const [history, setHistory] = useState<PollResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPolls, setExpandedPolls] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadHistory() {
      try {
        const data = await getPollHistory(templateId);
        setHistory(data);
      } catch (err) {
        console.error('Failed to load poll history:', err);
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, [templateId]);

  const togglePoll = (pollId: string) => {
    setExpandedPolls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pollId)) {
        newSet.delete(pollId);
      } else {
        newSet.add(pollId);
      }
      return newSet;
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside className="fixed top-0 right-0 h-screen w-96 bg-white dark:bg-zinc-900 shadow-2xl z-50 overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between">
          <div className="flex-1 pr-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Poll History
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
              {pollTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5 text-zinc-600 dark:text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="text-center py-12">
              <p className="text-zinc-600 dark:text-zinc-400">
                No historical results available
              </p>
            </div>
          )}

          {!loading && !error && history.length > 0 && (
            <div className="space-y-4">
              {history.map((result) => {
                const isExpanded = expandedPolls.has(result.pollId);
                
                return (
                <div
                  key={result.pollId}
                  className="bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden"
                >
                  {/* Header - Always Visible */}
                  <button
                    onClick={() => togglePoll(result.pollId)}
                    className="w-full p-4 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {new Date(result.pollDate + 'T00:00:00').toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {result.totalVotes} {result.totalVotes === 1 ? 'vote' : 'votes'}
                        </p>
                        <svg
                          className={`w-4 h-4 text-zinc-500 dark:text-zinc-400 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Winner - Always Visible */}
                    {result.winner && (
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">
                          🏆 Winner
                        </p>
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                            {result.winner.label}
                          </p>
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {result.winner.voteCount} ({result.winner.percentage}%)
                          </p>
                        </div>
                        <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                          <div
                            className="bg-green-500 dark:bg-green-400 h-2 rounded-full"
                            style={{ width: `${result.winner.percentage}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </button>

                  {/* Expanded Content - Full Breakdown */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                        Full Vote Breakdown
                      </p>
                      <div className="space-y-3">
                        {result.options.map((option) => {
                          // Calculate total rankings for this option
                          const totalRankings = option.rankBreakdown 
                            ? Object.values(option.rankBreakdown).reduce((sum, count) => sum + count, 0)
                            : 0;
                          
                          return (
                          <div key={option.optionId} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-zinc-700 dark:text-zinc-300 truncate pr-2">
                                {option.label}
                              </span>
                              <span className="text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                {option.voteCount} ({option.percentage}%)
                              </span>
                            </div>
                            {/* Progress bar */}
                            <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full transition-all ${
                                  option.isWinner || (result.winner && option.optionId === result.winner.optionId)
                                    ? 'bg-green-500 dark:bg-green-400'
                                    : 'bg-blue-500 dark:bg-blue-400'
                                }`}
                                style={{ width: `${option.percentage}%` }}
                              />
                            </div>
                            {/* Rank breakdown for ranked polls */}
                            {result.pollType === 'RANKED' && option.rankBreakdown && Object.keys(option.rankBreakdown).length > 0 && (
                              <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700 space-y-1.5">
                                {Object.entries(option.rankBreakdown)
                                  .sort(([a], [b]) => Number(a) - Number(b))
                                  .map(([rank, count]) => {
                                    const percentage = totalRankings > 0 ? (count / totalRankings * 100) : 0;
                                    const rankNum = Number(rank);
                                    // Color based on rank position
                                    const barColor = rankNum === 1 
                                      ? 'bg-amber-500 dark:bg-amber-400'  // Gold for 1st
                                      : rankNum === 2 
                                      ? 'bg-blue-500 dark:bg-blue-400'    // Blue for 2nd
                                      : rankNum === 3 
                                      ? 'bg-orange-500 dark:bg-red-400' // Orange for 3rd
                                      : 'bg-zinc-400 dark:bg-zinc-500';    // Gray for 4th+
                                    
                                    return (
                                      <div key={rank} className="space-y-0.5">
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-zinc-500 dark:text-zinc-400">
                                            #{rank} choice
                                          </span>
                                          <span className="text-zinc-600 dark:text-zinc-400">
                                            {count} ({percentage.toFixed(0)}%)
                                          </span>
                                        </div>
                                        <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-1">
                                          <div
                                            className={`${barColor} h-1 rounded-full`}
                                            style={{ width: `${percentage}%` }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        )})}
                      </div>
                    </div>
                  )}
                </div>
              )})}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
