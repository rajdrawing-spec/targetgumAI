import type { GrowthStageKey } from '@prisma/client'

/**
 * Static lesson content for the Growth Map's Duolingo-style quiz mechanic -
 * one short lesson per stage, each a handful of multiple-choice questions
 * with an explanation shown after answering. Fixed editorial content
 * authored for this app (not client data), so it lives in code the same
 * way `stage-defs.ts` and the achievement catalog do, rather than a new
 * database table - see docs/DECISIONS.md 2026-09-22 ("Achievement
 * *definitions* live in application code... the catalog is a fixed
 * handful, not per-organization content").
 *
 * A lesson is always completable - there's no pass/fail gate that blocks
 * a person from finishing their own onboarding. Right/wrong feedback and
 * a final score are for the learning value and the Duolingo-style feel,
 * not to withhold progress.
 */

export interface LessonQuestion {
  id: string
  prompt: string
  options: readonly string[]
  correctIndex: number
  explanation: string
}

export interface LessonDef {
  stage: GrowthStageKey
  title: string
  intro: string
  questions: readonly LessonQuestion[]
}

export const LESSON_DEFS: Record<GrowthStageKey, LessonDef> = {
  DEFINE_BUSINESS: {
    stage: 'DEFINE_BUSINESS',
    title: 'Define Your Business',
    intro: 'Before any campaign, get sharp on who you serve and why they should pick you.',
    questions: [
      {
        id: 'define-1',
        prompt: 'What is a value proposition?',
        options: [
          'A list of every feature your product has',
          'A clear statement of the specific benefit you deliver and why it beats the alternatives',
          'Your company mission statement',
          'The price you charge compared to competitors',
        ],
        correctIndex: 1,
        explanation: 'A value proposition answers "why you, and not someone else" in terms the customer cares about - the outcome they get, not a feature list.',
      },
      {
        id: 'define-2',
        prompt: 'Why does niching down (targeting a narrower market) usually outperform "everyone is our customer"?',
        options: [
          'It lowers your total addressable market, which is always the goal',
          'A focused message converts better because it speaks directly to one set of needs',
          'It removes the need for any marketing at all',
          'Niching down is only useful for very small businesses',
        ],
        correctIndex: 1,
        explanation: 'Message-market fit improves when copy and offers speak to one specific audience\'s specific problem, rather than a diluted message that half-fits everyone.',
      },
      {
        id: 'define-3',
        prompt: 'A SMART goal for a marketing plan should be Specific, Measurable, Achievable, Relevant, and what?',
        options: ['Time-bound', 'Trendy', 'Team-based', 'Technical'],
        correctIndex: 0,
        explanation: 'Time-bound - a goal without a deadline ("grow revenue") never gets prioritized against goals that have one ("grow revenue 15% this quarter").',
      },
      {
        id: 'define-4',
        prompt: 'What best separates you from competitors offering something similar?',
        options: [
          'Copying their pricing exactly',
          'A genuine point of differentiation - proof, positioning, or promise they can\'t match',
          'Having the biggest ad budget',
          'Using more marketing jargon in your copy',
        ],
        correctIndex: 1,
        explanation: 'Differentiation has to be real and defensible - a proof point, a guarantee, a specialization - not just louder marketing around the same offer.',
      },
    ],
  },
  UNDERSTAND_AUDIENCE: {
    stage: 'UNDERSTAND_AUDIENCE',
    title: 'Understand Your Audience',
    intro: 'Great targeting starts with knowing exactly who you\'re talking to - and what keeps them up at night.',
    questions: [
      {
        id: 'audience-1',
        prompt: 'What\'s the difference between demographics and psychographics?',
        options: [
          'They mean the same thing',
          'Demographics are who someone is (age, income); psychographics are how they think (values, motivations, pain points)',
          'Demographics only apply to B2B; psychographics only apply to B2C',
          'Psychographics is a term used only in academic research, not marketing',
        ],
        correctIndex: 1,
        explanation: 'Demographics describe who a person is on paper; psychographics describe what drives their decisions - both matter, but psychographics usually write better ad copy.',
      },
      {
        id: 'audience-2',
        prompt: 'What is an Ideal Customer Profile (ICP)?',
        options: [
          'A picture used in your ads',
          'A description of the account or person most likely to buy, get value, and stay a customer',
          'A legal document required before running ads',
          'The average of all your current customers, regardless of fit',
        ],
        correctIndex: 1,
        explanation: 'An ICP is deliberately narrow - it describes your *best-fit* customer, not just anyone who has ever bought, so targeting and messaging can sharpen around them.',
      },
      {
        id: 'audience-3',
        prompt: 'Why do marketers dig into customer "pain points" specifically?',
        options: [
          'To make ads feel more negative',
          'Because people act to relieve a felt problem far more reliably than to chase a vague aspiration',
          'Pain points are only relevant for healthcare products',
          'To justify higher prices',
        ],
        correctIndex: 1,
        explanation: 'Urgency comes from a felt problem. Messaging that names the pain precisely ("late invoices costing you cash flow") usually outperforms generic aspirational copy.',
      },
      {
        id: 'audience-4',
        prompt: 'Where can you find real audience insight instead of guessing?',
        options: [
          'Support tickets, sales call notes, reviews, and direct customer interviews',
          'Only your own assumptions about the market',
          'Competitor logos on their homepage',
          'Stock photo captions',
        ],
        correctIndex: 0,
        explanation: 'The words customers actually use - in support tickets, reviews, and interviews - are gold for audience research and often make the best ad copy verbatim.',
      },
    ],
  },
  RESEARCH_MARKET: {
    stage: 'RESEARCH_MARKET',
    title: 'Research Your Market',
    intro: 'Know the landscape before you spend a dollar - competitors, trends, and where the real opportunity sits.',
    questions: [
      {
        id: 'market-1',
        prompt: 'What does a competitor analysis mainly help you find?',
        options: [
          'Their exact revenue numbers',
          'Gaps in their offer, pricing, or messaging that you can position against',
          'A reason to copy their entire strategy',
          'Nothing useful - competitors don\'t affect your strategy',
        ],
        correctIndex: 1,
        explanation: 'The goal isn\'t to copy competitors - it\'s to spot what they\'re underserving (a price tier, a use case, a message) and position there.',
      },
      {
        id: 'market-2',
        prompt: 'In market sizing, what does "SAM" stand for?',
        options: [
          'Sales And Marketing',
          'Serviceable Available Market - the portion of the total market your business model can actually reach',
          'Standard Audience Metric',
          'Social Ad Multiplier',
        ],
        correctIndex: 1,
        explanation: 'TAM is the whole theoretical market; SAM narrows that to what you can realistically serve given your model, geography, and channels; SOM is what you can realistically capture.',
      },
      {
        id: 'market-3',
        prompt: 'Why track search and category trends before committing budget?',
        options: [
          'Trends are irrelevant to paid campaigns',
          'Rising or seasonal demand changes when and how hard you should push spend',
          'It\'s only useful for SEO, never for ads',
          'To copy whatever is currently trending regardless of fit',
        ],
        correctIndex: 1,
        explanation: 'Demand isn\'t flat - seasonality and rising search interest tell you when to lean into spend and when a slow period is expected, not a campaign failing.',
      },
      {
        id: 'market-4',
        prompt: 'What is a reliable early signal of real market opportunity?',
        options: [
          'A hunch with no supporting data',
          'People already searching for or actively discussing the problem you solve',
          'A press release from a competitor',
          'The size of your own team',
        ],
        correctIndex: 1,
        explanation: 'Existing demand - people already searching, asking, or complaining about the problem - is a far stronger signal than a novel idea nobody is looking for yet.',
      },
    ],
  },
  CREATE_OFFER: {
    stage: 'CREATE_OFFER',
    title: 'Create Your Offer',
    intro: 'An offer people can\'t say no to is worth more than a bigger ad budget.',
    questions: [
      {
        id: 'offer-1',
        prompt: 'What generally makes an offer feel "irresistible"?',
        options: [
          'The lowest price in the market, always',
          'Value that clearly outweighs the cost, with risk removed (guarantee, trial, etc.)',
          'As many bonuses as possible, regardless of relevance',
          'Complex terms and conditions',
        ],
        correctIndex: 1,
        explanation: 'Perceived value minus perceived risk is what makes an offer easy to say yes to - stacking irrelevant bonuses or just cutting price isn\'t the same as increasing value.',
      },
      {
        id: 'offer-2',
        prompt: 'What\'s the difference between genuine urgency and manufactured urgency?',
        options: [
          'There is no difference - all urgency works the same',
          'Genuine urgency is real and time-bound (a real deadline or limited stock); manufactured urgency is fake and erodes trust once noticed',
          'Urgency should never be used in marketing',
          'Manufactured urgency always converts better long-term',
        ],
        correctIndex: 1,
        explanation: 'A countdown that resets every visit is manufactured and damages trust once customers notice. Real deadlines and real limited availability convert without the backlash.',
      },
      {
        id: 'offer-3',
        prompt: 'Why do risk-reversal tools (money-back guarantees, free trials) tend to lift conversion?',
        options: [
          'They cost the business nothing',
          'They shift the risk of a bad purchase from the buyer to the seller, making the decision easier',
          'They are required by law in most markets',
          'They only work for physical products',
        ],
        correctIndex: 1,
        explanation: 'Buyers hesitate because of perceived risk. A guarantee or trial absorbs that risk on the seller\'s side, which removes the biggest reason to say no.',
      },
      {
        id: 'offer-4',
        prompt: 'When pricing a new offer, what should anchor the price?',
        options: [
          'Round numbers with no other reasoning',
          'The value and outcome delivered to the customer, not just your internal costs',
          'Whatever the cheapest competitor charges, always match it',
          'A random number that "feels right"',
        ],
        correctIndex: 1,
        explanation: 'Value-based pricing starts from what the outcome is worth to the customer - cost-plus and "match the cheapest competitor" pricing both leave money on the table or race to the bottom.',
      },
    ],
  },
  CREATE_CREATIVE_ASSETS: {
    stage: 'CREATE_CREATIVE_ASSETS',
    title: 'Create Creative Assets',
    intro: 'The first 2 seconds of a scroll decide whether your message gets seen at all.',
    questions: [
      {
        id: 'creative-1',
        prompt: 'What is the "hook" in an ad, and why does it matter most?',
        options: [
          'The legal disclaimer at the bottom',
          'The first line or visual that stops someone mid-scroll - if it fails, nothing else in the ad gets seen',
          'The call-to-action button',
          'The company logo',
        ],
        correctIndex: 1,
        explanation: 'Attention is the scarcest resource in a feed. If the hook (first line/frame) doesn\'t stop the scroll, the strongest offer in the world never gets read.',
      },
      {
        id: 'creative-2',
        prompt: 'Why does visual hierarchy matter in a creative?',
        options: [
          'It doesn\'t - viewers read everything equally',
          'It guides the eye to the most important element first (usually the hook, then the offer, then the CTA)',
          'It is only relevant for print ads',
          'It means using as many colors as possible',
        ],
        correctIndex: 1,
        explanation: 'A viewer scans, not reads. Size, contrast, and placement should deliberately guide that scan path toward the message you most need seen.',
      },
      {
        id: 'creative-3',
        prompt: 'What\'s a common reason a creative stops performing over time?',
        options: [
          'The platform algorithm randomly punishes old ads',
          'Creative fatigue - the same audience has seen it too many times and tunes it out',
          'Creatives never lose performance once they work',
          'It\'s always a sign the offer itself is bad',
        ],
        correctIndex: 1,
        explanation: 'Frequency (how many times the same person sees an ad) climbing too high causes fatigue and rising costs, even when the underlying offer is fine - the fix is usually fresh creative, not a new offer.',
      },
      {
        id: 'creative-4',
        prompt: 'Why keep creative consistent with your brand across assets?',
        options: [
          'Consistency doesn\'t affect trust or recognition',
          'Recognizable, consistent creative builds trust and recall across repeated impressions',
          'It\'s only a legal requirement for trademarked brands',
          'Inconsistent creative always performs better because it stands out',
        ],
        correctIndex: 1,
        explanation: 'People need multiple touchpoints before buying. Consistent brand cues across those touchpoints build recognition and trust instead of looking like unrelated ads each time.',
      },
    ],
  },
  BUILD_CAMPAIGN: {
    stage: 'BUILD_CAMPAIGN',
    title: 'Build Campaign',
    intro: 'Solid structure now saves you from messy, unreadable data later.',
    questions: [
      {
        id: 'build-1',
        prompt: 'Why organize a campaign into clear ad sets/ad groups by audience or theme?',
        options: [
          'It has no effect on performance, only organization',
          'It lets you read performance and control budget/targeting at the level where decisions actually get made',
          'Platforms require exactly one ad set per account',
          'To make the dashboard look busier',
        ],
        correctIndex: 1,
        explanation: 'Clean structure (one clear audience/theme per ad set) is what makes "which audience is working" a readable question instead of a guess buried inside one giant catch-all group.',
      },
      {
        id: 'build-2',
        prompt: 'What is UTM tagging used for?',
        options: [
          'Encrypting ad spend data',
          'Tracking which specific campaign, source, and creative drove a given visit or conversion in your analytics',
          'A platform-specific bidding strategy',
          'Blocking bot traffic',
        ],
        correctIndex: 1,
        explanation: 'UTM parameters on your links let analytics tools attribute a visit or conversion back to the exact campaign/source/creative that drove it - without them, results blur together.',
      },
      {
        id: 'build-3',
        prompt: 'When allocating budget across a new campaign\'s ad sets, what\'s a sound starting approach?',
        options: [
          'Split evenly with no testing period, permanently',
          'Give enough budget for each ad set to exit the learning phase, then shift budget toward what\'s proven to work',
          'Put 100% of budget on your best guess with no way to compare',
          'Budget allocation doesn\'t affect performance',
        ],
        correctIndex: 1,
        explanation: 'Under-funding every ad set so none can exit the platform\'s learning phase means you never get a real read - fund enough to learn, then double down on what wins.',
      },
      {
        id: 'build-4',
        prompt: 'Why set clear targeting parameters instead of the broadest possible audience from day one?',
        options: [
          'Broad targeting is always best for every campaign',
          'A defined audience gives cleaner, faster signal on what\'s actually working before you widen out',
          'Platforms don\'t allow narrow targeting',
          'Targeting has no impact on cost per result',
        ],
        correctIndex: 1,
        explanation: 'Starting focused gives faster, cleaner signal on message-audience fit. Many advertisers widen successfully later, but broad-with-no-data-yet is a hard place to learn from.',
      },
    ],
  },
  LAUNCH_CAMPAIGN: {
    stage: 'LAUNCH_CAMPAIGN',
    title: 'Launch Campaign',
    intro: 'A good launch is boring - checked, verified, and watched closely on day one.',
    questions: [
      {
        id: 'launch-1',
        prompt: 'What should happen right before a campaign goes live?',
        options: [
          'Nothing - launch as soon as the ad is written',
          'A final QA pass: links work, tracking fires, budget/targeting are correct, creative approved',
          'Delete all previous campaign data',
          'Turn off all analytics to avoid clutter',
        ],
        correctIndex: 1,
        explanation: 'A pre-launch checklist catches the expensive mistakes - a broken link, missing pixel, or wrong targeting - before real budget goes out the door.',
      },
      {
        id: 'launch-2',
        prompt: 'What\'s the benefit of a soft launch (small budget/audience) before scaling up?',
        options: [
          'It guarantees the campaign will be profitable',
          'It surfaces real-world issues (bad landing page, poor message-match) at low cost before committing full budget',
          'Soft launches are required by ad platforms',
          'There is no benefit versus launching at full budget immediately',
        ],
        correctIndex: 1,
        explanation: 'A small initial spend limits the cost of finding out something\'s broken - tracking, landing page, or targeting - before you\'ve committed the full budget to it.',
      },
      {
        id: 'launch-3',
        prompt: 'How closely should a brand-new campaign typically be monitored in its first 24-48 hours?',
        options: [
          'Not at all - check back in a month',
          'Closely - early spend and signal can reveal tracking or targeting problems fast, while they\'re still cheap to fix',
          'Only if performance is already bad',
          'Monitoring in the first days has no value',
        ],
        correctIndex: 1,
        explanation: 'Problems are cheapest to catch early. Close monitoring in the first 24-48 hours turns a potential week of wasted spend into a same-day fix.',
      },
      {
        id: 'launch-4',
        prompt: 'What is the "learning phase" many ad platforms go through after launch or a major edit?',
        options: [
          'A marketing training video',
          'A period where the algorithm is still calibrating delivery and results can be noisier than steady-state',
          'A required waiting period before ads can go live at all',
          'A feature only available on premium ad accounts',
        ],
        correctIndex: 1,
        explanation: 'Right after launch (or a big budget/targeting change), delivery algorithms are still calibrating - results are expected to be noisier and shouldn\'t be over-read in the first days.',
      },
    ],
  },
  ANALYZE_RESULTS: {
    stage: 'ANALYZE_RESULTS',
    title: 'Analyze Results',
    intro: 'Numbers only help if you know which ones actually tell you something.',
    questions: [
      {
        id: 'analyze-1',
        prompt: 'What does ROAS (Return on Ad Spend) measure?',
        options: [
          'How many people saw the ad',
          'Revenue generated per dollar of ad spend',
          'The number of clicks an ad receives',
          'How long an ad has been running',
        ],
        correctIndex: 1,
        explanation: 'ROAS = revenue ÷ ad spend. A 4x ROAS means $4 in revenue for every $1 spent - it\'s a top-line efficiency number, best read alongside margin.',
      },
      {
        id: 'analyze-2',
        prompt: 'A campaign has a high CTR (click-through rate) but very few conversions. What does that usually suggest?',
        options: [
          'The ad creative is definitely broken',
          'The hook/creative is working, but something after the click (landing page, offer match, price) is the problem',
          'CTR and conversions are always directly proportional',
          'The budget is too high',
        ],
        correctIndex: 1,
        explanation: 'High CTR with low conversion usually isolates the problem to what happens *after* the click - the landing page, offer clarity, or checkout - since the ad itself is clearly earning attention.',
      },
      {
        id: 'analyze-3',
        prompt: 'Why does "statistical significance" or a minimum sample size matter when comparing two ad variants?',
        options: [
          'It doesn\'t - any difference in numbers is meaningful',
          'With too few clicks/conversions, a difference between variants could just be random noise, not a real effect',
          'It\'s a formality required only for academic studies',
          'Larger sample sizes always favor the newer variant',
        ],
        correctIndex: 1,
        explanation: 'With small numbers, "Variant B converted at 5% vs A\'s 3%" might just be a handful of lucky conversions rather than a real, repeatable difference. Enough volume separates signal from noise.',
      },
      {
        id: 'analyze-4',
        prompt: 'What is a "funnel view" of campaign performance useful for?',
        options: [
          'Nothing - a single blended metric always tells the full story',
          'Seeing exactly where prospects drop off (impression → click → landing page → purchase) so you know what to fix',
          'Only useful for e-commerce, never for lead generation',
          'It replaces the need to track individual metrics',
        ],
        correctIndex: 1,
        explanation: 'A funnel breaks the journey into stages, so instead of one confusing number you can see precisely where people are dropping off and target that specific step.',
      },
    ],
  },
  OPTIMIZE: {
    stage: 'OPTIMIZE',
    title: 'Optimize',
    intro: 'Optimization is a habit, not a one-time fix - small, evidence-based changes compound.',
    questions: [
      {
        id: 'optimize-1',
        prompt: 'In A/B testing, what\'s a key rule for getting a trustworthy result?',
        options: [
          'Change as many variables as possible at once to move fast',
          'Change one variable at a time (or use a proper multivariate design), so you know what actually caused the difference',
          'Only test ideas you\'re already confident will win',
          'Results are equally trustworthy regardless of sample size',
        ],
        correctIndex: 1,
        explanation: 'If you change the headline, image, and CTA at once, a win tells you nothing about *which* change mattered. Isolating variables is what makes a test\'s learning reusable.',
      },
      {
        id: 'optimize-2',
        prompt: 'What are negative keywords used for in search advertising?',
        options: [
          'Keywords you want to bid the most on',
          'Terms you exclude your ads from showing for, to cut wasted spend on irrelevant searches',
          'A list of banned competitors',
          'Keywords reserved for future campaigns',
        ],
        correctIndex: 1,
        explanation: 'Negative keywords stop ads from showing on searches that look relevant but aren\'t (e.g. "free" or "jobs" when you sell a paid product) - a direct way to cut wasted spend.',
      },
      {
        id: 'optimize-3',
        prompt: 'When should budget generally shift toward a better-performing ad set or channel?',
        options: [
          'Never - budget should always stay static once set',
          'Once you have enough data to trust the difference is real, shift budget toward what\'s proven to perform',
          'Immediately after the very first result, regardless of sample size',
          'Only at the end of the fiscal year',
        ],
        correctIndex: 1,
        explanation: 'Reallocating budget toward the winner is the entire point of testing - but only once the difference is backed by enough data to trust, not the first data point that happens to look good.',
      },
      {
        id: 'optimize-4',
        prompt: 'How should you usually respond to declining performance on a previously strong ad?',
        options: [
          'Immediately pause the entire account',
          'Diagnose first (fatigue? audience saturation? seasonality?) before deciding whether to refresh creative, adjust targeting, or pause it',
          'Increase the budget significantly and hope it recovers',
          'Ignore it - performance always recovers on its own',
        ],
        correctIndex: 1,
        explanation: 'A drop has several possible causes with different fixes - creative fatigue calls for new creative, audience saturation calls for expansion, seasonality calls for patience. Diagnosing first avoids the wrong fix.',
      },
    ],
  },
  SCALE_GROW: {
    stage: 'SCALE_GROW',
    title: 'Scale & Grow',
    intro: 'Scaling is about protecting what works while carefully expanding it - not just spending more.',
    questions: [
      {
        id: 'scale-1',
        prompt: 'Why is scaling budget gradually (rather than a sudden large jump) generally safer?',
        options: [
          'Gradual scaling has no real benefit over a sudden jump',
          'Large, sudden budget increases can reset an ad set\'s learning phase and destabilize performance',
          'Ad platforms forbid large budget increases',
          'Gradual scaling is only relevant for very small budgets',
        ],
        correctIndex: 1,
        explanation: 'A large, sudden budget jump can knock a well-performing ad set back into the learning phase, temporarily raising costs - incremental increases (e.g. 20-30% at a time) usually scale more smoothly.',
      },
      {
        id: 'scale-2',
        prompt: 'What does the LTV:CAC ratio (customer lifetime value to customer acquisition cost) tell you?',
        options: [
          'How many employees are needed for a campaign',
          'Whether what you spend to acquire a customer is healthy relative to what that customer is worth over time',
          'The click-through rate of your best ad',
          'How long a campaign should run for',
        ],
        correctIndex: 1,
        explanation: 'A healthy LTV:CAC ratio (commonly cited around 3:1 or better) means customers are worth meaningfully more than it costs to acquire them - the core math behind sustainable scaling.',
      },
      {
        id: 'scale-3',
        prompt: 'Why diversify across channels once a first channel is working well?',
        options: [
          'Diversifying always dilutes results and should be avoided',
          'It reduces dependence on any single platform and can unlock incremental, not just repeated, reach',
          'A single channel can scale indefinitely with no diminishing returns',
          'Diversification is only relevant for very large enterprises',
        ],
        correctIndex: 1,
        explanation: 'Every channel eventually saturates the audience it can reach efficiently, and depending on one platform is a real business risk - a proven second channel adds incremental reach and resilience.',
      },
      {
        id: 'scale-4',
        prompt: 'Why does retention/repeat business matter as much as new customer acquisition when scaling?',
        options: [
          'It doesn\'t - only new customer growth matters',
          'Retained customers are typically cheaper to sell to again and compound the value of every acquisition dollar already spent',
          'Retention only matters for subscription businesses',
          'Acquisition and retention are unrelated to profitability',
        ],
        correctIndex: 1,
        explanation: 'Every new customer you keep buying from means the original acquisition cost is spread across more revenue - strong retention makes acquisition spend more efficient as you scale, not just a separate metric.',
      },
    ],
  },
}

export function getLessonForStage(stage: GrowthStageKey): LessonDef {
  return LESSON_DEFS[stage]
}
