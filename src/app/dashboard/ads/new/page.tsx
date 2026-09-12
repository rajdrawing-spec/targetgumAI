import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Megaphone, ShoppingBag, Sparkles } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listAccessibleClients } from '@/lib/clients/list'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ActionForm, FieldError, SubmitButton } from '@/components/ui/action-form'
import { Input, Textarea } from '@/components/ui/input'
import { buttonVariants } from '@/components/ui/button'
import { createCampaignAction } from '../actions'

export default async function NewCampaignPage({ searchParams }: { searchParams: Promise<{ platform?: string; clientId?: string }> }) {
  const [sp, ctx] = await Promise.all([searchParams, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const clients = await listAccessibleClients(ctx)
  const defaultPlatform = sp.platform ?? 'AMAZON_ADS'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/ads" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 font-medium">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Ads Hub
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <Megaphone className="h-6 w-6 text-primary" /> Create New Ad Set & Campaign
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Launch multi-platform ad sets across Amazon PPC, Google Ads, or Meta Ads with automated AI impression tracking.
        </p>
      </div>

      <Card className="shadow-card border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Campaign Parameters</CardTitle>
          <CardDescription>
            Configure targeting, budget limits, and platform-specific bidding.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={createCampaignAction} className="space-y-5">
            {/* Client Selection */}
            <div>
              <label htmlFor="clientId" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                Client Account
              </label>
              <select
                id="clientId"
                name="clientId"
                required
                defaultValue={sp.clientId ?? clients[0]?.id}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-subtle"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Campaign Name */}
            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                Campaign / Ad Set Name
              </label>
              <Input
                id="name"
                name="name"
                required
                placeholder="e.g. Amazon PPC - Sponsored Products (Exact Match Top ASINs)"
              />
              <FieldError name="name" />
            </div>

            {/* Platform Selection */}
            <div>
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                Advertising Platform
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-center gap-2.5 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/40 transition-colors has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50/50">
                  <input
                    type="radio"
                    name="provider"
                    value="AMAZON_ADS"
                    defaultChecked={defaultPlatform === 'AMAZON_ADS'}
                    className="h-4 w-4 text-amber-600 border-input"
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Amazon PPC</p>
                    <p className="text-[11px] text-muted-foreground">Sponsored Products & Brands</p>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/40 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50/50">
                  <input
                    type="radio"
                    name="provider"
                    value="GOOGLE_ADS"
                    defaultChecked={defaultPlatform === 'GOOGLE_ADS'}
                    className="h-4 w-4 text-blue-600 border-input"
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Google Ads</p>
                    <p className="text-[11px] text-muted-foreground">Search & Performance Max</p>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/40 transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50/50">
                  <input
                    type="radio"
                    name="provider"
                    value="META_ADS"
                    defaultChecked={defaultPlatform === 'META_ADS'}
                    className="h-4 w-4 text-indigo-600 border-input"
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Meta Ads</p>
                    <p className="text-[11px] text-muted-foreground">Instagram & Facebook Feed</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Amazon PPC Specific Options */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-4">
              <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
                <ShoppingBag className="h-4 w-4 text-amber-600" /> Amazon PPC Settings
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="amazonType" className="block text-xs font-medium text-foreground mb-1">
                    Amazon Campaign Type
                  </label>
                  <select
                    id="amazonType"
                    name="amazonType"
                    defaultValue="SPONSORED_PRODUCTS"
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-subtle"
                  >
                    <option value="SPONSORED_PRODUCTS">Sponsored Products</option>
                    <option value="SPONSORED_BRANDS">Sponsored Brands (Headline & Video)</option>
                    <option value="SPONSORED_DISPLAY">Sponsored Display</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="amazonTargeting" className="block text-xs font-medium text-foreground mb-1">
                    Targeting Method
                  </label>
                  <select
                    id="amazonTargeting"
                    name="amazonTargeting"
                    defaultValue="MANUAL_KEYWORD"
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-subtle"
                  >
                    <option value="MANUAL_KEYWORD">Manual Keyword Targeting (Exact/Phrase/Broad)</option>
                    <option value="MANUAL_PRODUCT">Product / ASIN Targeting</option>
                    <option value="AUTO">Automatic Targeting (Close & Loose Match)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="targetAcos" className="block text-xs font-medium text-foreground mb-1">
                    Target ACoS (%)
                  </label>
                  <Input id="targetAcos" name="targetAcos" type="number" min={5} max={100} defaultValue="22" placeholder="e.g. 22" />
                </div>

                <div>
                  <label htmlFor="defaultBid" className="block text-xs font-medium text-foreground mb-1">
                    Default Bid ($)
                  </label>
                  <Input id="defaultBid" name="defaultBid" type="number" step="0.05" min={0.1} defaultValue="1.35" placeholder="e.g. 1.35" />
                </div>

                <div>
                  <label htmlFor="asin" className="block text-xs font-medium text-foreground mb-1">
                    Target ASIN / SKU
                  </label>
                  <Input id="asin" name="asin" placeholder="e.g. B09X4KLMN8" />
                </div>
              </div>
            </div>

            {/* Budget & Channel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="budget" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                  Monthly Ad Spend Budget ($)
                </label>
                <Input
                  id="budget"
                  name="budget"
                  type="number"
                  required
                  min={50}
                  defaultValue="1000"
                />
              </div>

              <div>
                <label htmlFor="channel" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                  Channel / Sub-Placement
                </label>
                <Input
                  id="channel"
                  name="channel"
                  placeholder="e.g. Amazon Search Page 1 or Google Search Top"
                />
              </div>
            </div>

            {/* Keyword Targeting */}
            <div>
              <label htmlFor="keywords" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                Target Keywords / Search Terms (Comma separated)
              </label>
              <Textarea
                id="keywords"
                name="keywords"
                rows={2}
                placeholder="wireless earbuds, bluetooth noise cancelling headphones, waterproof gym earbuds"
              />
            </div>

            {/* Negative Keywords */}
            <div>
              <label htmlFor="negativeKeywords" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                Negative Keywords (Exclude Wasted Spend)
              </label>
              <Input
                id="negativeKeywords"
                name="negativeKeywords"
                placeholder="free, diy, repair, cheap, used, jobs"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Prevents ad impressions on non-buying queries to protect your ACoS and CTR.
              </p>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-border">
              <Link href="/dashboard/ads" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                Cancel
              </Link>
              <SubmitButton size="default" className="gap-2 shadow-sm font-semibold">
                <Sparkles className="h-4 w-4" /> Launch Ad Set
              </SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  )
}
