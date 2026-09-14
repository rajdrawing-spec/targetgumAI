import type { IntegrationProvider } from '@prisma/client'

export type AdPlatform = 'AMAZON_ADS' | 'GOOGLE_ADS' | 'META_ADS'

export type AmazonCampaignType = 'SPONSORED_PRODUCTS' | 'SPONSORED_BRANDS' | 'SPONSORED_DISPLAY'
export type AmazonTargetingType = 'AUTO' | 'MANUAL_KEYWORD' | 'MANUAL_PRODUCT'
export type AmazonMatchTypes = 'EXACT' | 'PHRASE' | 'BROAD'

export interface CreateCampaignInput {
  clientId: string
  name: string
  provider: IntegrationProvider
  channel?: string
  budget: number
  status?: string
  startDate?: Date
  endDate?: Date
  // Platform-specific configuration
  targetAcos?: number // Amazon PPC
  amazonType?: AmazonCampaignType
  amazonTargeting?: AmazonTargetingType
  defaultBid?: number
  keywords?: string[]
  negativeKeywords?: string[]
  adCopy?: {
    headline?: string
    description?: string
    targetUrl?: string
    asin?: string
  }
}

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
