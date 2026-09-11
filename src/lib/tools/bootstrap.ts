/**
 * Ensures every provider's tools (and the agents that depend on them) are
 * registered in the current process before `executeTool` runs one.
 *
 * `registerTool` (src/lib/tools/registry.ts) stores a tool's callable
 * implementation in an in-memory `Map` - it can't live in Postgres - and
 * every provider module (metricool/ga4/gsc/google-ads/meta-ads `tools.ts`)
 * exports a `register*Tools()` that populates it. Until this file existed, nothing in
 * the app itself ever called those functions outside test suites' own
 * `beforeAll` blocks: `executeTool` would resolve the `Tool` database row
 * fine (registerTool also upserts that) but find no matching in-memory
 * implementation on a freshly started server process, and throw
 * `ToolNotFoundError` on the very first tool call - e.g. every "Analyze
 * this client" run, or a content-calendar item's first "Schedule" click.
 * Found while wiring the content calendar's Metricool scheduling
 * (docs/DECISIONS.md) - not exercised earlier because prior live
 * verification always seeded AiRun/Recommendation rows directly rather
 * than actually invoking the workflow through a running server process.
 *
 * Guarded by a module-scope boolean so it only runs once per process,
 * however many times `executeTool` calls it.
 */
import { registerMetricoolTools } from '@/lib/integrations/metricool/tools'
import { registerGA4Tools } from '@/lib/integrations/ga4/tools'
import { registerGSCTools } from '@/lib/integrations/gsc/tools'
import { registerGoogleAdsTools } from '@/lib/integrations/google-ads/tools'
import { registerMetaAdsTools } from '@/lib/integrations/meta-ads/tools'
import { registerMarketingAnalyticsAgent } from '@/lib/agents/analytics-agent'
import { registerSeoAgent } from '@/lib/agents/seo-agent'
import { registerCompetitorAgent } from '@/lib/agents/competitor-agent'

let registered = false
let inFlight: Promise<void> | undefined

export async function ensureToolsRegistered(): Promise<void> {
  if (registered) return
  if (!inFlight) {
    inFlight = (async () => {
      await registerMetricoolTools()
      await registerGA4Tools()
      await registerGSCTools()
      await registerGoogleAdsTools()
      await registerMetaAdsTools()
      await registerMarketingAnalyticsAgent() // depends on the metricool/ga4/gsc/google-ads/meta-ads tools above already being registered
      await registerSeoAgent() // depends on the gsc tool above already being registered
      await registerCompetitorAgent() // no tool dependencies - allowedToolKeys: []
      registered = true
    })()
  }
  await inFlight
}

/** Test-only: forces the next `ensureToolsRegistered()` call to re-run, mirroring `_resetToolRegistryForTests`. */
export function _resetBootstrapForTests(): void {
  registered = false
  inFlight = undefined
}
