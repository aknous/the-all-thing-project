'use client';

import { useState, useEffect } from 'react';
import { Poll } from '@/app/lib/types';
import { submitVote } from '@/app/lib/api';
import PollHistorySidebar from './PollHistorySidebar';

interface PollCardProps {
  poll: Poll;
}

interface SavedVote {
  pollId: string;
  rankedChoices: string[];
  timestamp: number;
}

export default function PollCard({ poll }: PollCardProps) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [previousVote, setPreviousVote] = useState<string[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);

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

    return (
      <>
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6 border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 flex-1">
              {poll.title}
            </h3>
            <button
              onClick={() => setShowHistory(true)}
              className="ml-3 p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              title="View poll history"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          </div>
          
          {poll.question && (
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              {poll.question}
            </p>
          )}

          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 mb-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5"
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
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                  Your Vote
                </h4>
                {poll.pollType === 'RANKED' ? (
                  <ol className="list-decimal list-inside space-y-1">
                    {votedOptions.map((option) => option && (
                      <li key={option.optionId} className="text-green-800 dark:text-green-200">
                        {option.label}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-green-800 dark:text-green-200">
                    {votedOptions[0]?.label}
                  </p>
                )}
              </div>
            </div>
          </div>

          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
            Youve already voted on this poll
          </p>
        </div>

        {showHistory && (
          <PollHistorySidebar
            templateId={poll.templateId}
            pollTitle={poll.title}
            onClose={() => setShowHistory(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 flex-1">
            {poll.title}
          </h3>
          <button
            onClick={() => setShowHistory(true)}
            className="ml-3 p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            title="View poll history"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        </div>
        
        {poll.question && (
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            {poll.question}
          </p>
        )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-3 mb-4">
          {poll.pollType === 'SINGLE' ? (
            // Single choice (radio buttons)
            poll.options.map((option) => (
              <label
                key={option.optionId}
                className="flex items-center p-3 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                <input
                  type="radio"
                  name={`poll-${poll.pollId}`}
                  value={option.optionId}
                  checked={selectedOptions[0] === option.optionId}
                  onChange={() => handleSingleChoice(option.optionId)}
                  className="w-4 h-4 text-blue-600 mr-3"
                />
                <span className="text-zinc-900 dark:text-zinc-100">
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

        <button
          type="submit"
          disabled={submitting || selectedOptions.length === 0}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting...' : 'Submit Vote'}
        </button>
      </form>
      </div>

      {showHistory && (
        <PollHistorySidebar
          templateId={poll.templateId}
          pollTitle={poll.title}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
}
