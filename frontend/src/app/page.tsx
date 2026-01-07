/* eslint-disable react/no-unescaped-entities */
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PublicLayout } from '@/components/PublicLayout';
import { getTodayPolls } from '@/lib/api';
import { PollCategory, Poll } from '@/lib/types';
import { getCachedCategories, setCachedCategories } from '@/lib/categoryCache';
import PollCard from '@/components/PollCard';

export default function Home() {
  const [categories, setCategories] = useState<PollCategory[]>(() => getCachedCategories() || []);
  const [loading, setLoading] = useState(() => !getCachedCategories());
  const [visibleSections, setVisibleSections] = useState<string[]>([]);

  // Extract featured polls from all categories
  const featuredPolls = useMemo(() => {
    const featured: Array<{ poll: Poll; category: PollCategory }> = [];
    
    const extractFeatured = (cats: PollCategory[]) => {
      cats.forEach(cat => {
        cat.polls.filter(poll => poll.featured).forEach(poll => {
          featured.push({ poll, category: cat });
        });
        if (cat.subCategories) {
          extractFeatured(cat.subCategories);
        }
      });
    };
    
    extractFeatured(categories);
    return featured;
  }, [categories]);

  // Extract new polls (polls with no historical snapshots - truly new templates)
  const newPolls = useMemo(() => {
    const newPollsList: Array<{ poll: Poll; category: PollCategory }> = [];
    
    const extractNew = (cats: PollCategory[]) => {
      cats.forEach(cat => {
        cat.polls.forEach(poll => {
          // Backend marks polls as new if their template has no prior snapshots
          if (poll.isNew && !poll.featured) {
            newPollsList.push({ poll, category: cat });
          }
        });
        if (cat.subCategories) {
          extractNew(cat.subCategories);
        }
      });
    };
    
    extractNew(categories);
    return newPollsList;
  }, [categories]);

  useEffect(() => {
    // Initialize dark mode from localStorage
    const theme = localStorage.getItem('theme')
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
    }

    // Only fetch if not already cached (lazy init handled the cache check)
    if (categories.length > 0) {
      return;
    }

    // Fetch categories for navigation
    getTodayPolls()
      .then((data) => {
        setCategories(data.categories);
        setCachedCategories(data.categories);
      })
      .catch((err) => console.error('Failed to fetch categories:', err))
      .finally(() => setLoading(false));
  }, [categories.length]);

  // Track visible sections using IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible: string[] = [];
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.target.id) {
            visible.push(entry.target.id);
          }
        });
        if (visible.length > 0) {
          setVisibleSections(visible);
        }
      },
      {
        rootMargin: '-100px 0px -66% 0px',
        threshold: 0
      }
    );

    // Observe about, faq, featured, and new sections
    const aboutSection = document.getElementById('about');
    const faqSection = document.getElementById('faq');
    const featuredSection = document.getElementById('featured');
    const newSection = document.getElementById('new');

    if (aboutSection) observer.observe(aboutSection);
    if (faqSection) observer.observe(faqSection);
    if (featuredSection) observer.observe(featuredSection);
    if (newSection) observer.observe(newSection);

    return () => {
      if (aboutSection) observer.unobserve(aboutSection);
      if (faqSection) observer.unobserve(faqSection);
      if (featuredSection) observer.unobserve(featuredSection);
      if (newSection) observer.unobserve(newSection);
    };
  }, [loading]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-midnight-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-midnight-600 dark:text-midnight-200">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <PublicLayout categories={categories} visibleSections={visibleSections} newPollsCount={newPolls.length}>
      <div className="max-w-3xl mx-auto px-6 pb-8">
        {/* Hero Section */}
        <div className="flex items-center justify-center py-6">
          <div className="w-full text-center">
            {/* Logo */}
            <div className="mb-8 flex justify-center">
              <Image
                src="/TheAllThingProject-LogoFull-Dark.png"
                alt="The All Thing Project"
                width={400}
                height={100}
                priority
                className="dark:hidden"
              />
              <Image
                src="/TheAllThingProject-LogoFull-White.png"
                alt="The All Thing Project"
                width={400}
                height={100}
                priority
                className="hidden dark:block"
              />
            </div>

            {/* Welcome Text */}
            <h1 className="text-4xl md:text-5xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-rose-600">
              Welcome to <span className="whitespace-nowrap">The All Thing</span>
            </h1>
          </div>
        </div>

        {/* Featured Polls Section */}
        {featuredPolls.length > 0 && (
          <section id="featured" className="mt-8 scroll-mt-20">
            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-rose-600">
                Poll of the Day
              </h2>
            </div>
            
            <div className="space-y-6">
              {featuredPolls.map(({ poll, category }) => (
                <PollCard
                  key={poll.pollId}
                  poll={poll}
                  category={category}
                  allCategories={categories}
                />
              ))}
            </div>
          </section>
        )}

        {/* New Polls Section */}
        {newPolls.length > 0 && (
          <section id="new" className="mt-12 pt-8 scroll-mt-20 border-t border-midnight-200 dark:border-midnight-800">
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-rose-600">
                New Polls
              </h2>
            </div>
            
            <div className="space-y-6">
              {newPolls.map(({ poll, category }) => (
                <PollCard
                  key={poll.pollId}
                  poll={poll}
                  category={category}
                  allCategories={categories}
                />
              ))}
            </div>
          </section>
        )}

        {/* About Section */}
        <section id="about" className="mt-20 pt-16 border-t border-midnight-200 dark:border-midnight-800 scroll-mt-20">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-rose-600">
            About The All Thing Project
          </h2>
          <div className="space-y-4 text-left text-midnight-700 dark:dark:text-midnight-200 leading-relaxed">
            <p>
              The All Thing Project is a small, independent experiment in tracking public opinion over time.
            </p>
            <p>
              Some polls are simple, others use ranked choice when a single answer isn’t enough. Once a poll closes, its results are frozen and preserved.
            </p>
            <p>
              This project doesn’t claim to represent everyone or predict outcomes. These polls are not meant to be scientific or statistically representative. It’s a best-effort look at how a group of people thought about a question at a particular moment in time.
            </p>
            <p>
              The name comes from the All Thing in Dan Simmons’ Hyperion: a virtual gathering where consensus emerges through collective democratic process rather than authority. This is a personal side project, built out of curiosity about how opinions actually evolve when you look at them carefully and consistently.
            </p>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="mt-20 pt-16 border-t border-midnight-200 dark:border-midnight-800 scroll-mt-20">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-rose-600">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6 text-left">
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-midnight-950 dark:text-midnight-100 mb-2">
                What is The All Thing Project?
              </h3>
              <p className="text-midnight-700 dark:dark:text-midnight-200 leading-relaxed">
                The All Thing Project is an independent experiment that tracks public opinion over time by asking the same questions daily and recording each day’s results as a snapshot. The goal is to observe how opinions change, not just what they are at a single moment.
              </p>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-midnight-950 dark:text-midnight-100 mb-2">
                Is this a scientific or representative poll?
              </h3>
              <p className="text-midnight-700 dark:dark:text-midnight-200 leading-relaxed">
                No. This project isn’t designed to be statistically representative or predictive. It reflects the views of the people who choose to participate, at the time they participate. Results should be read as signals and patterns, not definitive measures of public opinion.
              </p>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-midnight-950 dark:text-midnight-100 mb-2">
                Is my vote anonymous?
              </h3>
              <p className="text-midnight-700 dark:dark:text-midnight-200 leading-relaxed">
                Yes. Votes are anonymous. The project may collect limited, high-level metadata (such as general location) to help analyze trends, but no personally identifying information is collected or stored.
              </p>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-midnight-950 dark:text-midnight-100 mb-2">
                What is ranked-choice voting?
              </h3>
              <p className="text-midnight-700 dark:dark:text-midnight-200 leading-relaxed">
                In ranked-choice polls, you’re asked to rank options in order of preference rather than choosing just one. This can provide a more complete picture, especially when opinions are nuanced or there are more than two reasonable answers. 
              </p>
              <p className="text-midnight-700 dark:dark:text-midnight-200 leading-relaxed mt-2">
                Learn more about ranked-choice voting here: <a className="text-blue-500 underline" href="https://fairvote.org/our-reforms/ranked-choice-voting/" target="_blank" rel="noopener noreferrer">https://fairvote.org/our-reforms/ranked-choice-voting/</a>.
              </p>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-midnight-950 dark:text-midnight-100 mb-2">
                When do new polls appear?
              </h3>
              <p className="text-midnight-700 dark:dark:text-midnight-200 leading-relaxed">
                New polls are published daily in the morning around 3am Eastern. Previous polls are closed 
                and results posted.
              </p>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-midnight-950 dark:text-midnight-100 mb-2">
                What happens when a poll closes?
              </h3>
              <p className="text-midnight-700 dark:dark:text-midnight-200 leading-relaxed">
                When a poll closes, its results are finalized and preserved. Closed polls aren’t edited, recalculated, or reopened later. Each day remains a fixed record of responses from that day.
              </p>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-midnight-950 dark:text-midnight-100 mb-2">
                Why are polls repeated every day?
              </h3>
              <p className="text-midnight-700 dark:dark:text-midnight-200 leading-relaxed">
                Asking the same question daily makes it easier to see trends. One-off polls can be misleading or overly influenced by a single event. Daily snapshots show how opinions evolve as circumstances change.
              </p>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-midnight-950 dark:text-midnight-100 mb-2">
                How do you prevent multiple votes?
              </h3>
              <p className="text-midnight-700 dark:dark:text-midnight-200 leading-relaxed">
                The project uses best-effort technical measures to limit multiple votes per person per poll. It’s not foolproof, but the goal is to reduce casual abuse without requiring accounts or personal information.
              </p>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-midnight-950 dark:text-midnight-100 mb-2">
                Why don’t you require accounts?
              </h3>
              <p className="text-midnight-700 dark:dark:text-midnight-200 leading-relaxed">
                For now, the project is intentionally lightweight and anonymous to lower the barrier to participation. Account-based polls and deeper demographic analysis may be explored later, but they’re not part of the initial version.
              </p>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-midnight-950 dark:text-midnight-100 mb-2">
                Who runs this project?
              </h3>
              <p className="text-midnight-700 dark:dark:text-midnight-200 leading-relaxed">
                The All Thing Project is a personal side project, built and maintained independently. It’s not affiliated with any political organization, media outlet, or institution.
              </p>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-midnight-950 dark:text-midnight-100 mb-2">
                Is The All Thing Project politically biased?
              </h3>
              <p className="text-midnight-700 dark:dark:text-midnight-200 leading-relaxed">
                The project isn’t aligned with any political party or organization. Poll questions aim to be clear and neutral, but no wording is ever perfectly free of influence.

                Rather than claiming objectivity, the focus is on consistency and transparency. Questions are asked the same way each day, results are preserved as recorded, and trends are shown over time. The project presents the data without interpretation and leaves conclusions to the reader.
              </p>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-midnight-950 dark:text-midnight-100 mb-2">
                How are poll topics chosen?
              </h3>
              <p className="text-midnight-700 dark:dark:text-midnight-200 leading-relaxed">
                Poll topics are carefully curated to cover a wide range of interests and perspectives. 
                We aim to ask questions that are thought-provoking, relevant, and encourage meaningful 
                participation across diverse topics.
              </p>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-midnight-950 dark:text-midnight-100 mb-2">
                Can I suggest a poll?
              </h3>
              <p className="text-midnight-700 dark:dark:text-midnight-200 leading-relaxed">
                Eventually, yes. The initial focus is on building a consistent baseline of polls. As the project evolves, there may be ways to suggest or propose questions.
              </p>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-midnight-950 dark:text-midnight-100 mb-2">
                What does the name mean?
              </h3>
              <p className="text-midnight-700 dark:dark:text-midnight-200 leading-relaxed">
                The name comes from the All Thing in Dan Simmons’ Hyperion, a virtual gathering where consensus emerges through collective democratic process rather than authority. It reflects the project’s focus on process, participation, and observation over time.
              </p>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
