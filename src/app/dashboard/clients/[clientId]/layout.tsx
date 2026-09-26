import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getAuthorizedClientCached } from '@/lib/db/tenant'
import { ForbiddenError } from '@/lib/rbac/errors'
import { Badge, toSentenceCase } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { WorkspaceTabs } from '@/components/clients/workspace-tabs'
import { RememberClient } from '@/components/clients/remember-client'
import { ClientRowActions } from '@/components/clients/client-row-actions'
import { AUTOMATION_LABEL } from '@/components/clients/labels'
import { displayHost, initials } from '@/lib/format'

/**
 * The Client Workspace shell (docs/UX-ASSESSMENT.md §10): one header with
 * client identity/status/quick actions, and tab navigation that keeps the
 * client in context across Overview/Business/Brand/Audience/Marketing/
 * Integrations/Settings. Every tab page re-derives its own auth context
 * (cheap - React `cache()`d) and reads the same client row via
 * `getAuthorizedClientCached`, deduped per request.
 */
export default async function ClientWorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ clientId: string }> }) {
  const [{ clientId }, ctx] = await Promise.all([params, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  let client
  try {
    client = await getAuthorizedClientCached(ctx, clientId)
  } catch (error) {
    if (error instanceof ForbiddenError) notFound()
    throw error
  }

  const canEdit = ctx.permissions.has('clients.edit')
  const canManage = ctx.permissions.has('clients.manage')
  const host = displayHost(client.website)

  return (
    // pb: room for the mobile bottom bar (WorkspaceTabs) below md.
    <div className="space-y-5 pb-20 md:pb-0">
      <Link href="/dashboard/clients" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3.5 w-3.5" /> Clients
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-base font-medium text-accent-foreground">
            {initials(client.name)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-medium tracking-tight text-foreground">{client.name}</h1>
              {client.status === 'ARCHIVED' && <Badge variant="neutral">Archived</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[client.industry, host].filter(Boolean).join(' · ') || 'No industry or website on file yet'}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {client.status !== 'ARCHIVED' && <Badge variant={client.status === 'ACTIVE' ? 'success' : 'neutral'}>{toSentenceCase(client.status)}</Badge>}
              <Badge variant="neutral">{AUTOMATION_LABEL[client.automationLevel]}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Link href={`/dashboard/clients/${client.id}/settings`} className={buttonVariants({ variant: 'outline' })}>
              Edit client
            </Link>
          )}
          <ClientRowActions client={client} canEdit={canEdit} canManage={canManage} />
        </div>
      </div>

      <RememberClient clientId={client.id} />
      <WorkspaceTabs clientId={client.id} />

      {children}
    </div>
  )
}
