'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { EMPTY_TRYIT_STATE, TRYIT_STORAGE_KEY, parseTryItState, type TryItState } from '@/lib/tryit/progress'

const CHANGE_EVENT = 'tg-tryit-change'

// Cache by raw string so useSyncExternalStore gets a stable snapshot.
let cachedRaw: string | null | undefined
let cachedState: TryItState = EMPTY_TRYIT_STATE
// Used only when localStorage throws (blocked storage): progress then lasts
// for this tab's lifetime instead of failing outright.
let memoryRaw: string | null = null

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(TRYIT_STORAGE_KEY)
  } catch {
    return memoryRaw
  }
}

function getSnapshot(): TryItState {
  const raw = readRaw()
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedState = parseTryItState(raw)
  }
  return cachedState
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

/**
 * The public try-it's progress, persisted in this browser only (see
 * src/lib/tryit/progress.ts). `hydrated` is false during SSR and the
 * first client render - callers show a skeleton until then so the server
 * HTML never disagrees with what localStorage holds.
 */
export function useTryIt() {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_TRYIT_STATE)
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )

  const update = useCallback((fn: (s: TryItState) => TryItState) => {
    const next = fn(getSnapshot())
    const raw = JSON.stringify(next)
    try {
      window.localStorage.setItem(TRYIT_STORAGE_KEY, raw)
    } catch {
      memoryRaw = raw
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return { state, hydrated, update }
}
