import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * The public try-it (/, /start/**) is reachable without signing in
 * (docs/DECISIONS.md 2026-09-24). Its safety rests on one property: it
 * never reaches tenant data, auth-gated libraries, or server actions. This
 * test walks the actual import graph of every public module and fails if
 * anything reachable from them imports the database, the RBAC/tenant
 * layer, integrations, the AI gateway, or declares 'use server'.
 *
 * The root page (src/app/page.tsx) is the one intentional exception: it
 * reads the auth context only to redirect a signed-in user away, and
 * renders nothing from it.
 */

const ROOT = path.resolve(__dirname, '../..')
const SRC = path.join(ROOT, 'src')

const PUBLIC_ENTRY_POINTS = [
  'src/components/tryit/landing.tsx',
  ...walk(path.join(SRC, 'app/start')).map((f) => path.relative(ROOT, f)),
]

const FORBIDDEN = [
  /^@\/lib\/db(\/|$)/,
  /^@\/lib\/auth(\/|$)/,
  /^@\/lib\/rbac(\/|$)/,
  /^@\/lib\/integrations(\/|$)/,
  /^@\/lib\/ai(\/|$)/,
  /^@\/lib\/tools(\/|$)/,
  /^@\/lib\/clients(\/|$)/,
  /^@\/lib\/audit(\/|$)/,
  /^@\/app\/dashboard(\/|$)/,
  /^next-auth/,
]

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
}

function resolveImport(spec: string, fromFile: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec)
  else return null // package import - checked against FORBIDDEN by name only
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  return null
}

function importsOf(file: string): string[] {
  const text = fs.readFileSync(file, 'utf8')
  // Type-only imports are erased at build time and can't reach runtime code.
  return [...text.matchAll(/^\s*(?:import|export)\s+(?!type\s)[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]!)
}

describe('public try-it isolation', () => {
  it('has public entry points to check', () => {
    expect(PUBLIC_ENTRY_POINTS.length).toBeGreaterThanOrEqual(5)
  })

  it('never reaches data, auth, AI, integrations, or server actions', () => {
    const seen = new Set<string>()
    const violations: string[] = []
    const queue = PUBLIC_ENTRY_POINTS.map((p) => path.join(ROOT, p))

    while (queue.length) {
      const file = queue.pop()!
      if (seen.has(file)) continue
      seen.add(file)
      const text = fs.readFileSync(file, 'utf8')
      if (/^\s*['"]use server['"]/m.test(text)) violations.push(`${path.relative(ROOT, file)} declares 'use server'`)
      for (const spec of importsOf(file)) {
        if (FORBIDDEN.some((re) => re.test(spec))) violations.push(`${path.relative(ROOT, file)} imports ${spec}`)
        const resolved = resolveImport(spec, file)
        if (resolved) queue.push(resolved)
      }
    }

    expect(violations).toEqual([])
    // Sanity: the walk really followed the graph into the shared engine.
    expect([...seen].some((f) => f.endsWith(path.join('lessons', 'lesson-player.tsx')))).toBe(true)
  })
})
