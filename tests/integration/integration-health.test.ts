import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  connectClientToProviderAccount,
  recordIntegrationSuccess,
  requireProviderConnection,
  withIntegrationHealthTracking,
} from '@/lib/integrations/health'
import { IntegrationUnavailableError } from '@/lib/integrations/errors'
import { db } from '@/lib/db/client'
import { cleanupOrg, createTestClient, createTestOrg } from '../helpers/factory'

describe('Integration connection model + health tracking (BRD Section 33/34)', () => {
  let orgId: string
  let clientId: string
  let unconnectedClientId: string

  beforeAll(async () => {
    const org = await createTestOrg()
    orgId = org.id
    const client = await createTestClient(orgId, 'Health Test Client')
    clientId = client.id
    const unconnectedClient = await createTestClient(orgId, 'Unconnected Client')
    unconnectedClientId = unconnectedClient.id

    await connectClientToProviderAccount({
      organizationId: orgId,
      clientId,
      provider: 'METRICOOL',
      externalAccountId: 'mock-brand-123',
      label: 'Mock Brand',
      createdBy: 'test',
    })
  })

  afterAll(async () => {
    await cleanupOrg(orgId)
  })

  it('a new connection starts AUTH_REQUIRED, not assumed connected', async () => {
    const connection = await db.integrationConnection.findFirst({ where: { clientId } })
    expect(connection?.status).toBe('AUTH_REQUIRED')
  })

  it('requireProviderConnection denies use of an AUTH_REQUIRED connection, never fabricating data', async () => {
    await expect(requireProviderConnection(clientId, 'METRICOOL')).rejects.toThrow(IntegrationUnavailableError)
  })

  it('requireProviderConnection denies a client with no connection at all', async () => {
    await expect(requireProviderConnection(unconnectedClientId, 'METRICOOL')).rejects.toThrow(
      IntegrationUnavailableError,
    )
  })

  it('withIntegrationHealthTracking marks CONNECTED on success and passes the brandId through', async () => {
    // First call transitions AUTH_REQUIRED -> CONNECTED via a successful run.
    const connection = await db.integrationConnection.findFirstOrThrow({ where: { clientId } })
    await recordIntegrationSuccess(connection.id) // simulate an initial manual verification

    const brandIdSeen = await withIntegrationHealthTracking(clientId, 'METRICOOL', async (brandId) => brandId)
    expect(brandIdSeen).toBe('mock-brand-123')

    const updated = await db.integrationConnection.findUniqueOrThrow({ where: { id: connection.id } })
    expect(updated.status).toBe('CONNECTED')
    expect(updated.lastSuccessfulSyncAt).not.toBeNull()
  })

  it('withIntegrationHealthTracking records failure and surfaces IntegrationUnavailableError with the last successful sync time, never fabricating a result', async () => {
    await expect(
      withIntegrationHealthTracking(clientId, 'METRICOOL', async () => {
        throw new Error('simulated provider failure')
      }),
    ).rejects.toThrow(IntegrationUnavailableError)

    const connection = await db.integrationConnection.findFirstOrThrow({ where: { clientId } })
    expect(connection.status).toBe('ERROR')
    expect(connection.lastErrorMessage).toContain('simulated provider failure')
    expect(connection.lastSuccessfulSyncAt).not.toBeNull() // preserved from the prior success
  })
})
