import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  Sparkles,
  Search,
  Users2,
  Plug,
  Lightbulb,
  CheckSquare,
  ShieldCheck,
  FileText,
  Bot,
  SlidersHorizontal,
  ChevronLeft,
  CalendarDays,
  Image as ImageIcon,
} from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getAuthorizedClient } from '@/lib/db/tenant'
import { listAiRuns } from '@/lib/ai/runs'
import { getClientPolicy, listClientCompetitors } from '@/lib/clients/brain'
import { listContentCalendarItems } from '@/lib/content-calendar/persist'
import { listCreativeAssets } from '@/lib/creative/persist'
import { listIntegrationConnectionsForOrg } from '@/lib/integrations/health'
import { listRecommendations } from '@/lib/recommendations/persist'
import { listTasks } from '@/lib/recommendations/tasks'
import { listApprovals } from '@/lib/approvals/approvals'
import { listReports } from '@/lib/reports/generate'
import { ForbiddenError } from '@/lib/rbac/errors'
import {
  addCompetitorAction,
  connectCanvaAccountAction,
  connectGoogleAdsAccountAction,
  connectMetaAdsAccountAction,
  connectMetricoolBrandAction,
  createContentItemAction,
  triggerAnalyzeClientAction,
  triggerCompetitorAnalysisAction,
  triggerCreativeWorkflowAction,
  triggerSeoAnalysisAction,
  updateWeeklyAutomationAction,
} from '../../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, StatusBadge, toSentenceCase } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * Client detail: the "Analyze Client A" trigger (BRD Section 46/43 - "the
 * user should be able to type 'Analyze Client A's marketing performance'"
 * -  a button is the MVP's non-natural-language stand-in, BRD Section 44's
 * command layer is Phase 2) plus that client's recommendations, tasks,
 * approvals, reports, and integration status.
 */
