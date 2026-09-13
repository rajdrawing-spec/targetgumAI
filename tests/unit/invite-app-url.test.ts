import { afterEach, describe, expect, it, vi } from 'vitest'
import { appUrl } from '@/lib/users/invitations'

/**
 * `appUrl()` builds the base URL every invite link is sent with
 * (src/lib/users/invitations.ts). It used to be a plain `?? 'http://
 * localhost:3000'`, which let a blank-but-set `APP_URL` (a value left
 * empty in a host's dashboard) or a scheme-with-no-host value
 * ("http://") both slip through, producing a host-less link
 * (`/accept-invite/<token>`) that silently broke for every invitee - see
 * docs/DECISIONS.md, 2026-09-13. These pin the cases that must now either
 * resolve correctly or fail loudly instead of producing a broken link.
 *
 * `vi.stubEnv` (not a plain `process.env.NODE_ENV = ...`) since Next.js's
 * bundled types declare `NODE_ENV` readonly.
 */
describe('unit: appUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns a valid APP_URL as-is', () => {
    vi.stubEnv('APP_URL', 'https://targetgum-ai.vercel.app')
    expect(appUrl()).toBe('https://targetgum-ai.vercel.app')
  })

  it('strips a trailing slash so the built link never doubles up', () => {
    vi.stubEnv('APP_URL', 'https://targetgum-ai.vercel.app/')
    expect(appUrl()).toBe('https://targetgum-ai.vercel.app')
  })

  it('falls back to localhost outside production when APP_URL is unset', () => {
    vi.stubEnv('APP_URL', undefined)
    vi.stubEnv('NODE_ENV', 'development')
    expect(appUrl()).toBe('http://localhost:3000')
  })

  it('falls back to localhost outside production when APP_URL is blank', () => {
    vi.stubEnv('APP_URL', '   ')
    vi.stubEnv('NODE_ENV', 'test')
    expect(appUrl()).toBe('http://localhost:3000')
  })

  it('falls back to localhost outside production when APP_URL has no host ("http://")', () => {
    vi.stubEnv('APP_URL', 'http://')
    vi.stubEnv('NODE_ENV', 'development')
    expect(appUrl()).toBe('http://localhost:3000')
  })

  it('throws in production when APP_URL is unset - never silently send a broken invite link', () => {
    vi.stubEnv('APP_URL', undefined)
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => appUrl()).toThrow(/APP_URL is not configured/)
  })

  it('throws in production when APP_URL is blank', () => {
    vi.stubEnv('APP_URL', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => appUrl()).toThrow(/APP_URL is not configured/)
  })

  it('throws in production when APP_URL has no host ("http://")', () => {
    vi.stubEnv('APP_URL', 'http://')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => appUrl()).toThrow(/not a valid absolute URL/)
  })

  it('throws in production when APP_URL is not a URL at all', () => {
    vi.stubEnv('APP_URL', 'not-a-url')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => appUrl()).toThrow(/not a valid absolute URL/)
  })
})
