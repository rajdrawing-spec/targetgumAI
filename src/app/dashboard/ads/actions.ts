'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { runAction, actionOk } from '@/lib/actions/result'
import type { ActionResult } from '@/lib/actions/result'
import { createCampaign, toggleCampaignStatus, seedDemoAdsData, listCampaigns } from '@/lib/ads/service'
import { analyzeAdImpressionsAndPerformance, createAndShareClientReport } from '@/lib/ads/analyzer'
import type { IntegrationProvider } from '@prisma/client'
import type { AmazonCampaignType, AmazonTargetingType } from '@/lib/ads/types'

async function requireCtx() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) throw new Error('You must be signed in.')
  return ctx
}

export async function createCampaignAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('create-campaign', async () => {
    const ctx = await requireCtx()
    const clientId = formData.get('clientId') as string
    const name = formData.get('name') as string
    const provider = formData.get('provider') as IntegrationProvider
    const channel = formData.get('channel') as string
    const budget = Number(formData.get('budget') ?? 500)
    const targetAcos = formData.get('targetAcos') ? Number(formData.get('targetAcos')) : undefined
    const amazonType = formData.get('amazonType') as AmazonCampaignType | undefined
    const amazonTargeting = formData.get('amazonTargeting') as AmazonTargetingType | undefined
    const defaultBid = formData.get('defaultBid') ? Number(formData.get('defaultBid')) : undefined
    const rawKeywords = formData.get('keywords') as string
    const rawNegatives = formData.get('negativeKeywords') as string
    const headline = formData.get('headline') as string | undefined
    const asin = formData.get('asin') as string | undefined

    if (!clientId || !name || !provider) {
      throw new Error('Client, campaign name, and platform are required.')
    }

    const keywords = rawKeywords ? rawKeywords.split(',').map((k) => k.trim()).filter(Boolean) : []
    const negativeKeywords = rawNegatives ? rawNegatives.split(',').map((k) => k.trim()).filter(Boolean) : []

    const campaign = await createCampaign(ctx, {
      clientId,
      name,
      provider,
      channel,
      budget,
      targetAcos,
      amazonType,
      amazonTargeting,
      defaultBid,
      keywords,
      negativeKeywords,
      adCopy: { headline, asin },
    })

    revalidatePath('/dashboard/ads')
    revalidatePath('/dashboard')
    revalidatePath(`/dashboard/clients/${clientId}`)
    return actionOk(`Campaign "${campaign.name}" launched successfully!`, { redirectTo: '/dashboard/ads' })
  })
}

export async function toggleCampaignStatusAction(campaignId: string, currentStatus: string): Promise<ActionResult> {
  return runAction('toggle-campaign-status', async () => {
    const ctx = await requireCtx()
    const updated = await toggleCampaignStatus(ctx, campaignId, currentStatus)
    revalidatePath('/dashboard/ads')
    return actionOk(`Campaign set to ${updated.status}.`)
  })
}

export async function seedDemoAdsAction(clientId?: string): Promise<ActionResult> {
  return runAction('seed-demo-ads', async () => {
    const ctx = await requireCtx()
    await seedDemoAdsData(ctx, clientId)
    revalidatePath('/dashboard/ads')
    revalidatePath('/dashboard/ads/analytics')
    revalidatePath('/dashboard')
    return actionOk('Sample multi-channel ad campaigns & impression metrics populated successfully!')
  })
}

export async function generateClientReportAction(clientId: string): Promise<ActionResult> {
  return runAction('generate-client-report', async () => {
    const ctx = await requireCtx()
    const campaigns = await listCampaigns(ctx, clientId)
    const analysis = analyzeAdImpressionsAndPerformance(campaigns)
    const report = await createAndShareClientReport(ctx, clientId, analysis)

    revalidatePath('/dashboard/reports')
    revalidatePath(`/dashboard/clients/${clientId}`)
    revalidatePath(`/portal/clients/${clientId}`)
    revalidatePath('/portal')
    return actionOk(`AI Performance Report generated and shared with client! (Report: ${report.title})`)
  })
}
