/**
 * MVP placeholder defaults, shared by every caller that triggers an
 * analysis without the caller specifying a network/channel/range
 * explicitly (the dashboard's "Analyze this client" button,
 * `src/app/dashboard/actions.ts`, and the weekly automation worker,
 * `src/lib/queue/weekly-intelligence-worker.ts`) - extracted here once a
 * second caller needed them (pure refactor, no behavior change), same
 * "extract on second use" discipline as `src/lib/integrations/
 * ads-schemas.ts`/`src/lib/agents/schemas.ts`.
 *
 * A client-level "default channel" setting (Client Brain/policy) is the
 * natural home for these once more than one network/channel is in play -
 * not built yet, same gap this comment has flagged since Day 13.
 */
export const DEFAULT_RANGE_DAYS = 30
export const DEFAULT_SOCIAL_NETWORK = 'instagram'
export const DEFAULT_ADS_CHANNEL = 'googleAds'
