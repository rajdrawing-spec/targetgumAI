import { randomUUID } from 'crypto'
import type { CreativeDesignInput, CreativeDesignRecord, CreativeProvider, CreativeSearchResult } from '../providers'

/**
 * Full mock implementation of `CreativeProvider` (BRD Section 92) -
 * deterministic, in-memory, no network. `designUrl` always points at a
 * fake but realistic-looking Canva editing link ("continue editing
 * through Canva" - BRD Section 17), never a placeholder that could be
 * mistaken for a working link if a screenshot or log line escaped its
 * mock context. `exportDesign` is a distinct step from `createDesign` -
 * a design can be created/edited indefinitely and only gets an
 * `exportUrl` once actually exported, matching Canva's own real behavior.
 */
class MockState {
  designs = new Map<string, CreativeDesignRecord & { title: string; concept: string; copy?: string; platform: string }>()
}

const state = new MockState()

function toSearchResult(record: { providerDesignId: string; title: string; thumbnailUrl?: string }): CreativeSearchResult {
  return { providerAssetId: record.providerDesignId, title: record.title, thumbnailUrl: record.thumbnailUrl }
}

export const CanvaMockProvider: CreativeProvider = {
  async createDesign(_brandId, input: CreativeDesignInput): Promise<CreativeDesignRecord> {
    const providerDesignId = randomUUID()
    const record = {
      providerDesignId,
      designUrl: `https://www.canva.com/design/mock-${providerDesignId}/edit`,
      status: 'draft',
      thumbnailUrl: `https://www.canva.com/design/mock-${providerDesignId}/thumbnail`,
      title: input.title,
      concept: input.concept,
      copy: input.copy,
      platform: input.platform,
    }
    state.designs.set(providerDesignId, record)
    return record
  },

  async editDesign(providerDesignId, input): Promise<CreativeDesignRecord> {
    const record = state.designs.get(providerDesignId)
    if (!record) throw new Error(`Mock: no Canva design with id "${providerDesignId}".`)
    Object.assign(record, input)
    return record
  },

  async searchDesigns(_brandId, query): Promise<CreativeSearchResult[]> {
    return Array.from(state.designs.values())
      .filter((d) => d.title.toLowerCase().includes(query.toLowerCase()))
      .map(toSearchResult)
  },

  async searchAssets(_brandId, query): Promise<CreativeSearchResult[]> {
    // No separate brand-asset library in this mock - a deterministic single result keyed off the query, standing in for Canva's real brand asset search.
    return [{ providerAssetId: `mock-brand-asset-${query.toLowerCase().replace(/\s+/g, '-')}`, title: `Mock brand asset: ${query}` }]
  },

  async exportDesign(providerDesignId): Promise<CreativeDesignRecord> {
    const record = state.designs.get(providerDesignId)
    if (!record) throw new Error(`Mock: no Canva design with id "${providerDesignId}".`)
    record.exportUrl = `https://export.canva.com/mock-${providerDesignId}.png`
    record.status = 'exported'
    return record
  },
}
