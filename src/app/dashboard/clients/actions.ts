'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { updateClientBrainSection, updateClientPolicy } from '@/lib/clients/brain'
import { addClientContact, deleteClientContact, updateClientContact } from '@/lib/clients/contacts'
import { createClient } from '@/lib/clients/create'
import { archiveClient, deleteClient, unarchiveClient, updateClientProfile } from '@/lib/clients/profile'
import { AuthenticationError } from '@/lib/rbac/errors'
import { actionOk, formString, runAction, type ActionResult } from '@/lib/actions/result'

/**
 * Server Actions for client management (list, onboarding, profile,
 * contacts, lifecycle). Same convention as `src/app/dashboard/actions.ts`:
 * resolve ctx, parse the form, call the permission/tenant-checked lib
 * function, return an ActionResult. Field names follow the form
 * (`contactName`, `brain.business.industry`, ...) - see `parseOnboarding`.
 */

async function requireCtx() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) throw new AuthenticationError()
  return ctx
}

function revalidateClients(clientId?: string) {
  revalidatePath('/dashboard/clients')
  revalidatePath('/dashboard')
  if (clientId) revalidatePath(`/dashboard/clients/${clientId}`, 'layout')
}

const list = (formData: FormData, key: string) => formData.getAll(key).map((v) => String(v).trim())
const lines = (value: string | undefined) => (value ? value.split(/\r?\n|,/).map((v) => v.trim()).filter(Boolean) : undefined)

/** Reads the profile fields every client form shares. */
function parseProfile(formData: FormData) {
  return {
    name: formString(formData, 'name') ?? '',
    legalName: formString(formData, 'legalName'),
    website: formString(formData, 'website'),
    industry: formString(formData, 'industry'),
    country: formString(formData, 'country'),
    city: formString(formData, 'city'),
    timezone: formString(formData, 'timezone'),
    description: formString(formData, 'description'),
    status: (formString(formData, 'status') as 'ACTIVE' | 'PAUSED' | undefined) ?? undefined,
    automationLevel: (formString(formData, 'automationLevel') as 'MANUAL' | 'ASSISTED' | 'APPROVAL_BASED' | 'HIGH_AUTOMATION' | undefined) ?? undefined,
    accountManagerId: formString(formData, 'accountManagerId'),
    monthlyBudget: formString(formData, 'monthlyBudget'),
    tags: lines(formString(formData, 'tags'))?.map((t) => t.toLowerCase()),
  }
}

/** The sectioned Add Client form - every section beyond Basic is optional. */
function parseOnboarding(formData: FormData) {
  const profile = parseProfile(formData)

  const contactNames = list(formData, 'contactName')
  const contactEmails = list(formData, 'contactEmail')
  const contactPhones = list(formData, 'contactPhone')
  const contactRoles = list(formData, 'contactDesignation')
  const contacts = contactNames
    .map((name, i) => ({ name, email: contactEmails[i] ?? '', phone: contactPhones[i] ?? '', designation: contactRoles[i] ?? '', isPrimary: i === 0 }))
    .filter((c) => c.name)

  const competitorNames = list(formData, 'competitorName')
  const competitorUrls = list(formData, 'competitorUrl')
  const competitorNotes = list(formData, 'competitorNotes')
  const competitors = competitorNames
    .map((name, i) => ({ name, url: competitorUrls[i] || undefined, observations: competitorNotes[i] || undefined }))
    .filter((c) => c.name)

  const budget = formString(formData, 'brain.marketing.monthlyBudget') ?? profile.monthlyBudget
  const brain = {
    business: {
      companyName: profile.legalName ?? profile.name,
      industry: profile.industry,
      productsServices: formString(formData, 'brain.business.productsServices'),
      locations: lines(formString(formData, 'brain.business.locations')),
      pricing: formString(formData, 'brain.business.pricing'),
      offers: formString(formData, 'brain.business.offers'),
      businessModel: formString(formData, 'brain.business.businessModel'),
      businessGoals: lines(formString(formData, 'brain.business.businessGoals')),
    },
    marketing: {
      objectives: lines(formString(formData, 'brain.marketing.objectives')),
      kpis: lines(formString(formData, 'brain.marketing.kpis')),
      targetChannels: list(formData, 'brain.marketing.targetChannels').filter(Boolean),
      monthlyBudget: budget ? Number(budget) : undefined,
      campaignHistory: formString(formData, 'brain.marketing.campaignHistory'),
      currentPriorities: lines(formString(formData, 'brain.marketing.currentPriorities')),
    },
    brand: {
      voice: formString(formData, 'brain.brand.voice'),
      tone: formString(formData, 'brain.brand.tone'),
      colors: lines(formString(formData, 'brain.brand.colors')),
      fonts: lines(formString(formData, 'brain.brand.fonts')),
      visualRules: formString(formData, 'brain.brand.visualRules'),
      restrictedImagery: formString(formData, 'brain.brand.restrictedImagery'),
      messagingRules: formString(formData, 'brain.brand.messagingRules'),
    },
    audience: {
      demographics: formString(formData, 'brain.audience.demographics'),
      personas: lines(formString(formData, 'brain.audience.personas'))?.map((name) => ({ name })),
      painPoints: lines(formString(formData, 'brain.audience.painPoints')),
      motivations: lines(formString(formData, 'brain.audience.motivations')),
      buyingJourney: formString(formData, 'brain.audience.buyingJourney'),
      objections: lines(formString(formData, 'brain.audience.objections')),
    },
  }
  // Drop empty keys so an untouched section is not written at all.
  const compact = <T extends Record<string, unknown>>(o: T) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))) as Partial<T>

  const num = (key: string) => {
    const v = formString(formData, key)
    return v ? Number(v) : undefined
  }
  const policy = {
    maxDailyAdBudget: num('policy.maxDailyAdBudget'),
    maxBudgetChangePercent: num('policy.maxBudgetChangePercent'),
    autoPublishSocial: formData.get('policy.autoPublishSocial') === 'on',
    autoChangeAds: formData.get('policy.autoChangeAds') === 'on',
    requireApprovalForCampaignLaunch: formData.get('policy.requireApprovalForCampaignLaunch') !== 'off',
  }

  return {
    ...profile,
    contacts,
    competitors,
    brain: { business: compact(brain.business), marketing: compact(brain.marketing), brand: compact(brain.brand), audience: compact(brain.audience) },
    policy,
    internalNotes: formString(formData, 'internalNotes'),
  }
}

