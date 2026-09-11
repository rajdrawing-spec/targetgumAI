'use client'

import { useRouter } from 'next/navigation'
import { ActionForm, FieldError, SubmitButton } from '@/components/ui/action-form'
import { Input, Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Field, Section } from './section'
import { createClientFullAction } from '@/app/dashboard/clients/actions'
import { AUTOMATION_LEVELS, CLIENT_STATUSES, COMMON_TIMEZONES, INDUSTRIES, MARKETING_CHANNELS } from '@/lib/clients/options'

const selectClass = 'h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function ClientOnboardingForm({ managers }: { managers: Array<{ id: string; label: string; roleName: string }> }) {
  const router = useRouter()

  return (
    <ActionForm action={createClientFullAction} className="space-y-4">
      {/* A - Basic Information */}
      <Section title="Basic information" defaultOpen optional={false}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Client name *" htmlFor="name">
            <Input id="name" name="name" required minLength={2} placeholder="e.g. Acme Retail" />
            <FieldError name="name" />
          </Field>
          <Field label="Legal / company name" htmlFor="legalName">
            <Input id="legalName" name="legalName" placeholder="Acme Retail Pvt Ltd" />
          </Field>
          <Field label="Website" htmlFor="website">
            <Input id="website" name="website" placeholder="example.com" />
            <FieldError name="website" />
          </Field>
          <Field label="Industry" htmlFor="industry">
            <Input id="industry" name="industry" list="industry-options" placeholder="e.g. E-commerce" />
            <datalist id="industry-options">
              {INDUSTRIES.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
          </Field>
          <Field label="Country" htmlFor="country">
            <Input id="country" name="country" placeholder="e.g. India" />
          </Field>
          <Field label="City" htmlFor="city">
            <Input id="city" name="city" placeholder="e.g. Chennai" />
          </Field>
          <Field label="Time zone" htmlFor="timezone">
            <Input id="timezone" name="timezone" list="timezone-options" placeholder="e.g. Asia/Kolkata" />
            <datalist id="timezone-options">
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
          </Field>
          <Field label="Status" htmlFor="status">
            <select id="status" name="status" defaultValue="ACTIVE" className={selectClass}>
              {CLIENT_STATUSES.filter((s) => s.value !== 'ARCHIVED').map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Account manager" htmlFor="accountManagerId">
            <select id="accountManagerId" name="accountManagerId" defaultValue="" className={selectClass}>
              <option value="">Unassigned</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · {m.roleName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Monthly ad budget" htmlFor="monthlyBudget" hint="Used as the default across marketing and policy.">
            <Input id="monthlyBudget" name="monthlyBudget" type="number" min={0} step="0.01" placeholder="e.g. 2000" />
            <FieldError name="monthlyBudget" />
          </Field>
          <Field label="Tags" htmlFor="tags" hint="One per line - used for search and filtering.">
            <Textarea id="tags" name="tags" rows={1} placeholder="local&#10;healthcare" />
          </Field>
        </div>
      </Section>

      {/* B - Contact */}
      <Section title="Contact" description="Who do we talk to at this client?">
        {[0, 1].map((i) => (
          <fieldset key={i} className="grid grid-cols-1 gap-3 rounded-md border border-dashed border-border p-3 sm:grid-cols-4">
            <legend className="px-1 text-xs font-medium text-caption">{i === 0 ? 'Primary contact' : 'Additional contact'}</legend>
            <Field label="Name" htmlFor={`contactName-${i}`}>
              <Input id={`contactName-${i}`} name="contactName" placeholder="Full name" />
            </Field>
            <Field label="Email" htmlFor={`contactEmail-${i}`}>
              <Input id={`contactEmail-${i}`} name="contactEmail" type="email" placeholder="name@client.com" />
            </Field>
            <Field label="Phone" htmlFor={`contactPhone-${i}`}>
              <Input id={`contactPhone-${i}`} name="contactPhone" placeholder="+1 555 0100" />
            </Field>
            <Field label="Designation" htmlFor={`contactDesignation-${i}`}>
              <Input id={`contactDesignation-${i}`} name="contactDesignation" placeholder="e.g. Marketing Director" />
            </Field>
          </fieldset>
        ))}
      </Section>

      {/* C - Business */}
      <Section title="Business" description="Feeds the Client Brain the AI uses for analysis and content.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Products / services" htmlFor="business-products" className="sm:col-span-2">
            <Textarea id="business-products" name="brain.business.productsServices" rows={2} placeholder="What does this client sell or offer?" />
          </Field>
          <Field label="Locations served" htmlFor="business-locations" hint="One per line.">
            <Textarea id="business-locations" name="brain.business.locations" rows={2} placeholder="Chennai&#10;Bangalore" />
          </Field>
          <Field label="Business model" htmlFor="business-model">
            <Input id="business-model" name="brain.business.businessModel" placeholder="e.g. D2C subscription" />
          </Field>
          <Field label="Pricing" htmlFor="business-pricing">
            <Textarea id="business-pricing" name="brain.business.pricing" rows={2} placeholder="Price ranges, positioning…" />
          </Field>
          <Field label="Key offers" htmlFor="business-offers">
            <Textarea id="business-offers" name="brain.business.offers" rows={2} placeholder="Current promotions or packages…" />
          </Field>
          <Field label="Business goals" htmlFor="business-goals" className="sm:col-span-2" hint="One per line.">
            <Textarea id="business-goals" name="brain.business.businessGoals" rows={2} placeholder="Grow online revenue 30%&#10;Expand to 2 new cities" />
          </Field>
        </div>
      </Section>

      {/* D - Marketing */}
      <Section title="Marketing" description="Objectives, KPIs and current priorities.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Objectives" htmlFor="marketing-objectives" hint="One per line.">
            <Textarea id="marketing-objectives" name="brain.marketing.objectives" rows={2} placeholder="Increase qualified leads&#10;Improve ROAS" />
          </Field>
          <Field label="Primary KPIs" htmlFor="marketing-kpis" hint="One per line.">
            <Textarea id="marketing-kpis" name="brain.marketing.kpis" rows={2} placeholder="ROAS&#10;CPA&#10;Website conversion rate" />
          </Field>
          <Field label="Target channels" htmlFor="marketing-channels" className="sm:col-span-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {MARKETING_CHANNELS.map((channel) => (
                <label key={channel} className="flex items-center gap-1.5 text-sm text-foreground">
                  <input type="checkbox" name="brain.marketing.targetChannels" value={channel} className="h-4 w-4 rounded border-input" />
                  {channel.replace('_', ' ')}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Important campaigns / history" htmlFor="marketing-history" className="sm:col-span-2">
            <Textarea id="marketing-history" name="brain.marketing.campaignHistory" rows={2} placeholder="What's worked or been tried before…" />
          </Field>
          <Field label="Current priorities" htmlFor="marketing-priorities" className="sm:col-span-2" hint="One per line.">
            <Textarea id="marketing-priorities" name="brain.marketing.currentPriorities" rows={2} placeholder="Launch spring campaign&#10;Fix Google Ads CPA" />
          </Field>
        </div>
      </Section>

      {/* E - Brand */}
      <Section title="Brand" description="Voice, visual identity and messaging rules the AI must respect.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Brand voice" htmlFor="brand-voice">
            <Input id="brand-voice" name="brain.brand.voice" placeholder="e.g. Warm, expert, direct" />
          </Field>
          <Field label="Tone" htmlFor="brand-tone">
            <Input id="brand-tone" name="brain.brand.tone" placeholder="e.g. Friendly but professional" />
          </Field>
          <Field label="Primary colors" htmlFor="brand-colors" hint="One per line, hex or name.">
            <Textarea id="brand-colors" name="brain.brand.colors" rows={2} placeholder="#C1584F&#10;#201F1E" />
          </Field>
          <Field label="Fonts" htmlFor="brand-fonts" hint="One per line.">
            <Textarea id="brand-fonts" name="brain.brand.fonts" rows={2} placeholder="Inter&#10;Georgia" />
          </Field>
          <Field label="Visual style rules" htmlFor="brand-visual" className="sm:col-span-2">
            <Textarea id="brand-visual" name="brain.brand.visualRules" rows={2} placeholder="Logo clear space, imagery style…" />
          </Field>
          <Field label="Restricted imagery / claims" htmlFor="brand-restricted" className="sm:col-span-2">
            <Textarea id="brand-restricted" name="brain.brand.restrictedImagery" rows={2} placeholder="Never show competitor logos, no medical claims…" />
          </Field>
          <Field label="Messaging rules" htmlFor="brand-messaging" className="sm:col-span-2">
            <Textarea id="brand-messaging" name="brain.brand.messagingRules" rows={2} placeholder="Always say 'clients', never 'customers'…" />
          </Field>
        </div>
      </Section>

      {/* F - Audience */}
      <Section title="Audience" description="Who this client is trying to reach.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Primary personas" htmlFor="audience-personas" hint="One per line.">
            <Textarea id="audience-personas" name="brain.audience.personas" rows={2} placeholder="Busy urban parent&#10;First-time homebuyer" />
          </Field>
          <Field label="Demographics" htmlFor="audience-demographics">
            <Textarea id="audience-demographics" name="brain.audience.demographics" rows={2} placeholder="Age, income, location…" />
          </Field>
          <Field label="Pain points" htmlFor="audience-pain" hint="One per line.">
            <Textarea id="audience-pain" name="brain.audience.painPoints" rows={2} />
          </Field>
          <Field label="Motivations" htmlFor="audience-motivations" hint="One per line.">
            <Textarea id="audience-motivations" name="brain.audience.motivations" rows={2} />
          </Field>
          <Field label="Buyer journey" htmlFor="audience-journey">
            <Textarea id="audience-journey" name="brain.audience.buyingJourney" rows={2} placeholder="How do they usually find and buy?" />
          </Field>
          <Field label="Common objections" htmlFor="audience-objections" hint="One per line.">
            <Textarea id="audience-objections" name="brain.audience.objections" rows={2} />
          </Field>
        </div>
      </Section>

      {/* G - Competitors */}
      <Section title="Competitors">
        {[0, 1].map((i) => (
          <fieldset key={i} className="grid grid-cols-1 gap-3 rounded-md border border-dashed border-border p-3 sm:grid-cols-3">
            <legend className="px-1 text-xs font-medium text-caption">Competitor {i + 1}</legend>
            <Field label="Name" htmlFor={`competitorName-${i}`}>
              <Input id={`competitorName-${i}`} name="competitorName" placeholder="Competitor name" />
            </Field>
            <Field label="Website" htmlFor={`competitorUrl-${i}`}>
              <Input id={`competitorUrl-${i}`} name="competitorUrl" placeholder="https://…" />
            </Field>
            <Field label="Notes" htmlFor={`competitorNotes-${i}`}>
              <Input id={`competitorNotes-${i}`} name="competitorNotes" placeholder="Positioning, pricing…" />
            </Field>
          </fieldset>
        ))}
      </Section>

      {/* H - Automation */}
      <Section title="Automation">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Automation mode" htmlFor="automationLevel" className="sm:col-span-2">
            <select id="automationLevel" name="automationLevel" defaultValue="MANUAL" className={selectClass}>
              {AUTOMATION_LEVELS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label} - {a.description}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Max daily ad budget" htmlFor="policy-max-daily">
            <Input id="policy-max-daily" name="policy.maxDailyAdBudget" type="number" min={0} step="0.01" placeholder="e.g. 150" />
          </Field>
          <Field label="Max budget change per action (%)" htmlFor="policy-max-change">
            <Input id="policy-max-change" name="policy.maxBudgetChangePercent" type="number" min={0} max={100} placeholder="e.g. 20" />
          </Field>
          <div className="sm:col-span-2 space-y-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" name="policy.requireApprovalForCampaignLaunch" defaultChecked className="h-4 w-4 rounded border-input" />
              Require human approval before a campaign launches
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" name="policy.autoPublishSocial" className="h-4 w-4 rounded border-input" />
              Allow social posts to publish automatically once approved
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" name="policy.autoChangeAds" className="h-4 w-4 rounded border-input" />
              Allow ad budget/bid changes to run automatically within limits
            </label>
          </div>
        </div>
      </Section>

      {/* I - Internal */}
      <Section title="Internal notes">
        <Field label="Notes for your team" htmlFor="internalNotes" hint="Not visible to the client.">
          <Textarea id="internalNotes" name="internalNotes" rows={3} placeholder="Anything the next account manager should know…" />
        </Field>
      </Section>

      <div className="sticky bottom-0 flex items-center justify-end gap-2 rounded-lg border border-border bg-card p-3 shadow-popover">
        <Button type="button" variant="ghost" onClick={() => router.push('/dashboard/clients')}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Creating client…">Create client</SubmitButton>
      </div>
    </ActionForm>
  )
}
