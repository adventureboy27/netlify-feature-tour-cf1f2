// Television, and the people who pay for it — §14.
//
// Gate money cannot sustain a promotion past the midgame. Television is the
// second stream and the long-term progression track: each tier is several
// times the last, and each one takes a bigger bite out of what you are allowed
// to book.
//
// The demands are the point. A network fee that arrived with no strings would
// just be a number going up; a network that will cancel you for drifting below
// the rating it signed you at is a floor under every booking decision for the
// rest of the save.

export type BroadcastDemandKind =
  | 'maintainRating'
  | 'maintainTvRating'
  | 'hardcoreCeiling'
  | 'ppvPerQuarter'
  | 'showsPerMonth';

export interface BroadcastDemand {
  kind: BroadcastDemandKind;
  value: number;
  /** How it reads on the contract. */
  text: string;
}

export interface Broadcaster {
  id: string;
  name: string;
  tier: number;
  /** Company rating needed before they will talk to you. */
  requiresRating: number;
  /**
   * The guaranteed rights fee — the floor, paid whatever happens, because
   * they signed a contract.
   */
  weeklyFee: number;
  /**
   * The rating they signed you expecting to deliver.
   *
   * The variable half of the fee is measured against this: beat it and they
   * pay more, miss it and they pay less. Without it the TV rating was a
   * scoreboard with nothing behind it — computed, charted, and read by no
   * money path in the game.
   *
   * Calibrated against what the share model actually produces at the company
   * rating each tier requires, which is a narrower band than it looks: TV
   * ratings are a split of a finite audience, so even a dominant promotion
   * lands around a five, not a fifteen. Set these by intuition and the top
   * tiers become a trap — a promotion gets promoted into a deal it is
   * permanently in breach of and takes the maximum fee cut for the privilege.
   */
  expectedRating: number;
  demands: BroadcastDemand[];
  blurb: string;
}

/**
 * Ordered worst to best. A promotion is offered the best tier it qualifies
 * for, and only after holding that rating long enough to prove it was not a
 * fluke.
 */
export const BROADCASTERS: Broadcaster[] = [
  {
    id: 'localAccess',
    name: 'Local Access',
    tier: 1,
    requiresRating: 55,
    weeklyFee: 6_000,
    expectedRating: 2.2,
    demands: [{ kind: 'showsPerMonth', value: 4, text: 'Four shows a month. Every month.' }],
    blurb: 'A public-access slot after the fishing programme. It is television, technically.',
  },
  {
    id: 'regionalCable',
    name: 'Regional Cable',
    tier: 2,
    requiresRating: 68,
    weeklyFee: 22_000,
    expectedRating: 2.8,
    demands: [
      { kind: 'maintainRating', value: 65, text: 'Stay at a 65. They signed a company, not a promise.' },
      { kind: 'maintainTvRating', value: 1.9, text: 'Do a 1.9 in the slot, or they will find somebody who can.' },
    ],
    blurb: 'Three states and a timeslot nobody else wanted, which is three states more than you had.',
  },
  {
    id: 'nationalNetwork',
    name: 'National Network',
    tier: 3,
    requiresRating: 80,
    weeklyFee: 70_000,
    expectedRating: 3.6,
    demands: [
      { kind: 'maintainRating', value: 75, text: 'Stay at a 75.' },
      { kind: 'maintainTvRating', value: 2.7, text: 'A 2.7 in the slot. That is what the sales team sold.' },
      { kind: 'hardcoreCeiling', value: 45, text: 'Nothing that frightens the advertisers.' },
    ],
    blurb: 'Standards and practices now has an opinion about your main event.',
  },
  {
    id: 'premiumGlobal',
    name: 'Premium Global',
    tier: 4,
    requiresRating: 91,
    weeklyFee: 180_000,
    expectedRating: 4.8,
    demands: [
      { kind: 'maintainRating', value: 88, text: 'Stay at an 88. There is no grace here.' },
      { kind: 'maintainTvRating', value: 3.6, text: 'A 3.6, every week. There is no grace here either.' },
      { kind: 'ppvPerQuarter', value: 1, text: 'A pay-per-view every quarter, minimum.' },
    ],
    blurb: 'The kind of money that changes what a wrestling company is, and the kind of scrutiny that comes with it.',
  },
];

export function broadcasterById(id: string): Broadcaster | undefined {
  return BROADCASTERS.find((b) => b.id === id);
}

/** The best network that would have this promotion, or none. */
export function bestBroadcasterFor(companyRating: number): Broadcaster | undefined {
  return [...BROADCASTERS].reverse().find((b) => companyRating >= b.requiresRating);
}
