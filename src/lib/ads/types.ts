import type { IntegrationProvider } from '@prisma/client'

export interface CampaignSummary {
  id: string
  clientId: string
  clientName: string
  name: string
  provider: IntegrationProvider
  channel: string | null
  status: string
  /** Set while a resume is waiting on the Approval Engine - see toggleCampaignStatus. */
  approvalId: string | null
  budget: number
  metrics: {
    impressions: number
    clicks: number
    spend: number
    ctr: number
    cpc: number
    conversions: number
    revenue: number
    roas: number
    acos: number
  }
  createdAt: Date
}
