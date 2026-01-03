'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function Header() {
  return (
    <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
      <div className="flex h-20">
        {/* Logo section - same width as sidebar */}
        <div className="w-64 flex items-center justify-center border-r border-zinc-200 dark:border-zinc-800">
          <Link href="/" className="flex items-center">
            <Image
              src="/TheAllThingProject-LogoFull-White.png"
              alt="The All Thing Project"
              width={300}
              height={75}
              priority
              className="h-12 w-auto"
            />
          </Link>
        </div>
        
        {/* Navigation section */}
        <div className="flex-1 flex items-center px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4">
            <Link
              href="/polls"
              className="px-3 py-2 rounded-lg text-sm font-medium transition-colors text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Polls
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
