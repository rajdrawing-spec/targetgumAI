/**
 * If a provider call fails, callers must surface this - never fabricate
 * data (BRD-PRD Section 56: "Integration unavailable. Last successful
 * data: timestamp.").
 */
export class IntegrationUnavailableError extends Error {
  constructor(
    public readonly provider: string,
    reason: string,
    public readonly lastSuccessfulSyncAt: Date | null = null,
  ) {
    const suffix = lastSuccessfulSyncAt
      ? ` Last successful data: ${lastSuccessfulSyncAt.toISOString()}.`
      : ' No successful sync on record.'
    super(`${provider} integration unavailable: ${reason}${suffix}`)
    this.name = 'IntegrationUnavailableError'
  }
}

/**
 * A provider adapter doesn't (or can't) implement a given operation - e.g.
 * Metricool has no ads write endpoints at all (docs/INTEGRATIONS.md). Never
 * silently no-op; always throw this so the caller/workflow sees a clear
 * failure rather than an operation that appeared to succeed.
 */
export class UnsupportedOperationError extends Error {
  constructor(provider: string, operation: string, detail?: string) {
    super(
      `${provider} does not support "${operation}"${detail ? `: ${detail}` : '.'} See docs/INTEGRATIONS.md.`,
    )
    this.name = 'UnsupportedOperationError'
  }
}
