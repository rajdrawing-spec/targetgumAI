import type { AutomationLevel, ClientStatus } from '@prisma/client'

/**
 * Curated select options for client profile fields. Free text is still
 * accepted for industry (the list is a convenience, not a constraint).
 */
export const INDUSTRIES = [
  'E-commerce',
  'Retail',
  'Education',
  'Healthcare',
  'Dental',
  'Real estate',
  'Consumer products',
  'B2B services',
  'SaaS / software',
  'Hospitality',
  'Restaurants & food',
  'Fitness & wellness',
  'Finance & insurance',
  'Automotive',
  'Non-profit',
  'Other',
] as const

export const AUTOMATION_LEVELS: Array<{ value: AutomationLevel; label: string; description: string }> = [
  { value: 'MANUAL', label: 'Manual', description: 'AI analyzes and recommends; people do everything else.' },
  { value: 'ASSISTED', label: 'Assisted', description: 'AI drafts content and changes; every write needs a person.' },
  { value: 'APPROVAL_BASED', label: 'Approval based', description: 'Low-risk actions run automatically; HIGH/CRITICAL wait for approval.' },
  { value: 'HIGH_AUTOMATION', label: 'High automation', description: 'Everything within policy limits runs automatically; CRITICAL still needs approval.' },
]

export const CLIENT_STATUSES: Array<{ value: ClientStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'ARCHIVED', label: 'Archived' },
]

export const MARKETING_CHANNELS = [
  'instagram',
  'facebook',
  'linkedin',
  'tiktok',
  'youtube',
  'google_ads',
  'meta_ads',
  'seo',
  'email',
] as const

export const COMMON_TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
] as const
