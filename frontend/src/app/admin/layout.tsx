'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { isAuthenticated, clearAdminKey } from '@/app/lib/adminAuth';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [hasMounted, setHasMounted] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    // Redirect to login if not authenticated (except on login page)
    if (hasMounted && !isAuthenticated() && pathname !== '/admin/login') {
      router.push('/admin/login');
    }
  }, [hasMounted, pathname, router]);

  const handleLogout = () => {
    clearAdminKey();
    router.push('/admin/login');
  };

  // Don't show layout on login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // Wait for client-side hydration
  if (!hasMounted) {
    return null;
  }
  
  // Check auth after mount
  if (!isAuthenticated()) {
    return null;
  }

  const navItems = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/categories', label: 'Categories' },
    { href: '/admin/templates', label: 'Templates' },
    { href: '/admin/instances', label: 'Instances' },
    { href: '/admin/operations', label: 'Operations' },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Top Navigation */}
      <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-8">
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
              
              <div className="hidden md:flex space-x-4">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pathname === item.href
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                View Site
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 
                         hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
