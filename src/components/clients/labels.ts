import type { IntegrationHealth, IntegrationProvider } from '@prisma/client'

export const PROVIDER_LABEL: Record<IntegrationProvider, string> = {
  METRICOOL: 'Metricool',
  CANVA: 'Canva',
  GA4: 'GA4',
  GOOGLE_SEARCH_CONSOLE: 'Search Console',
  GOOGLE_ADS: 'Google Ads',
  META_ADS: 'Meta Ads',
  AMAZON_ADS: 'Amazon Ads',
  TIKTOK_ADS: 'TikTok Ads',
  LINKEDIN: 'LinkedIn',
}

/** Dot color per health state - the raw palette swatches, text-safe variants are used for labels. */
export const HEALTH_DOT: Record<IntegrationHealth, string> = {
  CONNECTED: 'bg-sage',
  DEGRADED: 'bg-mustard',
  AUTH_REQUIRED: 'bg-mustard',
  ERROR: 'bg-blush',
  DISCONNECTED: 'bg-caption/50',
}

export const HEALTH_LABEL: Record<IntegrationHealth, string> = {
  CONNECTED: 'Connected',
  DEGRADED: 'Degraded',
  AUTH_REQUIRED: 'Needs re-auth',
  ERROR: 'Error',
  DISCONNECTED: 'Disconnected',
}

export const AUTOMATION_LABEL: Record<string, string> = {
  MANUAL: 'Manual',
  ASSISTED: 'Assisted',
  APPROVAL_BASED: 'Approval based',
  HIGH_AUTOMATION: 'High automation',
}