export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  let client
  try {
    client = await getAuthorizedClient(ctx, clientId)
  } catch (error) {
    if (error instanceof ForbiddenError) notFound()
    throw error
  }

  const [policy, recommendations, tasks, approvals, reports, allConnections, aiRuns, contentItems, creativeAssets, competitors] =
    await Promise.all([
      getClientPolicy(ctx, clientId),
      listRecommendations(ctx, clientId),
      listTasks(ctx, clientId),
      listApprovals(ctx, { clientId }),
      listReports(ctx, clientId),
      listIntegrationConnectionsForOrg(ctx),
      listAiRuns(ctx, { clientId, limit: 10 }),
      listContentCalendarItems(ctx, clientId),
      listCreativeAssets(ctx, clientId),
      listClientCompetitors(ctx, clientId),
    ])
  const connections = allConnections.filter((c) => c.clientId === clientId)
  const canManageIntegrations = ctx.permissions.has('integrations.manage')
  const canTriggerAnalysis = ctx.permissions.has('analysis.trigger')
  const canManageContent = ctx.permissions.has('content.manage')
  const canManageCreative = ctx.permissions.has('creative.manage')
  const canEditClient = ctx.permissions.has('clients.edit')
  const approvedCreativeAssets = creativeAssets.filter((a) => a.status === 'APPROVED')

  return (
    <div className="space-y-6">
      <Link href="/dashboard/clients" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3.5 w-3.5" /> Clients
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-base font-medium text-accent-foreground">
            {client.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-foreground">{client.name}</h1>
            <div className="mt-1 flex items-center gap-1.5">
              <Badge variant={client.status === 'ACTIVE' ? 'success' : 'neutral'}>{toSentenceCase(client.status)}</Badge>
              <Badge variant="neutral">Automation: {toSentenceCase(client.automationLevel)}</Badge>
            </div>
          </div>
        </div>
        {canTriggerAnalysis && (
          <div className="flex flex-wrap gap-2">
            <form action={triggerCompetitorAnalysisAction.bind(null, clientId)}>
              <Button type="submit" variant="outline" size="lg">
                <Users2 className="h-4 w-4" /> Run competitor analysis
              </Button>
            </form>
            <form action={triggerSeoAnalysisAction.bind(null, clientId)}>
              <Button type="submit" variant="outline" size="lg">
                <Search className="h-4 w-4" /> Run SEO analysis
              </Button>
            </form>
            <form action={triggerAnalyzeClientAction.bind(null, clientId)}>
              <Button type="submit" size="lg">
                <Sparkles className="h-4 w-4" /> Analyze this client
              </Button>
            </form>
          </div>
        )}
      </div>

      {policy && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" /> Policy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <dt className="text-xs text-caption">Max daily ad budget</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{policy.maxDailyAdBudget?.toString() ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-caption">Auto-publish social</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{policy.autoPublishSocial ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt className="text-xs text-caption">Auto-change ads</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{policy.autoChangeAds ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt className="text-xs text-caption">Approval for launches</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{policy.requireApprovalForCampaignLaunch ? 'Required' : 'Not required'}</dd>
              </div>
              <div>
                <dt className="text-xs text-caption">Weekly automated intelligence</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{policy.weeklyAutomationEnabled ? 'Enabled' : 'Disabled'}</dd>
              </div>
            </dl>
            {canEditClient && (
              <form action={updateWeeklyAutomationAction.bind(null, clientId)} className="mt-4 flex items-center gap-2 rounded-md border border-dashed border-border p-3">
                <input
                  id="weeklyAutomationEnabled"
                  name="weeklyAutomationEnabled"
                  type="checkbox"
                  defaultChecked={policy.weeklyAutomationEnabled}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="weeklyAutomationEnabled" className="mb-0 text-sm text-foreground">
                  Run weekly automated intelligence for this client
                </Label>
                <Button type="submit" variant="outline" size="sm" className="ml-auto">
                  Save
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plug className="h-4 w-4 text-muted-foreground" /> Integrations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {connections.length === 0 ? (
            <EmptyState icon={Plug} title="No integrations connected" />
          ) : (
            <ul className="space-y-2">
              {connections.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <span className="font-medium">{c.integrationAccount.integration.provider}</span>
                  <div className="flex items-center gap-2">
                    {c.lastErrorMessage && <span className="text-xs text-destructive">{c.lastErrorMessage}</span>}
                    <StatusBadge status={c.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {canManageIntegrations && (
            <form action={connectMetricoolBrandAction.bind(null, clientId)} className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3">
              <div>
                <Label htmlFor="brandId">Metricool brand id</Label>
                <Input id="brandId" name="brandId" type="text" required placeholder="e.g. 6818704" className="w-44" />
              </div>
              <div>
                <Label htmlFor="label">Label (optional)</Label>
                <Input id="label" name="label" type="text" className="w-44" />
              </div>
              <Button type="submit" variant="outline">
                Connect Metricool brand
              </Button>
            </form>
          )}
          {canManageIntegrations && (
            <form action={connectGoogleAdsAccountAction.bind(null, clientId)} className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3">
              <div>
                <Label htmlFor="googleAdsAccountId">Google Ads customer id</Label>
                <Input id="googleAdsAccountId" name="externalAccountId" type="text" required placeholder="e.g. 123-456-7890" className="w-44" />
              </div>
              <div>
                <Label htmlFor="googleAdsLabel">Label (optional)</Label>
                <Input id="googleAdsLabel" name="label" type="text" className="w-44" />
              </div>
              <Button type="submit" variant="outline">
                Connect Google Ads account
              </Button>
            </form>
          )}
          {canManageIntegrations && (
            <form action={connectMetaAdsAccountAction.bind(null, clientId)} className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3">
              <div>
                <Label htmlFor="metaAdsAccountId">Meta Ads account id</Label>
                <Input id="metaAdsAccountId" name="externalAccountId" type="text" required placeholder="e.g. act_123456789" className="w-44" />
              </div>
              <div>
                <Label htmlFor="metaAdsLabel">Label (optional)</Label>
                <Input id="metaAdsLabel" name="label" type="text" className="w-44" />
              </div>
              <Button type="submit" variant="outline">
                Connect Meta Ads account
              </Button>
            </form>
          )}
          {canManageIntegrations && (
            <form action={connectCanvaAccountAction.bind(null, clientId)} className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3">
              <div>
                <Label htmlFor="canvaAccountId">Canva brand id</Label>
                <Input id="canvaAccountId" name="externalAccountId" type="text" required placeholder="e.g. BAmockbrand" className="w-44" />
              </div>
              <div>
                <Label htmlFor="canvaLabel">Label (optional)</Label>
                <Input id="canvaLabel" name="label" type="text" className="w-44" />
              </div>
              <Button type="submit" variant="outline">
                Connect Canva brand
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-muted-foreground" /> Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recommendations.length === 0 ? (
            <EmptyState icon={Lightbulb} title="None yet" description="Run an analysis above to generate recommendations." />
          ) : (
            <ul className="space-y-3">
              {recommendations.map((rec) => (
                <li key={rec.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={rec.priority} />
                      <span className="text-sm font-medium text-foreground">{rec.area}</span>
                    </div>
                    <StatusBadge status={rec.status} />
                  </div>
                  <p className="mt-2 text-sm text-foreground">{rec.finding}</p>
                  <p className="mt-1 text-sm text-muted-foreground">→ {rec.recommendation}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckSquare className="h-4 w-4 text-muted-foreground" /> Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <EmptyState icon={CheckSquare} title="No tasks" />
            ) : (
              <ul className="divide-y divide-border">
                {tasks.map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                    <span className="text-sm text-foreground">{task.title}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <StatusBadge status={task.priority} />
                      <StatusBadge status={task.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {approvals.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="No approval requests" />
            ) : (
              <ul className="divide-y divide-border">
                {approvals.map((approval) => (
                  <li key={approval.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                    <span className="text-sm text-foreground">{approval.actionSummary}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <StatusBadge status={approval.riskLevel} />
                      <StatusBadge status={approval.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-muted-foreground" /> Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <EmptyState icon={FileText} title="No reports generated yet" />
            ) : (
              <ul className="divide-y divide-border">
                {reports.map((report) => (
                  <li key={report.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                    <Link href={`/dashboard/reports/${report.id}`} className="truncate text-sm text-foreground hover:text-primary">
                      {report.title}
                    </Link>
                    <Badge variant="neutral" className="shrink-0">
                      {toSentenceCase(report.type)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-muted-foreground" /> AI runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aiRuns.length === 0 ? (
              <EmptyState icon={Bot} title="No AI runs yet" />
            ) : (
              <ul className="divide-y divide-border">
                {aiRuns.map((run) => (
                  <li key={run.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                    <span className="text-sm text-foreground">{run.model}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <StatusBadge status={run.status} />
                      <span className="text-xs tabular-nums text-caption">{run.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="h-4 w-4 text-muted-foreground" /> Creatives
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {creativeAssets.length === 0 ? (
            <EmptyState icon={ImageIcon} title="No creative concepts yet" />
          ) : (
            <ul className="divide-y divide-border">
              {creativeAssets.map((asset) => (
                <li key={asset.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{asset.copy?.split('\n')[0] || asset.platform || 'Untitled'}</p>
                    <p className="text-xs text-caption">{asset.platform}</p>
                  </div>
                  <StatusBadge status={asset.status} className="shrink-0" />
                </li>
              ))}
            </ul>
          )}
          {canManageCreative && (
            <form action={triggerCreativeWorkflowAction.bind(null, clientId)} className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3">
              <div>
                <Label htmlFor="creativePlatform">Platform</Label>
                <Input id="creativePlatform" name="platform" type="text" required defaultValue="instagram" className="w-32" />
              </div>
              <div>
                <Label htmlFor="creativeCount">Count</Label>
                <Input id="creativeCount" name="count" type="number" min={1} max={10} required defaultValue={3} className="w-20" />
              </div>
              <div className="min-w-[14rem] flex-1">
                <Label htmlFor="campaignBrief">Campaign brief</Label>
                <Input id="campaignBrief" name="campaignBrief" type="text" required placeholder="e.g. the recommended spring promotion" />
              </div>
              <Button type="submit" variant="outline">
                <Sparkles className="h-3.5 w-3.5" /> Generate concepts
              </Button>
            </form>
          )}
          <p className="text-xs text-caption">
            Review, generate designs, and approve from the <Link href="/dashboard/creatives" className="text-primary hover:underline">creatives</Link> page.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-muted-foreground" /> Content calendar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {contentItems.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Nothing planned yet" />
          ) : (
            <ul className="divide-y divide-border">
              {contentItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{item.caption || item.platform}</p>
                    <p className="text-xs tabular-nums text-caption">
                      {item.platform} · {item.publishDate.toISOString().slice(0, 10)}
                    </p>
                  </div>
                  <StatusBadge status={item.status} className="shrink-0" />
                </li>
              ))}
            </ul>
          )}
          {canManageContent && (
            <form action={createContentItemAction.bind(null, clientId)} className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3">
              <div>
                <Label htmlFor="platform">Platform</Label>
                <Input id="platform" name="platform" type="text" required placeholder="e.g. instagram" className="w-36" />
              </div>
              <div>
                <Label htmlFor="publishDate">Publish date</Label>
                <Input id="publishDate" name="publishDate" type="date" required className="w-40" />
              </div>
              <div className="min-w-[14rem] flex-1">
                <Label htmlFor="caption">Caption</Label>
                <Input id="caption" name="caption" type="text" placeholder="Post copy…" />
              </div>
              {approvedCreativeAssets.length > 0 && (
                <div>
                  <Label htmlFor="creativeAssetId">Creative (optional)</Label>
                  <select
                    id="creativeAssetId"
                    name="creativeAssetId"
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">None</option>
                    {approvedCreativeAssets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.copy?.split('\n')[0]?.slice(0, 40) || asset.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <Button type="submit" variant="outline">
                Add to calendar
              </Button>
            </form>
          )}
          <p className="text-xs text-caption">
            Review, approve, and schedule from the <Link href="/dashboard/content-calendar" className="text-primary hover:underline">content calendar</Link> page.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users2 className="h-4 w-4 text-muted-foreground" /> Competitors
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {competitors.length === 0 ? (
            <EmptyState icon={Users2} title="No competitors on file" description="Add one below, then run a competitor analysis above." />
          ) : (
            <ul className="space-y-2">
              {competitors.map((competitor) => (
                <li key={competitor.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{competitor.name}</span>
                    {competitor.url && (
                      <a href={competitor.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                        {competitor.url}
                      </a>
                    )}
                  </div>
                  {competitor.positioning && <p className="mt-1 text-sm text-muted-foreground">{competitor.positioning}</p>}
                  {competitor.observations && <p className="mt-1 text-xs text-caption">{competitor.observations}</p>}
                </li>
              ))}
            </ul>
          )}
          {canEditClient && (
            <form action={addCompetitorAction.bind(null, clientId)} className="space-y-3 rounded-md border border-dashed border-border p-3">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label htmlFor="competitorName">Name</Label>
                  <Input id="competitorName" name="name" type="text" required placeholder="e.g. Acme Rivals" className="w-44" />
                </div>
                <div>
                  <Label htmlFor="competitorUrl">URL</Label>
                  <Input id="competitorUrl" name="url" type="url" placeholder="https://…" className="w-56" />
                </div>
                <div className="min-w-[14rem] flex-1">
                  <Label htmlFor="competitorPositioning">Positioning</Label>
                  <Input id="competitorPositioning" name="positioning" type="text" placeholder="e.g. Premium, enterprise-focused" />
                </div>
              </div>
              <div>
                <Label htmlFor="competitorObservations">Observations</Label>
                <Input id="competitorObservations" name="observations" type="text" placeholder="Anything worth noting…" />
              </div>
              <Button type="submit" variant="outline">
                Add competitor
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
