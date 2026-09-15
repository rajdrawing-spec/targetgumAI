'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Megaphone,
  Plug,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Users,
} from 'lucide-react'
import { generateBriefAction, launchCampaignAction } from '@/app/dashboard/ads/new/actions'
import type { CampaignBrief } from '@/lib/ads/campaign-brief'
import { AD_CAMPAIGN_PROVIDERS, type AdCampaignProvider } from '@/lib/ads/connected-providers'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

const STEPS = ['What it\'s about', 'Where to run it', 'Budget & audience', 'Review & create'] as const

const GOALS = [
  { label: 'Get more sales', hint: 'Someone buys something, online or in person' },
  { label: 'Get more leads or calls', hint: 'Someone fills out a form or calls you' },
  { label: 'Get more website visitors', hint: 'Grow traffic to your site or page' },
  { label: 'Build awareness', hint: 'Get your name in front of more people' },
] as const

const PLATFORM_INFO: Record<AdCampaignProvider, { label: string; description: string; icon: typeof Users }> = {
  META_ADS: { label: 'Facebook & Instagram', description: 'Great for reaching people by interest as they scroll', icon: Users },
  GOOGLE_ADS: { label: 'Google Search', description: 'Shows up when someone searches for what you offer', icon: Search },
  AMAZON_ADS: { label: 'Amazon', description: 'Puts your product in front of Amazon shoppers', icon: ShoppingBag },
}

export interface NewCampaignWizardProps {
  clients: Array<{ id: string; name: string }>
  connectedByClient: Record<string, AdCampaignProvider[]>
  budgetCapByClient: Record<string, number>
  initialClientId?: string
  initialPlatform?: AdCampaignProvider
}

