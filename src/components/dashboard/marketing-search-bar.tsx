'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, ListChecks, Loader2, Search, Sparkles, X } from 'lucide-react'
import { askMarketingSearchAction } from '@/app/dashboard/search-actions'
import type { MarketingSearchResult } from '@/lib/search/marketing-search'
import { cn } from '@/lib/utils'

const EXAMPLE_PROMPTS = ['What needs my approval right now?', 'Any high-priority issues today?', 'Analyse my busiest client\'s ad campaigns']

function AnalysisList({ title, icon: Icon, iconClassName, items }: { title: string; icon: typeof CheckCircle2; iconClassName: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint-hex)]">
        <Icon className={cn('h-3.5 w-3.5', iconClassName)} /> {title}
      </p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-[var(--text-primary-hex)]">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--text-faint-hex)]" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The main dashboard's "ask anything about your marketing" bar (distinct
 * from the header's small nav/client search, `UniversalSearch` - that one
 * jumps to a page or client instantly with no AI call; this one answers a
 * genuine question, grounded only in real, tenant-scoped data
 * (`src/lib/search/marketing-search.ts`). Read-only by construction - this
 * can never trigger an action, only answer questions about what's already
 * true.
 */
export function MarketingSearchBar() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<MarketingSearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [askedQuery, setAskedQuery] = useState('')

  async function runSearch(q: string) {
    const trimmed = q.trim()
    if (!trimmed || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    setAskedQuery(trimmed)
    const response = await askMarketingSearchAction(trimmed)
    setLoading(false)
    if (!response.ok) {
      setError(response.error)
      return
    }
    setResult(response.result)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    runSearch(query)
  }

  function reset() {
    setQuery('')
    setResult(null)
    setError(null)
    setAskedQuery('')
  }

  return (
    <div className="terminal-panel overflow-hidden">
      <form onSubmit={handleSubmit} className="flex items-center gap-2.5 border-b border-[var(--border-hairline)] p-4">
        <Sparkles className="h-5 w-5 shrink-0 text-[#E5252A]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything about your clients, campaigns, or performance…"
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary-hex)] placeholder:text-[var(--text-faint-hex)] focus:outline-none"
        />
        {query && !loading && (
          <button
            type="button"
            onClick={reset}
            aria-label="Clear"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--text-faint-hex)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary-hex)]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="btn-brand flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          {loading ? 'Searching…' : 'Ask'}
        </button>
      </form>

      {!result && !loading && !error && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="text-[10px] font-mono-data uppercase tracking-wider text-[var(--text-faint-hex)]">Try asking</span>
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => {
                setQuery(prompt)
                runSearch(prompt)
              }}
              className="rounded-full border border-[var(--border-hairline)] px-2.5 py-1 text-[11px] text-[var(--text-muted-hex)] transition-colors hover:border-[#E5252A]/40 hover:text-[var(--text-primary-hex)]"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="animate-shimmer flex items-center gap-2 px-4 py-4 text-xs text-[var(--text-muted-hex)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#E5252A]" />
          Looking through your clients, approvals, and recommendations…
        </div>
      )}

      {error && (
        <div className="animate-fade-in-up flex items-center justify-between gap-3 px-4 py-3 text-sm text-[var(--danger-text-hex)]">
          <span>{error}</span>
          <button type="button" onClick={reset} className="shrink-0 text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {result && (
        <div key={askedQuery} className="animate-fade-in-up space-y-4 px-4 py-4">
          <div className="space-y-1.5">
            <p className="text-xs font-mono-data uppercase tracking-wider text-[var(--text-faint-hex)]">“{askedQuery}”</p>
            <p className={cn('text-sm leading-relaxed text-[var(--text-primary-hex)]', result.notCovered && 'text-[var(--text-muted-hex)] italic')}>
              {result.answer}
            </p>
          </div>

          <AnalysisList title="Working well" icon={CheckCircle2} iconClassName="text-emerald-600" items={result.workingWell} />
          <AnalysisList title="Needs attention" icon={AlertTriangle} iconClassName="text-amber-600" items={result.needsAttention} />
          <AnalysisList title="Next steps" icon={ListChecks} iconClassName="text-[#E5252A]" items={result.nextSteps} />

          {result.links.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {result.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center gap-1 rounded-full border border-[#E5252A]/30 bg-[#E5252A]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--danger-text-hex)] transition-colors hover:bg-[#E5252A]/20"
                >
                  {link.label} <ArrowRight className="h-3 w-3" />
                </Link>
              ))}
            </div>
          )}
          <button type="button" onClick={reset} className="text-xs text-[var(--text-muted-hex)] underline hover:text-[var(--text-primary-hex)]">
            Ask another question
          </button>
        </div>
      )}
    </div>
  )
}
