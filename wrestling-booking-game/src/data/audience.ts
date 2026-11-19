// Who is watching. A family-leaning crowd and a grown-up one cheer for
// different things, and the sponsors on the banner are what draw each of them
// in (data/sponsors.ts `audience`). The model is engine/world/audience.ts;
// these are its numbers, kept here so a save made before it existed needs no
// new settings to load (a missing World.audienceAge reads as neutral).

import type { WrestlingStyle } from '../engine/types';

export const AUDIENCE = {
  /** 0 all families, 100 all grown-ups. */
  neutral: 50,
  /** How far one leaning sponsor pulls the crowd from neutral, at full effect. */
  sponsorPush: 30,
  /** Never all one or the other. */
  floor: 10,
  ceiling: 90,
  /** Share of the gap to the sponsors' target closed each week: about half of it in two months. */
  driftRate: 0.08,
  /** Rating points a match gains or loses for suiting, or not suiting, who is watching — at its most. */
  ratingWeight: 3,
  /** A wrestler this far either side of zero alignment reads as a face or a heel to a crowd. */
  alignmentScale: 100,
  /** How much a heel or a face sways this, against their style. */
  alignmentWeight: 0.6,
  /** Highest stipulation violence level (data/stipulations.ts). */
  maxViolence: 5,
} as const;

/**
 * What each style is to a grown-up crowd, -1 to 1: positive, the older crowd
 * wants more of it; negative, it is the families' favourite. The kids love
 * the flyers, the masks, the big personalities and the giants; the grown-ups
 * want the fights, the hardcore and the mat work.
 */
export const STYLE_AUDIENCE: Record<WrestlingStyle, number> = {
  bruiser: 0.6,
  technical: 0.3,
  highFlyer: -0.6,
  powerhouse: 0,
  striker: 0.3,
  luchador: -0.5,
  submission: 0.4,
  hardcore: 1,
  showman: -0.7,
  giant: -0.3,
  allRounder: 0,
  oldSchool: 0.5,
};

/** What a sponsor does to the crowd, in words, for its card. */
export const SPONSOR_AUDIENCE_WORDS: Record<'family' | 'grownUp', string> = {
  family: 'Brings in families — the kids love the flyers, the masks and the good guys.',
  grownUp: 'Brings in an older, rowdier crowd — they want the brawlers, the villains and the violence.',
};

/** Who is watching, in words (§0: never the number), from families to grown-ups. */
export const AUDIENCE_WORDS: readonly { upTo: number; words: string }[] = [
  { upTo: 25, words: 'Mostly families and kids' },
  { upTo: 42, words: 'A family-leaning crowd' },
  { upTo: 58, words: 'A mixed crowd' },
  { upTo: 75, words: 'An older crowd' },
  { upTo: 100, words: 'A grown-up, rowdy crowd' },
];
