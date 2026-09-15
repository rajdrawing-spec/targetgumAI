import { redirect } from 'next/navigation'
import { Plug, ExternalLink, RefreshCw } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listIntegrationConnectionsForOrg } from '@/lib/integrations/health'
import { isGoogleIntegrationConfigured } from '@/lib/integrations/google/oauth'
import {
  connectAmazonAdsAccountAction,
  connectCanvaAccountAction,
  connectGoogleAdsAccountAction,
  connectMetaAdsAccountAction,
  connectMetricoolBrandAction,
  syncClientMetaAdsAction,
} from '../../../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Input, Label } from '@/components/ui/input'
import { ActionForm, FieldError, SubmitButton } from '@/components/ui/action-form'
import { EmptyState } from '@/components/ui/empty-state'
import { PROVIDER_LABEL } from '@/components/clients/labels'
import { formatDateTime } from '@/lib/format'

export default async function ClientIntegrationsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const [{ clientId }, ctx] = await Promise.all([params, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const connections = await listIntegrationConnectionsForOrg(ctx, { clientId })
  const canManage = ctx.permissions.has('integrations.manage')
  const ga4Configured = isGoogleIntegrationConfigured('GA4')
  const gscConfigured = isGoogleIntegrationConfigured('GOOGLE_SEARCH_CONSOLE')

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plug className="h-4 w-4 text-muted-foreground" /> Connected accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <EmptyState icon={Plug} title="Nothing connected yet" description="Connect an account below to start pulling real data for this client." />
          ) : (
            <ul className="space-y-2">
              {connections.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium text-foreground">{PROVIDER_LABEL[c.integrationAccount.integration.provider]}</span>
                    <span className="ml-2 text-xs text-caption">{c.integrationAccount.label ?? c.integrationAccount.externalAccountId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.lastErrorMessage && <span className="text-xs text-destructive">{c.lastErrorMessage}</span>}
                    <span className="text-xs text-caption">{c.status === 'CONNECTED' ? `Synced ${formatDateTime(c.lastSuccessfulSyncAt)}` : ''}</span>
                    <StatusBadge status={c.status} />
                    {c.integrationAccount.integration.provider === 'META_ADS' && canManage && (
                      <ActionForm action={syncClientMetaAdsAction.bind(null, clientId, c.id)} className="inline">
                        <SubmitButton variant="outline" size="sm" pendingLabel="Syncing...">
                          <RefreshCw className="h-3 w-3 mr-1" /> Sync Live Data
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connect an account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ActionForm action={connectMetricoolBrandAction.bind(null, clientId)} className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3">
              <div>
                <div className="mb-1.5 flex items-center gap-2">
                  <Label htmlFor="brandId" className="mb-0">Metricool brand id</Label>
                  <a
                    href="https://app.metricool.com/brands"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Open Metricool <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Input id="brandId" name="brandId" type="text" required placeholder="e.g. 6818704" className="w-44" />
                <FieldError name="externalAccountId" />
                <p className="mt-1 text-xs text-caption">Find it in Metricool under the brand&apos;s Settings, or in the dashboard URL.</p>
              </div>
              <div>
                <Label htmlFor="label-metricool">Label (optional)</Label>
                <Input id="label-metricool" name="label" type="text" className="w-44" />
              </div>
              <SubmitButton variant="outline" pendingLabel="Connecting…">Connect Metricool</SubmitButton>
            </ActionForm>

            <ActionForm action={connectGoogleAdsAccountAction.bind(null, clientId)} className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3">
              <div>
                <Label htmlFor="googleAdsAccountId">Google Ads customer id</Label>
                <Input id="googleAdsAccountId" name="externalAccountId" type="text" required placeholder="e.g. 123-456-7890" className="w-44" />
                <FieldError name="externalAccountId" />
              </div>
              <div>
                <Label htmlFor="label-gads">Label (optional)</Label>
                <Input id="label-gads" name="label" type="text" className="w-44" />
              </div>
              <SubmitButton variant="outline" pendingLabel="Connecting…">Connect Google Ads</SubmitButton>
            </ActionForm>

            <ActionForm action={connectAmazonAdsAccountAction.bind(null, clientId)} className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3">
              <div>
                <Label htmlFor="amazonAdsProfileId">Amazon Ads advertiser profile id</Label>
                <Input id="amazonAdsProfileId" name="externalAccountId" type="text" required placeholder="e.g. 3054123456789" className="w-44" />
                <FieldError name="externalAccountId" />
                <p className="mt-1 text-xs text-caption">Sponsored Products only. Find it in Amazon Ads console under Settings → Account access.</p>
              </div>
              <div>
                <Label htmlFor="label-amzn">Label (optional)</Label>
                <Input id="label-amzn" name="label" type="text" className="w-44" />
              </div>
              <SubmitButton variant="outline" pendingLabel="Connecting…">Connect Amazon Ads</SubmitButton>
            </ActionForm>

            {/* Meta Marketing API (Graph API version - see META_GRAPH_API_VERSION) */}
            <ActionForm action={connectMetaAdsAccountAction.bind(null, clientId)} className="rounded-md border border-dashed border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-foreground text-sm">Meta Ads</span>
                  <span className="ml-2 text-xs text-caption">(Facebook & Instagram Marketing API)</span>
                </div>
                <a
                  href="https://developers.facebook.com/tools/explorer/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Meta Graph Explorer <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                <div>
                  <Label htmlFor="metaAdsAccountId">Meta Ad Account ID</Label>
                  <Input id="metaAdsAccountId" name="externalAccountId" type="text" required placeholder="act_123456789 or 123456789" />
                  <FieldError name="externalAccountId" />
                  <p className="mt-1 text-[11px] text-caption">Found in Meta Ads Manager URL or Ad Account settings.</p>
                </div>
                <div>
                  <Label htmlFor="metaAccessToken">Meta Access Token</Label>
                  <Input id="metaAccessToken" name="accessToken" type="password" placeholder="EAAB... (or set via .env.local)" />
                  <FieldError name="accessToken" />
                  <p className="mt-1 text-[11px] text-caption">Needs `ads_read` & `read_insights`. Encrypted safely at rest.</p>
                </div>
                <div>
                  <Label htmlFor="label-meta">Label (optional)</Label>
                  <Input id="label-meta" name="label" type="text" placeholder="e.g. Primary US Account" />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <SubmitButton variant="outline" pendingLabel="Connecting & Syncing…">Connect Meta Ads & Sync</SubmitButton>
              </div>
            </ActionForm>

            <ActionForm action={connectCanvaAccountAction.bind(null, clientId)} className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3">
              <div>
                <Label htmlFor="canvaAccountId">Canva brand id</Label>
                <Input id="canvaAccountId" name="externalAccountId" type="text" required placeholder="e.g. BAmockbrand" className="w-44" />
                <FieldError name="externalAccountId" />
              </div>
              <div>
                <Label htmlFor="label-canva">Label (optional)</Label>
                <Input id="label-canva" name="label" type="text" className="w-44" />
              </div>
              <SubmitButton variant="outline" pendingLabel="Connecting…">Connect Canva</SubmitButton>
            </ActionForm>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
              <span>Google Analytics 4 (OAuth)</span>
              <span className="text-xs text-caption">{ga4Configured ? 'Coming soon - not wired to a connect flow yet' : 'Not configured on this deployment'}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
              <span>Google Search Console (OAuth)</span>
              <span className="text-xs text-caption">{gscConfigured ? 'Coming soon - not wired to a connect flow yet' : 'Not configured on this deployment'}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
