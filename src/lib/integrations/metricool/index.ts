import type { AdsProvider, SocialProvider } from '../providers'
import { MetricoolMockProvider } from './mock-provider'
import { MetricoolProvider } from './provider'

/**
 * Resolves which Metricool implementation to use. Real adapter when
 * METRICOOL_MCP_URL is configured; otherwise the mock, with a warning -
 * BRD Section 92's "every external integration should have a mock/test
 * implementation... enables end-to-end workflow development without
 * production credentials."
 */
export function getMetricoolProvider(): SocialProvider & Partial<AdsProvider> {
  if (process.env.METRICOOL_MCP_URL) {
    return MetricoolProvider
  }
  console.warn('[metricool] METRICOOL_MCP_URL not configured - using MetricoolMockProvider.')
  return MetricoolMockProvider
}

export { MetricoolMockProvider } from './mock-provider'
export { MetricoolProvider } from './provider'
