import type { CreativeDesignRecord, CreativeProvider, CreativeSearchResult } from '../providers'
import { UnsupportedOperationError } from '../errors'

/**
 * The real Canva adapter - every method currently `UnsupportedOperationError`.
 *
 * BRD Section 55 itself frames Canva as "an optional external dependency
 * until access for TargetGum's custom integration is confirmed," and
 * Section 112 requires the whole app to degrade gracefully if it's
 * unavailable - this adapter's current shape (fully unsupported, fully
 * caught by the mock) is exactly that degraded state, not a shortcut
 * around it.
 *
 * Unlike Metricool (`src/lib/integrations/metricool/provider.ts`), whose
 * MCP tool names/schemas were checked live against a real, connected
 * Metricool MCP server in this exact session, no Canva MCP connection has
 * ever been available here to check anything against - the tool names a
 * real adapter would call (create_design, export_design, etc.) are not
 * confirmed. CLAUDE.md rule 5/BRD Section 15/116 rule out fabricating a
 * protocol implementation that can't be verified - same choice already
 * made for `metricool.publish_post`'s and the native Ads providers' real
 * adapters, for the same reason.
 *
 * `CanvaMockProvider` (mock-provider.ts) is what actually implements the
 * full interface and is what every canva.* Tool Registry entry, the
 * Creative Agent's downstream design-generation step, and every test
 * exercises today. Once a real Canva MCP connection exists, replace each
 * method body below with an actual `callCanvaTool`-style call (mirroring
 * `src/lib/integrations/metricool/mcp-client.ts`'s pattern, which the
 * `@modelcontextprotocol/sdk` machinery here is already proven to support)
 * - the interface and every call site stay unchanged.
 */
export function createCanvaProvider(): CreativeProvider {
  return {
    async createDesign(): Promise<CreativeDesignRecord> {
      throw new UnsupportedOperationError('canva', 'createDesign', 'no verified Canva MCP connection - see docs/EXTERNAL-APPROVALS.md')
    },
    async editDesign(): Promise<CreativeDesignRecord> {
      throw new UnsupportedOperationError('canva', 'editDesign', 'no verified Canva MCP connection - see docs/EXTERNAL-APPROVALS.md')
    },
    async searchDesigns(): Promise<CreativeSearchResult[]> {
      throw new UnsupportedOperationError('canva', 'searchDesigns', 'no verified Canva MCP connection - see docs/EXTERNAL-APPROVALS.md')
    },
    async searchAssets(): Promise<CreativeSearchResult[]> {
      throw new UnsupportedOperationError('canva', 'searchAssets', 'no verified Canva MCP connection - see docs/EXTERNAL-APPROVALS.md')
    },
    async exportDesign(): Promise<CreativeDesignRecord> {
      throw new UnsupportedOperationError('canva', 'exportDesign', 'no verified Canva MCP connection - see docs/EXTERNAL-APPROVALS.md')
    },
  }
}
