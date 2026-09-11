/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Client-side router cache for dynamic (server-rendered) pages. Next 15
    // defaults this to 0s, so every sidebar back-and-forth re-fetches the
    // full page from the server. 30s keeps recently visited pages instant
    // while a Server Action's revalidatePath still invalidates the affected
    // routes immediately after a mutation. See docs/UX-ASSESSMENT.md.
    staleTimes: { dynamic: 30, static: 180 },
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
