import type { CreativeProvider } from '../providers'
import { CanvaMockProvider } from './mock-provider'
import { createCanvaProvider } from './provider'

/**
 * Resolves the CreativeProvider to use for Canva calls. `CANVA_MCP_URL`
 * presence is the configuration signal (matching every other provider's
 * `resolve*Provider` shape) - even when set, `createCanvaProvider()` still
 * throws `UnsupportedOperationError` on every call today (see provider.ts's
 * doc comment for why), so in practice this always resolves to the mock
 * until a real adapter is implemented.
 */
export function resolveCanvaProvider(): CreativeProvider {
  if (!process.env.CANVA_MCP_URL) {
    console.warn('[canva] CANVA_MCP_URL not configured - using CanvaMockProvider.')
    return CanvaMockProvider
  }
  return createCanvaProvider()
}

export { CanvaMockProvider } from './mock-provider'
export { createCanvaProvider } from './provider'
