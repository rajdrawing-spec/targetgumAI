import { execSync } from 'node:child_process'

/**
 * Build identifier (docs/DECISIONS.md 2026-09-26): TG-<UTC build date>-<short
 * commit>, inlined at build time so anyone can tell which build a server is
 * running - <meta name="tg-build">, the small label in the app footer, and a
 * line in the server log at startup. Contains nothing sensitive. The commit
 * comes from git when the build has a checkout (Hostinger's Git deploy), else
 * the CI/Vercel env, else "local".
 */
function buildId() {
  let sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || ''
  if (!sha) {
    try {
      sha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    } catch {
      sha = 'local'
    }
  }
  const date = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '')
  return `TG-${date}-${sha.slice(0, 7)}`
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_TG_BUILD: buildId() },
  serverExternalPackages: [
    '@prisma/client',
    'bullmq',
    'ioredis',
    '@anthropic-ai/sdk',
    '@modelcontextprotocol/sdk',
    'googleapis',
    'google-auth-library',
    'nodemailer',
    'bcryptjs',
  ],
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  // prompts/*.md are read from disk at request time (src/lib/ai/prompts.ts),
  // not imported as modules - without this, a serverless deployment (e.g.
  // Vercel) can tree-shake them out of the function bundle since Next's file
  // tracer only follows imports. See docs/DECISIONS.md.
  outputFileTracingIncludes: {
    '/**': ['./prompts/**/*'],
  },
  // Secure headers baseline (Section 29 - Security Architecture).
  // Expanded/hardened as auth and integrations land.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
