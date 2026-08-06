// The owner.
//
// Somebody signs the cheques, and they have opinions. The personality is the
// whole point of the system: a traditionalist and a star-chaser want opposite
// things from the same promotion, so the pressure a save is under is a
// property of who you happen to work for rather than a difficulty slider.
//
// Every line here is written to be read in the owner's voice. A mandate that
// reads like a quest objective is a quest objective; one that reads like a man
// leaning on your desk is pressure.

import type { MandateType, OwnerPersonality } from '../engine/types';

export interface OwnerProfile {
  id: OwnerPersonality;
  name: string;
  blurb: string;
  /**
   * What they ask for, relative to each other. A zero means this owner never
   * asks for that — a penny-pincher does not demand you sign somebody, and a
   * star-chaser does not care what payroll costs.
   */
  weights: Partial<Record<MandateType, number>>;
  /** How they open, when they turn up with something. */
  greetings: string[];
}

export const OWNER_PROFILES: OwnerProfile[] = [
  {
    id: 'traditionalist',
    name: 'the traditionalist',
    blurb: 'Believes in the business the way it was, and thinks most of what you do is a fad.',
    weights: {
      titleOnWrestler: 3,
      reachRating: 2,
      reduceHardcore: 4,
      runShowInTerritory: 3,
      pushTalent: 2,
      expandTerritory: 1,
      drawAttendance: 2,
      releaseWrestler: 1,
    },
    greetings: [
      'We used to do this properly.',
      'I have been in this business longer than you have been alive.',
      'Let me tell you what a wrestling promotion is supposed to look like.',
    ],
  },
  {
    id: 'showman',
    name: 'the showman',
    blurb: 'Wants a spectacle. Does not much care what it costs or who it is.',
    weights: {
      drawAttendance: 4,
      reachRating: 3,
      expandTerritory: 3,
      runShowInTerritory: 2,
      titleOnWrestler: 2,
      signWrestler: 2,
    },
    greetings: [
      'Nobody ever sold a ticket being sensible.',
      'I want people talking about us on Monday.',
      'Give me something worth putting on a poster.',
    ],
  },
  {
    id: 'pennyPincher',
    name: 'the accountant',
    blurb: 'Reads the ledger before the results. Every wrestler is a line item.',
    weights: {
      cutPayroll: 5,
      releaseWrestler: 3,
      reachRating: 2,
      drawAttendance: 2,
      pushTalent: 2,
    },
    greetings: [
      'I have been through the numbers.',
      'Do you know what this roster costs me every week?',
      'We are not a charity for wrestlers.',
    ],
  },
  {
    id: 'hardcore',
    name: 'the promoter',
    blurb: 'Thinks blood draws money, and is not entirely wrong.',
    weights: {
      drawAttendance: 3,
      titleOnWrestler: 3,
      signWrestler: 3,
      expandTerritory: 2,
      reachRating: 2,
      pushTalent: 1,
    },
    greetings: [
      'People do not pay to watch a hug.',
      'I want them talking about what they saw.',
      'Make somebody famous or make somebody bleed. Preferably both.',
    ],
  },
  {
    id: 'starChaser',
    name: 'the star-chaser',
    blurb: 'Only believes in names. Would rather have one draw than ten good hands.',
    weights: {
      signWrestler: 4,
      pushTalent: 4,
      titleOnWrestler: 3,
      reachRating: 2,
      drawAttendance: 2,
      expandTerritory: 1,
    },
    greetings: [
      'Nobody buys a ticket to see a roster.',
      'Who is our guy? Name one.',
      'I want a face on the poster people recognise.',
    ],
  },
];

export function ownerProfile(personality: OwnerPersonality): OwnerProfile {
  return OWNER_PROFILES.find((p) => p.id === personality) ?? OWNER_PROFILES[0]!;
}

/** How each mandate is put to you. `{target}` and `{value}` are filled in. */
export const MANDATE_TEXT: Record<MandateType, string[]> = {
  signWrestler: ['Get {target} on this roster.', 'I want {target} working for us.'],
  releaseWrestler: [
    'Get {target} off my payroll.',
    'I do not want to see {target} on my television again.',
  ],
  titleOnWrestler: ['Put a belt on {target}.', 'I want to see {target} carrying a championship.'],
  reachRating: [
    'Get this company to a {value} or find somewhere else to work.',
    'I want us rated {value}. That is not a suggestion.',
  ],
  cutPayroll: [
    'Get the wage bill under {value} a week.',
    'This roster costs too much. Under {value} a week, or I will do it for you.',
  ],
  drawAttendance: [
    'Put {value} people in a building. One night. Do it.',
    'I want to see {value} paying customers at a show.',
  ],
  pushTalent: [
    'Get {target} over. I want them at a {value}.',
    'I have money on {target}. Take them to a {value}.',
  ],
  expandTerritory: [
    'I want {value} towns flying our flag.',
    'Hold {value} territories. We are not a local act.',
  ],
  reduceHardcore: [
    'Lay off the garbage wrestling. We are better than that.',
    'This is a wrestling promotion, not a scrapyard. Cool it.',
  ],
  runShowInTerritory: [
    'Run a show in {target}. That is where I am from.',
    'I want us in {target}. Do not ask me why.',
  ],
};
