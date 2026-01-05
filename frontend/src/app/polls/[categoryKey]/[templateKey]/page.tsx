'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getTodayPolls, getPollHistory } from '@/lib/api';
import { Poll, PollCategory, PollResult } from '@/lib/types';
import { PublicLayout } from '@/components/PublicLayout';
import PollCard from '@/components/PollCard';
import { IRVRoundsVisualization } from '@/components/IRVRoundsVisualization';

// Helper to find category by key
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

// Helper to find all polls across all categories
function getAllPolls(categories: PollCategory[]): Poll[] {
  const polls: Poll[] = [];
  for (const cat of categories) {
    polls.push(...cat.polls);
    if (cat.subCategories) {
      polls.push(...getAllPolls(cat.subCategories));
    }
  }
  return polls;
}

export default function PollDetailPage() {
  const params = useParams();
  const categoryKey = params?.categoryKey as string;
  const templateKey = params?.templateKey as string;
  
  const [categories, setCategories] = useState<PollCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PollResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadedTemplateId, setLoadedTemplateId] = useState<string | null>(null);
  const [expandedPolls, setExpandedPolls] = useState<Set<string>>(new Set());

  useEffect(() => {
    getTodayPolls()
      .then((data) => setCategories(data.categories))
      .catch((err) => {
        console.error('Failed to fetch polls:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  // Find the current poll and category
  const allPolls = getAllPolls(categories);
  const currentPoll = allPolls.find(p => p.templateKey === templateKey);
  const category = findCategoryByKey(categories, categoryKey);

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

  // Load history when poll is found
  useEffect(() => {
    if (currentPoll && currentPoll.templateId !== loadedTemplateId) {
      let cancelled = false;
      
      const loadHistory = async () => {
        try {
          const data = await getPollHistory(currentPoll.templateId);
          if (!cancelled) {
            setHistory(data);
            setLoadedTemplateId(currentPoll.templateId);
          }
        } catch (err) {
          console.error('Failed to load history:', err);
        }
      };
      
      loadHistory();
      return () => { cancelled = true; };
    }
  }, [currentPoll, loadedTemplateId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto"></div>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading poll...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-900">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">Failed to load poll</p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!currentPoll || !category) {
    return (
      <PublicLayout categories={categories}>
        <div className="max-w-3xl mx-auto">
          <p className="text-zinc-600 dark:text-zinc-400">Poll not found</p>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout categories={categories}>
      <div className="max-w-3xl mx-auto">
        <div className="mb-12">
          <PollCard 
            poll={currentPoll} 
            category={category}
            allCategories={categories}
            hideHistoryLink={true}
          />
        </div>

        {/* Historical Results */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-zinc-100">
            Past Results
          </h2>
        
        {!currentPoll && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
          </div>
        )}

            {currentPoll && history.length === 0 && (
              <p className="text-zinc-600 dark:text-zinc-400">No historical results yet.</p>
            )}

            {history.length > 0 && (
              <div className="space-y-6">
                {history.map((result) => {
                  const isExpanded = expandedPolls.has(result.pollId);
                  
                  return (
                    <div 
                      key={result.pollId}
                      className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden"
                    >
                      {/* Header - Always Visible */}
                      <button
                        onClick={() => togglePoll(result.pollId)}
                        className="w-full p-6 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="text-sm text-zinc-600 dark:text-zinc-400">
                              {new Date(result.pollDate).toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </div>
                            <div className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">
                              {result.totalVotes} {result.totalVotes === 1 ? 'vote' : 'votes'}
                            </div>
                          </div>
                          <svg
                            className={`w-5 h-5 text-zinc-500 dark:text-zinc-400 transition-transform shrink-0 ml-4 ${
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

                        {/* Winner Preview - Always Visible */}
                        {result.winner && (
                          <div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                              🏆 Winner
                            </p>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                {result.winner.label}
                              </span>
                              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                {result.winner.voteCount} ({result.winner.percentage.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                              <div
                                className="bg-green-500 dark:bg-green-600 h-2 rounded-full"
                                style={{ width: `${result.winner.percentage}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </button>

                      {/* Expanded Content - Full Breakdown */}
                      {isExpanded && (
                        <div className="px-6 pb-6 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                          {result.pollType === 'RANKED' && result.rounds && result.rounds.length > 0 ? (
                            <>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 font-medium">
                                Round-by-Round Results
                              </p>
                              <IRVRoundsVisualization
                                rounds={result.rounds}
                                options={result.options}
                                winnerId={result.winner?.optionId}
                                totalBallots={result.totalBallots || result.totalVotes}
                              />
                            </>
                          ) : (
                            <>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 font-medium">
                                Full Vote Breakdown
                              </p>
                              <div className="space-y-4">
                                {result.options.map((option, index) => {
                                  const percentage = result.totalVotes > 0 
                                    ? ((option.voteCount / result.totalVotes) * 100).toFixed(1)
                                    : '0.0';
                                  const isWinner = option.isWinner || index === 0;

                                  return (
                                    <div key={option.optionId} className="relative">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className={`text-sm font-medium ${
                                          isWinner 
                                            ? 'text-green-600 dark:text-green-400' 
                                            : 'text-zinc-700 dark:text-zinc-300'
                                        }`}>
                                          {isWinner && '🏆 '}{option.label}
                                        </span>
                                        <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                          {option.voteCount} ({percentage}%)
                                        </span>
                                      </div>
                                      <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                                        <div
                                          className={`h-2 rounded-full transition-all ${
                                            isWinner 
                                              ? 'bg-green-500 dark:bg-green-600' 
                                              : 'bg-blue-500 dark:bg-blue-600'
                                          }`}
                                          style={{ width: `${percentage}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </PublicLayout>
  );
}
