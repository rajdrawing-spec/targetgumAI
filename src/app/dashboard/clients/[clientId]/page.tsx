import Link from 'next/link'
import { redirect } from 'next/navigation'
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
  CalendarDays,
  ArrowUpRight,
  Plus,
  ShoppingBag,
  BarChart3,
} from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getAuthorizedClientCached } from '@/lib/db/tenant'
import { listClientCompetitors } from '@/lib/clients/brain'
import { listContentCalendarItems } from '@/lib/content-calendar/persist'
import { listIntegrationConnectionsForOrg } from '@/lib/integrations/health'
import { listRecommendations } from '@/lib/recommendations/persist'
import { listTasks } from '@/lib/recommendations/tasks'
import { listApprovals } from '@/lib/approvals/approvals'
import { listReports } from '@/lib/reports/generate'
import { listAiRuns } from '@/lib/ai/runs'
import {
  addCompetitorAction,
  triggerAnalyzeClientAction,
  triggerCompetitorAnalysisAction,
  triggerSeoAnalysisAction,
} from '../../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { ActionForm, FieldError, SubmitButton } from '@/components/ui/action-form'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { GenerateConceptsDialog } from '@/components/creative/generate-concepts-dialog'
import { HEALTH_DOT, HEALTH_LABEL, PROVIDER_LABEL } from '@/components/clients/labels'
import { formatDate, formatDateTime, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Client Overview (docs/UX-ASSESSMENT.md §11): the operational command
 * center for one client - what's connected, what needs attention, what
 * just happened, what's coming up. Business/Brand/Audience/Marketing/
 * Integrations/Settings each own their own tab; Recommendations, Tasks,
 * Approvals, Reports, AI Runs and Content are shown here trimmed to what
 * concerns *this* client, each linking to its full org-wide page (which
 * now has working filters/actions of its own).
 */
export default async function ClientOverviewPage({ params }: { params: Promise<{ clientId: string }> }) {
  const [{ clientId }, ctx] = await Promise.all([params, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')
  const client = await getAuthorizedClientCached(ctx, clientId)

  const [recommendations, tasks, approvals, reports, connections, aiRuns, contentItems, competitors] = await Promise.all([
    listRecommendations(ctx, clientId, { status: 'RECOMMENDED', limit: 5 }),
    listTasks(ctx, clientId, { status: 'OPEN' }),
    listApprovals(ctx, { clientId, status: 'PENDING' }),
    listReports(ctx, clientId, { limit: 5 }),
    listIntegrationConnectionsForOrg(ctx, { clientId }),
    listAiRuns(ctx, { clientId, limit: 5 }),
    listContentCalendarItems(ctx, clientId, { status: undefined, limit: 5 }),
    listClientCompetitors(ctx, clientId),
  ])
  const canTriggerAnalysis = ctx.permissions.has('analysis.trigger')
  const canEditClient = ctx.permissions.has('clients.edit')
  const upcomingContent = contentItems.filter((c) => c.publishDate >= new Date(Date.now() - 86_400_000)).slice(0, 5)
  const integrationIssues = connections.filter((c) => c.status !== 'CONNECTED')
  const attentionCount = approvals.length + recommendations.length + integrationIssues.length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/dashboard/ads/new?clientId=${clientId}`}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Create Ad Set
        </Link>
        <Link
          href={`/dashboard/ads/new?clientId=${clientId}&platform=AMAZON_ADS`}
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
        >
          <ShoppingBag className="h-3.5 w-3.5 text-amber-600" /> Amazon PPC
        </Link>
        <Link
          href={`/dashboard/ads/analytics?clientId=${clientId}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
        >
          <BarChart3 className="h-3.5 w-3.5 text-primary" /> Ad Telemetry
        </Link>

        {canTriggerAnalysis && (
          <>
            <ActionForm action={triggerCompetitorAnalysisAction.bind(null, clientId)}>
              <SubmitButton variant="outline" size="sm" pendingLabel="Analyzing competitors…">
                <Users2 className="h-3.5 w-3.5" /> Competitor analysis
              </SubmitButton>
            </ActionForm>
            <ActionForm action={triggerSeoAnalysisAction.bind(null, clientId)}>
              <SubmitButton variant="outline" size="sm" pendingLabel="Running SEO analysis…">
                <Search className="h-3.5 w-3.5" /> SEO analysis
              </SubmitButton>
            </ActionForm>
            <ActionForm action={triggerAnalyzeClientAction.bind(null, clientId)}>
              <SubmitButton size="sm" pendingLabel="Analyzing…">
                <Sparkles className="h-3.5 w-3.5" /> AI Client Audit
              </SubmitButton>
            </ActionForm>
            <GenerateConceptsDialog clientId={clientId} />
          </>
        )}
      </div>

      {/* Attention */}
      <Card className={attentionCount > 0 ? 'border-warning/30' : undefined}>
        <CardHeader>
          <CardTitle className="text-base">{attentionCount > 0 ? `${attentionCount} item${attentionCount === 1 ? '' : 's'} need attention` : 'Nothing needs attention'}</CardTitle>
        </CardHeader>
        {attentionCount > 0 && (
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {approvals.length > 0 && (
              <Link href="/dashboard/approvals" className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-muted">
                <span className="text-foreground">{approvals.length} approval{approvals.length === 1 ? '' : 's'} pending</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            )}
            {recommendations.length > 0 && (
              <Link href="/dashboard/recommendations" className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-muted">
                <span className="text-foreground">{recommendations.length} recommendation{recommendations.length === 1 ? '' : 's'} to review</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            )}
            {integrationIssues.length > 0 && (
              <Link href={`/dashboard/clients/${clientId}/integrations`} className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-muted">
                <span className="text-foreground">{integrationIssues.length} integration{integrationIssues.length === 1 ? '' : 's'} need attention</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            )}
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Integration health */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Plug className="h-4 w-4 text-muted-foreground" /> Integration health
            </CardTitle>
            <Link href={`/dashboard/clients/${clientId}/integrations`} className="text-xs font-medium text-primary hover:underline">
              Manage
            </Link>
          </CardHeader>
          <CardContent>
            {connections.length === 0 ? (
              <EmptyState icon={Plug} title="Nothing connected" description="Connect Metricool, Google Ads, Meta Ads or Canva from the Integrations tab." />
            ) : (
              <ul className="space-y-1.5">
                {connections.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 text-foreground">
                      <span className={cn('h-2 w-2 rounded-full', HEALTH_DOT[c.status])} />
                      {PROVIDER_LABEL[c.integrationAccount.integration.provider]}
                    </span>
                    <span className="text-xs text-caption">
                      {c.status === 'CONNECTED' ? `Synced ${formatRelative(c.lastSuccessfulSyncAt)}` : HEALTH_LABEL[c.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-muted-foreground" /> Recent activity
            </CardTitle>
            <Link href="/dashboard/ai-runs" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {aiRuns.length === 0 ? (
              <EmptyState icon={Bot} title="No AI runs yet" description="Choose Analyze this client above to generate one." />
            ) : (
              <ul className="divide-y divide-border">
                {aiRuns.map((run) => (
                  <li key={run.id} className="flex items-center justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0">
                    <span className="text-foreground">{run.model}</span>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={run.status} />
                      <span className="text-xs tabular-nums text-caption">{formatRelative(run.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-muted-foreground" /> Recommendations to review
            </CardTitle>
            <Link href="/dashboard/recommendations" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recommendations.length === 0 ? (
              <EmptyState icon={Lightbulb} title="Nothing to review" />
            ) : (
              <ul className="space-y-2">
                {recommendations.map((rec) => (
                  <li key={rec.id} className="rounded-md border border-border p-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={rec.priority} />
                      <span className="font-medium text-foreground">{rec.area}</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{rec.finding}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckSquare className="h-4 w-4 text-muted-foreground" /> Open tasks
            </CardTitle>
            <Link href="/dashboard/tasks" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <EmptyState icon={CheckSquare} title="No open tasks" />
            ) : (
              <ul className="divide-y divide-border">
                {tasks.map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0">
                    <span className="text-foreground">{task.title}</span>
                    <StatusBadge status={task.priority} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Pending approvals
            </CardTitle>
            <Link href="/dashboard/approvals" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {approvals.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="No pending approvals" />
            ) : (
              <ul className="divide-y divide-border">
                {approvals.map((approval) => (
                  <li key={approval.id} className="flex items-center justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0">
                    <span className="truncate text-foreground">{approval.actionSummary}</span>
                    <StatusBadge status={approval.riskLevel} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-muted-foreground" /> Upcoming content
            </CardTitle>
            <Link href="/dashboard/content-calendar" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {upcomingContent.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Nothing scheduled" />
            ) : (
              <ul className="divide-y divide-border">
                {upcomingContent.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0">
                    <span className="truncate text-foreground">{item.caption || item.platform}</span>
                    <span className="text-xs tabular-nums text-caption">{formatDate(item.publishDate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-muted-foreground" /> Reports
          </CardTitle>
          <Link href="/dashboard/reports" className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <EmptyState icon={FileText} title="No reports yet" />
          ) : (
            <ul className="divide-y divide-border">
              {reports.map((report) => (
                <li key={report.id} className="flex items-center justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0">
                  <Link href={`/dashboard/reports/${report.id}`} className="truncate text-foreground hover:text-primary">
                    {report.title}
                  </Link>
                  <span className="text-xs tabular-nums text-caption">{formatDateTime(report.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
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
            <ActionForm action={addCompetitorAction.bind(null, clientId)} className="space-y-3 rounded-md border border-dashed border-border p-3" resetOnSuccess>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="competitorName" className="mb-1.5 block text-xs font-medium text-caption">Name</label>
                  <Input id="competitorName" name="name" type="text" required placeholder="e.g. Acme Rivals" className="w-44" />
                  <FieldError name="name" />
                </div>
                <div>
                  <label htmlFor="competitorUrl" className="mb-1.5 block text-xs font-medium text-caption">URL</label>
                  <Input id="competitorUrl" name="url" type="url" placeholder="https://…" className="w-56" />
                  <FieldError name="url" />
                </div>
                <div className="min-w-[14rem] flex-1">
                  <label htmlFor="competitorPositioning" className="mb-1.5 block text-xs font-medium text-caption">Positioning</label>
                  <Input id="competitorPositioning" name="positioning" type="text" placeholder="e.g. Premium, enterprise-focused" />
                </div>
              </div>
              <div>
                <label htmlFor="competitorObservations" className="mb-1.5 block text-xs font-medium text-caption">Observations</label>
                <Input id="competitorObservations" name="observations" type="text" placeholder="Anything worth noting…" />
              </div>
              <SubmitButton variant="outline" pendingLabel="Adding…">
                Add competitor
              </SubmitButton>
            </ActionForm>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
