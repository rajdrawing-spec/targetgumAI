/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
