import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js'

/**
 * Low-level MCP client for Metricool's MCP server. This is a SEPARATE
 * connection from any MCP server available to a Claude Code session - the
 * running TargetGum application is its own MCP client, connecting out to
 * `METRICOOL_MCP_URL` with `METRICOOL_API_KEY`, independent of whatever
 * tooling built this code.
 *
 * NOT LIVE-VERIFIED: no METRICOOL_MCP_URL/METRICOOL_API_KEY is configured
 * in any environment this code has run in - see docs/EXTERNAL-APPROVALS.md.
 * The exact auth header (`Authorization: Bearer <key>` below) is a
 * reasonable default, not confirmed against Metricool's real MCP server -
 * adjust once real connection details are available. The tool names and
 * schemas this wraps ARE verified (checked live against a working
 * Metricool MCP connection during Day 1 architecture work - see
 * docs/DECISIONS.md and docs/INTEGRATIONS.md).
 */

let client: Client | undefined

/**
 * Minimal local shape for the content blocks in a CallToolResult. The SDK's
 * own inferred type for `.content` doesn't narrow cleanly through
 * TypeScript here (a zod-v4-via-z.core.$loose quirk, not a logic bug) -
 * this sidesteps it rather than fighting the inference.
 */
interface ToolResultTextBlock {
  type: 'text'
  text: string
}

function getConfig(): { url: string; apiKey?: string } {
  const url = process.env.METRICOOL_MCP_URL
  if (!url) {
    throw new Error(
      'METRICOOL_MCP_URL is not configured. Set it in your environment (see .env.example), or use MetricoolMockProvider for development without a live connection.',
    )
  }
  return { url, apiKey: process.env.METRICOOL_API_KEY }
}

async function getClient(): Promise<Client> {
  if (client) return client

  const { url, apiKey } = getConfig()
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : undefined,
  })

  const mcpClient = new Client({ name: 'targetgum-ai-marketing-os', version: '0.1.0' }, { capabilities: {} })
  await mcpClient.connect(transport)
  client = mcpClient
  return client
}

/**
 * Calls a Metricool MCP tool and returns its data payload. Prefers
 * `structuredContent` when the server provides it; otherwise parses the
 * first text content block as JSON (falls back to the raw string).
 * Throws if the tool call itself reports `isError`.
 */
export async function callMetricoolTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const mcpClient = await getClient()
  const result = await mcpClient.callTool({ name: toolName, arguments: args }, CallToolResultSchema)
  const content = (result.content ?? []) as unknown as ToolResultTextBlock[]

  if (result.isError) {
    const message = content.find((block) => block.type === 'text')?.text ?? 'Unknown MCP tool error.'
    throw new Error(`Metricool MCP tool "${toolName}" failed: ${message}`)
  }

  if (result.structuredContent) {
    return result.structuredContent
  }

  const textBlock = content.find((block) => block.type === 'text')
  if (!textBlock) return null
  try {
    return JSON.parse(textBlock.text)
  } catch {
    return textBlock.text
  }
}

/** Test-only: inject a stand-in client so the adapter's mapping logic is testable without a live Metricool MCP server. */
export function setMetricoolClientForTests(mockClient: Client): void {
  client = mockClient
}

/** Test-only: reset the cached client (real or injected) between tests. */
export function resetMetricoolClientForTests(): void {
  client = undefined
}
