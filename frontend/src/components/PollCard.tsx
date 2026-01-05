'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Poll, PollCategory } from '@/lib/types';
import { submitVote } from '@/lib/api';
import { Turnstile } from '@marsidev/react-turnstile';

interface PollCardProps {
  poll: Poll;
  category: PollCategory;
  allCategories: PollCategory[];
  hideHistoryLink?: boolean;
}

interface SavedVote {
  pollId: string;
  rankedChoices: string[];
  timestamp: number;
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

export default function PollCard({ poll, category, allCategories, hideHistoryLink = false }: PollCardProps) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [previousVote, setPreviousVote] = useState<string[] | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // Calculate time remaining
  useEffect(() => {
    const updateTimeRemaining = () => {
      // Polls close at 3am Eastern the morning AFTER closeDate
      // E.g., closeDate "2026-01-01" means closes at 3am Eastern on 2026-01-02
      
      // Parse closeDate and add 1 day
      const [year, month, day] = poll.closeDate.split('-').map(Number);
      const nextDay = new Date(year, month - 1, day + 1);
      
      // Determine if we're in EST or EDT at that date
      // Check DST for the target date in Eastern timezone
      const jan = new Date(nextDay.getFullYear(), 0, 1);
      const jul = new Date(nextDay.getFullYear(), 6, 1);
      const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
      const targetOffset = nextDay.getTimezoneOffset();
      const isDST = targetOffset < stdOffset;
      
      // 3am Eastern = 8am UTC (EST) or 7am UTC (EDT)
      const utcHour = isDST ? 7 : 8;
      const closeTime = new Date(Date.UTC(year, month - 1, day + 1, utcHour, 0, 0));
      
      const now = new Date();
      const diffMs = closeTime.getTime() - now.getTime();
      
      if (diffMs <= 0) {
        setTimeRemaining('Closed');
        return;
      }
      
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffHours < 24) {
        setTimeRemaining(`${diffHours}h remaining`);
      } else {
        setTimeRemaining(`${diffDays}d remaining`);
      }
    };
    
    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [poll.closeDate]);

  // Check localStorage for previous vote on mount
  useEffect(() => {
    const savedVotesStr = localStorage.getItem('poll_votes');
    if (savedVotesStr) {
      try {
        const savedVotes: SavedVote[] = JSON.parse(savedVotesStr);
        const vote = savedVotes.find(v => v.pollId === poll.pollId);
        if (vote) {
          setPreviousVote(vote.rankedChoices);
          setSuccess(true);
        }
      } catch (e) {
        console.error('Failed to parse saved votes:', e);
      }
    }
  }, [poll.pollId]);

  const handleSingleChoice = (optionId: string) => {
    setSelectedOptions([optionId]);
  };

