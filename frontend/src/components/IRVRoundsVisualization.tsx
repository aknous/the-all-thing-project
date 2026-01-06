'use client';

interface IRVRound {
  round: number;
  totals: { [optionId: string]: number };
  eliminated: string | null;
  exhausted: number;
}

interface IRVRoundsVisualizationProps {
  rounds: IRVRound[];
  options: Array<{
    optionId: string;
    label: string;
  }>;
  winnerId?: string;
  totalBallots: number;
}

export function IRVRoundsVisualization({ rounds, options, winnerId, totalBallots }: IRVRoundsVisualizationProps) {
  if (!rounds || rounds.length === 0) {
    return (
      <div className="text-sm text-midnight-500 dark:text-midnight-100">
        No round data available
      </div>
    );
  }

  // Build complete list of all options that appeared in any round
  const allOptionIds = new Set<string>();
  rounds.forEach(round => {
    Object.keys(round.totals).forEach(optionId => allOptionIds.add(optionId));
  });

  // Create complete options list (use provided labels, or fallback to optionId)
  const completeOptions = Array.from(allOptionIds).map(optionId => {
    const existingOption = options.find(o => o.optionId === optionId);
    return existingOption || { optionId, label: optionId };
  });

  // Colors for each round
  const roundColors = [
    'bg-blue-500 dark:bg-blue-400',
    'bg-purple-500 dark:bg-purple-400',
    'bg-amber-500 dark:bg-amber-400',
    'bg-red-500 dark:bg-red-400',
    'bg-green-500 dark:bg-green-400',
  ];

  // Sort options by their first round votes (or final round for those who lasted)
  const sortedOptions = [...completeOptions].sort((a, b) => {
    const aFirstVotes = rounds[0].totals[a.optionId] || 0;
    const bFirstVotes = rounds[0].totals[b.optionId] || 0;
    return bFirstVotes - aFirstVotes;
  });

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {rounds.map((round, index) => (
          <div key={round.round} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${roundColors[index % roundColors.length]}`} />
            <span className="text-midnight-600 dark:text-midnight-100">
              Round {round.round}
            </span>
          </div>
        ))}
      </div>

      {/* Stacked bar visualization */}
      <div className="space-y-3">
        {sortedOptions.map((option) => {
          const isWinner = winnerId === option.optionId;
          
          // Get votes for this option in each round (absolute totals)
          const roundTotals = rounds.map(round => round.totals[option.optionId] || 0);
          
          // Calculate incremental votes gained in each round
          const incrementalVotes = roundTotals.map((total, index) => {
            if (index === 0) return total; // First round is the baseline
            return total - roundTotals[index - 1]; // Votes gained from previous round
          });
          
          const finalVotes = roundTotals[roundTotals.length - 1];
          const finalPercentage = totalBallots > 0 ? ((finalVotes / totalBallots) * 100).toFixed(1) : '0.0';
          
          // Check if this option was eliminated (find which round)
          const eliminatedRound = rounds.findIndex(round => round.eliminated === option.optionId);
          const wasEliminated = eliminatedRound !== -1;
          
          return (
            <div key={option.optionId} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className={`font-medium ${
                  isWinner 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-midnight-950 dark:text-midnight-100'
                }`}>
                  {isWinner && '🏆 '}{option.label}
                </span>
                <span className="text-midnight-600 dark:text-midnight-100 text-xs">
                  {wasEliminated 
                    ? `Eliminated in Round ${eliminatedRound + 1}`
                    : `${finalVotes} votes (${finalPercentage}%)`
                  }
                </span>
              </div>
              
              {/* Container for the bar */}
              <div className="w-full bg-midnight-200 dark:bg-midnight-700 rounded-full h-3 relative overflow-hidden">
                {/* Single stacked bar showing incremental votes per round */}
                {incrementalVotes.map((votes, roundIndex) => {
                  if (votes === 0) return null;
                  
                  // Calculate segment width as percentage of total ballots
                  const segmentPercentage = totalBallots > 0 ? (votes / totalBallots) * 100 : 0;
                  
                  // Calculate left position (sum of all previous incremental votes)
                  const leftPosition = incrementalVotes
                    .slice(0, roundIndex)
                    .reduce((sum, v) => sum + (totalBallots > 0 ? (v / totalBallots) * 100 : 0), 0);
                  
                  return (
                    <div
                      key={roundIndex}
                      className={`${roundColors[roundIndex % roundColors.length]} absolute top-0 h-3 group`}
                      style={{ 
                        left: `${leftPosition}%`,
                        width: `${segmentPercentage}%`
                      }}
                    >
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-midnight-950 dark:bg-midnight-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                        Round {roundIndex + 1}: {votes > 0 && roundIndex > 0 ? '+' : ''}{votes} votes
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Exhausted ballots summary */}
      {rounds.some(r => r.exhausted > 0) && (
        <div className="pt-3 border-t border-midnight-200 dark:border-midnight-700 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-midnight-500 dark:text-midnight-100">
              Inactive Ballots
            </span>
            <span className="text-midnight-600 dark:text-midnight-100">
              {rounds[rounds.length - 1].exhausted}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
