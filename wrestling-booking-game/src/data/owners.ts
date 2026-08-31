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
    blurb: 'Believes in this business the way it used to be run, and thinks most of what you do is a passing fad.',
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
      'We used to do this the right way, not this way.',
      'I have been in this business longer than you have been alive, and it shows.',
      'Let me tell you exactly what a real wrestling promotion is supposed to look like.',
    ],
  },
  {
    id: 'showman',
    name: 'the showman',
    blurb: 'Wants a genuine spectacle, and does not much care what it costs or whose name is on it.',
    weights: {
      drawAttendance: 4,
      reachRating: 3,
      expandTerritory: 3,
      runShowInTerritory: 2,
      titleOnWrestler: 2,
      signWrestler: 2,
    },
    greetings: [
      'Nobody ever sold one single ticket by being sensible.',
      'I want everybody talking about us come Monday morning, not a word less.',
      'Give me something actually worth putting on a poster.',
    ],
  },
  {
    id: 'pennyPincher',
    name: 'the accountant',
    blurb: 'Reads the ledger before the results every single time. Every wrestler on this roster is a line item to this one.',
    weights: {
      cutPayroll: 5,
      releaseWrestler: 3,
      reachRating: 2,
      drawAttendance: 2,
      pushTalent: 2,
    },
    greetings: [
      'I have been through every single number, line by line.',
      'Do you have any idea what this roster costs me every single week?',
      'We are not running a charity for wrestlers here.',
    ],
  },
  {
    id: 'hardcore',
    name: 'the promoter',
    blurb: 'Thinks blood draws money, and honestly, is not entirely wrong about it.',
    weights: {
      drawAttendance: 3,
      titleOnWrestler: 3,
      signWrestler: 3,
      expandTerritory: 2,
      reachRating: 2,
      pushTalent: 1,
    },
    greetings: [
      'People do not pay good money to watch a hug out there.',
      'I want them still talking about what they saw days later.',
      'Make somebody famous or make somebody bleed. Preferably, do both.',
    ],
  },
  {
    id: 'starChaser',
    name: 'the star-chaser',
    blurb: 'Only believes in real names. Would rather have one genuine drawing card than ten good hands.',
    weights: {
      signWrestler: 4,
      pushTalent: 4,
      titleOnWrestler: 3,
      reachRating: 2,
      drawAttendance: 2,
      expandTerritory: 1,
    },
    greetings: [
      'Nobody ever bought a ticket just to see a roster.',
      'Who is our guy? Go ahead, name one.',
      'I want a face on that poster people actually recognize.',
    ],
  },
  {
    id: 'nostalgic',
    name: 'the true believer',
    blurb: 'Genuinely, radiantly certain that the right familiar face brings the old magic back. Never once less than delighted, however it actually goes.',
    weights: {
      signWrestler: 4,
      titleOnWrestler: 3,
      pushTalent: 2,
      reachRating: 1,
    },
    greetings: [
      'Isn\'t this wonderful? We are going to give people something to remember.',
      'I have the most marvelous idea, and it involves somebody you have not thought about in years.',
      'Trust me completely on this one. I have never once been wrong about magic.',
    ],
  },
];

export function ownerProfile(personality: OwnerPersonality): OwnerProfile {
  return OWNER_PROFILES.find((p) => p.id === personality) ?? OWNER_PROFILES[0]!;
}

/** How each mandate is put to you. `{target}` and `{value}` are filled in. */
export const MANDATE_TEXT: Record<MandateType, string[]> = {
  signWrestler: ['Get {target} on this roster, and I mean now.', 'I want {target} working for us, full stop.'],
  releaseWrestler: [
    'Get {target} off my payroll, today.',
    'I do not want to see {target} on my television ever again.',
  ],
  titleOnWrestler: ['Put a belt on {target}. I mean it.', 'I want to see {target} carrying a championship, and soon.'],
  reachRating: [
    'Get this company to a {value} or go find somewhere else to work.',
    'I want us rated {value}. That is not a suggestion, that is an order.',
  ],
  cutPayroll: [
    'Get the wage bill under {value} a week, however you have to do it.',
    'This roster costs way too much. Under {value} a week, or I will do it for you myself.',
  ],
  drawAttendance: [
    'Put {value} people in a building. One night. Just do it.',
    'I want to see {value} paying customers at a show, and I want to see it soon.',
  ],
  pushTalent: [
    'Get {target} over, for real. I want them at a {value}.',
    'I have real money riding on {target}. Take them all the way to a {value}.',
  ],
  expandTerritory: [
    'I want {value} towns flying our flag, and I want it now.',
    'Hold {value} territories. We are not some local act anymore.',
  ],
  reduceHardcore: [
    'Lay off the garbage wrestling. We are a whole lot better than that.',
    'This is a wrestling promotion, not a scrapyard. Cool it, right now.',
  ],
  runShowInTerritory: [
    'Run a show in {target}. That is where I am from, and that matters to me.',
    'I want us in {target}. Do not ask me why, just do it.',
  ],
};
