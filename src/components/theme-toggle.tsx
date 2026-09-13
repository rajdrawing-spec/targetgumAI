'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

/**
 * Light/dark toggle (2026-09-13, docs/DECISIONS.md). The actual class
 * flip happens instantly on click; the blocking inline script in
 * src/app/layout.tsx sets the initial class before paint, so this only
 * needs to read that same class back on mount (no flash, no guessing).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState<boolean | null>(null)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('tg-theme', next ? 'dark' : 'light')
    } catch {
      // Private browsing / storage disabled - the toggle still works for this page view.
    }
    setDark(next)
  }

  // Avoid a mismatched icon flash before the client knows the real state.
  if (dark === null) {
    return <div className={className} style={{ width: '1.75rem', height: '1.75rem' }} aria-hidden />
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={className}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
