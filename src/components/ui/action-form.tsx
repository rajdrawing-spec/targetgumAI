'use client'

import { useActionState, useEffect, useRef, type ComponentProps, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import { ACTION_IDLE, type ActionResult } from '@/lib/actions/result'
import { Button } from './button'
import { useToast } from './toast'
import { cn } from '@/lib/utils'

/**
 * The form primitives every mutation in the app goes through (BRD "every
 * action needs loading / success / error / disabled states"):
 *
 * - `ActionForm` binds a Server Action returning `ActionResult` with
 *   `useActionState`, shows the inline error it returns, toasts its success
 *   message, and follows `redirectTo` client-side (no full reload).
 * - `SubmitButton` uses `useFormStatus` so only the control that started
 *   the action is disabled and spinning - never the whole page.
 *
 * A pending state comes from the actual request lifecycle, never from a
 * timer.
 */

type BoundAction = (prevState: ActionResult, formData: FormData) => Promise<ActionResult>

export function ActionForm({
  action,
  children,
  className,
  successMessage,
  resetOnSuccess = false,
  onSuccess,
  fullReload = false,
  ...rest
}: Omit<ComponentProps<'form'>, 'action' | 'onSubmit'> & {
  action: BoundAction
  /** Shown as a toast when the action succeeds without its own message. */
  successMessage?: string
  /** Clear the form's fields after a successful submit (create forms). */
  resetOnSuccess?: boolean
  onSuccess?: (result: Extract<ActionResult, { ok: true }>) => void
  /**
   * Follow `redirectTo` with a full page load instead of a client-side
   * router push. For actions whose success view must always arrive -
   * the Growth quest/shop actions (docs/DECISIONS.md 2026-09-24), where
   * client-side navigation within the Client Workspace was measured
   * intermittently never committing.
   */
  fullReload?: boolean
}) {
  const [state, formAction] = useActionState(action, ACTION_IDLE)
  const router = useRouter()
  const toast = useToast()
  const formRef = useRef<HTMLFormElement>(null)
  const lastHandled = useRef<ActionResult>(ACTION_IDLE)

  useEffect(() => {
    if (state === lastHandled.current || state === ACTION_IDLE) return
    lastHandled.current = state
    if (state.ok) {
      const message = state.message ?? successMessage
      if (message) toast.success(message)
      if (resetOnSuccess) formRef.current?.reset()
      onSuccess?.(state)
      if (state.redirectTo) {
        if (fullReload) window.location.assign(state.redirectTo)
        else router.push(state.redirectTo)
      }
    }
  }, [state, successMessage, resetOnSuccess, onSuccess, router, toast, fullReload])

  return (
    <form ref={formRef} action={formAction} className={className} {...rest}>
      <FormStateContext.Provider value={state}>{children}</FormStateContext.Provider>
      {!state.ok && <FormError message={state.error} className="mt-2" />}
    </form>
  )
}

import { createContext, useContext } from 'react'
const FormStateContext = createContext<ActionResult>(ACTION_IDLE)

/** Field-level error from the last ActionResult, keyed by input name. */
export function FieldError({ name, className }: { name: string; className?: string }) {
  const state = useContext(FormStateContext)
  const message = !state.ok ? state.fieldErrors?.[name] : undefined
  if (!message) return null
  return (
    <p className={cn('mt-1 text-xs text-destructive', className)} role="alert">
      {message}
    </p>
  )
}

export function FormError({ message, className }: { message: string; className?: string }) {
  return (
    <div role="alert" className={cn('flex items-start gap-2 rounded-md bg-destructive-bg px-3 py-2 text-sm text-destructive', className)}>
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  )
}
