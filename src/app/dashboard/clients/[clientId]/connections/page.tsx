import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { IntegrationProvider } from '@prisma/client'
import { X } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listIntegrationConnectionsForOrg } from '@/lib/integrations/health'
import { connectClientConnectionAction, disconnectClientConnectionAction } from '../../../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { HEALTH_DOT, HEALTH_LABEL, PROVIDER_LABEL } from '@/components/clients/labels'

/**
 * The Client Workspace's "Connections" tab (2026-09-13, structure-first -
 * see docs/DECISIONS.md): every social/web platform a client might have,
 * in one grid, connectable with just a handle/page name today - no real
 * API/OAuth behind any of these yet ("later i will do api things, first
 * build the structure" was the explicit ask). Ad platforms are shown
 * read-only here since their real connect flows already live on the
 * Integrations tab (`src/lib/integrations/connections.ts` never lets this
 * page touch those providers, so there's no way to clobber a real,
 * credentialed connection with a placeholder label).
 */
const WEB_PROVIDERS: IntegrationProvider[] = ['WEB', 'BLOG']
const SOCIAL_PROVIDERS: IntegrationProvider[] = [
  'FACEBOOK',
  'INSTAGRAM',
  'THREADS',
  'TWITTER_X',
  'BLUESKY',
  'LINKEDIN',
  'PINTEREST',
  'TIKTOK_PERSONAL',
  'TIKTOK_BUSINESS',
  'GOOGLE_BUSINESS_PROFILE',
]
const AD_PROVIDERS: IntegrationProvider[] = ['META_ADS', 'GOOGLE_ADS', 'AMAZON_ADS', 'TIKTOK_ADS']

type Connection = Awaited<ReturnType<typeof listIntegrationConnectionsForOrg>>[number]

export default async function ClientConnectionsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const [{ clientId }, ctx] = await Promise.all([params, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const connections = await listIntegrationConnectionsForOrg(ctx, { clientId })
  const byProvider = new Map(connections.map((c) => [c.integrationAccount.integration.provider, c]))
  const canManage = ctx.permissions.has('integrations.manage')

  return (
    <div className="space-y-4">
      <p className="text-sm text-caption">
        Every platform this client is on, in one place. Connecting here just records the account for now - live syncing comes later, per platform, once each is wired up.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Web &amp; blog</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {WEB_PROVIDERS.map((provider) => (
              <ConnectionCard key={provider} clientId={clientId} provider={provider} connection={byProvider.get(provider)} canManage={canManage} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Social accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SOCIAL_PROVIDERS.map((provider) => (
              <ConnectionCard key={provider} clientId={clientId} provider={provider} connection={byProvider.get(provider)} canManage={canManage} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ad accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-caption">Connected from the Integrations tab - shown here for a single overview.</p>
          <ul className="space-y-2">
            {AD_PROVIDERS.map((provider) => {
              const connection = byProvider.get(provider)
              return (
                <li key={provider} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <span className="font-medium text-foreground">{PROVIDER_LABEL[provider]}</span>
                  <div className="flex items-center gap-3">
                    {connection ? (
                      <span className="flex items-center gap-1.5 text-xs text-caption">
                        <span className={`h-1.5 w-1.5 rounded-full ${HEALTH_DOT[connection.status]}`} />
                        {connection.integrationAccount.label ?? connection.integrationAccount.externalAccountId}
                      </span>
                    ) : (
                      <span className="text-xs text-caption">Not connected</span>
                    )}
                    <Link href={`/dashboard/clients/${clientId}/integrations`} className="text-xs font-medium text-primary hover:underline">
                      Manage →
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function ConnectionCard({
  clientId,
  provider,
  connection,
  canManage,
}: {
  clientId: string
  provider: IntegrationProvider
  connection: Connection | undefined
  canManage: boolean
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{PROVIDER_LABEL[provider]}</span>
        {connection && (
          <span className={`h-2 w-2 shrink-0 rounded-full ${HEALTH_DOT[connection.status]}`} title={HEALTH_LABEL[connection.status]} />
        )}
      </div>

      {connection ? (
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm text-caption">{connection.integrationAccount.label ?? connection.integrationAccount.externalAccountId}</span>
          {canManage && (
            <ActionForm action={disconnectClientConnectionAction.bind(null, clientId, provider)}>
              <SubmitButton variant="ghost" size="sm" pendingLabel="…" aria-label={`Disconnect ${PROVIDER_LABEL[provider]}`}>
                <X className="h-3.5 w-3.5" />
              </SubmitButton>
            </ActionForm>
          )}
        </div>
      ) : canManage ? (
        <ActionForm action={connectClientConnectionAction.bind(null, clientId, provider)} className="flex items-center gap-2" resetOnSuccess>
          <Input name="label" placeholder="Page name or handle" className="h-8 text-xs" required maxLength={200} />
          <SubmitButton size="sm" variant="outline" pendingLabel="…">
            Connect
          </SubmitButton>
        </ActionForm>
      ) : (
        <span className="text-xs text-caption">Not connected</span>
      )}
    </div>
  )
}
