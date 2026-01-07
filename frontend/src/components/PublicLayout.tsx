'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef, useEffect, useMemo } from 'react'
import { PollCategory, Poll } from '@/lib/types'
import { ThemeToggle } from './ThemeToggle'
import { remToPx } from '@/lib/remToPx'

interface PublicLayoutProps {
  children: React.ReactNode
  categories: PollCategory[]
  onCategoryChange?: (categoryKey: string | null) => void
  activeCategory?: string | null
  visibleSections?: string[]
  newPollsCount?: number
}

interface CategoryGroupProps {
  categories: PollCategory[]
  activeCategory?: string | null
  onCategoryClick: (categoryKey: string) => void
  visibleSections?: string[]
}

interface NavCategory {
  categoryKey: string
  categoryName: string
}

function VisibleSectionHighlight({
  categories,
  activeCategory,
  sections,
  visibleSections,
}: {
  categories: NavCategory[]
  activeCategory: string
  sections: NavCategory[]
  visibleSections: string[]
}) {
  if (visibleSections.length === 0) return null

  const itemHeight = remToPx(2)
  
  // Find the active parent's position in the categories list
  const activePageIndex = categories.findIndex((cat) => cat.categoryKey === activeCategory)
  if (activePageIndex === -1) return null
  
  // Filter visible sections to only those in current sections array
  const visibleSectionsInScope = visibleSections.filter(vs => 
    sections.some(s => s.categoryKey === vs)
  )
  
  if (visibleSectionsInScope.length === 0) return null
  
  // Find first visible section index within the sections array
  const firstVisibleSectionIndex = Math.max(
    0,
    sections.findIndex((section) => section.categoryKey === visibleSectionsInScope[0])
  )
  
  if (firstVisibleSectionIndex === -1) return null

  const height = Math.max(1, visibleSectionsInScope.length + 1) * itemHeight
  // Position at parent + offset for first visible section
  const top = activePageIndex * itemHeight + firstVisibleSectionIndex * itemHeight

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: 0.2 } }}
      exit={{ opacity: 0 }}
      className="absolute inset-x-0 top-0 bg-midnight-800/2.5 will-change-transform dark:bg-white/2.5"
      style={{ borderRadius: 8, height, top }}
    />
  )
}

function ActivePageMarker({
  categories,
  activeCategory,
}: {
  categories: NavCategory[]
  activeCategory: string | null
}) {
  if (!activeCategory) return null

  const itemHeight = remToPx(2)
  const offset = remToPx(0.25)
  const activePageIndex = categories.findIndex((cat) => cat.categoryKey === activeCategory)
  
  if (activePageIndex === -1) return null

  const top = offset + activePageIndex * itemHeight

  return (
    <motion.div
      layout
      className="absolute left-2 h-6 w-px bg-blue-500"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: 0.2 } }}
      exit={{ opacity: 0 }}
      style={{ top }}
    />
  )
}

