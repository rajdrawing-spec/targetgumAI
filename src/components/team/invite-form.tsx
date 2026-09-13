'use client'

import { useRef, useState } from 'react'
import { ActionForm, FieldError, SubmitButton } from '@/components/ui/action-form'
import { Input, Label } from '@/components/ui/input'
import { inviteUserAction } from '@/app/dashboard/team/actions'
import { CopyableLink } from './copyable-link'

const selectClass = 'h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * The only way anyone gets access to this app (2026-09-13 role-model
 * simplification, docs/DECISIONS.md): a Super Admin enters an email and
 * picks one of the two invitable roles. `employee` additionally picks
 * which clients they're assigned to (may be left empty - assign later);
 * `client` picks exactly the one client this portal user belongs to.
 *
 * Deliberately does NOT use `ActionForm`'s `resetOnSuccess` (a native
 * `form.reset()`) - this form has a React-*controlled* `role` select, and
 * an imperative DOM reset racing with React's controlled-value
 * reconciliation on the very next render (which also has to process the
 * server-returned invite link) left `useActionState` never settling out
 * of pending in production builds, found live via Playwright while
 * verifying this flow end-to-end. Resetting through React state
 * (`setRole`/`setInviteUrl`) plus a plain ref for the one uncontrolled
 * field (email) avoids that whole class of bug.
 */
export function InviteForm({ clients }: { clients: Array<{ id: string; name: string }> }) {
  const [role, setRole] = useState<'employee' | 'client'>('employee')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  return (
    <ActionForm
      action={inviteUserAction}
      className="space-y-4"
      onSuccess={(result) => {
        setInviteUrl(result.data?.inviteUrl ?? null)
        setRole('employee')
        if (emailRef.current) emailRef.current.value = ''
      }}
    >
      {inviteUrl && <CopyableLink url={inviteUrl} onDismiss={() => setInviteUrl(null)} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input ref={emailRef} id="email" name="email" type="email" required placeholder="name@company.com" />
          <FieldError name="email" />
        </div>
        <div>
          <Label htmlFor="role">Role</Label>
          <select
            id="role"
            name="role"
            className={selectClass}
            value={role}
            onChange={(e) => setRole(e.target.value as 'employee' | 'client')}
          >
            <option value="employee">Employee - internal staff</option>
            <option value="client">Client - portal access for one client</option>
          </select>
          <FieldError name="role" />
        </div>
      </div>

      {role === 'employee' ? (
        <div>
          <Label>Assign to clients (optional - can assign later)</Label>
          {clients.length === 0 ? (
            <p className="mt-1 text-xs text-caption">No clients yet.</p>
          ) : (
            <div className="mt-1.5 grid max-h-40 grid-cols-1 gap-1.5 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
              {clients.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" name="clientIds" value={c.id} className="h-3.5 w-3.5 rounded border-input" />
                  {c.name}
                </label>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <Label htmlFor="clientId">Client</Label>
          <select id="clientId" name="clientId" className={selectClass} defaultValue="" required>
            <option value="" disabled>
              Select a client…
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <FieldError name="clientId" />
        </div>
      )}

      <SubmitButton pendingLabel="Sending invite…">Send invite</SubmitButton>
    </ActionForm>
  )
}