  const handleRankedChoice = (optionId: string) => {
    if (selectedOptions.includes(optionId)) {
      setSelectedOptions(selectedOptions.filter(id => id !== optionId));
    } else {
      const maxRank = poll.maxRank || poll.options.length;
      if (selectedOptions.length < maxRank) {
        setSelectedOptions([...selectedOptions, optionId]);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedOptions.length === 0) {
      setError('Please select at least one option');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await submitVote(poll.pollId, {
        rankedChoices: selectedOptions,
        turnstileToken: turnstileToken || undefined,
      });
      
      // Save vote to localStorage
      const savedVotesStr = localStorage.getItem('poll_votes');
      const savedVotes: SavedVote[] = savedVotesStr ? JSON.parse(savedVotesStr) : [];
      
      // Remove old vote for this poll if exists
      const filteredVotes = savedVotes.filter(v => v.pollId !== poll.pollId);
      
      // Add new vote
      filteredVotes.push({
        pollId: poll.pollId,
        rankedChoices: selectedOptions,
        timestamp: Date.now(),
      });
      
      localStorage.setItem('poll_votes', JSON.stringify(filteredVotes));
      setPreviousVote(selectedOptions);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit vote');
    } finally {
      setSubmitting(false);
    }
  };

  if (success && previousVote) {
    const votedOptions = previousVote.map(optionId => 
      poll.options.find(o => o.optionId === optionId)
    ).filter(Boolean);

    // Build poll detail URL
    const parentCategory = findParentCategory(allCategories, category.categoryId);
    const pollUrl = `/polls/${category.categoryKey}/${poll.templateKey}`;

    return (
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <Link
                  href={pollUrl}
                  className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-indigo-600 hover:to-pink-600 dark:hover:from-indigo-400 dark:hover:to-pink-400 transition-all duration-200"
                >
                  {poll.title}
                </Link>
                {poll.pollType === 'RANKED' && (
                  <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                    RANKED CHOICE
                  </span>
                )}
              </div>
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                {timeRemaining}
              </span>
            </div>
          </div>

          {poll.question && (
            <p className="text-zinc-600 dark:text-zinc-400 mb-4 mt-4">
              {poll.question}
            </p>
          )}

          <div className="bg-emerald-100 dark:bg-emerald-900/20 border border-emerald-500 rounded-lg p-6 mb-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <h4 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
                  Your Vote
                </h4>
                {poll.pollType === 'RANKED' ? (
                  <ol className="list-decimal list-inside space-y-1">
                    {votedOptions.map((option) => option && (
                      <li key={option.optionId} className="text-emerald-800 dark:text-emerald-200">
                        {option.label}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-emerald-800 dark:text-emerald-200">
                    {votedOptions[0]?.label}
                  </p>
                )}
              </div>
            </div>
          </div>

          {!hideHistoryLink && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                You&apos;ve already voted on this poll
              </p>
              <Link
                href={pollUrl}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                View History →
              </Link>
            </div>
          )}
          {hideHistoryLink && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              You&apos;ve already voted on this poll
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-800/50 rounded-lg shadow-md border-l-4 border-blue-500 dark:border-blue-600 overflow-hidden ring-1 ring-zinc-200 dark:ring-zinc-800">
      <div className="p-4 sm:p-6">
        <div className="mb-4">
          <div className="mb-2">
            <Link
              href={`/polls/${category.categoryKey}/${poll.templateKey}`}
              className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-100 hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-blue-600 hover:via-indigo-600 hover:to-rose-600 dark:hover:from-blue-400 dark:hover:via-indigo-400 dark:hover:to-rose-400 transition-all duration-200"
            >
              {poll.title}
            </Link>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {timeRemaining}
            </span>
            {poll.pollType === 'RANKED' && (
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                Ranked Choice
              </span>
            )}
          </div>
        </div>

        {poll.question && (
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mb-6">
            {poll.question}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-2.5 sm:space-y-3 mb-6">
            {poll.pollType === 'SINGLE' ? (
              // Single choice (radio buttons)
              poll.options.map((option) => (
                <label
                  key={option.optionId}
                  className="flex items-center p-3.5 sm:p-3 rounded-lg border-2 border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 cursor-pointer transition-all"
                >
                  <input
                    type="radio"
                    name={`poll-${poll.pollId}`}
                    value={option.optionId}
                    checked={selectedOptions[0] === option.optionId}
                    onChange={() => handleSingleChoice(option.optionId)}
                    className="w-4 h-4 text-sky-600 mr-3 shrink-0"
                  />
                    <span className="text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                      {option.label}
                    </span>
                  </label>
                ))
              ) : (
                // Ranked choice (checkboxes with order)
                <>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                    Select up to {poll.maxRank || poll.options.length} options in order of preference
                  </p>
                  {poll.options.map((option) => {
                    const rank = selectedOptions.indexOf(option.optionId);
                    const isSelected = rank !== -1;
                    
                    return (
                      <label
                        key={option.optionId}
                        className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleRankedChoice(option.optionId)}
                          className="w-4 h-4 text-blue-600 mr-3"
                        />
                        {isSelected && (
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm font-bold mr-2">
                            {rank + 1}
                          </span>
                        )}
                        <span className="text-zinc-900 dark:text-zinc-100">
                          {option.label}
                        </span>
                      </label>
                    );
                  })}
                </>
              )}
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
              <Turnstile
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                onSuccess={(token) => setTurnstileToken(token)}
                onError={() => setTurnstileToken(null)}
                onExpire={() => setTurnstileToken(null)}
                options={{
                  theme: 'auto',
                  size: 'invisible',
                }}
              />
            )}

            <button
              type="submit"
              disabled={submitting || selectedOptions.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Vote'}
            </button>
          </form>
        </div>
      </div>
    );
}