function InfoNavigation({ pathname, visibleSections = [], newPollsCount = 0, hasFeaturedPolls = false, onLinkClick }: { pathname: string; visibleSections?: string[]; newPollsCount?: number; hasFeaturedPolls?: boolean; onLinkClick?: () => void }) {
  const router = useRouter()

  // Determine active section based on pathname and hash (derived state)
  const activeSection = useMemo(() => {
    const hash = window.location.hash
    if (pathname === '/') {
      if (hash === '#about') return 'about'
      if (hash === '#faq') return 'faq'
      if (hash === '#featured') return 'featured'
      if (hash === '#new') return 'new'
      return 'welcome'
    }
    if (pathname === '/blog') return 'blog'
    return ''
  }, [pathname])

  const isWelcomeActive = pathname === '/' && ['welcome', 'about', 'faq', 'featured', 'new'].includes(activeSection)
  const itemHeight = remToPx(2)
  const offset = remToPx(0.25)

  const handleWelcomeClick = () => {
    router.push('/')
  }

  const handleSectionClick = (section: string) => {
    router.push(`/#${section}`)
    setTimeout(() => {
      const element = document.getElementById(section)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

  const handleBlogClick = () => {
    router.push('/blog')
  }

  // Calculate active marker position
  const getActiveMarkerTop = () => {
    if (activeSection === 'welcome' || isWelcomeActive) return offset
    if (activeSection === 'blog') return offset + itemHeight
    return offset
  }

  // Info navigation categories for positioning
  const infoNavCategories: NavCategory[] = [
    { categoryKey: 'welcome', categoryName: 'Welcome' },
    { categoryKey: 'blog', categoryName: 'Blog' }
  ]

  // Subsections for Welcome - conditionally include Featured
  const infoSubsections: NavCategory[] = [
    ...(hasFeaturedPolls ? [{ categoryKey: 'featured', categoryName: 'Poll of the Day' }] : []),
    { categoryKey: 'new', categoryName: 'New Polls' },
    { categoryKey: 'about', categoryName: 'About' },
    { categoryKey: 'faq', categoryName: 'FAQ' }
  ]

  return (
    <li className="relative">
      <motion.h2
        layout="position"
        className="text-sm font-semibold text-midnight-950 dark:text-white"
      >
        Info
      </motion.h2>
      <div className="relative mt-3 pl-2">
        <AnimatePresence initial={false}>
          {isWelcomeActive && visibleSections.length > 0 && (
            <VisibleSectionHighlight
              categories={infoNavCategories}
              activeCategory="welcome"
              sections={infoSubsections}
              visibleSections={visibleSections}
            />
          )}
        </AnimatePresence>
        <motion.div
          layout
          className="absolute inset-y-0 left-2 w-px bg-midnight-950/10 dark:bg-white/5"
        />
        <AnimatePresence initial={false}>
          {(isWelcomeActive || activeSection === 'blog') && (
            <motion.div
              layout
              className="absolute left-2 h-6 w-px bg-blue-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.2 } }}
              exit={{ opacity: 0 }}
              style={{ top: getActiveMarkerTop() }}
            />
          )}
        </AnimatePresence>
        <ul role="list" className="border-l border-transparent">
          {/* Welcome */}
          <motion.li layout="position" className="relative">
            <button
              onClick={() => {
                handleWelcomeClick()
                onLinkClick?.()
              }}
              aria-current={isWelcomeActive ? 'page' : undefined}
              className={`flex justify-between gap-2 py-1 pr-3 pl-4 text-sm transition w-full text-left min-h-8 ${
                isWelcomeActive
                  ? 'text-midnight-950 dark:text-white'
                  : 'text-midnight-600 hover:text-midnight-950 dark:text-midnight-100 dark:hover:text-white'
              }`}
            >
              <span className="truncate">Welcome</span>
            </button>
            <AnimatePresence mode="popLayout" initial={false}>
              {isWelcomeActive && (
                <motion.ul
                  role="list"
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    transition: { delay: 0.1 },
                  }}
                  exit={{
                    opacity: 0,
                    transition: { duration: 0.15 },
                  }}
                >
                  {infoSubsections.map((section) => {
                    // Special handling for New Polls with count indicator
                    if (section.categoryKey === 'new' && newPollsCount > 0) {
                      return (
                        <li key={section.categoryKey}>
                          <button
                            onClick={() => handleSectionClick(section.categoryKey)}
                            className="flex items-center gap-2 py-1 pr-3 pl-7 text-sm transition w-full text-left min-h-8"
                          >
                            <span className="truncate font-semibold text-blue-600 dark:text-blue-400">{section.categoryName}</span>
                            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </button>
                        </li>
                      )
                    }
                    
                    // Don't show New Polls if count is 0
                    if (section.categoryKey === 'new' && newPollsCount === 0) {
                      return null
                    }
                    
                    // Regular subsection
                    return (
                      <li key={section.categoryKey}>
                        <button
                          onClick={() => handleSectionClick(section.categoryKey)}
                          className="flex justify-between gap-2 py-1 pr-3 pl-7 text-sm transition w-full text-left text-midnight-600 hover:text-midnight-950 dark:text-midnight-100 dark:hover:text-white min-h-8"
                        >
                          <span className="truncate">{section.categoryName}</span>
                        </button>
                      </li>
                    )
                  })}
                </motion.ul>
              )}
            </AnimatePresence>
          </motion.li>

          {/* Blog */}
          <motion.li layout="position" className="relative">
            <button
              onClick={() => {
                handleBlogClick()
                onLinkClick?.()
              }}
              aria-current={activeSection === 'blog' ? 'page' : undefined}
              className={`flex justify-between gap-2 py-1 pr-3 pl-4 text-sm transition w-full text-left min-h-8 ${
                activeSection === 'blog'
                  ? 'text-midnight-950 dark:text-white'
                  : 'text-midnight-600 hover:text-midnight-950 dark:text-midnight-100 dark:hover:text-white'
              }`}
            >
              <span className="truncate">Blog</span>
            </button>
          </motion.li>
        </ul>
      </div>
    </li>
  )
}

function CategoriesNavigation({ categories, activeCategory, onCategoryClick, visibleSections = [] }: CategoryGroupProps) {
  // Extract all featured polls from all categories
  const featuredPolls: Array<{ poll: Poll; category: PollCategory }> = []
  const extractFeaturedPolls = (cats: PollCategory[], parentCat?: PollCategory) => {
    cats.forEach(cat => {
      cat.polls.filter(poll => poll.featured).forEach(poll => {
        featuredPolls.push({ poll, category: parentCat || cat })
      })
      if (cat.subCategories) {
        extractFeaturedPolls(cat.subCategories, cat)
      }
    })
  }
  extractFeaturedPolls(categories)
  
  const handleChildClick = (categoryKey: string, parentKey: string) => {
    onCategoryClick(parentKey)
    setTimeout(() => {
      const element = document.getElementById(categoryKey)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)
  
  // Find active parent (either directly selected or has active child, or 'featured')
  const activeParent = activeCategory === 'featured' 
    ? null 
    : sortedCategories.find(cat => 
        cat.categoryKey === activeCategory ||
        cat.subCategories?.some(sub => sub.categoryKey === activeCategory)
      )
  
  // Get sections (children) for the active parent
  const sections = activeParent?.subCategories?.sort((a, b) => a.sortOrder - b.sortOrder) || []
  
  // Build flat list of nav items for positioning (no longer include featured here)
  const navCategories: NavCategory[] = [
    ...sortedCategories.map(cat => ({
      categoryKey: cat.categoryKey,
      categoryName: cat.categoryName,
    }))
  ]
  
  // Build sections list for visible highlight
  const navSections: NavCategory[] = sections.map(sec => ({
    categoryKey: sec.categoryKey,
    categoryName: sec.categoryName,
  }))

  return (
    <li className="relative mt-6 md:mt-0">
      <motion.h2
        layout="position"
        className="text-sm font-semibold text-midnight-950 dark:text-white"
      >
        Polls by Category
      </motion.h2>
      <div className="relative mt-3 pl-2">
        <AnimatePresence initial={false}>
          {activeParent && navSections.length > 0 && (
            <VisibleSectionHighlight
              categories={navCategories}
              activeCategory={activeParent.categoryKey}
              sections={navSections}
              visibleSections={visibleSections}
            />
          )}
        </AnimatePresence>
        <motion.div
          layout
          className="absolute inset-y-0 left-2 w-px bg-midnight-950/10 dark:bg-white/5"
        />
        <AnimatePresence initial={false}>
          {activeParent && (
            <ActivePageMarker
              categories={navCategories}
              activeCategory={activeParent.categoryKey}
            />
          )}
        </AnimatePresence>
        <ul role="list" className="border-l border-transparent">
          {/* Category Buttons */}
          {sortedCategories.map((category) => {
            const isActive = category.categoryKey === activeParent?.categoryKey
            
            return (
              <motion.li key={category.categoryId} layout="position" className="relative">
                <button
                  onClick={() => onCategoryClick(category.categoryKey)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex justify-between gap-2 py-1 pr-3 pl-4 text-sm transition w-full text-left min-h-8 ${
                    isActive
                      ? 'text-midnight-950 dark:text-white'
                      : 'text-midnight-600 hover:text-midnight-950 dark:text-midnight-100 dark:hover:text-white'
                  }`}
                >
                  <span className="truncate">{category.categoryName}</span>
                </button>
                <AnimatePresence mode="popLayout" initial={false}>
                  {isActive && sections.length > 0 && (
                    <motion.ul
                      role="list"
                      initial={{ opacity: 0 }}
                      animate={{
                        opacity: 1,
                        transition: { delay: 0.1 },
                      }}
                      exit={{
                        opacity: 0,
                        transition: { duration: 0.15 },
                      }}
                    >
                      {sections.map((section) => (
                        <li key={section.categoryId}>
                          <button
                            onClick={() => handleChildClick(section.categoryKey, category.categoryKey)}
                            className="flex justify-between gap-2 py-1 pr-3 pl-7 text-sm transition w-full text-left text-midnight-600 hover:text-midnight-950 dark:text-midnight-100 dark:hover:text-white min-h-8"
                          >
                            <span className="truncate">{section.categoryName}</span>
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </motion.li>
            )
          })}
        </ul>
      </div>
    </li>
  )
}

export function PublicLayout({ children, categories, onCategoryChange, activeCategory, visibleSections, newPollsCount = 0 }: PublicLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  
  // Check if there are any featured polls
  const hasFeaturedPolls = useMemo(() => {
    const checkFeatured = (cats: PollCategory[]): boolean => {
      for (const cat of cats) {
        if (cat.polls.some(poll => poll.featured)) {
          return true
        }
        if (cat.subCategories && checkFeatured(cat.subCategories)) {
          return true
        }
      }
      return false
    }
    return checkFeatured(categories)
  }, [categories])
  
  // Search across all polls using useMemo
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return []
    }

    const results: Array<{ poll: Poll; category: PollCategory }> = []
    const query = searchQuery.toLowerCase()
    
    const searchInCategories = (cats: PollCategory[]) => {
      cats.forEach(cat => {
        cat.polls.forEach(poll => {
          const titleMatch = poll.title?.toLowerCase().includes(query)
          const questionMatch = poll.question?.toLowerCase().includes(query)
          if (titleMatch || questionMatch) {
            results.push({ poll, category: cat })
          }
        })
        if (cat.subCategories) {
          searchInCategories(cat.subCategories)
        }
      })
    }
    
    searchInCategories(categories)
    return results
  }, [searchQuery, categories])

  // Show dropdown when there's a query
  useEffect(() => {
    setShowSearchResults(searchQuery.trim().length > 0)
  }, [searchQuery])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  const handleCategoryClick = (categoryKey: string) => {
    // If we're not on the main polls page, navigate there with the category
    if (pathname !== '/polls') {
      router.push(`/polls?category=${categoryKey}`)
    } else {
      // On polls page, update URL and let page component handle state
      router.push(`/polls?category=${categoryKey}`)
      if (onCategoryChange) {
        onCategoryChange(categoryKey)
      }
    }
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-midnight-950 dark:via-midnight-950 dark:to-indigo-950">
      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            />
            {/* Mobile sidebar */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed inset-y-0 left-0 z-50 w-72 lg:hidden"
            >
              <div className="flex h-full flex-col gap-y-5 overflow-y-auto border-r border-midnight-200 dark:border-midnight-800 bg-white dark:bg-midnight-950 px-6 pb-4">
                {/* Logo and close button */}
                <div className="flex h-16 shrink-0 items-center justify-between">
                  <Link href="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center">
                    <Image
                      src="/TheAllThingProject-LogoFull-Dark.png"
                      alt="The All Thing Project"
                      width={240}
                      height={60}
                      priority
                      className="h-12 w-auto dark:hidden"
                    />
                    <Image
                      src="/TheAllThingProject-LogoFull-White.png"
                      alt="The All Thing Project"
                      width={240}
                      height={60}
                      priority
                      className="h-12 w-auto hidden dark:block"
                    />
                  </Link>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-midnight-500 hover:text-midnight-950 dark:hover:text-white"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* Navigation */}
                <nav className="flex flex-1 flex-col">
                  <ul role="list" className="space-y-6">
                    <InfoNavigation pathname={pathname} visibleSections={visibleSections} newPollsCount={newPollsCount} hasFeaturedPolls={hasFeaturedPolls} />
                    <CategoriesNavigation
                      categories={categories}
                      activeCategory={activeCategory}
                      onCategoryClick={(key) => {
                        handleCategoryClick(key)
                        setMobileMenuOpen(false)
                      }}
                      visibleSections={visibleSections}
                    />
                  </ul>
                </nav>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-midnight-200 dark:border-midnight-800 bg-white/80 dark:bg-midnight-900/80 backdrop-blur-sm px-6 pb-4">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center">
            <Link href="/" className="flex items-center">
              <Image
                src="/TheAllThingProject-LogoFull-Dark.png"
                alt="The All Thing Project"
                width={280}
                height={70}
                priority
                className="h-12 w-auto dark:hidden"
              />
              <Image
                src="/TheAllThingProject-LogoFull-White.png"
                alt="The All Thing Project"
                width={280}
                height={70}
                priority
                className="h-12 w-auto hidden dark:block"
              />
            </Link>
          </div>
          
          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="space-y-6">
              <InfoNavigation pathname={pathname} visibleSections={visibleSections} newPollsCount={newPollsCount} hasFeaturedPolls={hasFeaturedPolls} onLinkClick={() => {}} />
              <CategoriesNavigation
                categories={categories}
                activeCategory={activeCategory}
                onCategoryClick={handleCategoryClick}
                visibleSections={visibleSections}
              />
            </ul>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72 flex-1">
        {/* Top header */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-midnight-200 dark:border-midnight-800 bg-white/95 dark:bg-midnight-900/80 backdrop-blur px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1 items-center justify-between">
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden -m-2.5 p-2.5 text-midnight-700 dark:text-midnight-100"
              >
                <span className="sr-only">Open sidebar</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              <div className="lg:hidden flex-1 flex justify-center">
                <Link href="/" className="flex items-center">
                  <Image
                    src="/TheAllThingProject-LogoFull-Dark.png"
                    alt="The All Thing Project"
                    width={280}
                    height={70}
                    priority
                    className="h-12 w-auto dark:hidden"
                  />
                  <Image
                    src="/TheAllThingProject-LogoFull-White.png"
                    alt="The All Thing Project"
                    width={280}
                    height={70}
                    priority
                    className="h-10 w-auto hidden dark:block"
                  />
                </Link>
              </div>
              
              {/* Search Bar */}
              <div className="relative hidden sm:flex flex-1 max-w-2xl mx-4" ref={searchRef}>
                <div className="relative w-full">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <svg className="h-5 w-5 text-midnight-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search polls..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full rounded-md border-0 bg-white dark:bg-midnight-800 py-1.5 pl-10 pr-3 text-midnight-950 dark:text-midnight-50 placeholder:text-midnight-400 dark:placeholder:text-midnight-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 dark:focus:ring-blue-500 sm:text-sm sm:leading-6"
                  />
                </div>
                
                {/* Search Results Dropdown */}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute z-50 mt-2 w-full rounded-md bg-white dark:bg-midnight-800 shadow-lg ring-1 ring-black ring-opacity-5 max-h-96 overflow-auto">
                    <ul className="py-1">
                      {searchResults.map(({ poll, category }) => (
                        <li key={poll.pollId}>
                          <Link
                            href={`/polls/${category.categoryKey}/${poll.templateKey}`}
                            onClick={() => {
                              setSearchQuery('')
                              setShowSearchResults(false)
                            }}
                            className="block px-4 py-3 hover:bg-midnight-50 dark:hover:bg-midnight-700 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-midnight-950 dark:text-midnight-100 truncate">
                                  {poll.title}
                                </p>
                                {poll.question && (
                                  <p className="text-sm text-midnight-500 dark:text-midnight-100 mt-1 line-clamp-2">
                                    {poll.question}
                                  </p>
                                )}
                              </div>
                              <span className="shrink-0 inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                                {category.categoryName}
                              </span>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {showSearchResults && searchQuery && searchResults.length === 0 && (
                  <div className="absolute z-50 mt-2 w-full rounded-md bg-white dark:bg-midnight-800 shadow-lg ring-1 ring-black ring-opacity-5 p-4">
                    <p className="text-sm text-midnight-500 dark:text-midnight-100 text-center">No polls found</p>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-4 ml-auto">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
