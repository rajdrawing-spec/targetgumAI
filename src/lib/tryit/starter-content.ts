import type { LessonQuestion } from '@/lib/lessons/types'

/**
 * Public try-it content (docs/DECISIONS.md 2026-09-24, "Public try-it
 * experience"): the starter Growth Journey anyone can play at /start
 * without an account. Static editorial content only - no client data,
 * no AI calls, no database - so exposing it publicly changes nothing
 * about the invite-only security model.
 *
 * One running example throughout (a new eco-friendly water bottle, as in
 * the reference designs) so a beginner can picture every decision.
 */

export interface StarterLesson {
  id: string
  /** Growth Map node this lesson completes. */
  node: number
  title: string
  summary: string
  xp: number
  questions: readonly LessonQuestion[]
}

export const STARTER_LESSONS: readonly StarterLesson[] = [
  {
    id: 'audience-basics',
    node: 2,
    title: 'Understand Your Audience',
    summary: 'You learned why every campaign starts with knowing who you are trying to reach.',
    xp: 50,
    questions: [
      {
        type: 'choice',
        id: 'aud-first-step',
        category: 'Campaign Planning',
        prompt: 'Help Gummy finish the conversation about starting a campaign.',
        conversation: {
          coach: 'You want to launch a campaign to sell your new eco-friendly water bottle. What is the first step?',
          learner: 'The first step is to ___.',
        },
        options: ['Create the ad and launch it immediately', 'Define your target audience', 'Set a high budget', 'Choose a random platform'],
        correctIndex: 1,
        tip: 'A successful campaign starts with understanding who your audience is.',
        explanation: 'A campaign starts with knowing who you are trying to reach. Who they are decides what the ad says, where it runs and how much it is worth spending.',
      },
      {
        type: 'choice',
        id: 'aud-segment',
        category: 'Audience Targeting',
        prompt: 'Your goal is to attract environmentally conscious young adults. Which audience should you target first?',
        options: [
          'People interested in sustainable living, outdoor activities and eco-friendly products',
          'All internet users worldwide',
          'People who recently bought luxury watches',
          'People interested in fast food and gaming',
        ],
        correctIndex: 0,
        tip: 'Look for interests that match what makes your product special.',
        explanation: 'People who already care about sustainability and the outdoors are the most likely to want a reusable, eco-friendly bottle. "Everyone" sounds big but wastes money on people who will never buy.',
      },
      {
        type: 'match',
        id: 'aud-match',
        category: 'Audience Targeting',
        prompt: 'Match each product with the audience most likely to buy it.',
        pairs: [
          { left: 'Eco water bottle', right: 'Hikers and zero-waste shoppers' },
          { left: 'Protein bars', right: 'Gym-goers and runners' },
          { left: 'Kids’ story books', right: 'Parents of young children' },
          { left: 'Office chairs', right: 'People who work from home' },
        ],
        explanation: 'The best audience is the group with a real reason to need the product. Start from the problem it solves and ask who has that problem.',
      },
      {
        type: 'choice',
        id: 'aud-mistake',
        category: 'Spot the Mistake',
        prompt: 'A shop says: "Our bottle is for everyone, so we will show the ad to everyone." What is the mistake?',
        options: [
          'Nothing - more people always means more sales',
          'Trying to reach everyone makes the message vague and wastes budget on people who will not buy',
          'They should only advertise on TV',
          'They should lower the price first',
        ],
        correctIndex: 1,
        explanation: 'A message written for everyone speaks to no one. A focused audience lets you say something that really matters to them - and every rupee goes further.',
      },
    ],
  },
  {
    id: 'market-research',
    node: 3,
    title: 'Research Your Market',
    summary: 'You learned how to spot what your buyers care about and where to find them.',
    xp: 50,
    questions: [
      {
        type: 'choice',
        id: 'mkt-where',
        category: 'Market Research',
        prompt: 'What is the quickest honest way to learn what buyers of water bottles care about?',
        options: [
          'Guess, based on what you like',
          'Read reviews of popular bottles and note what people praise and complain about',
          'Copy a competitor’s price',
          'Wait until after launch to find out',
        ],
        correctIndex: 1,
        tip: 'Real customers already wrote down what they want - in reviews.',
        explanation: 'Reviews are free research: the praise tells you what to highlight, the complaints tell you what to do better than everyone else.',
      },
      {
        type: 'match',
        id: 'mkt-platforms',
        category: 'Platforms',
        prompt: 'Match each platform with the job it does best.',
        pairs: [
          { left: 'Instagram', right: 'Short videos and good-looking product photos' },
          { left: 'YouTube', right: 'Longer videos and brand stories' },
          { left: 'Google Ads', right: 'People already searching to buy' },
          { left: 'LinkedIn', right: 'Selling to businesses and professionals' },
        ],
        tip: 'Think about what people are doing when they open each app.',
        explanation: 'Each platform has its own mood: browsing (Instagram), watching and learning (YouTube), searching with intent (Google) and working (LinkedIn).',
      },
      {
        type: 'choice',
        id: 'mkt-creative',
        category: 'Creative Studio',
        prompt: 'Which ad is most likely to stop someone scrolling who cares about the planet?',
        layout: 'cards',
        options: ['“BUY NOW. BEST BOTTLE.”', '“One bottle. 1,000 fewer plastic ones. Start today.”', '“Bottles available in many colours.”'],
        correctIndex: 1,
        explanation: 'It speaks to what this audience cares about (less plastic), shows a clear benefit with a concrete number, and ends with a call to action.',
      },
    ],
  },
  {
    id: 'offer-and-plan',
    node: 4,
    title: 'Create Your Offer',
    summary: 'You built an offer, chose a call to action and planned your first campaign budget.',
    xp: 100,
    questions: [
      {
        type: 'choice',
        id: 'offer-best',
        category: 'Offer',
        prompt: 'Which launch offer gives eco-minded buyers the strongest reason to act now?',
        options: [
          'No offer - the product speaks for itself',
          '“Launch week: free cleaning brush + we plant a tree for every order”',
          '“90% off everything forever”',
          '“Prices may change”',
        ],
        correctIndex: 1,
        tip: 'A good offer is a reason to act NOW that fits what buyers value.',
        explanation: 'A time-limited bonus that matches the audience’s values (a tree planted) gives a reason to buy today without destroying your profit the way a huge discount would.',
      },
      {
        type: 'choice',
        id: 'offer-cta',
        category: 'Call to Action',
        prompt: 'Which call to action (button text) should the ad use?',
        layout: 'cards',
        options: ['Click here', 'Get yours + a free brush', 'Learn about our company history'],
        correctIndex: 1,
        explanation: 'A good call to action says exactly what happens next and repeats the benefit. "Click here" says neither.',
      },
      {
        type: 'order',
        id: 'offer-steps',
        category: 'Campaign Setup',
        prompt: 'Put the steps for launching your campaign in the right order.',
        steps: ['Set the campaign objective', 'Define the target audience', 'Create the ad creatives', 'Choose the platform', 'Set the budget', 'Launch the campaign'],
        tip: 'Decide WHY and WHO before you make anything.',
        explanation: 'Objective first, then audience - those two decide what the ad says, where it runs and how much it is worth spending. Launching is always last.',
      },
      {
        type: 'budget',
        id: 'offer-budget',
        category: 'Budgeting',
        prompt: 'Your eco-minded, young-adult audience spends most of its time on Instagram. How would you split a ₹10,000 test budget?',
        total: 10000,
        currencySymbol: '₹',
        step: 500,
        channels: ['Instagram', 'Facebook', 'Google Ads', 'YouTube'],
        largestChannelIndex: 0,
        tip: 'Put more budget where your target audience is most active.',
        explanation: 'Give the largest share to where your audience actually is (Instagram), and keep smaller amounts elsewhere to learn. Splitting evenly feels fair but usually wastes money.',
      },
    ],
  },
]

export function getStarterLesson(id: string): StarterLesson | undefined {
  return STARTER_LESSONS.find((l) => l.id === id)
}

/** The last free node - everything after it is part of the full product. */
export const LAST_FREE_NODE = 4

/** XP awarded for finishing the business onboarding (node 1). */
export const ONBOARDING_XP = 25
