'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { GummyStyle } from '@/lib/growth/shop-catalog'

export type { GummyStyle }

/**
 * Growth Shop cosmetics for one client's growth pages (docs/DECISIONS.md
 * 2026-09-24): which outfit Gummy wears and whether lesson celebrations
 * use gold confetti. Each growth page provides it from `cosmeticsFor(
 * progress)`; the default (no provider - e.g. the public try-it and
 * non-growth pages) is plain Gummy.
 */
const GummyStyleContext = createContext<GummyStyle>({ outfit: null, goldCelebration: false })

export function GummyStyleProvider({ value, children }: { value: GummyStyle; children: ReactNode }) {
  return <GummyStyleContext.Provider value={value}>{children}</GummyStyleContext.Provider>
}

export function useGummyStyle(): GummyStyle {
  return useContext(GummyStyleContext)
}
