import { redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listAccessibleClients } from '@/lib/clients/list'
import { mapConnectedAdProvidersByClient, mapDailyBudgetCapByClient, AD_CAMPAIGN_PROVIDERS, type AdCampaignProvider } from '@/lib/ads/connected-providers'
import { NewCampaignWizard } from '@/components/ads/new-campaign-wizard'

/**
 * The guided "Create Ad Campaign" wizard (replaces the old jargon-heavy
 * form and the entirely fake "AI Ad Creator Studio" tab - see
 * docs/DECISIONS.md). Three plain-language questions - what it's about,
 * where to run it, budget & audience - then an AI-drafted brief to review
 * before anything real happens. Aimed at someone who has never run a
 * digital ad before, not a media buyer.
 */
export default async function NewCampaignPage({ searchParams }: { searchParams: Promise<{ platform?: string; clientId?: string }> }) {
  const [sp, ctx] = await Promise.all([searchParams, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')
  if (!ctx.permissions.has('ads.manage')) redirect('/dashboard/ads')

  const clients = await listAccessibleClients(ctx)
  const clientIds = clients.map((c) => c.id)
  const [connectedByClient, budgetCapByClient] = await Promise.all([
    mapConnectedAdProvidersByClient(ctx, clientIds),
    mapDailyBudgetCapByClient(ctx, clientIds),
  ])

  const initialPlatform = AD_CAMPAIGN_PROVIDERS.includes(sp.platform as AdCampaignProvider) ? (sp.platform as AdCampaignProvider) : undefined
  const initialClientId = sp.clientId && clients.some((c) => c.id === sp.clientId) ? sp.clientId : clients[0]?.id

  return (
    <NewCampaignWizard
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      connectedByClient={Object.fromEntries(Array.from(connectedByClient.entries()).map(([id, set]) => [id, Array.from(set)]))}
      budgetCapByClient={Object.fromEntries(budgetCapByClient)}
      initialClientId={initialClientId}
      initialPlatform={initialPlatform}
    />
  )
}
