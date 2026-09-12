import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  KeyRound,
  Search,
  TrendingUp,
  DollarSign,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  Filter,
} from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { searchKeywords } from '@/lib/keywords/service'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const INTENT_BADGE: Record<string, string> = {
  TRANSACTIONAL: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold',
  COMMERCIAL: 'bg-blue-100 text-blue-800 border-blue-300 font-semibold',
  INFORMATIONAL: 'bg-slate-100 text-slate-800 border-slate-300 font-medium',
  NAVIGATIONAL: 'bg-purple-100 text-purple-800 border-purple-300 font-medium',
}

const COMPETITION_BADGE: Record<string, string> = {
  LOW: 'text-emerald-700 font-semibold',
  MEDIUM: 'text-amber-700 font-semibold',
  HIGH: 'text-rose-700 font-semibold',
}

const SAMPLE_QUERIES = [
  'wireless earbuds',
  'organic dog food',
  'amazon fba tools',
  'running shoes',
  'anti aging serum',
]

export default async function KeywordResearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [sp, ctx] = await Promise.all([searchParams, getCurrentAuthContext()])
  if (!ctx) redirect('/sign-in')

  const query = sp.q || 'wireless earbuds'
  const result = searchKeywords(query)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <KeyRound className="h-6 w-6 text-primary" /> PPC & SEO Keyword Research Engine
        </h1>
        <p className="text-sm text-muted-foreground">
          Discover high-converting search terms, estimate bid CPCs, isolate Amazon PPC targets, and harvest negative keywords.
        </p>
      </div>

      {/* Search Bar */}
      <Card className="border-border shadow-subtle p-4">
        <form method="get" action="/dashboard/keywords" className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={query}
              placeholder="Enter seed keyword, product niche, or ASIN (e.g. bluetooth headphones)..."
              className="pl-9 h-10 text-sm"
            />
          </div>
          <Button type="submit" className="gap-2 font-semibold shadow-sm">
            <Sparkles className="h-4 w-4" /> Explore Keywords
          </Button>
        </form>

        <div className="mt-3 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-muted-foreground font-medium whitespace-nowrap">Suggested niches:</span>
          {SAMPLE_QUERIES.map((sq) => (
            <Link
              key={sq}
              href={`/dashboard/keywords?q=${encodeURIComponent(sq)}`}
              className={`rounded-md px-2.5 py-1 transition-colors whitespace-nowrap ${
                query === sq ? 'bg-primary/10 text-primary font-semibold' : 'bg-muted/60 text-foreground hover:bg-muted'
              }`}
            >
              {sq}
            </Link>
          ))}
        </div>
      </Card>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 border-border shadow-subtle">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Search Term</span>
          <p className="mt-1 text-lg font-bold text-foreground capitalize truncate">{result.query}</p>
          <span className="text-xs text-muted-foreground">{result.totalResults} high-intent ideas found</span>
        </Card>

        <Card className="p-4 border-border shadow-subtle">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Search Volume</span>
          <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{result.totalVolume.toLocaleString()}</p>
          <span className="text-xs text-emerald-600 font-semibold inline-flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Combined monthly queries
          </span>
        </Card>

        <Card className="p-4 border-border shadow-subtle">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Average CPC</span>
          <p className="mt-1 text-2xl font-bold text-indigo-600 tabular-nums">${result.avgCpc}</p>
          <span className="text-xs text-muted-foreground">Estimated auction benchmark</span>
        </Card>

        <Card className="p-4 border-border shadow-subtle">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Negative Wasted Risk</span>
          <p className="mt-1 text-2xl font-bold text-rose-600 tabular-nums">{result.negativeKeywords.length} terms</p>
          <span className="text-xs text-rose-600 font-medium">Potential wasted spend detected</span>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Keywords Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" /> Target Keyword Opportunities ({result.keywords.length})
            </h2>
            <Link
              href={`/dashboard/ads/new?keywords=${encodeURIComponent(result.keywords.slice(0, 5).map((k) => k.keyword).join(', '))}`}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              Add to Campaign <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3">Keyword Query</th>
                  <th className="px-3 py-3 text-right">Volume</th>
                  <th className="px-3 py-3 text-right">Est. CPC</th>
                  <th className="px-3 py-3">Intent</th>
                  <th className="px-3 py-3">Competition</th>
                  <th className="px-3 py-3 text-right">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.keywords.map((kw) => (
                  <tr key={kw.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-foreground text-sm">{kw.keyword}</p>
                        {kw.amazonPpcCategory && (
                          <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            Amazon: {kw.amazonPpcCategory.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-foreground">
                      {kw.searchVolume.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums text-indigo-600">
                      ${kw.cpc.toFixed(2)}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] ${INTENT_BADGE[kw.intent]}`}>
                        {kw.intent}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-xs ${COMPETITION_BADGE[kw.competition]}`}>
                        {kw.competition}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-emerald-600 text-xs tabular-nums">
                      {kw.trend}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side Panels: Negative Keywords & Amazon PPC Search Terms */}
        <div className="space-y-6">
          {/* Negative Keywords Box */}
          <Card className="border-rose-200 bg-rose-50/20 shadow-subtle">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-rose-900 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-600" /> Negative Keywords to Add
              </CardTitle>
              <CardDescription className="text-xs">
                Exclude these low-intent terms to stop burning ad spend on non-buyers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {result.negativeKeywords.map((neg) => (
                  <div key={neg.term} className="rounded-lg border border-rose-200 bg-card p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-800">-{neg.term}</span>
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                        {neg.wastedSpendRisk} RISK
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{neg.reason}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Amazon PPC Backend Terms */}
          <Card className="border-amber-200 bg-amber-50/20 shadow-subtle">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-amber-600" /> Amazon PPC Search Terms
              </CardTitle>
              <CardDescription className="text-xs">
                Recommended customer search queries for Sponsored Products.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {result.amazonSearchTerms.map((term) => (
                  <span
                    key={term}
                    className="inline-flex items-center rounded-md border border-amber-300 bg-card px-2.5 py-1 text-xs font-semibold text-amber-900 shadow-subtle"
                  >
                    {term}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