export function NewCampaignWizard({
  clients,
  connectedByClient,
  budgetCapByClient,
  initialClientId,
  initialPlatform,
}: NewCampaignWizardProps) {
  const toast = useToast()
  const [step, setStep] = useState(1)
  const [clientId, setClientId] = useState(initialClientId ?? '')
  const [about, setAbout] = useState('')
  const [goal, setGoal] = useState<string>(GOALS[0].label)
  const [platformChoice, setPlatformChoice] = useState<AdCampaignProvider | 'AI_RECOMMEND'>(initialPlatform ?? 'AI_RECOMMEND')
  const [dailyBudget, setDailyBudget] = useState(20)
  const [audience, setAudience] = useState('')
  const [brief, setBrief] = useState<CampaignBrief | null>(null)
  const [aiRunId, setAiRunId] = useState<string | undefined>()
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  if (clients.length === 0) {
    return (
      <EmptyState icon={Megaphone} title="Add a client first" description="A campaign always belongs to a client - create one before setting up ads for them.">
        <Link href="/dashboard/clients/new" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowRight className="h-4 w-4" /> Add a client
        </Link>
      </EmptyState>
    )
  }

  const connected = connectedByClient[clientId] ?? []
  const budgetCap = budgetCapByClient[clientId]
  const resolvedProvider = platformChoice === 'AI_RECOMMEND' ? brief?.recommendedProvider ?? connected[0] : platformChoice
  const clientName = clients.find((c) => c.id === clientId)?.name ?? ''

  function handleClientChange(id: string) {
    setClientId(id)
    setPlatformChoice(initialPlatform && (connectedByClient[id] ?? []).includes(initialPlatform) ? initialPlatform : 'AI_RECOMMEND')
    setBrief(null)
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenerateError(null)
    const result = await generateBriefAction({
      clientId,
      about,
      goal,
      platformChoice,
      connectedProviders: connected,
      dailyBudget,
      audience: audience.trim() || undefined,
    })
    setGenerating(false)
    if (!result.ok) {
      setGenerateError(result.error)
      toast.error(result.error)
      return
    }
    setBrief(result.brief)
    setAiRunId(result.aiRunId)
    setStep(4)
  }

  const canLeaveStep1 = clientId.length > 0 && about.trim().length >= 10
  const canLeaveStep2 = connected.length > 0 && (platformChoice === 'AI_RECOMMEND' || connected.includes(platformChoice))
  const canGenerate = dailyBudget > 0

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/ads" className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Ads Hub
        </Link>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
          <Sparkles className="h-6 w-6 text-primary" /> Create an Ad Campaign
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Answer a few plain questions - no marketing experience needed. AI drafts the campaign, you review it before anything goes live.
        </p>
      </div>

      {/* Step indicator */}
      <ol className="flex items-center gap-2 text-xs font-medium">
        {STEPS.map((label, i) => {
          const n = i + 1
          const state = n === step ? 'current' : n < step ? 'done' : 'upcoming'
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px]',
                  state === 'done' && 'bg-primary text-primary-foreground',
                  state === 'current' && 'bg-primary/15 text-primary ring-2 ring-primary',
                  state === 'upcoming' && 'bg-muted text-muted-foreground',
                )}
              >
                {state === 'done' ? <Check className="h-3.5 w-3.5" /> : n}
              </span>
              <span className={cn('hidden sm:inline', state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground')}>{label}</span>
              {n < STEPS.length && <span className="h-px flex-1 bg-border" />}
            </li>
          )
        })}
      </ol>

      <Card>
        <CardContent className="space-y-5 p-5">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <Label htmlFor="clientId">Which client is this for?</Label>
                <select
                  id="clientId"
                  value={clientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-subtle focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="about">What are you advertising?</Label>
                <Textarea
                  id="about"
                  rows={4}
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="e.g. We're a local bakery and want more people to order custom birthday cakes online. We're known for same-day delivery."
                />
                <p className="mt-1 text-xs text-caption">A sentence or two is enough - what you sell, and anything that makes you stand out.</p>
              </div>

              <div>
                <Label>What&apos;s the goal?</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {GOALS.map((g) => (
                    <label
                      key={g.label}
                      className={cn(
                        'cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40',
                        goal === g.label ? 'border-primary bg-primary/5' : 'border-border',
                      )}
                    >
                      <input type="radio" name="goal" className="sr-only" checked={goal === g.label} onChange={() => setGoal(g.label)} />
                      <p className="text-sm font-medium text-foreground">{g.label}</p>
                      <p className="text-xs text-caption">{g.hint}</p>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={() => setStep(2)} disabled={!canLeaveStep1}>
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <Label>Where do you want to run it?</Label>
                <p className="mb-2 text-xs text-caption">Only platforms already connected for {clientName || 'this client'} can be used.</p>

                {connected.length === 0 ? (
                  <EmptyState
                    icon={Plug}
                    title="No ad platforms connected yet"
                    description={`Connect Facebook/Instagram, Google, or Amazon for ${clientName || 'this client'} before creating a campaign.`}
                  >
                    <Link href={`/dashboard/clients/${clientId}/integrations`} className="text-sm font-medium text-primary hover:underline">
                      Connect a platform
                    </Link>
                  </EmptyState>
                ) : (
                  <div className="space-y-2">
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40',
                        platformChoice === 'AI_RECOMMEND' ? 'border-primary bg-primary/5' : 'border-border',
                      )}
                    >
                      <input type="radio" name="platform" className="sr-only" checked={platformChoice === 'AI_RECOMMEND'} onChange={() => setPlatformChoice('AI_RECOMMEND')} />
                      <Sparkles className="h-5 w-5 shrink-0 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Not sure - let AI recommend</p>
                        <p className="text-xs text-caption">Picks the best fit among your connected platforms based on what you told us</p>
                      </div>
                    </label>

                    {AD_CAMPAIGN_PROVIDERS.map((provider) => {
                      const info = PLATFORM_INFO[provider]
                      const Icon = info.icon
                      const isConnected = connected.includes(provider)
                      return (
                        <label
                          key={provider}
                          className={cn(
                            'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                            !isConnected && 'cursor-not-allowed opacity-50',
                            isConnected && 'cursor-pointer hover:bg-muted/40',
                            isConnected && platformChoice === provider ? 'border-primary bg-primary/5' : 'border-border',
                          )}
                        >
                          <input
                            type="radio"
                            name="platform"
                            className="sr-only"
                            disabled={!isConnected}
                            checked={platformChoice === provider}
                            onChange={() => setPlatformChoice(provider)}
                          />
                          <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">{info.label}</p>
                            <p className="text-xs text-caption">{info.description}</p>
                          </div>
                          {!isConnected && (
                            <Link
                              href={`/dashboard/clients/${clientId}/integrations`}
                              className="shrink-0 text-xs font-medium text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Connect
                            </Link>
                          )}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button onClick={() => setStep(3)} disabled={!canLeaveStep2}>
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <Label htmlFor="dailyBudget">How much do you want to spend per day?</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input
                    id="dailyBudget"
                    type="number"
                    min={1}
                    step="1"
                    value={dailyBudget}
                    onChange={(e) => setDailyBudget(Number(e.target.value))}
                    className="max-w-32"
                  />
                  <span className="text-sm text-muted-foreground">/ day</span>
                </div>
                {budgetCap != null && dailyBudget > budgetCap && (
                  <p className="mt-1.5 text-xs text-amber-600">
                    Heads up - {clientName}&apos;s usual daily budget limit is ${budgetCap}. You can still continue; just worth double-checking.
                  </p>
                )}
                <p className="mt-1 text-xs text-caption">This is a daily amount, not a monthly total. You can change it any time after launch.</p>
              </div>

              <div>
                <Label htmlFor="audience">Who are you trying to reach? (optional)</Label>
                <Textarea
                  id="audience"
                  rows={3}
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="e.g. People in Austin, TX planning a birthday party"
                />
                <p className="mt-1 text-xs text-caption">Leave this blank and we&apos;ll make a sensible guess from what you already told us.</p>
              </div>

              {generateError && (
                <p role="alert" className="rounded-md bg-destructive-bg px-3 py-2 text-sm text-destructive">
                  {generateError}
                </p>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)} disabled={generating}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button onClick={handleGenerate} disabled={!canGenerate || generating}>
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Putting your plan together…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Create my campaign plan
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 4 && brief && resolvedProvider && (
            <ActionForm
              action={launchCampaignAction}
              successMessage="Campaign created."
              className="space-y-5"
            >
              <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm text-foreground">
                <p className="font-medium">Here&apos;s the plan AI put together. Nothing is live yet.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Review everything below, edit anything you&apos;d like, then create it - it will start <strong>paused</strong> so you can
                  double-check before it ever spends money.
                </p>
              </div>

              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="provider" value={resolvedProvider} />
              <input type="hidden" name="dailyBudget" value={dailyBudget} />
              {aiRunId && <input type="hidden" name="aiRunId" value={aiRunId} />}

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 font-medium text-foreground">
                  {(() => {
                    const Icon = PLATFORM_INFO[resolvedProvider].icon
                    return <Icon className="h-3.5 w-3.5" />
                  })()}
                  {PLATFORM_INFO[resolvedProvider].label}
                </span>
                <span className="text-caption">${dailyBudget}/day</span>
                {platformChoice === 'AI_RECOMMEND' && <span className="text-caption">· AI-recommended platform</span>}
              </div>

              <div>
                <Label htmlFor="name">Campaign name</Label>
                <Input id="name" name="name" defaultValue={brief.campaignName} required maxLength={200} />
              </div>

              <div className="space-y-1.5 rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-caption">The plan, in plain language</p>
                <p className="text-sm text-foreground">{brief.strategyNote}</p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Who it&apos;ll reach: </span>
                  {brief.audienceSummary}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">About that budget: </span>
                  {brief.budgetAssessment}
                </p>
              </div>

              <div className="space-y-3 rounded-md border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-caption">Draft ad</p>
                <div>
                  <Label htmlFor="headline">Headline</Label>
                  <Input id="headline" name="headline" defaultValue={brief.adConcept.headline} required maxLength={200} />
                </div>
                <div>
                  <Label htmlFor="primaryText">Ad text</Label>
                  <Textarea id="primaryText" name="primaryText" rows={3} defaultValue={brief.adConcept.primaryText} required maxLength={2000} />
                </div>
                <div>
                  <Label htmlFor="visualDirection">What the image/video should show</Label>
                  <Textarea id="visualDirection" name="visualDirection" rows={2} defaultValue={brief.adConcept.visualDirection} required maxLength={2000} />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep(3)}>
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button type="button" variant="outline" onClick={handleGenerate} disabled={generating}>
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Regenerate
                  </Button>
                </div>
                <SubmitButton pendingLabel="Creating…">
                  <Sparkles className="h-4 w-4" /> Create campaign (starts paused)
                </SubmitButton>
              </div>
            </ActionForm>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
