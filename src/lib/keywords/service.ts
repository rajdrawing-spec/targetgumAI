export interface KeywordIdea {
  id: string
  keyword: string
  searchVolume: number
  cpc: number
  competition: 'LOW' | 'MEDIUM' | 'HIGH'
  difficulty: number
  intent: 'TRANSACTIONAL' | 'COMMERCIAL' | 'INFORMATIONAL' | 'NAVIGATIONAL'
  trend: string
  amazonPpcCategory?: 'EXACT_HERO' | 'BROAD_DISCOVERY' | 'LONG_TAIL' | 'ASIN_TARGET'
}

export interface KeywordResearchResult {
  query: string
  totalResults: number
  avgCpc: number
  totalVolume: number
  keywords: KeywordIdea[]
  negativeKeywords: Array<{
    term: string
    reason: string
    wastedSpendRisk: 'HIGH' | 'MEDIUM'
  }>
  amazonSearchTerms: string[]
}

export function searchKeywords(query: string = 'wireless earbuds'): KeywordResearchResult {
  const clean = query.trim().toLowerCase() || 'digital marketing'

  // Dynamic generative keyword pool tailored to the seed query
  const keywords: KeywordIdea[] = [
    {
      id: 'kw-1',
      keyword: `best ${clean}`,
      searchVolume: 34500,
      cpc: 2.15,
      competition: 'HIGH',
      difficulty: 68,
      intent: 'COMMERCIAL',
      trend: '+32%',
      amazonPpcCategory: 'EXACT_HERO',
    },
    {
      id: 'kw-2',
      keyword: `buy ${clean} online`,
      searchVolume: 18200,
      cpc: 3.40,
      competition: 'HIGH',
      difficulty: 74,
      intent: 'TRANSACTIONAL',
      trend: '+18%',
      amazonPpcCategory: 'EXACT_HERO',
    },
    {
      id: 'kw-3',
      keyword: `${clean} deals and discounts`,
      searchVolume: 12400,
      cpc: 1.85,
      competition: 'MEDIUM',
      difficulty: 52,
      intent: 'TRANSACTIONAL',
      trend: '+45%',
      amazonPpcCategory: 'BROAD_DISCOVERY',
    },
    {
      id: 'kw-4',
      keyword: `affordable ${clean} with warranty`,
      searchVolume: 9600,
      cpc: 1.45,
      competition: 'MEDIUM',
      difficulty: 46,
      intent: 'TRANSACTIONAL',
      trend: '+24%',
      amazonPpcCategory: 'LONG_TAIL',
    },
    {
      id: 'kw-5',
      keyword: `top rated ${clean} 2026`,
      searchVolume: 22100,
      cpc: 2.65,
      competition: 'HIGH',
      difficulty: 62,
      intent: 'COMMERCIAL',
      trend: '+35%',
      amazonPpcCategory: 'EXACT_HERO',
    },
    {
      id: 'kw-6',
      keyword: `how to choose ${clean}`,
      searchVolume: 14200,
      cpc: 0.95,
      competition: 'LOW',
      difficulty: 38,
      intent: 'INFORMATIONAL',
      trend: '+8%',
      amazonPpcCategory: 'BROAD_DISCOVERY',
    },
    {
      id: 'kw-7',
      keyword: `premium ${clean} for professionals`,
      searchVolume: 8100,
      cpc: 3.10,
      competition: 'MEDIUM',
      difficulty: 55,
      intent: 'TRANSACTIONAL',
      trend: '+14%',
      amazonPpcCategory: 'LONG_TAIL',
    },
    {
      id: 'kw-8',
      keyword: `${clean} review and comparison`,
      searchVolume: 16800,
      cpc: 1.60,
      competition: 'MEDIUM',
      difficulty: 59,
      intent: 'COMMERCIAL',
      trend: '+22%',
      amazonPpcCategory: 'BROAD_DISCOVERY',
    },
  ]

  const negativeKeywords = [
    { term: 'free', reason: 'Zero purchase intent, high bounce rate', wastedSpendRisk: 'HIGH' as const },
    { term: 'diy', reason: 'Informational searchers seeking self-made alternatives', wastedSpendRisk: 'HIGH' as const },
    { term: 'repair manual', reason: 'Existing owners seeking fixes, not new buyers', wastedSpendRisk: 'MEDIUM' as const },
    { term: 'jobs', reason: 'Employment queries absorbing impressions', wastedSpendRisk: 'HIGH' as const },
    { term: 'torrent', reason: 'Piracy query with zero commercial conversion', wastedSpendRisk: 'HIGH' as const },
    { term: 'reddit', reason: 'Discussion research with very low instant conversion rate', wastedSpendRisk: 'MEDIUM' as const },
  ]

  const amazonSearchTerms = [
    `${clean} prime eligible`,
    `best seller ${clean}`,
    `${clean} gift box pack`,
    `${clean} fast shipping`,
    `${clean} 2 pack bundle`,
  ]

  let totalVolume = 0
  let totalCpc = 0
  for (const k of keywords) {
    totalVolume += k.searchVolume
    totalCpc += k.cpc
  }

  return {
    query: clean,
    totalResults: keywords.length,
    avgCpc: Number((totalCpc / keywords.length).toFixed(2)),
    totalVolume,
    keywords,
    negativeKeywords,
    amazonSearchTerms,
  }
}
