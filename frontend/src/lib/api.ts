import { PollsData, VoteSubmission, PollResult } from '../lib/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function getTodayPolls(): Promise<PollsData> {
  const res = await fetch(`${API_URL}/polls/today`, {
    credentials: 'include', // Important: sends/receives cookies
  });
  
  if (!res.ok) throw new Error('Failed to fetch polls');
  
  const json = await res.json();
  return json.data;
}

export async function submitVote(pollId: string, vote: VoteSubmission): Promise<void> {
  console.log('Submitting vote:', vote);
  const res = await fetch(`${API_URL}/polls/${pollId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(vote),
  });
  
  if (res.status === 409) {
    throw new Error('You have already voted on this poll');
  }
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to submit vote');
  }
}

export async function getPollHistory(templateId: string): Promise<PollResult[]> {
  const res = await fetch(`${API_URL}/polls/templates/${templateId}/history`, {
    credentials: 'include',
  });
  
  if (!res.ok) throw new Error('Failed to fetch poll history');
  
  const json = await res.json();
  return json.data || [];
}