'use client';

import { useEffect, useState } from 'react';
import { PublicLayout } from '@/components/PublicLayout';
import { PollCategory } from '@/lib/types';
import { getTodayPolls } from '@/lib/api';
import { getCachedCategories, setCachedCategories } from '@/lib/categoryCache';

interface BlogPost {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  content: string;
  author: string;
}

export default function BlogPage() {
  const [categories, setCategories] = useState<PollCategory[]>(() => getCachedCategories() || []);
  const [loading, setLoading] = useState(() => !getCachedCategories());
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch if not already cached
    if (categories.length > 0) {
      return;
    }

    getTodayPolls()
      .then((data) => {
        setCategories(data.categories);
        setCachedCategories(data.categories);
      })
      .catch((err) => console.error('Failed to fetch categories:', err))
      .finally(() => setLoading(false));
  }, [categories.length]);

  useEffect(() => {
    // Fetch RSS feed
    const fetchBlogPosts = async () => {
      try {
        // You'll need to replace this with your actual Substack URL
        const substackUrl = process.env.NEXT_PUBLIC_SUBSTACK_URL || 'https://yoursubstack.substack.com/feed';
        
        // Use a CORS proxy or API route to fetch the RSS feed
        const response = await fetch(`/api/rss?url=${encodeURIComponent(substackUrl)}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch RSS feed');
        }
        
        const data = await response.json();
        setPosts(data.posts);
      } catch (err) {
        console.error('Failed to fetch blog posts:', err);
        setError(err instanceof Error ? err.message : 'Failed to load blog posts');
      } finally {
        setPostsLoading(false);
      }
    };

    fetchBlogPosts();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-midnight-950 dark:via-midnight-950 dark:to-indigo-950/20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-midnight-600 dark:text-midnight-100">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <PublicLayout categories={categories}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-rose-600">
          Blog
        </h1>
        <p className="text-lg text-midnight-600 dark:text-midnight-100 mb-8">
          Latest thoughts and updates from The All Thing
        </p>

        {postsLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12 bg-midnight-50 dark:bg-midnight-800/50 rounded-lg border border-midnight-200 dark:border-midnight-700">
            <p className="text-red-600 dark:text-red-400 mb-2">Failed to load blog posts</p>
            <p className="text-sm text-midnight-600 dark:text-midnight-100">{error}</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 bg-midnight-50 dark:bg-midnight-800/50 rounded-lg border border-midnight-200 dark:border-midnight-700">
            <p className="text-midnight-600 dark:text-midnight-100">No blog posts yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {posts.map((post, index) => (
              <article
                key={index}
                className="bg-white dark:bg-midnight-950 rounded-lg shadow-md border border-midnight-200 dark:border-midnight-800 overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="p-6">
                  <a
                    href={post.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group"
                  >
                    <h2 className="text-2xl font-bold mb-2 text-midnight-950 dark:text-midnight-100 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:via-indigo-600 group-hover:to-rose-600 transition-all">
                      {post.title}
                    </h2>
                  </a>
                  
                  <div className="flex items-center gap-4 text-sm text-midnight-500 dark:text-midnight-100 mb-4">
                    {post.author && <span>By {post.author}</span>}
                    <span>{new Date(post.pubDate).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}</span>
                  </div>

                  <div 
                    className="text-midnight-700 dark:text-midnight-200 mb-4 blog-content"
                    dangerouslySetInnerHTML={{ __html: post.content }}
                  />

                  <a
                    href={post.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    Read more on Substack
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
