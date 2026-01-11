'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Poll, PollCategory } from '@/lib/types';
import { submitVote } from '@/lib/api';
import { Turnstile } from '@marsidev/react-turnstile';
import DemographicSurveyModal, { DemographicData } from './DemographicSurveyModal';
import { 
  hasDemographicSurvey, 
  getDemographicData, 
  saveDemographicData, 
  markSurveySkipped 
} from '@/lib/demographicSurvey';
import { useDemographicSurveyUpdate } from '@/contexts/DemographicSurveyContext';

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
  const onDemographicSurveyUpdate = useDemographicSurveyUpdate();
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [previousVote, setPreviousVote] = useState<string[] | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  const [pendingVoteData, setPendingVoteData] = useState<{ selections: string[], token: string | null } | null>(null);

  // Restore survey state from sessionStorage on mount (in case of refresh during survey)
  useEffect(() => {
    const savedSurveyState = sessionStorage.getItem(`survey_state_${poll.pollId}`);
    if (savedSurveyState) {
      try {
        const { showSurvey: savedShowSurvey, pendingVoteData: savedPendingData } = JSON.parse(savedSurveyState);
        setShowSurvey(savedShowSurvey);
        setPendingVoteData(savedPendingData);
        // Restore selected options to show in the form
        if (savedPendingData?.selections) {
          setSelectedOptions(savedPendingData.selections);
        }
      } catch (e) {
        sessionStorage.removeItem(`survey_state_${poll.pollId}`);
      }
    }
  }, [poll.pollId]);

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

    // Check if user needs to complete demographic survey
    if (!hasDemographicSurvey()) {
      // Show survey modal first
      const voteData = { selections: selectedOptions, token: turnstileToken };
      setPendingVoteData(voteData);
      setShowSurvey(true);
      
      // Save to sessionStorage in case of refresh
      sessionStorage.setItem(`survey_state_${poll.pollId}`, JSON.stringify({
        showSurvey: true,
        pendingVoteData: voteData
      }));
      return;
    }

    // Proceed with vote submission
    await submitVoteWithDemographics(selectedOptions, turnstileToken);
  };

  const submitVoteWithDemographics = async (selections: string[], token: string | null) => {
    setSubmitting(true);
    setError(null);

    try {
      const demographicData = getDemographicData();
      
      await submitVote(poll.pollId, {
        rankedChoices: selections,
        turnstileToken: token || undefined,
        ...demographicData, // Spread demographic fields
      });
      
      // Save vote to localStorage
      const savedVotesStr = localStorage.getItem('poll_votes');
      const savedVotes: SavedVote[] = savedVotesStr ? JSON.parse(savedVotesStr) : [];
      
      // Remove old vote for this poll if exists
      const filteredVotes = savedVotes.filter(v => v.pollId !== poll.pollId);
      
      // Add new vote
      filteredVotes.push({
        pollId: poll.pollId,
        rankedChoices: selections,
        timestamp: Date.now(),
      });
      
      localStorage.setItem('poll_votes', JSON.stringify(filteredVotes));
      setPreviousVote(selections);
      setSuccess(true);
      
      // Dispatch event for detail page to listen to
      window.dispatchEvent(new CustomEvent('pollVoted', { 
        detail: { pollId: poll.pollId } 
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit vote');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSurveyComplete = (data: DemographicData) => {
    saveDemographicData(data);
    setShowSurvey(false);
    
    // Notify parent that survey was updated
    onDemographicSurveyUpdate?.();
    
    // Clear sessionStorage
    sessionStorage.removeItem(`survey_state_${poll.pollId}`);
    
    // Submit the pending vote with demographic data
    if (pendingVoteData) {
      submitVoteWithDemographics(pendingVoteData.selections, pendingVoteData.token);
      setPendingVoteData(null);
    }
  };

  const handleSurveySkip = () => {
    markSurveySkipped();
    setShowSurvey(false);
    
    // Clear sessionStorage
    sessionStorage.removeItem(`survey_state_${poll.pollId}`);
    
    // Submit the pending vote without demographic data
    if (pendingVoteData) {
      submitVoteWithDemographics(pendingVoteData.selections, pendingVoteData.token);
      setPendingVoteData(null);
    }
  };

  if (success && previousVote) {
    const votedOptions = previousVote.map(optionId => 
      poll.options.find(o => o.optionId === optionId)
    ).filter(Boolean);

    // Build poll detail URL
    const parentCategory = findParentCategory(allCategories, category.categoryId);
    const pollUrl = `/polls/${category.categoryKey}/${poll.templateKey}`;

    // On detail page (hideHistoryLink=true), show minimal voted state
    // Results will be displayed in CurrentResults component below
    if (hideHistoryLink) {
      return (
        <div className="bg-white dark:bg-midnight-950 rounded-lg shadow-lg border border-midnight-200 dark:border-midnight-800 overflow-hidden">
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-semibold text-midnight-950 dark:text-midnight-100 mb-1">
                  {poll.title}
                </h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-midnight-500 dark:text-midnight-100">
                  {timeRemaining}
                </span>
                {poll.pollType === 'RANKED' && (
                  <span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                    RANKED CHOICE
                  </span>
                )}
              </div>
            </div>

            {poll.question && (
              <p className="text-sm sm:text-base text-midnight-600 dark:text-midnight-100 mb-4">
                {poll.question}
              </p>
            )}

            {/* Context Section */}
            {poll.contextText && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setShowContext(!showContext)}
                  className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${showContext ? 'rotate-180' : ''}`}
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
                  {showContext ? 'Hide' : 'Show'} Context
                </button>
                {showContext && (
                  <div className="mt-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-700">
                    <div className="prose prose-sm dark:prose-invert max-w-none text-midnight-500 dark:text-midnight-100 prose-headings:text-gray-900 dark:prose-headings:text-white prose-p:text-gray-800 dark:prose-p:text-gray-100 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-strong:text-gray-900 dark:prose-strong:text-white prose-ul:text-gray-800 dark:prose-ul:text-gray-100 prose-ol:text-gray-800 dark:prose-ol:text-gray-100 [&>*+*]:mt-3">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {poll.contextText}
                      </ReactMarkdown>
                    </div>
                    <p className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700 text-xs text-gray-600 dark:text-gray-400 italic">
                      AI-generated content, reviewed by a human
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
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
                  <h4 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-2 text-sm">
                    Your Vote
                  </h4>
                  {poll.pollType === 'RANKED' ? (
                    <ol className="list-decimal list-inside space-y-1">
                      {votedOptions.map((option) => option && (
                        <li key={option.optionId} className="text-emerald-800 dark:text-emerald-200 text-sm">
                          {option.label}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-emerald-800 dark:text-emerald-200 text-sm">
                      {votedOptions[0]?.label}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // On list page, show full voted state with link to history
    return (
      <div className="bg-white dark:bg-midnight-950 rounded-lg shadow-lg border border-midnight-200 dark:border-midnight-800 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <Link
                  href={pollUrl}
                  className="text-xl font-semibold text-midnight-950 dark:text-midnight-50 hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-indigo-600 hover:to-pink-600 dark:hover:from-indigo-400 dark:hover:to-pink-400 transition-all duration-200"
                >
                  {poll.title}
                </Link>
                {poll.pollType === 'RANKED' && (
                  <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                    RANKED CHOICE
                  </span>
                )}
              </div>
              <span className="text-sm font-medium text-midnight-500 dark:text-midnight-100">
                {timeRemaining}
              </span>
            </div>
          </div>

          {poll.question && (
            <p className="text-midnight-600 dark:text-midnight-100 mb-4 mt-4">
              {poll.question}
            </p>
          )}

          {/* Context Section */}
          {poll.contextText && (
            <div className="mb-4 mt-4">
              <button
                type="button"
                onClick={() => setShowContext(!showContext)}
                className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showContext ? 'rotate-180' : ''}`}
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
                {showContext ? 'Hide' : 'Show'} Context
              </button>
              {showContext && (
                <div className="mt-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-700">
                  <div className="prose prose-sm dark:prose-invert max-w-none ttext-midnight-500 dark:text-midnight-100 prose-headings:text-gray-900 dark:prose-headings:text-white prose-p:text-gray-800 dark:prose-p:text-gray-100 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-strong:text-gray-900 dark:prose-strong:text-white prose-ul:text-gray-800 dark:prose-ul:text-gray-100 prose-ol:text-gray-800 dark:prose-ol:text-gray-100 [&>*+*]:mt-3">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {poll.contextText}
                    </ReactMarkdown>
                  </div>
                  <p className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700 text-xs text-gray-600 dark:text-gray-400 italic">
                    AI-generated content, reviewed by a human
                  </p>
                </div>
              )}
            </div>
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

          <div className="flex items-center justify-between">
            <p className="text-sm text-midnight-500 dark:text-midnight-100">
              You&apos;ve already voted on this poll
            </p>
            <Link
              href={pollUrl}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              View Results →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-br from-white to-midnight-50 dark:from-midnight-950 dark:to-midnight-800/50 rounded-lg shadow-md border-l-4 border-blue-500 dark:border-blue-600 overflow-hidden ring-1 ring-midnight-200 dark:ring-midnight-800">
      <div className="p-4 sm:p-6">
        <div className="mb-4">
          <div className="mb-2">
            <Link
              href={`/polls/${category.categoryKey}/${poll.templateKey}`}
              className="text-lg sm:text-xl font-semibold text-midnight-950 dark:text-midnight-100 hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-blue-600 hover:via-indigo-600 hover:to-rose-600 dark:hover:from-blue-400 dark:hover:via-indigo-400 dark:hover:to-rose-400 transition-all duration-200"
            >
              {poll.title}
            </Link>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-midnight-500 dark:text-midnight-100">
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
          <p className="text-sm sm:text-base text-midnight-600 dark:text-midnight-100 mb-6">
            {poll.question}
          </p>
        )}

        {/* Context Section */}
        {poll.contextText && (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowContext(!showContext)}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showContext ? 'rotate-180' : ''}`}
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
              {showContext ? 'Hide' : 'Show'} Context
            </button>
            {showContext && (
              <div className="mt-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-700">
                <div className="prose prose-sm dark:prose-invert max-w-none text-midnight-500 dark:text-midnight-100 prose-headings:text-gray-900 dark:prose-headings:text-white prose-p:text-gray-800 dark:prose-p:text-gray-100 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-strong:text-gray-900 dark:prose-strong:text-white prose-ul:text-gray-800 dark:prose-ul:text-gray-100 prose-ol:text-gray-800 dark:prose-ol:text-gray-100 [&>*+*]:mt-3">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {poll.contextText}
                  </ReactMarkdown>
                </div>
                <p className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700 text-xs text-gray-600 dark:text-gray-400 italic">
                  AI-generated content, reviewed by a human
                </p>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-2.5 sm:space-y-3 mb-6">
            {poll.pollType === 'SINGLE' ? (
              // Single choice (radio buttons)
              poll.options.map((option) => (
                <label
                  key={option.optionId}
                  className="flex items-center p-3.5 sm:p-3 rounded-lg border-2 border-midnight-300 dark:border-midnight-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 cursor-pointer transition-all"
                >
                  <input
                    type="radio"
                    name={`poll-${poll.pollId}`}
                    value={option.optionId}
                    checked={selectedOptions[0] === option.optionId}
                    onChange={() => handleSingleChoice(option.optionId)}
                    className="w-4 h-4 text-sky-600 mr-3 shrink-0"
                  />
                    <span className="text-sm sm:text-base text-midnight-950 dark:text-midnight-100">
                      {option.label}
                    </span>
                  </label>
                ))
              ) : (
                // Ranked choice (checkboxes with order)
                <>
                  <p className="text-sm text-midnight-600 dark:text-midnight-100 mb-2">
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
                            : 'border-midnight-300 dark:border-midnight-700 hover:bg-midnight-50 dark:hover:bg-midnight-800'
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
                        <span className="text-midnight-950 dark:text-midnight-100">
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
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-midnight-300 dark:disabled:bg-midnight-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Vote'}
            </button>
          </form>
        </div>
      </div>
      
      {/* Demographic Survey Modal */}
      {showSurvey && (
        <DemographicSurveyModal
          onComplete={handleSurveyComplete}
          onSkip={handleSurveySkip}
        />
      )}
    </>
  );
}
