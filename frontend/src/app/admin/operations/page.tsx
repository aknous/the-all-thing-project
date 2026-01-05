'use client';

import { useState, useEffect } from 'react';
import { adminFetch } from '@/lib/adminAuth';
import { getEasternToday } from '@/lib/dateUtils';
import { IRVRoundsVisualization } from '@/components/IRVRoundsVisualization';

interface PollInstance {
  id: string;
  title: string;
  question: string;
  pollDate: string;
  status: string;
  categoryId: string | null;
}

interface SnapshotData {
  id: string;
  instanceId: string;
  totalVotes: number | null;
  totalBallots: number | null;
  winnerOptionId: string | null;
  resultsJson: {
    found: boolean;
    instanceId: string;
    title: string;
    pollType: string;
    options: Array<{
      optionId: string;
      label: string;
      sortOrder: number;
    }>;
    totalVotes?: number;
    totalBallots?: number;
    winnerOptionId?: string | null;
    results?: Array<{
      optionId: string;
      label: string;
      count: number;
    }>;
    rankBreakdown?: Record<string, Record<number, number>>;
    rounds?: Array<{
      round: number;
      eliminated: string | null;
      totals: Record<string, number>;
      exhausted: number;
    }>;
  };
  createdAt: string;
}

export default function OperationsPage() {
  const [rolloverDate, setRolloverDate] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  
  // Individual snapshot state
  const [openPolls, setOpenPolls] = useState<PollInstance[]>([]);
  const [selectedPollId, setSelectedPollId] = useState('');
  const [snapshotData, setSnapshotData] = useState<SnapshotData | null>(null);
  const [loadingPolls, setLoadingPolls] = useState(false);

  useEffect(() => {
    loadOpenPolls();
  }, []);

  const loadOpenPolls = async () => {
    setLoadingPolls(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const today = getEasternToday();
      const res = await adminFetch(`${API_URL}/admin/instances?pollDate=${today}`);
      const data = await res.json();
      
      // Filter for OPEN status
      const open = data.instances?.filter((inst: PollInstance) => inst.status === 'OPEN') || [];
      setOpenPolls(open);
    } catch (error) {
      console.error('Failed to load open polls:', error);
    } finally {
      setLoadingPolls(false);
    }
  };

  const handleRollover = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!rolloverDate) {
      alert('Please select a date');
      return;
    }

    if (!confirm(`Run rollover for ${rolloverDate}? This will create poll instances for all active templates.`)) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const res = await adminFetch(`${API_URL}/admin/rollover?pollDate=${rolloverDate}`, {
        method: 'POST',
      });
      
      const data = await res.json();
      setResult(`✓ Rollover completed for ${data.pollDate}. Created ${data.createdCount} poll instance(s).`);
    } catch (error) {
      console.error('Rollover failed:', error);
      setResult('✗ Rollover failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!closeDate) {
      alert('Please select a date');
      return;
    }

    if (!confirm(`Close all polls for ${closeDate}? This will create snapshots and cannot be undone.`)) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const res = await adminFetch(`${API_URL}/admin/close?pollDate=${closeDate}`, {
        method: 'POST',
      });
      
      const data = await res.json();
      setResult(`✓ Closed ${data.closedCount} poll(s) and created ${data.snapshotCount} snapshot(s) for ${data.pollDate}.`);
    } catch (error) {
      console.error('Close failed:', error);
      setResult('✗ Close failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMissingSnapshots = async () => {
    if (!confirm('Create snapshots for all closed polls that are missing them?')) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const res = await adminFetch(`${API_URL}/admin/snapshots/create-missing`, {
        method: 'POST',
      });
      
      const data = await res.json();
      if (data.createdCount === 0) {
        setResult(`✓ ${data.message || 'All closed polls already have snapshots'}`);
      } else {
        setResult(`✓ Created ${data.createdCount} snapshot(s) out of ${data.totalMissing} missing.`);
      }
    } catch (error) {
      console.error('Create missing snapshots failed:', error);
      setResult('✗ Create missing snapshots failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateSnapshots = async () => {
    if (!confirm('Regenerate ALL snapshots? This will update the data structure for all closed polls.')) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const res = await adminFetch(`${API_URL}/admin/snapshots/regenerate`, {
        method: 'POST',
      });
      
      const data = await res.json();
      setResult(`✓ Regenerated ${data.regeneratedCount} snapshot(s) out of ${data.totalClosed} closed poll(s).`);
    } catch (error) {
      console.error('Regenerate snapshots failed:', error);
      setResult('✗ Regenerate snapshots failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateActiveSnapshots = async () => {
    if (!confirm('Create snapshots for all active polls? This captures current results without closing the polls.')) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const res = await adminFetch(`${API_URL}/admin/snapshots/create-for-active`, {
        method: 'POST',
      });
      
      const data = await res.json();
      if (data.createdCount === 0) {
        setResult(`✓ ${data.message || 'No active polls found'}`);
      } else {
        setResult(`✓ Created/updated ${data.createdCount} snapshot(s) for ${data.totalActive} active poll(s).`);
      }
    } catch (error) {
      console.error('Create active snapshots failed:', error);
      setResult('✗ Create active snapshots failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSnapshotSinglePoll = async () => {
    if (!selectedPollId) {
      alert('Please select a poll');
      return;
    }

    setLoading(true);
    setResult(null);
    setSnapshotData(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      console.log('Creating snapshot for poll:', selectedPollId);
      
      const res = await adminFetch(`${API_URL}/admin/instances/${selectedPollId}/snapshot`, {
        method: 'POST',
      });
      
      console.log('Response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
      
      const data = await res.json();
      console.log('Snapshot data:', data);
      setSnapshotData(data.snapshot);
      setResult(`✓ Snapshot created successfully`);
    } catch (error) {
      console.error('Create snapshot failed:', error);
      setResult('✗ Create snapshot failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const getTodayDate = () => {
    return getEasternToday();
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">
        Operations
      </h1>

      {result && (
        <div className={`mb-6 p-4 rounded-lg border ${
          result.startsWith('✓')
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
        }`}>
          {result}
        </div>
      )}

      <div className="space-y-6">
        {/* Snapshot Individual Poll */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            Snapshot Individual Poll
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Create a snapshot for a specific open poll to view current results.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Select Poll
              </label>
              <select
                value={selectedPollId}
                onChange={(e) => setSelectedPollId(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg
                         bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                disabled={loadingPolls}
              >
                <option value="">
                  {loadingPolls ? 'Loading polls...' : openPolls.length === 0 ? 'No open polls found' : 'Select a poll'}
                </option>
                {openPolls.map((poll) => (
                  <option key={poll.id} value={poll.id}>
                    {poll.title}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSnapshotSinglePoll}
              disabled={loading || !selectedPollId}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Creating Snapshot...' : 'Create Snapshot'}
            </button>
          </div>

          {/* Display snapshot data */}
          {snapshotData && (
            <div className="mt-6 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                Snapshot Results
              </h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">Poll:</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {snapshotData.resultsJson.title}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">Type:</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {snapshotData.resultsJson.pollType}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">Total Votes:</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {snapshotData.totalVotes || 0}
                  </span>
                </div>
                
                {snapshotData.totalBallots !== null && (
                  <div className="flex justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">Total Ballots:</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {snapshotData.totalBallots}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">Snapshot Created:</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {new Date(snapshotData.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Options breakdown */}
              <div className="mt-4">
                <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                  Results by Option
                </h4>
                <div className="space-y-2">
                  {snapshotData.resultsJson.pollType === 'SINGLE' && snapshotData.resultsJson.results?.map((result) => {
                    const percentage = (snapshotData.resultsJson.totalVotes ?? 0) > 0 
                      ? (result.count / (snapshotData.resultsJson.totalVotes ?? 1) * 100) 
                      : 0;
                    const isWinner = result.optionId === snapshotData.winnerOptionId;
                    
                    return (
                      <div key={result.optionId} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-900 dark:text-zinc-100 font-medium">
                            {result.label}
                            {isWinner && ' 🏆'}
                          </span>
                          <span className="text-zinc-600 dark:text-zinc-400">
                            {result.count} votes ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              isWinner
                                ? 'bg-green-500 dark:bg-green-400'
                                : 'bg-blue-500 dark:bg-blue-400'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ranked choice rounds visualization */}
              {snapshotData.resultsJson.pollType === 'RANKED' && snapshotData.resultsJson.rounds && snapshotData.resultsJson.rounds.length > 0 && (
                <div className="mt-4">
                  <IRVRoundsVisualization
                    rounds={snapshotData.resultsJson.rounds}
                    options={snapshotData.resultsJson.options}
                    winnerId={snapshotData.winnerOptionId || undefined}
                    totalBallots={snapshotData.resultsJson.totalBallots || snapshotData.resultsJson.totalVotes || 0}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rollover */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            Run Rollover
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Create poll instances for all active templates for a specific date. This is normally done automatically each day.
          </p>
          
          <form onSubmit={handleRollover} className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Poll Date
                </label>
                <input
                  type="date"
                  value={rolloverDate}
                  onChange={(e) => setRolloverDate(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg
                           bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  required
                />
              </div>
              
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setRolloverDate(getTodayDate())}
                  className="px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700
                           text-zinc-900 dark:text-zinc-100 rounded-lg transition-colors"
                >
                  Today
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Running...' : 'Run Rollover'}
            </button>
          </form>
        </div>

        {/* Close Polls */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            Close Polls by Date
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Close all open polls for a specific date and create result snapshots. This action cannot be undone.
          </p>
          
          <form onSubmit={handleClose} className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Poll Date
                </label>
                <input
                  type="date"
                  value={closeDate}
                  onChange={(e) => setCloseDate(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg
                           bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  required
                />
              </div>
              
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setCloseDate(getTodayDate())}
                  className="px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700
                           text-zinc-900 dark:text-zinc-100 rounded-lg transition-colors"
                >
                  Today
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Closing...' : 'Close Polls'}
            </button>
          </form>
        </div>

        {/* Snapshot Operations */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            Snapshot Operations
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Manage result snapshots for closed polls.
          </p>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <div>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                  Snapshot Active Polls
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Create/update snapshots for active polls (captures current results)
                </p>
              </div>
              <button
                onClick={handleCreateActiveSnapshots}
                disabled={loading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors"
              >
                {loading ? 'Creating...' : 'Snapshot Active'}
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <div>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                  Create Missing Snapshots
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Find closed polls without snapshots and create them
                </p>
              </div>
              <button
                onClick={handleCreateMissingSnapshots}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
              >
                {loading ? 'Creating...' : 'Create Missing'}
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <div>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                  Regenerate All Snapshots
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Regenerate snapshots for all closed polls (updates data structure)
                </p>
              </div>
              <button
                onClick={handleRegenerateSnapshots}
                disabled={loading}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-medium rounded-lg transition-colors"
              >
                {loading ? 'Regenerating...' : 'Regenerate All'}
              </button>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
            ℹ️ Operation Notes
          </h3>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li><strong>Rollover:</strong> Creates instances only if they don&apos;t already exist (idempotent).</li>
            <li><strong>Close:</strong> Closes polls with closeDate ≤ selected date and creates snapshots.</li>
            <li><strong>Snapshot Active:</strong> Captures current results for active polls without closing them.</li>
            <li><strong>Create Missing:</strong> Only creates snapshots for closed polls that are missing them.</li>
            <li><strong>Regenerate:</strong> Updates all existing snapshots (useful after data structure changes).</li>
            <li><strong>Snapshots:</strong> Result snapshots preserve vote tallies at a point in time.</li>
            <li><strong>Daily Automation:</strong> Rollover runs automatically each morning (Eastern time).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
