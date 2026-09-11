import { ZodError } from 'zod'
import { AiGatewayError } from '@/lib/ai/errors'
import { IntegrationUnavailableError, UnsupportedOperationError } from '@/lib/integrations/errors'
import { AuthenticationError, ForbiddenError } from '@/lib/rbac/errors'

/**
 * The one return shape every Server Action in this app uses, so the
 * client-side form primitives (`src/components/ui/action-form.tsx`) can
 * render pending / success / inline-error states without each form
 * inventing its own. Actions never throw to the client: a thrown error
 * would replace the whole page with the segment error boundary, which is
 * the wrong response to "this one field is invalid" or "Metricool is
 * down right now".
 */
export type ActionResult =
  | { ok: true; message?: string; redirectTo?: string; data?: Record<string, string> }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

export const ACTION_IDLE: ActionResult = { ok: true }

export function actionOk(message?: string, extra: { redirectTo?: string; data?: Record<string, string> } = {}): ActionResult {
  return { ok: true, message, ...extra }
}

export function actionError(error: string, fieldErrors?: Record<string, string>): ActionResult {
  return { ok: false, error, fieldErrors }
}

/**
 * Turns a thrown error into a human-readable ActionResult. Known,
 * user-facing failures are passed through with their own message (they are
 * written to be shown - "Metricool integration unavailable: ... Last
 * successful data: ..."); anything else is logged server-side with its
 * stack and reduced to a generic message so internal details (SQL, file
 * paths, provider payloads) never reach the browser (docs/SECURITY.md).
 */
export function toActionError(error: unknown, context: string): ActionResult {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of error.issues) {
      const key = issue.path.join('.') || '_'
      if (!fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return actionError('Please fix the highlighted fields.', fieldErrors)
  }
  if (error instanceof AuthenticationError) {
    return actionError('Your session has expired. Sign in again to continue.')
  }
  if (error instanceof ForbiddenError) {
    return actionError("You don't have permission to do that.")
  }
  if (error instanceof IntegrationUnavailableError || error instanceof UnsupportedOperationError) {
    return actionError(error.message)
  }
  if (error instanceof AiGatewayError) {
    return actionError(`The AI analysis could not be completed: ${error.message}`)
  }
  if (error instanceof Error && /required|invalid|already exists|not found|cannot|must /i.test(error.message)) {
    // Validation-style errors thrown by lib functions ("Client name is
    // required.", "A client named X already exists.") are written for
    // people; pass them through verbatim.
    return actionError(error.message)
  }
  console.error(`[action:${context}]`, error)
  return actionError('Something went wrong on our side. Please try again.')
}

/** Wraps an action body: catches everything, returns an ActionResult. */
export async function runAction(context: string, body: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await body()
  } catch (error) {
    // Next.js implements redirect() by throwing - let it propagate.
    if (isNextRedirectError(error)) throw error
    return toActionError(error, context)
  }
}

function isNextRedirectError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'digest' in error && String((error as { digest?: unknown }).digest).startsWith('NEXT_REDIRECT')
}

/** `formData.get()` as a trimmed string, or undefined when blank. */
export function formString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}
