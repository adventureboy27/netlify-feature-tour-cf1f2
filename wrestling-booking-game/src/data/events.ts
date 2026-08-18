// The creative event library — §20.
//
// House rules for anything added here:
//
//   * Every option has a real cost. Not flavour text — an actual negative
//     effect or a gamble that can fail. events.test.ts fails the build if an
//     option is all upside, because a decision with a free correct answer is
//     not a decision.
//
//   * At least two options, and they should pull in different directions.
//     "Do it" / "Don't" is fine only when both sides genuinely hurt.
//
//   * 3+ body variants so the second sighting reads differently.
//
//   * Cooldowns long enough that the event stays a story. Big, identity-
//     defining events (a walkout, a career-ending injury) get very long
//     cooldowns; small texture gets shorter ones.
//
// §0 targets 150+ events at v1. This is the founding set across all five
// categories, and the shape every later batch follows.

import type { CreativeEvent } from '../engine/events/types';

export const CREATIVE_EVENTS: CreativeEvent[] = [
  // ------------------------------------------------------------ locker room
  {
    id: 'backstageFight',
    category: 'lockerRoom',
    title: '{primary} and {secondary} had to be pulled apart',
    body: [
      'It started over a missed spot and ended with both of them on the floor. Half the locker room saw it.',
      'Nobody will say who swung first. Both of them are sitting on opposite sides of the room refusing to look at each other.',
      'A shoving match in catering turned into something the road agents had to break up.',
      'It was over in ten seconds and everyone in the building is still talking about it.',
    ],
    weight: 10,
    cooldownWeeks: 30,
    conditions: {
      minWeek: 3,
      primary: (w) => w.attitude < 55,
      secondary: (w) => w.attitude < 65,
    },
    options: [
      {
        id: 'fine-both',
        label: 'Fine them both and move on',
        gains: 'The room sees a line being enforced',
        costs: 'Both of them resent you, and the grudge stays live',
        effects: ({ primary, secondary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: -10 },
          { kind: 'morale', wrestlerId: secondary!.id, delta: -10 },
          { kind: 'rosterMorale', delta: 3 },
          { kind: 'shootHeat', wrestlerIds: [primary!.id, secondary!.id], delta: 15 },
        ],
      },
      {
        id: 'book-it',
        label: 'Put them in the ring together',
        gains: 'Real animosity draws — this could be the best match of the year',
        costs: 'You are pointing a camera at a fight nobody is pulling',
        effects: ({ primary, secondary }) => [
          { kind: 'shootHeat', wrestlerIds: [primary!.id, secondary!.id], delta: 25 },
          { kind: 'crowdHeat', wrestlerIds: [primary!.id, secondary!.id], delta: 20 },
          { kind: 'rosterMorale', delta: -4 },
        ],
        gamble: {
          chance: ({ primary, secondary }) => 0.35 + ((primary!.attitude + secondary!.attitude) / 200) * 0.4,
          onSuccess: ({ primary, secondary }) => [
            { kind: 'popularity', wrestlerId: primary!.id, delta: 6 },
            { kind: 'popularity', wrestlerId: secondary!.id, delta: 6 },
          ],
          onFailure: ({ primary, secondary }) => [
            { kind: 'injury', wrestlerId: secondary!.id, weeks: 3 },
            { kind: 'shootHeat', wrestlerIds: [primary!.id, secondary!.id], delta: 25 },
            { kind: 'rosterMorale', delta: -6 },
          ],
        },
      },
      {
        id: 'separate',
        label: 'Keep them apart entirely',
        gains: 'It cannot escalate if they never share a building',
        costs: 'Your two best heat magnets can never be booked together',
        effects: ({ primary, secondary }) => [
          { kind: 'rosterMorale', delta: 2 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -8 },
          { kind: 'momentum', wrestlerId: secondary!.id, delta: -8 },
        ],
      },
    ],
  },
  {
    id: 'veteranComplaint',
    category: 'lockerRoom',
    title: '{primary} thinks the young talent is being handed too much',
    body: [
      'They caught you after the show. Twenty years in the business and they have opinions about who is getting the spots.',
      'It was not a complaint exactly. It was a long story about how things used to be, with a point at the end of it.',
      'They have been saying it in the locker room for weeks. Now they are saying it to you.',
    ],
    weight: 12,
    cooldownWeeks: 22,
    conditions: { minWeek: 6, primary: (_w, status) => status === 'veteran' || status === 'gatekeeper' || status === 'legend' },
    options: [
      {
        id: 'agree',
        label: 'Agree — slow the young talent down',
        gains: 'The veterans trust you and the room settles',
        costs: 'Your prospects stop climbing, and they notice',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: 12 },
          { kind: 'rosterMorale', delta: -3 },
          { kind: 'bookingCredibility', delta: -4 },
        ],
      },
      {
        id: 'tell-them',
        label: 'Tell them the business moved on',
        gains: 'You keep control of your own booking',
        costs: 'A respected voice in that locker room is now against you',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: -16 },
          { kind: 'bookingCredibility', delta: 3 },
          { kind: 'rosterMorale', delta: -2 },
        ],
      },
      {
        id: 'make-them-teach',
        label: 'Make it their job to fix it',
        gains: 'Turns the complaint into a use for someone with nothing to do',
        costs: 'Costs you a spot on the card and their appearance fee',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: 8 },
          { kind: 'money', delta: -2500 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -6 },
        ],
      },
    ],
  },

  // --------------------------------------------------------------- creative
  {
    id: 'gimmickRequest',
    category: 'creative',
    title: '{primary} wants a new gimmick',
    body: [
      'They have been doing the same character for years and they are done with it. They have an idea. It is not a bad one.',
      'They came to you with three pages of notes. Somebody has been thinking about this for a long time.',
      'The current act is stale and they know it before you do. They want to change everything.',
      'They are not asking for a push. They are asking to be someone else.',
    ],
    weight: 14,
    cooldownWeeks: 16,
    conditions: { minWeek: 4, primary: (w) => w.gimmickFreshness < 60 },
    options: [
      {
        id: 'grant',
        label: 'Grant it — new character, new look',
        gains: 'A fresh act, restyled to match, and a wrestler who owes you one',
        costs: 'Everything you built with the old gimmick is gone',
        effects: ({ primary }) => [
          { kind: 'gimmickChange', wrestlerId: primary!.id },
          { kind: 'morale', wrestlerId: primary!.id, delta: 14 },
          { kind: 'popularity', wrestlerId: primary!.id, delta: -8 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -10 },
        ],
        gamble: {
          chance: ({ primary }) => 0.35 + (primary!.charisma / 100) * 0.45,
          onSuccess: ({ primary }) => [
            { kind: 'popularity', wrestlerId: primary!.id, delta: 18 },
            { kind: 'momentum', wrestlerId: primary!.id, delta: 20 },
          ],
          onFailure: ({ primary }) => [
            { kind: 'popularity', wrestlerId: primary!.id, delta: -10 },
            { kind: 'morale', wrestlerId: primary!.id, delta: -12 },
          ],
        },
      },
      {
        id: 'refuse',
        label: 'Refuse — the act still works',
        gains: 'Keeps the popularity you have already paid for',
        costs: 'They are stale, they know it, and now they know you do not care',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: -14 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -5 },
        ],
      },
      {
        id: 'tweak',
        label: 'A repackage, not a rebuild',
        gains: 'Freshens the act without throwing the equity away',
        costs: 'Half measures satisfy nobody, least of all them',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: 3 },
          { kind: 'popularity', wrestlerId: primary!.id, delta: -2 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: 6 },
        ],
      },
    ],
  },
  {
    id: 'turnRequest',
    category: 'creative',
    title: '{primary} wants to turn',
    body: [
      'They think the crowd is ready to hate them. They might be right.',
      'They are tired of being cheered politely. They want to be booed properly.',
      'The character has nowhere left to go in this direction and they know it.',
    ],
    weight: 11,
    cooldownWeeks: 20,
    conditions: { minWeek: 8, primary: (w) => Math.abs(w.alignment) > 30 && w.popularity > 45 },
    options: [
      {
        id: 'turn',
        label: 'Turn them',
        gains: 'A fresh direction and a story the crowd has not seen',
        costs: 'You lose the act you had, and turns can fall completely flat',
        effects: ({ primary }) => [
          { kind: 'alignmentTurn', wrestlerId: primary!.id, toward: primary!.alignment >= 0 ? 'heel' : 'face' },
          { kind: 'morale', wrestlerId: primary!.id, delta: 10 },
          { kind: 'popularity', wrestlerId: primary!.id, delta: -6 },
        ],
        gamble: {
          chance: ({ primary }) => 0.4 + (primary!.charisma / 100) * 0.4,
          onSuccess: ({ primary }) => [
            { kind: 'popularity', wrestlerId: primary!.id, delta: 16 },
            { kind: 'momentum', wrestlerId: primary!.id, delta: 18 },
          ],
          onFailure: ({ primary }) => [
            { kind: 'popularity', wrestlerId: primary!.id, delta: -12 },
            { kind: 'momentum', wrestlerId: primary!.id, delta: -15 },
          ],
        },
      },
      {
        id: 'later',
        label: 'Tell them to wait',
        gains: 'You keep the timing for when it will draw the most',
        costs: 'Momentum stalls and they stop bringing you ideas',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: -8 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -6 },
        ],
      },
    ],
  },
  {
    id: 'stableProposal',
    category: 'creative',
    title: '{primary} and {secondary} want to form a group',
    body: [
      'They have been travelling together for months and they have it all worked out — name, colours, the lot.',
      'Two acts that are not going anywhere alone think they would go somewhere together.',
      'They pitched it as a faction. They already have matching gear made.',
    ],
    weight: 9,
    cooldownWeeks: 26,
    conditions: {
      minWeek: 10,
      primary: (w, status) => status !== 'draw' && w.popularity > 35,
      secondary: (w, status) => status !== 'draw' && w.popularity > 35,
    },
    options: [
      {
        id: 'form',
        label: 'Form the group, matching colours and all',
        gains: 'Two mid-card acts become one thing worth caring about',
        costs: 'Neither of them can be built as a singles act while it lasts',
        effects: ({ primary, secondary }) => [
          { kind: 'formStable', memberIds: [primary!.id, secondary!.id], name: 'faction' },
          { kind: 'morale', wrestlerId: primary!.id, delta: 10 },
          { kind: 'morale', wrestlerId: secondary!.id, delta: 10 },
          { kind: 'popularity', wrestlerId: primary!.id, delta: 5 },
          { kind: 'popularity', wrestlerId: secondary!.id, delta: 5 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -8 },
          { kind: 'momentum', wrestlerId: secondary!.id, delta: -8 },
        ],
      },
      {
        id: 'refuse',
        label: 'Keep them singles',
        gains: 'Both stay available to build individually',
        costs: 'Two disappointed wrestlers who had a plan',
        effects: ({ primary, secondary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: -9 },
          { kind: 'morale', wrestlerId: secondary!.id, delta: -9 },
        ],
      },
    ],
  },

  // --------------------------------------------------------------- business
  {
    id: 'sponsorOffer',
    category: 'business',
    title: 'A sponsor wants their name on the show',
    body: [
      'A regional brand wants the naming rights. The money is real and the creative notes are going to be worse.',
      'They love the product. They have also sent over a two-page list of things they would rather you did not do on camera.',
      'It is not enormous money, but it is money that arrives whether the show is any good or not.',
    ],
    weight: 10,
    cooldownWeeks: 24,
    conditions: { minWeek: 6 },
    options: [
      {
        id: 'take',
        label: 'Take the money',
        gains: 'Guaranteed income that does not depend on the gate',
        costs: 'They get a say, and what they want is duller than what you want',
        effects: () => [
          { kind: 'money', delta: 22000 },
          { kind: 'companyRating', delta: -2 },
          { kind: 'reputation', delta: -3 },
        ],
      },
      {
        id: 'refuse',
        label: 'Turn it down',
        gains: 'The show stays yours',
        costs: 'The boys hear you turned down a payday they would have shared in',
        effects: () => [
          { kind: 'reputation', delta: 4 },
          { kind: 'bookingCredibility', delta: 2 },
          { kind: 'rosterMorale', delta: -4 },
        ],
      },
      {
        id: 'negotiate',
        label: 'Take it but fight over the notes',
        gains: 'Most of the money without all of the interference',
        costs: 'They may walk entirely, and you have burned the relationship',
        effects: () => [{ kind: 'reputation', delta: 1 }],
        gamble: {
          chance: ({ promotion }) => 0.3 + (promotion.reputation / 100) * 0.5,
          onSuccess: () => [{ kind: 'money', delta: 18000 }],
          onFailure: () => [
            { kind: 'money', delta: -3000 },
            { kind: 'reputation', delta: -4 },
          ],
        },
      },
    ],
  },
  {
    id: 'tvSlotOffer',
    category: 'business',
    title: 'The network is offering a better slot',
    body: [
      'A better night, more eyes, and they want more shows a month to go with it.',
      'The slot is a real upgrade. The production commitment that comes with it is not small.',
      'They are offering the good hour. They want to know you can fill it every week.',
    ],
    weight: 8,
    cooldownWeeks: 40,
    conditions: { minWeek: 14, promotion: (p) => p.rating > 50 },
    options: [
      {
        id: 'accept',
        label: 'Take the slot',
        gains: 'A bigger audience every week from here on',
        costs: 'A production commitment your roster may not be deep enough for',
        effects: () => [
          { kind: 'companyRating', delta: 6 },
          { kind: 'money', delta: -15000 },
          { kind: 'rosterMorale', delta: -5 },
        ],
      },
      {
        id: 'decline',
        label: 'Stay where you are',
        gains: 'A schedule your roster can actually sustain',
        costs: 'The network offered once; they may not offer again',
        effects: () => [
          { kind: 'companyRating', delta: -2 },
          { kind: 'rosterMorale', delta: 3 },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ rival
  {
    id: 'rivalInterest',
    category: 'rival',
    title: '{rival} has been talking to {primary}',
    body: [
      'It got back to you third-hand, which means it has been going on a while.',
      'Somebody saw them having dinner with a booker who does not work for you.',
      'They did not deny it. They did not really explain it either.',
      'The offer is apparently generous. The offer is apparently in writing.',
    ],
    weight: 13,
    cooldownWeeks: 14,
    conditions: {
      minWeek: 8,
      needsRival: true,
      primary: (_w, status) => status === 'draw' || status === 'mainEventer' || status === 'upperCard',
    },
    options: [
      {
        id: 'pay',
        label: 'Match the money',
        gains: 'They stay, and the locker room sees loyalty rewarded',
        costs: 'Your payroll just went up, and everyone else will hear about it',
        effects: ({ primary }) => [
          { kind: 'contractRate', wrestlerId: primary!.id, multiplier: 1.35 },
          { kind: 'morale', wrestlerId: primary!.id, delta: 15 },
          { kind: 'rosterMorale', delta: -4 },
        ],
      },
      {
        id: 'push',
        label: 'Outbid them with the booking instead',
        gains: 'Costs nothing up front and buys real loyalty',
        costs: 'You are committing your top spot to someone with one foot out',
        effects: ({ primary }) => [
          { kind: 'momentum', wrestlerId: primary!.id, delta: 20 },
          { kind: 'morale', wrestlerId: primary!.id, delta: 10 },
          { kind: 'bookingCredibility', delta: -3 },
        ],
        gamble: {
          chance: ({ primary }) => 0.35 + (primary!.attitude / 100) * 0.45,
          onSuccess: ({ primary }) => [{ kind: 'popularity', wrestlerId: primary!.id, delta: 10 }],
          onFailure: ({ primary }) => [
            { kind: 'release', wrestlerId: primary!.id },
            { kind: 'rosterMorale', delta: -8 },
          ],
        },
      },
      {
        id: 'let-go',
        label: 'Let them walk',
        gains: 'You keep the money and the spot opens for somebody younger',
        costs: 'You just handed a rival a star you built',
        effects: ({ primary }) => [
          { kind: 'release', wrestlerId: primary!.id },
          { kind: 'money', delta: 6000 },
          { kind: 'companyRating', delta: -4 },
          { kind: 'rosterMorale', delta: -5 },
        ],
      },
    ],
  },
  {
    id: 'rivalRaidsTape',
    category: 'rival',
    title: '{rival} ran your finish on their show',
    body: [
      'Same spot, same false finish, seven days later and better lit.',
      'It is not illegal. It is not subtle either.',
      'Their booker has clearly been watching. Closely.',
    ],
    weight: 9,
    cooldownWeeks: 20,
    conditions: { minWeek: 12, needsRival: true },
    options: [
      {
        id: 'ignore',
        label: 'Say nothing',
        gains: 'You look like the bigger operation',
        costs: 'They will do it again, and your locker room noticed you did nothing',
        effects: () => [{ kind: 'rosterMorale', delta: -3 }],
      },
      {
        id: 'answer',
        label: 'Answer it on air',
        gains: 'A real inter-promotional story your audience can follow',
        costs: 'You just told your viewers a rival promotion exists',
        effects: () => [
          { kind: 'companyRating', delta: 3 },
          { kind: 'reputation', delta: -2 },
        ],
        gamble: {
          chance: ({ promotion }) => 0.35 + (promotion.rating / 100) * 0.4,
          onSuccess: () => [{ kind: 'companyRating', delta: 5 }],
          onFailure: () => [
            { kind: 'companyRating', delta: -6 },
            { kind: 'reputation', delta: -3 },
          ],
        },
      },
    ],
  },

  // --------------------------------------------------------------- personal
  {
    id: 'workingHurt',
    category: 'personal',
    title: '{primary} has been working hurt',
    body: [
      'The trainer told you before they did. They have been taping it up for weeks.',
      'It is not serious yet. Everyone involved has been careful to use the word "yet".',
      'They can go. They should not, but they can.',
    ],
    weight: 12,
    cooldownWeeks: 12,
    conditions: { minWeek: 5, primary: (w) => w.health < 70 },
    options: [
      {
        id: 'rest',
        label: 'Sit them down until it heals',
        gains: 'You get them back whole instead of losing them for a year',
        costs: 'A hole in your card and an act going cold',
        effects: ({ primary }) => [
          { kind: 'health', wrestlerId: primary!.id, delta: 25 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -18 },
          { kind: 'popularity', wrestlerId: primary!.id, delta: -4 },
        ],
      },
      {
        id: 'work',
        label: 'Keep them working',
        gains: 'Your card holds and the story keeps moving',
        costs: 'You are gambling with somebody’s career to save a booking',
        effects: ({ primary }) => [{ kind: 'morale', wrestlerId: primary!.id, delta: -6 }],
        gamble: {
          chance: ({ primary }) => 0.3 + (primary!.toughness / 100) * 0.45,
          onSuccess: ({ primary }) => [{ kind: 'momentum', wrestlerId: primary!.id, delta: 8 }],
          onFailure: ({ primary }) => [
            { kind: 'injury', wrestlerId: primary!.id, weeks: 10 },
            { kind: 'rosterMorale', delta: -7 },
          ],
        },
      },
      {
        id: 'lighten',
        label: 'Book them light and protect them',
        gains: 'Keeps them on television without the risk',
        costs: 'Everyone can see they are being protected, including the crowd',
        effects: ({ primary }) => [
          { kind: 'health', wrestlerId: primary!.id, delta: 8 },
          { kind: 'popularity', wrestlerId: primary!.id, delta: -3 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -6 },
        ],
      },
    ],
  },
  {
    id: 'retirementThoughts',
    category: 'personal',
    title: '{primary} is thinking about the end',
    body: [
      'Not this year, they said. But they said it out loud, which is new.',
      'The body is telling them something and they have started listening.',
      'They wanted you to hear it from them before you heard it from anyone else.',
    ],
    weight: 7,
    cooldownWeeks: 36,
    conditions: { minWeek: 20, primary: (_w, status) => status === 'veteran' || status === 'legend' },
    options: [
      {
        id: 'send-off',
        label: 'Plan the send-off now',
        gains: 'A retirement run you control, and a huge final night',
        costs: 'You are committing to losing them on a date you just set',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: 18 },
          { kind: 'popularity', wrestlerId: primary!.id, delta: 10 },
          { kind: 'companyRating', delta: 3 },
          { kind: 'money', delta: -8000 },
        ],
      },
      {
        id: 'talk-out',
        label: 'Talk them out of it',
        gains: 'You keep a draw on the roster a while longer',
        costs: 'Every week they keep going is a week closer to a bad injury',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: -5 },
          { kind: 'health', wrestlerId: primary!.id, delta: -10 },
        ],
      },
      {
        id: 'office-job',
        label: 'Offer them a job in the office',
        gains: 'Keeps the knowledge in the building after the body quits',
        costs: 'Their in-ring value goes to zero the day they accept',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: 12 },
          { kind: 'rosterMorale', delta: 4 },
          { kind: 'money', delta: -4000 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -20 },
        ],
      },
    ],
  },
];

export function eventById(id: string): CreativeEvent | undefined {
  return CREATIVE_EVENTS.find((e) => e.id === id);
}
