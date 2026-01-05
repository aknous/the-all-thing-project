'use client'

import { useEffect, useState } from 'react'

function SunIcon(props: React.ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path d="M12.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z" />
      <path
        strokeLinecap="round"
        d="M10 5.5v-1m0 11v-1m-5.5-4.5h1m11 0h1M7.5 7.5 7 7m6 6-.5.5m0-6L13 7m-6 6-.5.5"
      />
    </svg>
  )
}

function MoonIcon(props: React.ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path d="M15.224 11.724a5.5 5.5 0 0 1-6.949-6.949 5.5 5.5 0 1 0 6.949 6.949Z" />
    </svg>
  )
}

export function ThemeToggle() {
  const [, forceUpdate] = useState({})

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains('dark')
    
    if (isDark) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    }
    
    // Force re-render to update icons
    forceUpdate({})
  }

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      onClick={toggleTheme}
      className="group rounded-full bg-white/90 px-3 py-2 shadow-lg shadow-zinc-800/5 ring-1 ring-zinc-900/5 backdrop-blur transition dark:bg-zinc-800/90 dark:ring-white/10 dark:hover:ring-white/20"
    >
      <SunIcon className="h-5 w-5 fill-zinc-100 stroke-zinc-500 transition group-hover:fill-zinc-200 group-hover:stroke-zinc-700 dark:hidden" />
      <MoonIcon className="hidden h-5 w-5 fill-zinc-700 stroke-zinc-500 transition dark:block dark:group-hover:stroke-zinc-400" />
    </button>
  )
}
