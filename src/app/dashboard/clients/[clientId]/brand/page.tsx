import { redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getClientBrainSection, listClientBrandAssets } from '@/lib/clients/brain'
import type { BrandSectionSchema } from '@/lib/clients/brain-schemas'
import type { z } from 'zod'
import { updateBrainSectionAction } from '../../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/input'
import { ActionForm, SubmitButton } from '@/components/ui/action-form'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/clients/section'
import { Palette } from 'lucide-react'

type Brand = z.infer<typeof BrandSectionSchema>
const joinLines = (v?: string[]) => v?.join('\n') ?? ''

export default async function ClientBrandPage({ params }: { params: Promise<{ clientId: string }> }) {
  const [{ clientId }, ctx] = await Promise.all([params, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const [section, assets] = await Promise.all([
    getClientBrainSection(ctx, clientId, 'brand') as Promise<Brand | null>,
    listClientBrandAssets(ctx, clientId),
  ])
  const brand = section ?? ({} as Brand)
  const canEdit = ctx.permissions.has('clients.edit')

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand assets</CardTitle>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <EmptyState icon={Palette} title="No brand assets uploaded yet" description="Logos, color palettes and fonts appear here once added." />
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {assets.map((asset) => (
                <li key={asset.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{asset.label}</p>
                    <p className="text-xs text-caption">{asset.type.replace('_', ' ').toLowerCase()}</p>
                  </div>
                  {asset.restricted && <span className="shrink-0 text-xs text-destructive">Restricted</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand voice & rules</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={updateBrainSectionAction.bind(null, clientId, 'brand')} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Brand voice" htmlFor="brand-voice">
              <Textarea id="brand-voice" name="brain.brand.voice" rows={2} defaultValue={brand.voice ?? ''} disabled={!canEdit} />
            </Field>
            <Field label="Tone" htmlFor="brand-tone">
              <Textarea id="brand-tone" name="brain.brand.tone" rows={2} defaultValue={brand.tone ?? ''} disabled={!canEdit} />
            </Field>
            <Field label="Primary colors" htmlFor="brand-colors" hint="One per line.">
              <Textarea id="brand-colors" name="brain.brand.colors" rows={2} defaultValue={joinLines(brand.colors)} disabled={!canEdit} />
            </Field>
            <Field label="Fonts" htmlFor="brand-fonts" hint="One per line.">
              <Textarea id="brand-fonts" name="brain.brand.fonts" rows={2} defaultValue={joinLines(brand.fonts)} disabled={!canEdit} />
            </Field>
            <Field label="Visual style rules" htmlFor="brand-visual" className="sm:col-span-2">
              <Textarea id="brand-visual" name="brain.brand.visualRules" rows={3} defaultValue={brand.visualRules ?? ''} disabled={!canEdit} />
            </Field>
            <Field label="Restricted imagery / claims" htmlFor="brand-restricted" className="sm:col-span-2">
              <Textarea id="brand-restricted" name="brain.brand.restrictedImagery" rows={3} defaultValue={brand.restrictedImagery ?? ''} disabled={!canEdit} />
            </Field>
            <Field label="Messaging rules" htmlFor="brand-messaging" className="sm:col-span-2">
              <Textarea id="brand-messaging" name="brain.brand.messagingRules" rows={3} defaultValue={brand.messagingRules ?? ''} disabled={!canEdit} />
            </Field>
            {canEdit && (
              <div className="sm:col-span-2">
                <SubmitButton pendingLabel="Saving…">Save brand profile</SubmitButton>
              </div>
            )}
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  )
}
