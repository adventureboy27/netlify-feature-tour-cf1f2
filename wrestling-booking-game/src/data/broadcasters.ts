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
  weeklyFee: number;
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
    demands: [{ kind: 'showsPerMonth', value: 4, text: 'Four shows a month. Every month.' }],
    blurb: 'A public-access slot after the fishing programme. It is television, technically.',
  },
  {
    id: 'regionalCable',
    name: 'Regional Cable',
    tier: 2,
    requiresRating: 68,
    weeklyFee: 22_000,
    demands: [{ kind: 'maintainRating', value: 65, text: 'Stay at a 65. They signed a company, not a promise.' }],
    blurb: 'Three states and a timeslot nobody else wanted, which is three states more than you had.',
  },
  {
    id: 'nationalNetwork',
    name: 'National Network',
    tier: 3,
    requiresRating: 80,
    weeklyFee: 70_000,
    demands: [
      { kind: 'maintainRating', value: 75, text: 'Stay at a 75.' },
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
    demands: [
      { kind: 'maintainRating', value: 88, text: 'Stay at an 88. There is no grace here.' },
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
