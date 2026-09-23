import type { GrowthStageKey } from '@prisma/client'

/**
 * Static lesson content for the Growth Map's Duolingo-style quiz mechanic
 * - a short lesson per stage (except `DEFINE_BUSINESS`, which is a plain
 * business-info form instead - see `business-intake-form.tsx` and
 * docs/DECISIONS.md), each a handful of multiple-choice questions with
 * instant feedback and a plain-language explanation.
 *
 * Written for someone with *zero* marketing background - a small maker
 * or shop owner (docs/DECISIONS.md's "village potter" persona), not a
 * marketing professional. No jargon (no "value proposition", "ICP",
 * "ROAS", "CTR", "funnel", "A/B test", "LTV:CAC") - every question uses
 * plain words and a concrete example from a small handmade-goods
 * business, since that's the running example a non-marketer can actually
 * picture. Fixed editorial content, not client data, so it lives in code
 * the same way `stage-defs.ts` and the achievement catalog do.
 *
 * A lesson is always completable - there's no pass/fail gate that blocks
 * progress. Right/wrong feedback and a final score are for the learning
 * value, not to withhold progress.
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

/**
 * `DEFINE_BUSINESS` has no entry here - it's a plain-language business-
 * info form, not a quiz (someone brand new to their own business page
 * shouldn't be quizzed on marketing terms before they've even described
 * what they make).
 */
