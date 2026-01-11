/* eslint-disable react/no-unescaped-entities */
'use client';

import { useEffect, useState } from 'react';
import { getTodayPolls } from '@/lib/api';
import { PollCategory } from '@/lib/types';
import { PublicLayout } from '@/components/PublicLayout';
import { getCachedCategories, setCachedCategories } from '@/lib/categoryCache';

export const dynamic = 'force-dynamic';

export default function PrivacyPage() {
  const [categories, setCategories] = useState<PollCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    setMounted(true);
    
    // Check cache first
    const cached = getCachedCategories();
    if (cached) {
      setCategories(cached);
      setLoading(false);
      return;
    }

    // Fetch if no cache
    getTodayPolls()
      .then((data) => {
        setCategories(data.categories);
        setCachedCategories(data.categories);
      })
      .catch((err) => {
        console.error('Failed to fetch polls:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  // Don't render anything on server side
  if (!mounted) {
    return null;
  }

  if (loading) {
    return (
      <PublicLayout categories={categories}>
        <div className="flex justify-center items-center min-h-96">
          <div className="text-midnight-500 dark:text-midnight-400">Loading...</div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout categories={categories}>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-midnight-950 dark:text-white mb-8">Privacy Policy</h1>
        
        <div className="space-y-6 text-midnight-700 dark:text-midnight-300">
          <section>
            <h2 className="text-2xl font-semibold text-midnight-950 dark:text-white mb-3">Overview</h2>
            <p>
              The All Thing Project is committed to protecting your privacy. This policy explains what data we collect, 
              how we use it, and your rights regarding your information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-midnight-950 dark:text-white mb-3">Data We Collect</h2>
            
            <h3 className="text-xl font-medium text-midnight-900 dark:text-midnight-100 mb-2 mt-4">Voting Cookie</h3>
            <p>
              We use one essential cookie called <code className="px-1.5 py-0.5 bg-midnight-100 dark:bg-midnight-800 rounded text-sm">vt</code> (voter token) 
              to prevent duplicate voting. This cookie:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Contains a randomly generated identifier</li>
              <li>Is cryptographically signed to prevent tampering</li>
              <li>Does not contain any personal information</li>
              <li>Is stored as a hash on our servers to check for duplicate votes</li>
              <li>Is strictly necessary for our polling system to function</li>
            </ul>

            <h3 className="text-xl font-medium text-midnight-900 dark:text-midnight-100 mb-2 mt-4">Browser Storage (localStorage)</h3>
            <p>We store the following data locally in your browser:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Vote history:</strong> A record of which polls you've voted on (stored as poll IDs)</li>
              <li><strong>Demographic data (optional):</strong> If you choose to complete our demographic survey, 
                  this information is stored only in your browser</li>
            </ul>
            <p className="mt-2 text-sm italic">
              Important: This data never leaves your browser unless you submit a vote. When you vote, 
              only your demographic data (if provided) is sent with your ballot.
            </p>

            <h3 className="text-xl font-medium text-midnight-900 dark:text-midnight-100 mb-2 mt-4">Vote Data</h3>
            <p>When you submit a vote, we collect:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Your poll selections</li>
              <li>A hashed version of your voter token (for duplicate detection)</li>
              <li>Optional demographic information (if you completed the survey)</li>
              <li>Your IP address (temporarily, for rate limiting and abuse prevention)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-midnight-950 dark:text-white mb-3">How We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Voter token:</strong> To ensure each person can only vote once per poll</li>
              <li><strong>Vote selections:</strong> To tally poll results using ranked-choice voting (IRV)</li>
              <li><strong>Demographic data:</strong> To provide aggregate demographic breakdowns of poll results 
                  (e.g., "65% of voters aged 25-34 selected option A")</li>
              <li><strong>IP address:</strong> To prevent abuse and rate limit vote submissions (not stored long-term)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-midnight-950 dark:text-white mb-3">Privacy Protections</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>We cannot link your votes to your identity</li>
              <li>We do not use tracking cookies or analytics that identify individual users</li>
              <li>We do not sell or share your data with third parties</li>
              <li>Demographic data is attached to individual vote ballots but cannot be traced back to you</li>
              <li>Vote results are published as aggregates only</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-midnight-950 dark:text-white mb-3">Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Clear your browser's localStorage at any time (removes vote history and demographic data)</li>
              <li>Skip the demographic survey entirely</li>
              <li>Update or clear your demographic data using the Survey button in the header</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-midnight-950 dark:text-white mb-3">Data Retention</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Vote ballots:</strong> Stored indefinitely for historical poll results</li>
              <li><strong>Voter token hashes:</strong> Stored as long as the poll is active and for historical records</li>
              <li><strong>IP addresses:</strong> Stored temporarily for rate limiting (typically less than 24 hours)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-midnight-950 dark:text-white mb-3">Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. Any changes will be posted on this page.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-midnight-950 dark:text-white mb-3">Contact</h2>
            <p>
              If you have questions about this privacy policy or our data practices, please contact us through our 
              GitHub repository or the contact information provided on our main site.
            </p>
          </section>

          <div className="text-sm text-midnight-500 dark:text-midnight-400 mt-8 pt-6 border-t border-midnight-200 dark:border-midnight-800">
            Last updated: January 10, 2026
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
