import { describe, expect, it } from 'vitest'
import { UnsupportedOperationError } from '@/lib/integrations/errors'
import { CanvaMockProvider } from '@/lib/integrations/canva/mock-provider'
import { createCanvaProvider } from '@/lib/integrations/canva/provider'

/**
 * Canva `CreativeProvider` (Phase 2, BRD Section 17/92): `CanvaMockProvider`
 * is what every canva.* Tool Registry entry, the Creative Agent's
 * downstream design-generation step, and every test actually exercises -
 * the real adapter stays `UnsupportedOperationError` for every method (no
 * verified Canva MCP connection in this environment, docs/DECISIONS.md
 * has the full reasoning).
 */
describe('CanvaMockProvider (BRD Section 92 - full CreativeProvider interface, no network)', () => {
  it('createDesign returns a real Canva-shaped editing link ("continue editing through Canva" - BRD Section 17)', async () => {
    const design = await CanvaMockProvider.createDesign('brand-1', {
      title: 'Spring Sale Concept',
      concept: 'A bright, energetic flat-lay of the product with a bold discount callout.',
      copy: 'Spring into savings - 20% off this week only.',
      platform: 'instagram',
    })
    expect(design.status).toBe('draft')
    expect(design.designUrl).toContain('canva.com/design/')
    expect(design.exportUrl).toBeUndefined()
  })

  it('editDesign mutates the stored design in place', async () => {
    const design = await CanvaMockProvider.createDesign('brand-1', {
      title: 'Original title',
      concept: 'Original concept',
      platform: 'instagram',
    })
    const edited = await CanvaMockProvider.editDesign(design.providerDesignId, { title: 'Updated title' })
    expect(edited.providerDesignId).toBe(design.providerDesignId)

    const [found] = await CanvaMockProvider.searchDesigns('brand-1', 'Updated title')
    expect(found?.providerAssetId).toBe(design.providerDesignId)
  })

  it('throws for editDesign on an unknown design id', async () => {
    await expect(CanvaMockProvider.editDesign('does-not-exist', {})).rejects.toThrow()
  })

  it('searchDesigns filters by title, case-insensitively', async () => {
    await CanvaMockProvider.createDesign('brand-1', { title: 'Summer Launch', concept: 'x', platform: 'facebook' })
    const results = await CanvaMockProvider.searchDesigns('brand-1', 'summer')
    expect(results.some((r) => r.title === 'Summer Launch')).toBe(true)
  })

  it('searchAssets returns a deterministic result for the query (BRD Section 17\'s "Access brand assets")', async () => {
    const results = await CanvaMockProvider.searchAssets('brand-1', 'logo')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.title).toContain('logo')
  })

  it('exportDesign is a distinct step from createDesign - only populates exportUrl once actually exported', async () => {
    const design = await CanvaMockProvider.createDesign('brand-1', { title: 'Export Me', concept: 'x', platform: 'instagram' })
    expect(design.exportUrl).toBeUndefined()

    const exported = await CanvaMockProvider.exportDesign(design.providerDesignId)
    expect(exported.exportUrl).toContain('export.canva.com')
    expect(exported.status).toBe('exported')
  })

  it('throws for exportDesign on an unknown design id', async () => {
    await expect(CanvaMockProvider.exportDesign('does-not-exist')).rejects.toThrow()
  })
})

describe('Canva real adapter (not live-verified - no Canva MCP connection, see docs/EXTERNAL-APPROVALS.md)', () => {
  it('every CreativeProvider method throws UnsupportedOperationError', async () => {
    const provider = createCanvaProvider()
    await expect(provider.createDesign('b', { title: 't', concept: 'c', platform: 'instagram' })).rejects.toThrow(UnsupportedOperationError)
    await expect(provider.editDesign('d', {})).rejects.toThrow(UnsupportedOperationError)
    await expect(provider.searchDesigns('b', 'q')).rejects.toThrow(UnsupportedOperationError)
    await expect(provider.searchAssets('b', 'q')).rejects.toThrow(UnsupportedOperationError)
    await expect(provider.exportDesign('d')).rejects.toThrow(UnsupportedOperationError)
  })
})
