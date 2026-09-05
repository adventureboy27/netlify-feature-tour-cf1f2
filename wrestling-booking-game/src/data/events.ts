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
    title: '{primary} and {secondary} had to be pulled apart backstage',
    speaker: 'narrator',
    body: [
      'It started over a missed spot and ended with both of them flat on the floor. Half this locker room saw the whole thing go down.',
      'Nobody is saying who swung first. Both of them are sitting on opposite sides of the room right now, refusing to even look at each other.',
      'A shoving match in catering turned into something the road agents had to physically break up.',
      'It was over in ten seconds flat, and every single soul in this building is still talking about it.',
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
        gains: 'The whole room sees exactly where the line is now',
        costs: 'Both of them resent you for it, and that grudge stays red hot',
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
        gains: 'Real animosity flat-out draws — this could be your match of the year',
        costs: 'You are pointing a live camera at a fight nobody is holding back',
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
        gains: 'It cannot blow up if they never share a building again',
        costs: 'Your two best heat magnets can never once be booked together',
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
    speaker: 'primary',
    body: [
      "Twenty years in this business, and I have got real opinions about who is getting the spots. I caught you right after the show because this could not wait one more minute.",
      "This is not a complaint, exactly. It is a long story about how things used to be done right. But there is a point at the end of it, and you are going to want to hear it.",
      "I have been saying this in that locker room for weeks now. Time somebody said it straight to you.",
    ],
    weight: 12,
    cooldownWeeks: 22,
    conditions: { minWeek: 6, primary: (_w, status) => status === 'veteran' || status === 'gatekeeper' || status === 'legend' },
    options: [
      {
        id: 'agree',
        label: 'Agree — slow the young talent down',
        gains: 'The veterans trust you completely and this room settles right down',
        costs: 'Your best prospects stop climbing dead in their tracks, and they notice',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: 12 },
          { kind: 'rosterMorale', delta: -3 },
          { kind: 'bookingCredibility', delta: -4 },
        ],
      },
      {
        id: 'tell-them',
        label: 'Tell them the business moved on',
        gains: 'You keep full control of your own booking, no exceptions',
        costs: 'A respected voice in that locker room is dead set against you now',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: -16 },
          { kind: 'bookingCredibility', delta: 3 },
          { kind: 'rosterMorale', delta: -2 },
        ],
      },
      {
        id: 'make-them-teach',
        label: 'Make it their job to fix it',
        gains: 'Turns a loud complaint into real use out of someone with nothing to do',
        costs: 'Costs you a spot on the card and their full appearance fee',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: 8 },
          { kind: 'money', delta: -2500 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -6 },
        ],
      },
    ],
  },

  {
    id: 'lateToWork',
    category: 'lockerRoom',
    title: '{primary} was late again',
    speaker: 'primary',
    body: [
      "I know I was late. I am not going to stand here and make excuses about it.",
      "It will not happen again. I know I said that exact same thing last time too.",
      "The road agent already had it written down before I even made it through the door.",
    ],
    weight: 13,
    cooldownWeeks: 10,
    conditions: { minWeek: 3, primary: (w) => w.attitude < 60 },
    options: [
      {
        id: 'let-slide',
        label: 'Let it go this time',
        gains: 'No hard feelings at all, and they know it',
        costs: 'The next one who shows up late remembers you did nothing about this one',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: 6 },
          { kind: 'rosterMorale', delta: -3 },
        ],
      },
      {
        id: 'write-up',
        label: 'Write them up',
        gains: 'The whole room sees the schedule actually means something around here',
        costs: 'They figure you are keeping a list on them — because now, flat out, you are',
        effects: ({ primary }) => [
          { kind: 'violation', wrestlerId: primary!.id, violationKind: 'conduct', note: 'Late for the show.' },
          { kind: 'morale', wrestlerId: primary!.id, delta: -8 },
        ],
      },
    ],
  },
  // --------------------------------------------------------------- creative
  {
    id: 'gimmickRequest',
    category: 'creative',
    title: '{primary} wants a brand-new gimmick',
    speaker: 'primary',
    body: [
      "I have been doing the same character for years and I am flat-out done with it. I have got an idea. It is not a bad one either.",
      "I wrote you three full pages of notes. I have been thinking about this for a long, long time.",
      "The act is stale and I knew it before you ever did. I want to change every single thing about it.",
      "I am not asking for a push. I am asking to be somebody else entirely.",
    ],
    weight: 14,
    cooldownWeeks: 16,
    conditions: { minWeek: 4, primary: (w) => w.gimmickFreshness < 60 },
    options: [
      {
        id: 'grant',
        label: 'Grant it — new character, new look',
        gains: 'A completely fresh act, restyled to match, and a wrestler who owes you one',
        costs: 'Every ounce of equity you built with the old gimmick is gone for good',
        effects: ({ primary }) => [
          { kind: 'gimmickChange', wrestlerId: primary!.id },
          { kind: 'morale', wrestlerId: primary!.id, delta: 14 },
          { kind: 'popularity', wrestlerId: primary!.id, delta: -8 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -10 },
        ],
        // Granting it doesn't end the conversation — how it debuts is a
        // second, real decision, and that's what the odds actually hang on.
        next: 'debut',
      },
      {
        id: 'refuse',
        label: 'Refuse — the act still works',
        gains: 'Keeps every ounce of popularity you already paid good money for',
        costs: 'They are stale, they know it, and now they know you plain do not care',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: -14 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -5 },
        ],
      },
      {
        id: 'tweak',
        label: 'A repackage, not a rebuild',
        gains: 'Freshens the act right up without throwing away all that equity',
        costs: 'Half measures satisfy absolutely nobody, least of all them',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: 3 },
          { kind: 'popularity', wrestlerId: primary!.id, delta: -2 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: 6 },
        ],
      },
    ],
    nodes: {
      debut: {
        id: 'debut',
        speaker: 'primary',
        body: [
          'So how do we actually bring this out?',
          "New look, new name — how do you want this crowd to see it for the very first time?",
        ],
        options: [
          {
            id: 'cold',
            label: 'Debut it cold on TV',
            gains: 'Maximum impact if this crowd bites right away',
            costs: 'Absolutely no safety net if they do not',
            effects: () => [],
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
            id: 'vignette',
            label: 'Vignette it first',
            gains: 'Builds real anticipation before anybody has to sell it live',
            costs: 'Production money burned on a video package instead of a match',
            effects: ({ primary }) => [
              { kind: 'popularity', wrestlerId: primary!.id, delta: 5 },
              { kind: 'momentum', wrestlerId: primary!.id, delta: 8 },
              { kind: 'money', delta: -3000 },
            ],
          },
          {
            id: 'dark',
            label: 'Debut it in a dark match',
            gains: 'A real look at how a live crowd takes it, with nothing on the line if it flops flat',
            costs: 'Nobody watching at home ever sees a second of it',
            effects: ({ primary }) => [{ kind: 'popularity', wrestlerId: primary!.id, delta: 2 }],
            gamble: {
              // Safer odds than debuting cold on TV — a building's worth of
              // people is a much smaller bet than the whole audience.
              chance: ({ primary }) => 0.5 + (primary!.charisma / 100) * 0.35,
              onSuccess: ({ primary }) => [
                { kind: 'popularity', wrestlerId: primary!.id, delta: 8 },
                { kind: 'momentum', wrestlerId: primary!.id, delta: 10 },
                {
                  kind: 'wire',
                  wireKind: 'debut',
                  text: `Somebody in that crowd filmed ${primary!.name}'s brand-new look on their phone, and it is already pulling better numbers online than half of last week's entire show.`,
                },
              ],
              onFailure: ({ primary }) => [{ kind: 'morale', wrestlerId: primary!.id, delta: -6 }],
            },
          },
        ],
      },
    },
  },
  {
    id: 'turnRequest',
    category: 'creative',
    title: '{primary} wants to turn',
    speaker: 'primary',
    body: [
      "I think this crowd is finally ready to hate me. And I think I might be right.",
      "I am tired of getting cheered politely. I want to be booed properly, the real way.",
      "This character has got nowhere left to go in this direction, and I have known it for a while now.",
    ],
    weight: 11,
    cooldownWeeks: 20,
    conditions: { minWeek: 8, primary: (w) => Math.abs(w.alignment) > 30 && w.popularity > 45 },
    options: [
      {
        id: 'turn',
        label: 'Turn them',
        gains: 'A brand-new direction and a story this crowd has never once seen',
        costs: 'You lose the act you had, and a turn can fall completely, spectacularly flat',
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
        gains: 'You keep the timing for exactly when it will draw the biggest money',
        costs: 'Momentum stalls out and they stop bringing you ideas at all',
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
    speaker: 'narrator',
    body: [
      'They have been traveling together for months now and they have got it all worked out already — name, colors, the whole package.',
      'Two acts going absolutely nowhere alone think, put together, they would go somewhere real.',
      'They pitched it as a full faction. They already have matching gear made and ready to go.',
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
        label: 'Form the group, matching colors and all',
        gains: 'Two mid-card acts become one genuine thing worth caring about',
        costs: 'Neither one can be built as a singles act for as long as it lasts',
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
        gains: 'Both stay wide open to build up individually',
        costs: 'Two genuinely disappointed wrestlers who had a real plan',
        effects: ({ primary, secondary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: -9 },
          { kind: 'morale', wrestlerId: secondary!.id, delta: -9 },
        ],
      },
    ],
  },

  {
    id: 'wantsToMainEvent',
    category: 'creative',
    title: '{primary} wants the top of the card',
    speaker: 'primary',
    body: [
      "I have done everything you have asked for two straight years. I want the top of this card, not just a good spot on it.",
      "I am not asking for a favor here. I am telling you flat out that I am ready.",
      "Every single time I ask, it is 'not yet.' I want to know exactly what 'yet' actually means.",
    ],
    weight: 11,
    cooldownWeeks: 20,
    conditions: { minWeek: 10, primary: (_w, status) => status === 'upperCard' },
    options: [
      {
        id: 'grant',
        label: 'Put them in the main event',
        gains: 'A wrestler who finally gets exactly what they have been chasing this whole time',
        costs: 'If this crowd does not follow them up there, everybody in that building sees it happen',
        effects: ({ primary }) => [
          { kind: 'momentum', wrestlerId: primary!.id, delta: 16 },
          { kind: 'morale', wrestlerId: primary!.id, delta: 14 },
        ],
        gamble: {
          chance: ({ primary }) => 0.35 + (primary!.popularity / 100) * 0.4,
          onSuccess: ({ primary }) => [{ kind: 'popularity', wrestlerId: primary!.id, delta: 14 }],
          onFailure: ({ primary }) => [
            { kind: 'popularity', wrestlerId: primary!.id, delta: -10 },
            { kind: 'momentum', wrestlerId: primary!.id, delta: -14 },
          ],
        },
      },
      {
        id: 'refuse',
        label: 'Tell them it is not time yet',
        gains: 'You keep the card exactly where you already had it',
        costs: 'They now know precisely where they stand with you, and it stings',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: -16 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -6 },
        ],
      },
    ],
  },
  {
    id: 'tagTeamPitch',
    category: 'creative',
    title: '{primary} and {secondary} want to team up',
    speaker: 'narrator',
    body: [
      "They have been tagging together in dark matches for months and it flat-out works — now they want to make it official.",
      "Two singles pushes going nowhere is a whole lot worse than one tag team going somewhere real, and they have already worked that out for themselves.",
      "They already have the name picked out. They just need you to say the word.",
    ],
    weight: 10,
    cooldownWeeks: 24,
    conditions: {
      minWeek: 8,
      primary: (w, status) => status !== 'draw' && w.popularity > 30,
      secondary: (w, status) => status !== 'draw' && w.popularity > 30,
    },
    options: [
      {
        id: 'form',
        label: 'Make it official',
        gains: 'A tag division gets an act with real, honest-to-goodness chemistry already built in',
        costs: 'Neither one is available for a singles push for as long as this runs',
        effects: ({ primary, secondary }) => [
          { kind: 'formStable', memberIds: [primary!.id, secondary!.id], name: 'tagTeam' },
          { kind: 'relationship', aId: primary!.id, bId: secondary!.id, delta: 20 },
          { kind: 'morale', wrestlerId: primary!.id, delta: 10 },
          { kind: 'morale', wrestlerId: secondary!.id, delta: 10 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -5 },
          { kind: 'momentum', wrestlerId: secondary!.id, delta: -5 },
        ],
      },
      {
        id: 'refuse',
        label: 'Keep them apart',
        gains: 'Both stay wide open for a singles run down the road',
        costs: 'Two people who wanted this hear no together, and they both remember exactly who said it',
        effects: ({ primary, secondary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: -10 },
          { kind: 'morale', wrestlerId: secondary!.id, delta: -10 },
          { kind: 'relationship', aId: primary!.id, bId: secondary!.id, delta: -6 },
        ],
      },
    ],
  },
  {
    id: 'wantsTitleShot',
    category: 'creative',
    title: '{primary} wants a title shot',
    speaker: 'primary',
    body: [
      "I want a title shot. Not eventually. Right now.",
      "I have beaten everyone standing in my way except the one man holding that belt.",
      "You know I have earned this. I want to hear you say it too, out loud.",
    ],
    weight: 10,
    cooldownWeeks: 22,
    conditions: {
      minWeek: 12,
      primary: (w, status) => (status === 'upperCard' || status === 'mainEventer') && w.popularity > 50,
    },
    options: [
      {
        id: 'grant',
        label: 'Promise them the shot',
        gains: 'A wrestler who finally has something real and big to chase',
        costs: 'You just told the entire roster exactly where the next shot is going',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: 12 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: 8 },
          { kind: 'rosterMorale', delta: -3 },
        ],
        next: 'howBig',
      },
      {
        id: 'refuse',
        label: 'Tell them to wait their turn',
        gains: 'The title picture stays exactly where you already had it',
        costs: 'Real, genuine heat — and they are never going to forget you said no',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: -16 },
          { kind: 'shootHeat', wrestlerIds: [primary!.id], delta: 12 },
        ],
      },
    ],
    nodes: {
      howBig: {
        id: 'howBig',
        speaker: 'primary',
        body: ['So how do we actually get there? Do I get the shot, or do I earn the shot first?'],
        options: [
          {
            id: 'cold-shot',
            label: 'Book the title match next show',
            gains: 'The fastest possible way to pay off that promise',
            costs: 'No time at all to build it — this crowd has to already be there for it',
            effects: () => [],
            gamble: {
              chance: ({ primary }) => 0.35 + (primary!.popularity / 100) * 0.4,
              onSuccess: ({ primary }) => [
                { kind: 'popularity', wrestlerId: primary!.id, delta: 14 },
                { kind: 'momentum', wrestlerId: primary!.id, delta: 16 },
              ],
              onFailure: ({ primary }) => [
                { kind: 'popularity', wrestlerId: primary!.id, delta: -10 },
                { kind: 'morale', wrestlerId: primary!.id, delta: -8 },
              ],
            },
          },
          {
            id: 'build-angle',
            label: 'Build an angle first',
            gains: 'The match means a whole lot more by the time it actually happens',
            costs: 'Weeks of TV time burned building this instead of moving somebody else forward',
            effects: ({ primary }) => [
              { kind: 'momentum', wrestlerId: primary!.id, delta: 10 },
              { kind: 'popularity', wrestlerId: primary!.id, delta: 6 },
              { kind: 'money', delta: -3000 },
            ],
          },
        ],
      },
    },
  },

  // --------------------------------------------------------------- business
  {
    id: 'sponsorOffer',
    category: 'business',
    title: 'A sponsor wants their name on the show',
    speaker: 'narrator',
    body: [
      'A regional brand wants the naming rights, and they are ready to pay real money for it. The creative notes are going to be a whole lot worse.',
      'They love the product, they really do. They have also sent over a two-page list of things they would rather you did not do on camera.',
      'It is not enormous money, but it is money that shows up whether the show is any good or not.',
    ],
    weight: 10,
    cooldownWeeks: 24,
    conditions: { minWeek: 6 },
    options: [
      {
        id: 'take',
        label: 'Take the money',
        gains: 'Guaranteed income that does not depend one bit on the gate',
        costs: 'They get a real say, and what they want is a whole lot duller than what you want',
        effects: () => [
          { kind: 'money', delta: 22000 },
          { kind: 'companyRating', delta: -2 },
          { kind: 'reputation', delta: -3 },
        ],
      },
      {
        id: 'refuse',
        label: 'Turn it down',
        gains: 'The show stays entirely yours, top to bottom',
        costs: 'The boys hear you turned down a payday they would have shared in too',
        effects: () => [
          { kind: 'reputation', delta: 4 },
          { kind: 'bookingCredibility', delta: 2 },
          { kind: 'rosterMorale', delta: -4 },
        ],
      },
      {
        id: 'negotiate',
        label: 'Take it but fight over the notes',
        gains: 'Most of the money without all of that interference',
        costs: 'They may walk away entirely, and you have burned the relationship for good',
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
    speaker: 'narrator',
    body: [
      'A better night, a whole lot more eyes, and they want more shows a month to go along with it.',
      'This slot is a genuine upgrade. The production commitment riding along with it is not small at all.',
      'They are offering the good hour, the one everybody wants. They want to know you can fill it every single week.',
    ],
    weight: 8,
    cooldownWeeks: 40,
    conditions: { minWeek: 14, promotion: (p) => p.rating > 50 },
    options: [
      {
        id: 'accept',
        label: 'Take the slot',
        gains: 'A bigger audience, every single week from here on out',
        costs: 'A production commitment your roster may not be deep enough to cover',
        effects: () => [
          { kind: 'companyRating', delta: 6 },
          { kind: 'money', delta: -15000 },
          { kind: 'rosterMorale', delta: -5 },
        ],
      },
      {
        id: 'decline',
        label: 'Stay where you are',
        gains: 'A schedule your roster can actually sustain long term',
        costs: 'The network offered once — they may never offer it again',
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
    speaker: 'primary',
    body: [
      "It got back to you third-hand, which means it has been going on for a while now. I should have told you myself, straight up.",
      "Yeah, I had dinner with a booker who does not work for you. I am not going to sit here and pretend I did not.",
      "I am not denying it. I am honestly not sure I can even explain it either.",
      "The offer is generous, real generous. It is in writing. I have not signed a single thing.",
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
        gains: 'They stay, and this whole locker room sees loyalty actually get rewarded',
        costs: 'Your payroll just jumped, and everybody else in that room is going to hear about it',
        effects: ({ primary }) => [
          { kind: 'contractRate', wrestlerId: primary!.id, multiplier: 1.35 },
          { kind: 'morale', wrestlerId: primary!.id, delta: 15 },
          { kind: 'rosterMorale', delta: -4 },
        ],
      },
      {
        id: 'push',
        label: 'Outbid them with the booking instead',
        gains: 'Costs nothing at all up front and buys real, lasting loyalty',
        costs: 'You are handing your top spot to somebody standing there with one foot out the door',
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
        gains: 'You keep the money, and the spot opens right up for somebody younger',
        costs: 'You just handed a rival promotion a star that you built from nothing',
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
    speaker: 'narrator',
    body: [
      'Same exact spot, same false finish, seven days later and better lit besides.',
      'It is not illegal, not technically. It is not subtle either, not even a little.',
      'Their booker has clearly been watching. Closely. Very closely.',
    ],
    weight: 9,
    cooldownWeeks: 20,
    conditions: { minWeek: 12, needsRival: true },
    options: [
      {
        id: 'ignore',
        label: 'Say nothing',
        gains: 'You look like the bigger operation, above all the noise',
        costs: 'They will absolutely do it again, and your locker room noticed you did nothing',
        effects: () => [{ kind: 'rosterMorale', delta: -3 }],
      },
      {
        id: 'answer',
        label: 'Answer it on air',
        gains: 'A real inter-promotional story your audience can actually follow',
        costs: 'You just told every viewer you have that a rival promotion exists',
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
    speaker: 'primary',
    body: [
      "The trainer told you before I ever did. I have been taping this up for weeks now.",
      "It is not serious yet. I have been real careful to use that word — \"yet.\"",
      "I can go tonight. I should not. But I can.",
    ],
    weight: 12,
    cooldownWeeks: 12,
    conditions: { minWeek: 5, primary: (w) => w.health < 70 },
    options: [
      {
        id: 'rest',
        label: 'Sit them down until it heals',
        gains: 'You get them back whole instead of losing them for a full year',
        costs: 'A hole right in your card and an act going stone cold',
        effects: ({ primary }) => [
          { kind: 'health', wrestlerId: primary!.id, delta: 25 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -18 },
          { kind: 'popularity', wrestlerId: primary!.id, delta: -4 },
        ],
      },
      {
        id: 'work',
        label: 'Keep them working',
        gains: 'Your card holds together and the story keeps right on moving',
        costs: 'You are gambling with somebody’s entire career just to save one booking',
        effects: ({ primary }) => [{ kind: 'morale', wrestlerId: primary!.id, delta: -6 }],
        gamble: {
          chance: ({ primary }) => 0.3 + (primary!.toughness / 100) * 0.45,
          onSuccess: ({ primary }) => [{ kind: 'momentum', wrestlerId: primary!.id, delta: 8 }],
          onFailure: ({ primary }) => [
            { kind: 'injury', wrestlerId: primary!.id, weeks: 10 },
            { kind: 'rosterMorale', delta: -7 },
          ],
          // It paying off ends cleanly, as it always did. It backfiring
          // opens a real follow-up — now they're actually hurt, worse than
          // before, and there's a second decision about how you handle it.
          nextOnFailure: 'aftermath',
        },
      },
      {
        id: 'lighten',
        label: 'Book them light and protect them',
        gains: 'Keeps them right on television without taking on the risk',
        costs: 'Everybody can see they are being protected, including this crowd',
        effects: ({ primary }) => [
          { kind: 'health', wrestlerId: primary!.id, delta: 8 },
          { kind: 'popularity', wrestlerId: primary!.id, delta: -3 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -6 },
        ],
      },
    ],
    nodes: {
      aftermath: {
        id: 'aftermath',
        speaker: 'primary',
        body: [
          "You knew this could happen. I need to know you are actually going to take care of it now.",
          "This costs me time either way, no question. The real question is whether it costs you anything too.",
        ],
        options: [
          {
            id: 'full-cover',
            label: 'Cover the medical bill in full',
            gains: 'They know for certain you stood behind them when it all went wrong',
            costs: 'A real bill, paid in full, for a gamble that was entirely yours to take',
            effects: ({ primary }) => [
              { kind: 'money', delta: -6000 },
              { kind: 'morale', wrestlerId: primary!.id, delta: 15 },
            ],
          },
          {
            id: 'standard-care',
            label: 'Standard company care only',
            gains: 'Cheap, and technically well within your obligations',
            costs: 'They remember exactly who was calling the shots when it happened',
            effects: ({ primary }) => [
              { kind: 'money', delta: -1000 },
              { kind: 'shootHeat', wrestlerIds: [primary!.id], delta: 15 },
            ],
          },
        ],
      },
    },
  },
  {
    id: 'retirementThoughts',
    category: 'personal',
    title: '{primary} is thinking about the end',
    speaker: 'primary',
    body: [
      "Not this year. But I said it out loud just now, and that is new for me.",
      "My body is telling me something, and I have finally started listening to it.",
      "I wanted you to hear it from me first, before you heard it from anybody else.",
    ],
    weight: 7,
    cooldownWeeks: 36,
    conditions: { minWeek: 20, primary: (_w, status) => status === 'veteran' || status === 'legend' },
    options: [
      {
        id: 'send-off',
        label: 'Plan the send-off now',
        gains: 'A retirement run you control completely, and one huge final night to remember',
        costs: 'You are committing to losing them on a date you just picked yourself',
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
        gains: 'You keep a real drawing card on your roster a while longer',
        costs: 'Every week they keep going out there is a week closer to a serious injury',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: -5 },
          { kind: 'health', wrestlerId: primary!.id, delta: -10 },
        ],
      },
      {
        id: 'office-job',
        label: 'Offer them a job in the office',
        gains: 'Keeps decades of knowledge right in the building after the body finally quits',
        costs: 'Their in-ring value drops to zero the very day they accept',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: 12 },
          { kind: 'rosterMorale', delta: 4 },
          { kind: 'money', delta: -4000 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -20 },
        ],
      },
    ],
  },
  {
    id: 'timeOffRequest',
    category: 'personal',
    title: '{primary} needs a week off',
    speaker: 'primary',
    body: [
      "My kid has a thing at school and I already missed the last one. I am not missing this one too.",
      "I have not had a single week off since I signed here. I am not asking for much, believe me.",
      "Family stuff. I do not want to get into all of it. I just need the week.",
      "I need to be somewhere, just once, that is not an arena parking lot.",
    ],
    weight: 14,
    cooldownWeeks: 16,
    conditions: { minWeek: 3, primary: (_w, status) => status !== 'trainee' },
    options: [
      {
        id: 'grant',
        label: 'Give them the week',
        gains: 'They remember, for a long time, that you said yes',
        costs: 'A body off the card for a show you had already built around them',
        effects: ({ primary }) => [
          { kind: 'leave', wrestlerId: primary!.id, weeks: 1, reason: 'Personal time, granted without an argument.' },
          { kind: 'morale', wrestlerId: primary!.id, delta: 12 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -5 },
        ],
      },
      {
        id: 'refuse',
        label: 'Tell them the schedule does not move',
        gains: 'The card stays exactly as it was booked, no exceptions',
        costs: 'They hear that "no" loud and clear, and file it away for later',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: -14 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -4 },
        ],
      },
    ],
  },
  {
    id: 'trainingInjury',
    category: 'personal',
    title: '{primary} got hurt in the gym',
    speaker: 'primary',
    body: [
      "Pulled something in the gym this morning. Nothing dramatic, but it is real, and I felt it right away.",
      "Landed a drill wrong. The trainer already looked at it and does not love what they saw.",
      "I was pushing the numbers up and something in my shoulder flat-out disagreed with the plan.",
    ],
    weight: 11,
    cooldownWeeks: 18,
    conditions: { minWeek: 4, primary: (w) => !w.injury },
    options: [
      {
        id: 'rest',
        label: 'Pull them from everything until it is checked out properly',
        gains: 'A small injury actually stays small',
        costs: 'Training time lost, and a body off the card while it heals',
        effects: ({ primary }) => [
          { kind: 'injury', wrestlerId: primary!.id, weeks: 2 },
          { kind: 'fatigue', wrestlerId: primary!.id, delta: -10 },
          { kind: 'morale', wrestlerId: primary!.id, delta: 8 },
        ],
      },
      {
        id: 'push',
        label: 'Clear them to keep going',
        gains: 'No time lost whatsoever if it really is nothing',
        costs: 'You are betting on a diagnosis nobody in a lab coat actually made',
        effects: ({ primary }) => [{ kind: 'fatigue', wrestlerId: primary!.id, delta: 5 }],
        gamble: {
          chance: ({ primary }) => 0.35 + (primary!.toughness / 100) * 0.4,
          onSuccess: ({ primary }) => [{ kind: 'momentum', wrestlerId: primary!.id, delta: 6 }],
          onFailure: ({ primary }) => [
            { kind: 'injury', wrestlerId: primary!.id, weeks: 6 },
            { kind: 'morale', wrestlerId: primary!.id, delta: -8 },
          ],
          // Told you so, and now there is a second, real decision about how
          // you make it right — same shape as workingHurt's aftermath.
          nextOnFailure: 'setback',
        },
      },
    ],
    nodes: {
      setback: {
        id: 'setback',
        speaker: 'primary',
        body: ["Told you so. It is worse now, and I need you to actually do something real about it this time."],
        options: [
          {
            id: 'proper-treatment',
            label: 'Pay for real treatment',
            gains: 'They know for a fact you did not cut corners a second time',
            costs: 'A real medical bill for a bet that was entirely yours to make',
            effects: ({ primary }) => [
              { kind: 'money', delta: -5000 },
              { kind: 'morale', wrestlerId: primary!.id, delta: 14 },
            ],
          },
          {
            id: 'cheap-out',
            label: 'Standard company care only',
            gains: 'Cheap, and this one is over quickly',
            costs: 'They clock exactly how little that gesture really was',
            effects: ({ primary }) => [
              { kind: 'money', delta: -800 },
              { kind: 'morale', wrestlerId: primary!.id, delta: -12 },
            ],
          },
        ],
      },
    },
  },
  {
    id: 'burnout',
    category: 'personal',
    title: '{primary} is running on empty',
    speaker: 'primary',
    body: [
      "I am not injured. I am just plain done. I need you to actually hear that difference.",
      "I have worked every single date for months straight. I do not have anything left tonight, and I might not next week either.",
      "I am not walking out on you. I am telling you now, before I have to.",
    ],
    weight: 10,
    cooldownWeeks: 20,
    conditions: { minWeek: 8, primary: (w) => w.fatigueDebt > 65 },
    options: [
      {
        id: 'mandate-rest',
        label: 'Pull them off the schedule for a real break',
        gains: 'They come back actually able to perform, night in and night out',
        costs: 'Weeks without a body you were counting on to be there',
        effects: ({ primary }) => [
          { kind: 'leave', wrestlerId: primary!.id, weeks: 2, reason: 'Burned out. Ordered off the road.' },
          { kind: 'fatigue', wrestlerId: primary!.id, delta: -40 },
          { kind: 'morale', wrestlerId: primary!.id, delta: 10 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -8 },
        ],
      },
      {
        id: 'push-forward',
        label: 'Ask them to push through it',
        gains: 'The card does not move an inch',
        costs: 'You are drawing on a well you have already emptied dry',
        effects: ({ primary }) => [
          { kind: 'fatigue', wrestlerId: primary!.id, delta: 15 },
          { kind: 'morale', wrestlerId: primary!.id, delta: -12 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -10 },
        ],
      },
    ],
  },
  {
    id: 'sick',
    category: 'personal',
    title: '{primary} is sick',
    speaker: 'primary',
    body: [
      "I have been throwing up since this morning. I did not want to no-show without telling you myself first.",
      "Whatever is going around got me too. I can barely stand up straight right now.",
      "I do not think I should be anywhere near that locker room tonight.",
    ],
    weight: 9,
    cooldownWeeks: 14,
    conditions: { minWeek: 3, primary: (w) => !w.injury && !w.leave },
    options: [
      {
        id: 'send-home',
        label: 'Send them home',
        gains: 'Nobody else in this building catches it too',
        costs: 'A late scratch you now have to scramble to cover',
        effects: ({ primary }) => [
          { kind: 'leave', wrestlerId: primary!.id, weeks: 1, reason: 'Sick. Sent home rather than risk the room.' },
          { kind: 'morale', wrestlerId: primary!.id, delta: 6 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -4 },
        ],
      },
      {
        id: 'work-through',
        label: 'Ask them to push through it',
        gains: 'The card holds exactly as booked',
        costs: 'A visibly sick performer out there is not the show you wanted anybody to see',
        effects: ({ primary }) => [
          { kind: 'health', wrestlerId: primary!.id, delta: -15 },
          { kind: 'morale', wrestlerId: primary!.id, delta: -10 },
          { kind: 'popularity', wrestlerId: primary!.id, delta: -3 },
        ],
      },
    ],
  },
  {
    id: 'wantsPartTime',
    category: 'personal',
    title: '{primary} wants to cut back',
    speaker: 'primary',
    body: [
      "I do not want to retire. I want to stop doing every single date on the calendar.",
      "My body can do twelve nights a year the right way. It flat-out cannot do fifty anymore.",
      "I will still show up big when it matters. I just cannot be there every week doing it.",
    ],
    weight: 8,
    cooldownWeeks: 30,
    conditions: {
      minWeek: 16,
      primary: (_w, status) => status === 'veteran' || status === 'legend' || status === 'draw',
    },
    options: [
      {
        id: 'grant',
        label: 'Work out a part-time arrangement',
        gains: 'You keep a real name on the roster instead of losing them entirely',
        costs: 'A smaller wage and a wrestler you flat-out cannot count on week to week',
        effects: ({ primary }) => [
          { kind: 'contractType', wrestlerId: primary!.id, type: 'partTime' },
          { kind: 'contractRate', wrestlerId: primary!.id, multiplier: 0.55 },
          { kind: 'morale', wrestlerId: primary!.id, delta: 10 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -10 },
        ],
      },
      {
        id: 'refuse',
        label: 'Tell them it is full-time or nothing',
        gains: 'You keep full access to every one of their dates',
        costs: 'You may be pushing out somebody who would have gladly stayed on part-time',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: -14 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -6 },
        ],
      },
    ],
  },
  {
    id: 'wantsToFilmAMovie',
    category: 'personal',
    title: '{primary} has a movie offer',
    speaker: 'primary',
    body: [
      "A studio wants me for six weeks straight. It is a real role too, not some cameo.",
      "This does not happen twice in a career. I need you to let me go do this.",
      "I already told them I would ask you first. So here I am, asking.",
    ],
    weight: 7,
    cooldownWeeks: 40,
    conditions: { minWeek: 20, primary: (w) => w.popularity > 65 },
    options: [
      {
        id: 'grant',
        label: 'Let them go make it',
        gains: 'Real mainstream exposure the company never had to pay one dime for',
        costs: 'Weeks with a top name gone from every single card you build',
        effects: ({ primary }) => [
          { kind: 'leave', wrestlerId: primary!.id, weeks: 5, reason: 'Off shooting a film. Back on schedule.' },
          { kind: 'popularity', wrestlerId: primary!.id, delta: 18 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -14 },
          { kind: 'morale', wrestlerId: primary!.id, delta: 16 },
        ],
      },
      {
        id: 'refuse',
        label: 'Tell them the company needs them here',
        gains: 'No gap in the card whatsoever',
        costs: 'You just turned down the single best exposure they will ever be offered in this business',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: -20 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -8 },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------
  // The remaining "Rival Booker Battle" random-event brainstorm, built
  // through this same engine rather than a new one — each already carries a
  // real choice, gains, costs, and a genuine beginning and end.

  {
    id: 'sponsorPullout',
    category: 'business',
    title: 'A sponsor just walked',
    speaker: 'narrator',
    body: [
      'The money that was supposed to land this month never did. The rep stopped returning calls a week ago, and now it is official.',
      'Whatever changed at the top of that company, it changed fast — the sponsorship that was signed, sealed, and budgeted for is gone.',
      'The check that was supposed to clear this week bounced with a one-line explanation: priorities changed.',
    ],
    weight: 8,
    cooldownWeeks: 30,
    conditions: { minWeek: 10 },
    options: [
      {
        id: 'eatIt',
        label: 'Eat the loss',
        gains: 'No further entanglement with people who bail this easily',
        costs: 'The money that was budgeted for this month just is not coming',
        effects: () => [
          { kind: 'money', delta: -14000 },
          { kind: 'reputation', delta: 2 },
        ],
      },
      {
        id: 'chase',
        label: 'Chase a replacement, fast',
        gains: 'A real shot at plugging the hole before it is felt',
        costs: 'Whoever you land will not pay what the last one promised, and it might not work at all',
        effects: () => [{ kind: 'money', delta: -2000 }],
        gamble: {
          chance: ({ promotion }) => 0.35 + (promotion.reputation / 100) * 0.4,
          onSuccess: () => [{ kind: 'money', delta: 9000 }],
          onFailure: () => [{ kind: 'reputation', delta: -3 }],
        },
      },
      {
        id: 'callOut',
        label: 'Call them out on the way out the door',
        gains: 'The boys respect you for not just eating it quietly, and it plays well on the wire',
        costs: 'Burns the relationship for good, and touchy sponsors talk to each other',
        effects: () => [
          { kind: 'money', delta: -14000 },
          { kind: 'reputation', delta: 5 },
          { kind: 'bookingCredibility', delta: 3 },
          { kind: 'wire', wireKind: 'business', text: 'The office went public about a sponsor pulling out mid-deal — made sure everybody in the business heard exactly how it happened.' },
        ],
      },
    ],
  },

  {
    id: 'liveRetirement',
    category: 'personal',
    title: '{primary} wants to go out on top',
    speaker: 'primary',
    body: [
      'I want to call it. Right there, in the ring, in front of the people who have been with me the whole way.',
      'I have been thinking about this for a while now. I want my last night to actually mean something.',
      'There is no better way to leave than saying it myself, out loud, before somebody else says it for me.',
    ],
    weight: 6,
    cooldownWeeks: 60,
    conditions: { minWeek: 40, primary: (_w, status) => status === 'veteran' || status === 'legend' },
    options: [
      {
        id: 'grant',
        label: 'Give them the send-off',
        gains: 'A genuine, emotional moment the crowd remembers for years, and a real rating bump on the night it happens',
        costs: 'They are gone for good — no swerve, no surprise return next month — and a proper send-off costs real production money',
        effects: ({ primary }) => [
          { kind: 'retire', wrestlerId: primary!.id },
          { kind: 'money', delta: -8000 },
          { kind: 'companyRating', delta: 4 },
          { kind: 'rosterMorale', delta: 5 },
        ],
      },
      {
        id: 'talkThemOut',
        label: 'Talk them into staying',
        gains: 'You keep a name the card still needs',
        costs: 'They are working through a decision they had already made, and it shows out there',
        effects: ({ primary }) => [
          { kind: 'morale', wrestlerId: primary!.id, delta: -10 },
          { kind: 'momentum', wrestlerId: primary!.id, delta: -6 },
        ],
      },
    ],
  },

  {
    id: 'uninvitedLegend',
    category: 'personal',
    title: 'A name out of the record books wants a spot on the show',
    speaker: 'narrator',
    body: [
      'Somebody who has not laced up in years called the office this week, out of nowhere, wanting one more night under the lights.',
      "A voice from a completely different era of this business is on the phone, asking for a spot on tonight's card like it is the most natural thing in the world.",
      'Word came in through a manager nobody had heard from in a decade: a genuine name from the past wants back in the building, just for one night.',
    ],
    weight: 6,
    cooldownWeeks: 40,
    conditions: { minWeek: 30 },
    options: [
      {
        id: 'giveThemTheSpot',
        label: 'Give them the segment',
        gains: 'A real nostalgia pop, and a story the wire runs with',
        costs: 'It is a spot that could have gone to somebody on your own roster building toward something, and it does not come cheap',
        effects: () => [
          { kind: 'companyRating', delta: 5 },
          { kind: 'money', delta: -6000 },
          { kind: 'rosterMorale', delta: -3 },
        ],
      },
      {
        id: 'turnThemAway',
        label: 'Turn them away politely',
        gains: 'The card stays exactly what you already built it to be',
        costs: 'Word travels fast about who does and does not respect the old guard',
        effects: () => [{ kind: 'reputation', delta: -2 }],
      },
    ],
  },

  {
    id: 'protestNoShow',
    category: 'business',
    title: 'The building is half empty, and it is not an accident',
    speaker: 'narrator',
    body: [
      'A real chunk of the crowd stayed home tonight — organized, and loud about why, online, all week leading up to the show.',
      'The advance ticket numbers cratered the moment the internet decided it did not like a decision this office made.',
      'Whatever goodwill was left after that last decision, it just cost a real dent in tonight\'s house.',
    ],
    weight: 6,
    cooldownWeeks: 26,
    conditions: { minWeek: 8, promotion: (p) => p.reputation < 40 },
    options: [
      {
        id: 'apologize',
        label: 'Address it publicly',
        gains: 'A real chance to start winning some of it back',
        costs: 'Admitting fault in public costs you something with everybody who agreed with the decision in the first place',
        effects: () => [
          { kind: 'reputation', delta: 6 },
          { kind: 'bookingCredibility', delta: -3 },
        ],
      },
      {
        id: 'digIn',
        label: 'Say nothing and keep booking your show',
        gains: 'You do not look like you are bending to pressure',
        costs: 'The people staying home tonight are not obligated to come back on their own',
        effects: () => [{ kind: 'companyRating', delta: -3 }],
      },
    ],
  },

  {
    id: 'schedulingCollision',
    category: 'rival',
    title: '{rival} just booked their own show for your date',
    speaker: 'narrator',
    body: [
      'The announcement went up an hour ago: {rival} moved their next show to go head to head with yours, on purpose.',
      'This is not a coincidence. {rival} saw your date on the calendar and booked right on top of it.',
      'Somebody at {rival} wants a real answer to whose audience actually shows up. They just forced the question.',
    ],
    weight: 7,
    cooldownWeeks: 34,
    conditions: { minWeek: 16, needsRival: true },
    options: [
      {
        id: 'pushThrough',
        label: 'Run it exactly as booked',
        gains: 'You do not blink, and the show you built stays the show you built',
        costs: 'A real chance the gate splits and both companies take a hit that night',
        effects: () => [{ kind: 'reputation', delta: 2 }],
        gamble: {
          chance: ({ promotion }) => 0.4 + (promotion.rating / 100) * 0.4,
          onSuccess: () => [{ kind: 'companyRating', delta: 5 }],
          onFailure: () => [
            { kind: 'money', delta: -9000 },
            { kind: 'companyRating', delta: -3 },
          ],
        },
      },
      {
        id: 'moveDate',
        label: 'Move your date',
        gains: 'You avoid the head-to-head entirely',
        costs: 'Rebooking costs real money and reads as backing down',
        effects: () => [
          { kind: 'money', delta: -5000 },
          { kind: 'reputation', delta: -2 },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------
  // "Rival Booker Battle" sub-stories — the rest of the brainstormed pool
  // that fits a single-decision event cleanly. Title stripping did not make
  // this list: the existing champion-injury vacate path (titleDefence.ts,
  // OfficeScreen's ChampionCallPanel) already covers a title being taken off
  // somebody for a real, booker-driven reason, so it was not rebuilt.

  {
    id: 'personalConfrontation',
    category: 'rival',
    title: '{rival} took a real shot at you, by name',
    speaker: 'narrator',
    body: [
      "The head of {rival} went out of their way in an interview this week to call you out directly, by name, unprompted.",
      "{rival}'s office put out a statement this week that had your name in it three separate times, and none of them were kind.",
      "Whoever runs {rival} decided this was the week to make it personal, right out in the open where everybody could see it.",
    ],
    weight: 8,
    cooldownWeeks: 24,
    conditions: { minWeek: 12, needsRival: true },
    options: [
      {
        id: 'fireBack',
        label: 'Fire back in public',
        gains: 'Real heat and real press for the promotion, right now',
        costs: 'The locker room notices the office fixated on a feud with a rival instead of building the roster',
        effects: () => [
          { kind: 'companyRating', delta: 3 },
          { kind: 'bookingCredibility', delta: -2 },
        ],
      },
      {
        id: 'riseAboveIt',
        label: 'Rise above it and say nothing',
        gains: 'Reads as the more professional operation in the room',
        costs: 'Some of the boys wanted the office to swing back, and they noticed it did not',
        effects: () => [
          { kind: 'reputation', delta: 2 },
          { kind: 'rosterMorale', delta: -3 },
        ],
      },
    ],
  },

  {
    id: 'charityPRMove',
    category: 'rival',
    title: '{rival} just staged a real charity push',
    speaker: 'narrator',
    body: [
      '{rival} put on a genuine charity show this week, and the good press is everywhere — the kind of story that makes everybody else look worse by comparison.',
      'Every outlet covering this business ran the same story this week: {rival} gave real money to a real cause, on camera, and it landed.',
      "{rival}'s charity push this week was not subtle, and it worked exactly like they wanted it to.",
    ],
    weight: 6,
    cooldownWeeks: 30,
    conditions: { minWeek: 14, needsRival: true },
    options: [
      {
        id: 'matchThem',
        label: 'Put on a real charity push of your own',
        gains: 'Genuine goodwill, and the story stops being only about them',
        costs: 'A real donation, not a photo-op number',
        effects: () => [
          { kind: 'money', delta: -10000 },
          { kind: 'reputation', delta: 6 },
        ],
      },
      {
        id: 'letItGo',
        label: 'Let them have the news cycle',
        gains: 'Costs nothing today',
        costs: 'The contrast is not flattering, and people notice who did something and who did not',
        effects: () => [{ kind: 'reputation', delta: -3 }],
      },
    ],
  },

  {
    id: 'whisperCampaign',
    category: 'rival',
    title: 'Somebody is quietly spreading rumors about your locker room',
    speaker: 'narrator',
    body: [
      "Whispers are going around about real dysfunction backstage — nothing anybody can point to directly, but it traces straight back to people close to {rival}.",
      'A story is circulating about your own locker room that nobody in it actually said — and it has {rival}\'s fingerprints all over the timing of it.',
      "None of it is confirmed, all of it is spreading, and it started right around the time {rival} started losing ground to you.",
    ],
    weight: 6,
    cooldownWeeks: 26,
    conditions: { minWeek: 16, needsRival: true },
    options: [
      {
        id: 'addressItHeadOn',
        label: 'Address it head-on, publicly',
        gains: 'Gets ahead of the story before it hardens into something worse',
        costs: 'Answering rumors at all makes people wonder how much smoke there really is',
        effects: () => [
          { kind: 'bookingCredibility', delta: 4 },
          { kind: 'reputation', delta: -2 },
        ],
      },
      {
        id: 'letItDieOnItsOwn',
        label: 'Say nothing and let it die on its own',
        gains: 'Refuses to give the story any more oxygen',
        costs: 'The locker room notices nobody up top ever said a word in their defense',
        effects: () => [{ kind: 'rosterMorale', delta: -5 }],
      },
    ],
  },

  {
    id: 'insiderDefector',
    category: 'rival',
    title: 'Somebody inside {rival} wants to talk',
    speaker: 'narrator',
    body: [
      'A voice from inside {rival}\'s own front office reached out this week, quietly, with real information nobody outside that building should have.',
      "Somebody close to {rival}'s booking table wants to feed you something real — the kind of thing that only makes sense if they are already looking for a way out.",
      "An email landed this week from an address that traces back to {rival}. Whoever sent it knows things they should not be telling you.",
    ],
    weight: 5,
    cooldownWeeks: 34,
    conditions: { minWeek: 20, needsRival: true },
    options: [
      {
        id: 'useTheIntel',
        label: 'Use what they gave you',
        gains: 'A real edge, if it holds up',
        costs: 'If this ever traces back to you, the fallout is real',
        effects: () => [],
        gamble: {
          chance: ({ promotion }) => 0.4 + (promotion.reputation / 100) * 0.3,
          onSuccess: () => [{ kind: 'companyRating', delta: 6 }],
          onFailure: () => [{ kind: 'reputation', delta: -8 }],
        },
      },
      {
        id: 'declineIt',
        label: 'Decline. It is not worth the risk',
        gains: 'Keeps your hands clean',
        costs: 'You will never know what they had',
        effects: () => [{ kind: 'bookingCredibility', delta: -2 }],
      },
    ],
  },

  {
    id: 'thirdCompanyRace',
    category: 'rival',
    title: 'Two other companies are racing for the same thing',
    speaker: 'narrator',
    body: [
      'Word is out that two other promotions are quietly racing each other for the same opening, and neither one has noticed you could still get in on it.',
      'A real opportunity just opened up, and right now it is a two-horse race between companies that are not you — unless you make it a three-horse one.',
      'Everybody assumes this is a fight between two other promotions. Nobody has said you cannot make it a fight between three.',
    ],
    weight: 5,
    cooldownWeeks: 30,
    conditions: { minWeek: 18, needsRival: true },
    options: [
      {
        id: 'jumpIn',
        label: 'Spend to get in on it',
        gains: 'A real shot at winning something two other companies wanted for themselves',
        costs: 'The entry money is gone the moment you commit, win or lose',
        effects: () => [{ kind: 'money', delta: -8000 }],
        gamble: {
          chance: ({ promotion }) => 0.35 + (promotion.rating / 100) * 0.35,
          onSuccess: () => [
            { kind: 'money', delta: 20000 },
            { kind: 'companyRating', delta: 4 },
          ],
          onFailure: () => [{ kind: 'reputation', delta: -2 }],
        },
      },
      {
        id: 'stayOut',
        label: 'Stay out of it entirely',
        gains: 'No money at risk',
        costs: 'You watch two other companies fight over something you could have had a piece of',
        effects: () => [{ kind: 'reputation', delta: -1 }],
      },
    ],
  },

  {
    id: 'territoryTargetingBias',
    category: 'business',
    title: '{rival} is targeting your own home turf',
    speaker: 'narrator',
    body: [
      '{rival} just booked a show inside your own territory, priced to undercut you on your own turf, on purpose.',
      "This is not {rival} expanding generally — this is {rival} specifically going after the ground you already stand on.",
      '{rival} could have run their show almost anywhere. They picked your territory, and that is the story.',
    ],
    weight: 6,
    cooldownWeeks: 30,
    conditions: { minWeek: 16, needsRival: true, promotion: (p) => p.ownedTerritoryIds.length > 0 },
    options: [
      {
        id: 'defendItHard',
        label: 'Defend it hard — spend to protect the turf',
        gains: 'Sends a real message that this ground is not open for the taking',
        costs: 'Protecting a territory this way is not cheap',
        effects: () => [
          { kind: 'money', delta: -9000 },
          { kind: 'companyRating', delta: 3 },
        ],
      },
      {
        id: 'letItRide',
        label: 'Let it ride and see what happens',
        gains: 'Costs nothing today',
        costs: 'A rival testing your own ground and getting no response is a real dent',
        effects: () => [{ kind: 'companyRating', delta: -4 }],
      },
    ],
  },

  {
    id: 'blackballing',
    category: 'personal',
    title: '{rival} is trying to blackball {primary}',
    speaker: 'narrator',
    body: [
      "Word is going around that {rival} is leaning on other promotions not to book {primary}, quietly, over bad blood that has nothing to do with wrestling.",
      '{primary} crossed {rival} once, a long time ago, and {rival} has apparently decided this is the year to make sure nobody else in the business forgets it.',
      "{rival} is working the phones trying to make {primary} unemployable everywhere but here. {primary} knows it.",
    ],
    weight: 5,
    cooldownWeeks: 34,
    conditions: { minWeek: 18, needsRival: true, primary: (w) => w.popularity > 40 },
    options: [
      {
        id: 'backThemPublicly',
        label: 'Back them publicly',
        gains: 'A real show of loyalty the whole locker room sees',
        costs: 'Standing behind them publicly costs real money and picks a side in a fight that was not originally yours',
        effects: ({ primary }) => [
          { kind: 'money', delta: -4000 },
          { kind: 'morale', wrestlerId: primary!.id, delta: 10 },
        ],
      },
      {
        id: 'letThemFendForThemselves',
        label: 'Let them handle it themselves',
        gains: 'Stays out of a fight that is not officially yours',
        costs: 'They notice exactly who did not have their back',
        effects: ({ primary }) => [{ kind: 'morale', wrestlerId: primary!.id, delta: -14 }],
      },
    ],
  },

  {
    id: 'staffPoaching',
    category: 'business',
    title: '{rival} is making a real run at one of your signed staff',
    speaker: 'narrator',
    body: [
      "{rival} is quietly offering real money to somebody signed to your production and officiating staff, not your roster.",
      'One of the people who make your shows actually run — not a wrestler — has a real offer from {rival} sitting in front of them right now.',
      "{rival} figured out that the fastest way to hurt you is not always a wrestler. Sometimes it is whoever keeps your shows running on time.",
    ],
    weight: 5,
    cooldownWeeks: 30,
    conditions: { minWeek: 14, needsRival: true },
    options: [
      {
        id: 'payToKeepThem',
        label: 'Pay to keep them',
        gains: 'Keeps the people who actually run your shows in the building',
        costs: 'Real money, and a precedent for the next time somebody comes calling',
        effects: () => [
          { kind: 'money', delta: -7000 },
          { kind: 'reputation', delta: 2 },
        ],
      },
      {
        id: 'letThemGo',
        label: 'Let them go',
        gains: 'No money spent today',
        costs: 'Word gets around that this is not a building worth staying loyal to',
        effects: () => [{ kind: 'reputation', delta: -3 }],
      },
    ],
  },

  {
    id: 'spiteFreeAgentSigning',
    category: 'rival',
    title: '{rival} just paid four times market rate out of pure spite',
    speaker: 'narrator',
    body: [
      "{rival} signed a hot free agent this week for roughly four times what anybody in the business thought they were worth — not because the numbers made sense, but to keep them off every other roster, yours included.",
      "Nobody thinks {rival} actually needed that free agent. They just did not want anybody else — especially you — to have them.",
      "The number {rival} paid does not make business sense on paper. It was never about the paper. It was about making sure you could not have that name.",
    ],
    weight: 6,
    cooldownWeeks: 26,
    conditions: { minWeek: 14, needsRival: true },
    options: [
      {
        id: 'callItOut',
        label: 'Call out the overspend publicly',
        gains: 'Reads as the office that keeps its head while a rival throws money around',
        costs: 'Sounds a little like sour grapes to anybody who was not already on your side',
        effects: () => [
          { kind: 'bookingCredibility', delta: 3 },
          { kind: 'reputation', delta: -2 },
        ],
      },
      {
        id: 'matchTheNewReality',
        label: 'Quietly raise your own offers to stay competitive',
        gains: 'Keeps your own targets from testing a market that just got a lot more expensive',
        costs: 'Real money, spent to stand still rather than get ahead',
        effects: () => [{ kind: 'money', delta: -5000 }],
      },
    ],
  },
];

export function eventById(id: string): CreativeEvent | undefined {
  return CREATIVE_EVENTS.find((e) => e.id === id);
}
