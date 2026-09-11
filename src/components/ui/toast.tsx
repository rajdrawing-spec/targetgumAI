'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Minimal toast notifications (no dependency). Success confirmations for
 * actions that don't redirect - "Client archived", "Feedback sent" - so a
 * completed action is never silent. Errors stay inline next to the form
 * that produced them (`action-form.tsx`); toasts are for success and for
 * background/redirect cases only.
 */

type Toast = { id: number; kind: 'success' | 'error'; message: string }

const ToastContext = createContext<{ push: (kind: Toast['kind'], message: string) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
  }, [])

  const push = useCallback(
    (kind: Toast['kind'], message: string) => {
      const id = nextId.current++
      setToasts((t) => [...t.slice(-3), { id, kind, message }])
      timers.current.set(id, setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 4000))
    },
    [dismiss],
  )

  useEffect(() => {
    const active = timers.current
    return () => active.forEach((t) => clearTimeout(t))
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-card px-3.5 py-3 text-sm shadow-popover',
              toast.kind === 'success' ? 'border-success/30' : 'border-destructive/30',
            )}
          >
            {toast.kind === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            )}
            <p className="flex-1 text-foreground">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** No-op outside a provider so components stay usable in isolation (tests, portal). */
export function useToast() {
  const ctx = useContext(ToastContext)
  return useMemo(
    () => ({
      success: (message: string) => ctx?.push('success', message),
      error: (message: string) => ctx?.push('error', message),
    }),
    [ctx],
  )
}