export async function createClientFullAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('create-client-full', async () => {
    const ctx = await requireCtx()
    const input = parseOnboarding(formData)
    const client = await createClient(ctx, input)
    revalidateClients()
    return actionOk(`${client.name} created.`, { redirectTo: `/dashboard/clients/${client.id}` })
  })
}

export async function updateClientProfileAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('update-client-profile', async () => {
    const ctx = await requireCtx()
    const client = await updateClientProfile(ctx, clientId, parseProfile(formData))
    revalidateClients(clientId)
    return actionOk(`${client.name} saved.`)
  })
}

const sectionSchema = z.enum(['business', 'audience', 'brand', 'marketing'])

/** One Client Brain section at a time - the Business/Brand/Audience/Marketing tabs each edit their own. */
export async function updateBrainSectionAction(clientId: string, section: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('update-brain-section', async () => {
    const ctx = await requireCtx()
    const key = sectionSchema.parse(section)
    const parsed = parseOnboarding(formData).brain[key]
    await updateClientBrainSection(ctx, clientId, key, parsed)
    revalidateClients(clientId)
    return actionOk(`${key.charAt(0).toUpperCase()}${key.slice(1)} saved. The AI will use this on its next run.`)
  })
}

export async function updatePolicyAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('update-policy', async () => {
    const ctx = await requireCtx()
    const maxDailyAdBudget = formString(formData, 'maxDailyAdBudget')
    const maxBudgetChangePercent = formString(formData, 'maxBudgetChangePercent')
    await updateClientPolicy(ctx, clientId, {
      maxDailyAdBudget: maxDailyAdBudget ? Number(maxDailyAdBudget) : undefined,
      maxBudgetChangePercent: maxBudgetChangePercent ? Number(maxBudgetChangePercent) : undefined,
      autoPublishSocial: formData.get('autoPublishSocial') === 'on',
      autoChangeAds: formData.get('autoChangeAds') === 'on',
      requireApprovalForCampaignLaunch: formData.get('requireApprovalForCampaignLaunch') === 'on',
      weeklyAutomationEnabled: formData.get('weeklyAutomationEnabled') === 'on',
    })
    revalidateClients(clientId)
    return actionOk('Automation policy saved.')
  })
}

export async function archiveClientAction(clientId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('archive-client', async () => {
    const ctx = await requireCtx()
    const client = await archiveClient(ctx, clientId)
    revalidateClients(clientId)
    return actionOk(`${client.name} archived. It is hidden from lists but nothing was deleted.`)
  })
}

export async function unarchiveClientAction(clientId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('unarchive-client', async () => {
    const ctx = await requireCtx()
    const client = await unarchiveClient(ctx, clientId)
    revalidateClients(clientId)
    return actionOk(`${client.name} restored.`)
  })
}

export async function deleteClientAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('delete-client', async () => {
    const ctx = await requireCtx()
    const confirmName = formString(formData, 'confirmName') ?? ''
    const deleted = await deleteClient(ctx, clientId, confirmName)
    revalidateClients()
    return actionOk(`${deleted.name} was permanently deleted.`, { redirectTo: '/dashboard/clients' })
  })
}

function parseContact(formData: FormData) {
  return {
    name: formString(formData, 'name') ?? '',
    email: formString(formData, 'email') ?? '',
    phone: formString(formData, 'phone') ?? '',
    designation: formString(formData, 'designation') ?? '',
    isPrimary: formData.get('isPrimary') === 'on',
    notes: formString(formData, 'notes') ?? '',
  }
}

export async function addContactAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('add-contact', async () => {
    const ctx = await requireCtx()
    const contact = await addClientContact(ctx, clientId, parseContact(formData))
    revalidateClients(clientId)
    return actionOk(`${contact.name} added.`)
  })
}

export async function updateContactAction(clientId: string, contactId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction('update-contact', async () => {
    const ctx = await requireCtx()
    const contact = await updateClientContact(ctx, clientId, contactId, parseContact(formData))
    revalidateClients(clientId)
    return actionOk(`${contact.name} saved.`)
  })
}

export async function deleteContactAction(clientId: string, contactId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  return runAction('delete-contact', async () => {
    const ctx = await requireCtx()
    await deleteClientContact(ctx, clientId, contactId)
    revalidateClients(clientId)
    return actionOk('Contact removed.')
  })
}
