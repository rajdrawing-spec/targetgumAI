import { redirect } from 'next/navigation'
import { Plus, Trash2, AlertTriangle } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getAuthorizedClientCached } from '@/lib/db/tenant'
import { getClientPolicy } from '@/lib/clients/brain'
import { listClientContacts } from '@/lib/clients/contacts'
import { listAccountManagerCandidates } from '@/lib/clients/profile'
import {
  addContactAction,
  archiveClientAction,
  deleteClientAction,
  deleteContactAction,
  unarchiveClientAction,
  updateClientProfileAction,
  updatePolicyAction,
} from '../../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label, Textarea } from '@/components/ui/input'
import { ActionForm, FieldError, SubmitButton } from '@/components/ui/action-form'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/clients/section'
import { AUTOMATION_LEVELS, CLIENT_STATUSES, COMMON_TIMEZONES, INDUSTRIES } from '@/lib/clients/options'

const selectClass = 'h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export default async function ClientSettingsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const [{ clientId }, ctx] = await Promise.all([params, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const client = await getAuthorizedClientCached(ctx, clientId)
  const [policy, contacts, managers] = await Promise.all([
    getClientPolicy(ctx, clientId),
    listClientContacts(ctx, clientId),
    listAccountManagerCandidates(ctx),
  ])
  const canEdit = ctx.permissions.has('clients.edit')
  const canManage = ctx.permissions.has('clients.manage')
  const archived = client.status === 'ARCHIVED'

  return (
    <div className="space-y-4">
      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={updateClientProfileAction.bind(null, clientId)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Client name" htmlFor="name">
              <Input id="name" name="name" defaultValue={client.name} required minLength={2} disabled={!canEdit || archived} />
              <FieldError name="name" />
            </Field>
            <Field label="Legal / company name" htmlFor="legalName">
              <Input id="legalName" name="legalName" defaultValue={client.legalName ?? ''} disabled={!canEdit || archived} />
            </Field>
            <Field label="Website" htmlFor="website">
              <Input id="website" name="website" defaultValue={client.website ?? ''} disabled={!canEdit || archived} />
              <FieldError name="website" />
            </Field>
            <Field label="Industry" htmlFor="industry">
              <Input id="industry" name="industry" list="industry-options" defaultValue={client.industry ?? ''} disabled={!canEdit || archived} />
              <datalist id="industry-options">
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i} />
                ))}
              </datalist>
            </Field>
            <Field label="Country" htmlFor="country">
              <Input id="country" name="country" defaultValue={client.country ?? ''} disabled={!canEdit || archived} />
            </Field>
            <Field label="City" htmlFor="city">
              <Input id="city" name="city" defaultValue={client.city ?? ''} disabled={!canEdit || archived} />
            </Field>
            <Field label="Time zone" htmlFor="timezone">
              <Input id="timezone" name="timezone" list="timezone-options" defaultValue={client.timezone ?? ''} disabled={!canEdit || archived} />
              <datalist id="timezone-options">
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz} />
                ))}
              </datalist>
            </Field>
            {!archived && (
              <Field label="Status" htmlFor="status">
                <select id="status" name="status" defaultValue={client.status} className={selectClass} disabled={!canEdit}>
                  {CLIENT_STATUSES.filter((s) => s.value !== 'ARCHIVED').map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Automation mode" htmlFor="automationLevel">
              <select id="automationLevel" name="automationLevel" defaultValue={client.automationLevel} className={selectClass} disabled={!canEdit || archived}>
                {AUTOMATION_LEVELS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Account manager" htmlFor="accountManagerId">
              <select id="accountManagerId" name="accountManagerId" defaultValue={client.accountManagerId ?? ''} className={selectClass} disabled={!canEdit || archived}>
                <option value="">Unassigned</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} · {m.roleName}
                  </option>
                ))}
              </select>
              <FieldError name="accountManagerId" />
            </Field>
            <Field label="Monthly ad budget" htmlFor="monthlyBudget">
              <Input id="monthlyBudget" name="monthlyBudget" type="number" min={0} step="0.01" defaultValue={client.monthlyBudget?.toString() ?? ''} disabled={!canEdit || archived} />
              <FieldError name="monthlyBudget" />
            </Field>
            <Field label="Tags" htmlFor="tags" hint="One per line." className="sm:col-span-2">
              <Textarea id="tags" name="tags" rows={2} defaultValue={client.tags.join('\n')} disabled={!canEdit || archived} />
            </Field>
            <Field label="Description" htmlFor="description" className="sm:col-span-2">
              <Textarea id="description" name="description" rows={2} defaultValue={client.description ?? ''} disabled={!canEdit || archived} />
            </Field>
            {canEdit && !archived && (
              <div className="sm:col-span-2">
                <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
              </div>
            )}
            {archived && <p className="text-sm text-caption sm:col-span-2">Restore this client from the &quot;…&quot; menu above to make changes.</p>}
          </ActionForm>
        </CardContent>
      </Card>

      {/* Contacts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contacts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {contacts.length === 0 ? (
            <p className="text-sm text-caption">No contacts on file yet.</p>
          ) : (
            <ul className="space-y-2">
              {contacts.map((contact) => (
                <li key={contact.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
                  <div>
                    <span className="font-medium text-foreground">{contact.name}</span>
                    {contact.isPrimary && <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">Primary</span>}
                    <p className="text-xs text-caption">{[contact.designation, contact.email, contact.phone].filter(Boolean).join(' · ') || '—'}</p>
                  </div>
                  {canEdit && (
                    <ActionForm action={deleteContactAction.bind(null, clientId, contact.id)}>
                      <SubmitButton variant="ghost" size="sm" pendingLabel="Removing…">
                        <Trash2 className="h-3.5 w-3.5" />
                      </SubmitButton>
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <ActionForm action={addContactAction.bind(null, clientId)} className="grid grid-cols-1 gap-3 rounded-md border border-dashed border-border p-3 sm:grid-cols-5" resetOnSuccess>
              <Field label="Name" htmlFor="contact-name" className="sm:col-span-2">
                <Input id="contact-name" name="name" required placeholder="Full name" />
                <FieldError name="name" />
              </Field>
              <Field label="Email" htmlFor="contact-email">
                <Input id="contact-email" name="email" type="email" placeholder="name@client.com" />
                <FieldError name="email" />
              </Field>
              <Field label="Phone" htmlFor="contact-phone">
                <Input id="contact-phone" name="phone" placeholder="+1 555 0100" />
              </Field>
              <Field label="Designation" htmlFor="contact-designation">
                <Input id="contact-designation" name="designation" placeholder="Role" />
              </Field>
              <div className="flex items-end gap-3 sm:col-span-5">
                <label className="flex items-center gap-1.5 text-sm text-foreground">
                  <input type="checkbox" name="isPrimary" className="h-4 w-4 rounded border-input" /> Primary contact
                </label>
                <SubmitButton variant="outline" size="sm" pendingLabel="Adding…">
                  <Plus className="h-3.5 w-3.5" /> Add contact
                </SubmitButton>
              </div>
            </ActionForm>
          )}
        </CardContent>
      </Card>

      {/* Automation policy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Automation & approval policy</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={updatePolicyAction.bind(null, clientId)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Max daily ad budget" htmlFor="maxDailyAdBudget">
                <Input id="maxDailyAdBudget" name="maxDailyAdBudget" type="number" min={0} step="0.01" defaultValue={policy?.maxDailyAdBudget?.toString() ?? ''} disabled={!canEdit} />
              </Field>
              <Field label="Max budget change per action (%)" htmlFor="maxBudgetChangePercent">
                <Input id="maxBudgetChangePercent" name="maxBudgetChangePercent" type="number" min={0} max={100} defaultValue={policy?.maxBudgetChangePercent?.toString() ?? ''} disabled={!canEdit} />
              </Field>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" name="requireApprovalForCampaignLaunch" defaultChecked={policy?.requireApprovalForCampaignLaunch ?? true} disabled={!canEdit} className="h-4 w-4 rounded border-input" />
                Require human approval before a campaign launches
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" name="autoPublishSocial" defaultChecked={policy?.autoPublishSocial ?? false} disabled={!canEdit} className="h-4 w-4 rounded border-input" />
                Allow social posts to publish automatically once approved
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" name="autoChangeAds" defaultChecked={policy?.autoChangeAds ?? false} disabled={!canEdit} className="h-4 w-4 rounded border-input" />
                Allow ad budget/bid changes to run automatically within limits
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" name="weeklyAutomationEnabled" defaultChecked={policy?.weeklyAutomationEnabled ?? false} disabled={!canEdit} className="h-4 w-4 rounded border-input" />
                Run weekly automated intelligence for this client
              </label>
            </div>
            {canEdit && <SubmitButton pendingLabel="Saving…">Save policy</SubmitButton>}
          </ActionForm>
        </CardContent>
      </Card>

      {/* Danger zone */}
      {canManage && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-4 w-4" /> Danger zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">{archived ? 'Restore this client' : 'Archive this client'}</p>
                <p className="text-xs text-muted-foreground">{archived ? 'Makes the client active again.' : 'Hides the client from lists and stops automation. Nothing is deleted.'}</p>
              </div>
              {archived ? (
                <ConfirmDialog
                  trigger={(open) => <Button type="button" variant="outline" onClick={open}>Restore</Button>}
                  title={`Restore ${client.name}?`}
                  description="The client becomes active again and reappears in lists, dashboards and automation."
                  confirmLabel="Restore client"
                  destructive={false}
                  action={unarchiveClientAction.bind(null, clientId)}
                />
              ) : (
                <ConfirmDialog
                  trigger={(open) => <Button type="button" variant="outline" onClick={open}>Archive</Button>}
                  title={`Archive ${client.name}?`}
                  description="Archiving hides the client from lists and stops scheduled automation. Nothing is deleted - you can restore it at any time."
                  confirmLabel="Archive client"
                  destructive={false}
                  action={archiveClientAction.bind(null, clientId)}
                />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive-bg p-3">
              <div>
                <p className="text-sm font-medium text-destructive">Delete this client</p>
                <p className="text-xs text-destructive/80">Permanently removes the client and everything attached to it. This cannot be undone.</p>
              </div>
              <ConfirmDialog
                trigger={(open) => <Button type="button" variant="destructive" onClick={open}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>}
                title={`Delete ${client.name}?`}
                description={
                  <>
                    This permanently removes the client and everything attached to it - contacts, Client Brain, integrations, recommendations, tasks, reports and content. The audit trail is kept. <strong>This cannot be undone.</strong>
                  </>
                }
                confirmLabel="Delete permanently"
                requireText={client.name}
                action={deleteClientAction.bind(null, clientId)}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