export const LESSON_DEFS: Partial<Record<GrowthStageKey, LessonDef>> = {
  UNDERSTAND_AUDIENCE: {
    stage: 'UNDERSTAND_AUDIENCE',
    title: 'Understand Your Audience',
    intro: 'The more you know about the people who buy from you, the easier it is to find more people just like them.',
    questions: [
      {
        id: 'audience-1',
        prompt: 'Why is it helpful to know who your customers actually are?',
        options: [
          "It isn't really necessary - anyone might buy",
          'So you can talk to them in a way that makes sense to them, and show them what they actually want',
          'Only big companies need to think about this',
          "It's only useful for online shops",
        ],
        correctIndex: 1,
        explanation: "When you know who you're talking to, you can use words and photos that speak to THEM - not just anyone. That's what makes people stop and pay attention.",
      },
      {
        id: 'audience-2',
        prompt: 'A potter sells mostly to people decorating their homes. What\'s a smart way to learn more about these buyers?',
        options: [
          "Guess, based on what you'd want yourself",
          'Ask a few recent buyers why they chose your pottery, and look at who likes or comments on your posts',
          'Copy whatever a big brand does',
          "It doesn't matter, just keep making pottery",
        ],
        correctIndex: 1,
        explanation: 'Real answers from real buyers beat guessing every time - even a few short conversations can teach you a lot.',
      },
      {
        id: 'audience-3',
        prompt: "Why does it matter WHY someone buys (e.g. \"it's a gift\", \"I love that it's handmade\")?",
        options: [
          "It doesn't - price is all that matters",
          "Knowing why someone buys tells you exactly what to say to convince others with the same reason",
          'Only useful for expensive products',
          'This only matters for jewelry, not pottery',
        ],
        correctIndex: 1,
        explanation: "If most buyers say \"I love that it's handmade, not mass-produced,\" that's exactly the thing to say more often in your posts and ads.",
      },
      {
        id: 'audience-4',
        prompt: "What's a simple way to find out what's stopping people from buying?",
        options: [
          'Never ask, just hope for the best',
          "Ask people who looked but didn't buy what held them back",
          "Assume it's always the price",
          'Stop selling that product',
        ],
        correctIndex: 1,
        explanation: "Sometimes it isn't price at all - maybe they weren't sure it would arrive safely, or wanted to see more photos. Asking tells you exactly what to fix.",
      },
    ],
  },
  RESEARCH_MARKET: {
    stage: 'RESEARCH_MARKET',
    title: 'Research Your Market',
    intro: 'Before you spend any money, it helps to look around - what are other sellers doing, and what are people already searching for?',
    questions: [
      {
        id: 'market-1',
        prompt: 'Why look at other sellers of similar products?',
        options: [
          'To copy them exactly',
          'To see what they do well, and find a gap you can fill better',
          "It's a waste of time",
          'Only to complain about them',
        ],
        correctIndex: 1,
        explanation: "You're not copying - you're looking for what's missing. Maybe nobody else offers custom colours, faster delivery, or the story of how it's made.",
      },
      {
        id: 'market-2',
        prompt: 'A pottery seller notices people search online for "handmade mug gift". What does that tell you?',
        options: [
          'Nothing useful',
          "There's real demand for exactly that kind of product - worth making it easy to find",
          'You should stop making mugs',
          'Only large companies can use this kind of information',
        ],
        correctIndex: 1,
        explanation: "When people are already searching for something close to what you sell, that's a sign of real, existing demand you can meet.",
      },
      {
        id: 'market-3',
        prompt: 'Why does it help to notice busier times of year, like before festivals?',
        options: [
          'It never matters when you sell',
          'You can prepare stock and push a little harder exactly when more people are ready to buy',
          'Prices should always stay exactly the same',
          'This only applies to food businesses',
        ],
        correctIndex: 1,
        explanation: "Demand isn't flat all year round. Knowing when people buy more lets you get ready in time instead of missing the moment.",
      },
      {
        id: 'market-4',
        prompt: "What's a low-cost way to spot a real opportunity before spending any money?",
        options: [
          'Guess and hope',
          "See if people are already asking about, or searching for, what you make",
          'Only trust your own opinion',
          'Wait for a competitor to prove it works, then never act on it',
        ],
        correctIndex: 1,
        explanation: 'People already looking for something similar is one of the strongest, cheapest signs that an idea is worth trying.',
      },
    ],
  },
  CREATE_OFFER: {
    stage: 'CREATE_OFFER',
    title: 'Create Your Offer',
    intro: "A good offer makes saying \"yes\" feel easy and safe - often more powerful than just running more ads.",
    questions: [
      {
        id: 'offer-1',
        prompt: 'What usually makes someone finally decide to buy?',
        options: [
          'The lowest price, always',
          'Feeling like what they get is worth more than what they pay, with little risk',
          'A confusing set of terms and conditions',
          'Random luck',
        ],
        correctIndex: 1,
        explanation: "People buy when the value feels clearly bigger than the risk. A fair price plus something that removes worry - like \"happy with it or your money back\" - makes that easy.",
      },
      {
        id: 'offer-2',
        prompt: 'A festival is coming up. Is it OK to say "Sale ends in 2 days" if that\'s actually true?',
        options: [
          'No, creating any urgency is always dishonest',
          "Yes - real urgency (a real deadline) is fine and helps people decide; making up a fake countdown that never actually ends is not",
          "It doesn't matter either way",
          'Only large stores are allowed to do this',
        ],
        correctIndex: 1,
        explanation: 'A genuine deadline helps someone who was "thinking about it" actually decide. A fake one that resets every visit just breaks trust once people notice.',
      },
      {
        id: 'offer-3',
        prompt: 'Why might offering "happy with it, or your money back" help you sell more?',
        options: [
          "It doesn't help at all",
          "It removes the buyer's biggest worry - \"what if I don't like it\"",
          "It's only useful for very expensive items",
          "It's required by law everywhere",
        ],
        correctIndex: 1,
        explanation: 'First-time buyers often hesitate because of risk, not price. Taking that risk away for them makes buying feel like an easy decision.',
      },
      {
        id: 'offer-4',
        prompt: 'How should you decide what to charge?',
        options: [
          'Always match the cheapest seller you can find',
          'Think about what the piece is truly worth to the person buying it - the time, skill and story behind it',
          'Pick a random number',
          'Never change your price, ever',
        ],
        correctIndex: 1,
        explanation: "Handmade work carries real skill and story. Pricing based on what it's genuinely worth to the buyer - not just copying the cheapest seller - protects your business.",
      },
    ],
  },
  CREATE_CREATIVE_ASSETS: {
    stage: 'CREATE_CREATIVE_ASSETS',
    title: 'Create Creative Assets',
    intro: "On social media you have about two seconds to stop someone's scroll - a strong photo and a short line of words do that job.",
    questions: [
      {
        id: 'creative-1',
        prompt: 'What is usually the single most important part of a post or ad?',
        options: [
          'The small print at the bottom',
          'The first thing someone sees - the photo or opening line - since it decides if they stop scrolling at all',
          'The logo',
          'How many hashtags you use',
        ],
        correctIndex: 1,
        explanation: "If the first photo or line doesn't grab attention, nothing else in the post ever gets seen - so it deserves the most care.",
      },
      {
        id: 'creative-2',
        prompt: 'Why do clear, well-lit photos of your pottery matter so much?',
        options: [
          "They don't matter much online",
          "People can't touch or hold handmade work online - a good photo is the only way to show its quality",
          'Only professional photographers can ever take a good photo',
          'One blurry photo works just as well as a clear one',
        ],
        correctIndex: 1,
        explanation: "Online, a photo does the job your hands would do in person - showing texture, colour and care. It's worth the extra effort to get right.",
      },
      {
        id: 'creative-3',
        prompt: 'You post the same photo every day for two weeks, and it stops getting attention. Why?',
        options: [
          'The product suddenly got worse',
          "People have already seen it enough times and stop noticing - it's time for a fresh photo or angle",
          'This never actually happens',
          'You should stop posting entirely',
        ],
        correctIndex: 1,
        explanation: 'Even a great photo becomes "invisible" once people have seen it too many times. Refreshing your photos and captions keeps people noticing.',
      },
      {
        id: 'creative-4',
        prompt: 'Why keep your style - colours, fonts, tone of writing - consistent across posts?',
        options: [
          "It doesn't matter",
          'People remember and trust you more when your posts feel like they come from the same person each time',
          'Only large brands need to worry about consistency',
          'Changing your style every post always works better',
        ],
        correctIndex: 1,
        explanation: "People need to see you a few times before they trust you enough to buy. If every post looks completely different, they may not even realise it's the same seller.",
      },
    ],
  },
  BUILD_CAMPAIGN: {
    stage: 'BUILD_CAMPAIGN',
    title: 'Build Campaign',
    intro: 'A little planning before you spend any money on ads saves you from wasting it.',
    questions: [
      {
        id: 'build-1',
        prompt: 'Why decide WHO should see your ad before turning it on?',
        options: [
          "It doesn't matter, just show it to everyone",
          'Showing it to people more likely to actually want it means your money goes further',
          'Only large companies need to choose an audience',
          "It's against the rules to choose",
        ],
        correctIndex: 1,
        explanation: 'Money spent showing your ad to people who were never going to buy is money wasted. A little bit of targeting stretches your budget much further.',
      },
      {
        id: 'build-2',
        prompt: 'Should you spend your entire budget on the very first idea you try?',
        options: [
          'Yes, always go all in immediately',
          "No - try a smaller amount first, see what works, then put more money behind the winner",
          "Budget size doesn't really matter",
          'Only spend money once a year',
        ],
        correctIndex: 1,
        explanation: "Starting small lets you learn cheaply. Once you see what's actually working, that's the moment to spend more.",
      },
      {
        id: 'build-3',
        prompt: 'Why write down where each sale or visitor came from - an Instagram post, a WhatsApp share, an ad?',
        options: [
          "It's not worth the effort to track",
          "So you know what's actually bringing you customers, and can do more of it",
          'Only useful for large websites',
          'This information can never really be known',
        ],
        correctIndex: 1,
        explanation: "Without knowing where buyers came from, you're guessing what's working. Even a simple note (\"came from Instagram\") tells you where to focus next.",
      },
      {
        id: 'build-4',
        prompt: 'Before spending money on an ad, what should you check first?',
        options: [
          'Nothing, just launch it right away',
          'That your links work, prices are correct, and photos look right - mistakes cost real money once ads are live',
          'Only the spelling of the product name',
          'Whether the moon is full',
        ],
        correctIndex: 1,
        explanation: 'A broken link or wrong price found AFTER money has been spent is expensive to fix. A two-minute check before launching saves that pain.',
      },
    ],
  },
  LAUNCH_CAMPAIGN: {
    stage: 'LAUNCH_CAMPAIGN',
    title: 'Launch Campaign',
    intro: 'Going live is exciting - a calm, watchful first few days makes sure nothing gets wasted.',
    questions: [
      {
        id: 'launch-1',
        prompt: 'Should you start with your full budget on day one?',
        options: [
          'Yes, spend everything immediately',
          "No - start small, watch closely, then increase spending once you see it's working",
          "Budget size doesn't matter at launch",
          'Wait a full year before spending anything',
        ],
        correctIndex: 1,
        explanation: "A smaller first spend limits how much you could lose if something isn't quite right yet, while still letting you learn fast.",
      },
      {
        id: 'launch-2',
        prompt: 'Why check on a new ad every day for the first few days, instead of once a month?',
        options: [
          'No need to check at all',
          'Problems - wrong price, a broken link, poor response - are cheap to fix early and expensive to fix late',
          'Ads fix themselves automatically',
          'Checking daily is discouraged',
        ],
        correctIndex: 1,
        explanation: 'Catching a mistake on day one costs a day of wasted spend. Catching it on day thirty costs a whole month.',
      },
      {
        id: 'launch-3',
        prompt: "In the first couple of days, results might look a bit shaky. What's the best response?",
        options: [
          'Panic and turn everything off immediately',
          'Give it a little time to settle before judging - the first days are often noisier than they will be later',
          "Assume it's broken forever",
          'Raise the price to compensate',
        ],
        correctIndex: 1,
        explanation: 'New ads often take a few days to find their footing. Judging too early, on too little information, can lead to the wrong decision.',
      },
      {
        id: 'launch-4',
        prompt: 'What\'s a simple way to "test the waters" before a big launch?',
        options: [
          'Show your new offer to a small group first, then open it up wider once it looks good',
          'Always launch to everyone at once, no exceptions',
          'Never test anything, just guess',
          "Only launch products nobody's ever heard of",
        ],
        correctIndex: 0,
        explanation: 'A small first release lets you catch problems - or discover you need to adjust price or photos - before it reaches everyone.',
      },
    ],
  },
  ANALYZE_RESULTS: {
    stage: 'ANALYZE_RESULTS',
    title: 'Analyze Results',
    intro: 'Numbers only help if you know which ones actually tell you something useful.',
    questions: [
      {
        id: 'analyze-1',
        prompt: 'You got lots of likes on a post, but no one bought anything. What does that tell you?',
        options: [
          'Nothing - likes and sales are unrelated',
          'People are noticing and liking what they see, but something after that - price, photos, how to order - may be stopping them buying',
          'You should stop posting entirely',
          'Likes always turn into sales eventually',
        ],
        correctIndex: 1,
        explanation: 'Lots of attention with no sales usually means the problem is AFTER the like - maybe pricing, product info, or how easy it is to actually order.',
      },
      {
        id: 'analyze-2',
        prompt: 'You tried two different photos for the same product. One got noticeably more attention, but from only a handful of views. Should you trust that result yet?',
        options: [
          'Yes immediately, switch to it forever',
          'Not yet - with very few views, the difference could just be luck. Wait for a bit more data before deciding',
          'No test is ever worth doing',
          'Always trust the very first result, no matter what',
        ],
        correctIndex: 1,
        explanation: 'With small numbers, a lucky handful of people can make one option look better than it really is. More views give a trustworthy answer.',
      },
      {
        id: 'analyze-3',
        prompt: 'What does it mean to look at the whole journey - saw the ad, clicked, then bought - instead of just one number?',
        options: [
          "It's overcomplicating things",
          'It shows exactly where people are dropping off, so you know what to fix',
          'Only large businesses need to do this',
          "There's no way to know this",
        ],
        correctIndex: 1,
        explanation: 'Breaking it into steps (saw it → clicked → bought) shows precisely where people are losing interest, instead of one confusing overall number.',
      },
      {
        id: 'analyze-4',
        prompt: 'Why write down your numbers regularly, even simple ones?',
        options: [
          "There's no real benefit",
          'So you can see what is actually changing over time, instead of relying on memory or guessing',
          "It's only useful for accountants",
          "Numbers change randomly and can't be tracked",
        ],
        correctIndex: 1,
        explanation: 'Memory is unreliable, especially over months. A simple ongoing note of what happened each week shows real patterns.',
      },
    ],
  },
  OPTIMIZE: {
    stage: 'OPTIMIZE',
    title: 'Optimize',
    intro: 'Small, steady improvements - tested one at a time - add up to real results.',
    questions: [
      {
        id: 'optimize-1',
        prompt: "You want to try a new price. What's the safest way to test it?",
        options: [
          'Change several things at once - price, photo and description - so you find out faster',
          'Change just the price and keep everything else the same, so you know exactly what caused any change',
          'Never test anything at all',
          'Only test prices once a year',
        ],
        correctIndex: 1,
        explanation: "If you change several things at once and something improves, you won't know WHICH change actually caused it. Testing one thing at a time gives a clear answer.",
      },
      {
        id: 'optimize-2',
        prompt: 'Your ad aimed at gift buyers keeps showing to people searching for "pottery classes" - not your kind of customer. What should you do?',
        options: [
          "Nothing, it doesn't really matter",
          "Exclude \"classes\" as a search term, so your ad stops showing to people who were never going to buy",
          'Increase the budget instead',
          'Stop advertising completely',
        ],
        correctIndex: 1,
        explanation: 'Excluding clearly irrelevant searches - like people looking for lessons, not products - stops money being spent on people who were never going to buy.',
      },
      {
        id: 'optimize-3',
        prompt: 'When should you shift more of your budget toward the better-performing option?',
        options: [
          'Immediately, after the very first result',
          "Once you've seen enough results to be confident the difference is real, not just luck",
          'Never move budget around, ever',
          'Only at the very end of the year',
        ],
        correctIndex: 1,
        explanation: 'Shifting budget toward a real winner is the whole point of testing - but only once confident it\'s a genuine difference, not an early lucky streak.',
      },
      {
        id: 'optimize-4',
        prompt: 'A photo that used to work well suddenly stops getting attention. What\'s a good first step?',
        options: [
          'Immediately assume the product itself is bad',
          "Figure out why first - maybe people have simply seen it too many times - then decide whether to refresh the photo or try a new audience",
          'Raise the price to compensate',
          'Ignore it, it will fix itself',
        ],
        correctIndex: 1,
        explanation: 'A drop can have different causes with different fixes - understanding why first means fixing the right thing instead of guessing.',
      },
    ],
  },
  SCALE_GROW: {
    stage: 'SCALE_GROW',
    title: 'Scale & Grow',
    intro: "Growing is about protecting what's already working while carefully doing more of it - not just spending more all at once.",
    questions: [
      {
        id: 'scale-1',
        prompt: 'Something is working well. Should you suddenly triple your spending on it overnight?',
        options: [
          'Yes, always go all in immediately',
          'No - increase gradually, so it keeps working smoothly instead of disrupting what was going well',
          'Spending amount never really matters',
          'Only increase spending once a decade',
        ],
        correctIndex: 1,
        explanation: 'A sudden, huge jump in spending can actually disrupt something that was working well. Growing it step by step tends to work more smoothly.',
      },
      {
        id: 'scale-2',
        prompt: 'Why does it matter if a customer buys from you again later, not just once?',
        options: [
          "It doesn't matter - only new customers count",
          'A customer who buys again is extra reward for the same effort it took to find them the first time',
          'Repeat customers are rare and not worth thinking about',
          'This only applies to subscription businesses',
        ],
        correctIndex: 1,
        explanation: 'Keeping a customer happy enough to come back means the work of finding them the first time keeps paying off - repeat buyers are often your cheapest sales.',
      },
      {
        id: 'scale-3',
        prompt: 'Your Instagram posts are working really well. Should you also try a second place to sell, like a local market or WhatsApp groups?',
        options: [
          'No, stick to one place forever',
          "It's worth trying carefully - a second good channel means you're not depending on just one place, and can reach new people",
          'Only large companies can use more than one channel',
          'This never actually works',
        ],
        correctIndex: 1,
        explanation: "Relying on just one place to find customers is risky. A second channel that's proven to work adds new reach and protects you if the first one slows down.",
      },
      {
        id: 'scale-4',
        prompt: 'What\'s one simple sign that a customer had a great experience and might come back or refer a friend?',
        options: [
          "There's no way to know",
          'They message you again, leave a kind comment or review, or tell a friend about you',
          'Only sales numbers matter, nothing else',
          'Silence always means they were happy',
        ],
        correctIndex: 1,
        explanation: 'Genuine, ongoing interest - repeat messages, reviews, referrals - is a real signal of loyalty, well worth noticing and thanking people for.',
      },
    ],
  },
}

export function getLessonForStage(stage: GrowthStageKey): LessonDef | undefined {
  return LESSON_DEFS[stage]
}
