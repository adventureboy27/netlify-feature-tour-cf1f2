// Sponsors — §14.
//
// A third stream, independent of the network, and the one with an opinion
// about what kind of company you are. The design that matters here is in the
// spec and is worth restating: sponsors carry conditions that conflict with
// each other. A family brand and a beer brand will not both stay, so a roster
// of sponsors is not a pile of free money, it is a statement about the
// promotion — and taking the bigger cheque means letting the other one walk.

export type SponsorConditionKind =
  | 'hardcoreCeiling'
  | 'hardcoreFloor'
  | 'minAttendance'
  | 'marketableStar';

export interface SponsorCondition {
  kind: SponsorConditionKind;
  value: number;
  /** What the contract says, in their words. */
  text: string;
}

export interface Sponsor {
  id: string;
  name: string;
  requiresRating: number;
  weeklyFee: number;
  conditions: SponsorCondition[];
  blurb: string;
}

export const SPONSORS: Sponsor[] = [
  {
    id: 'localBusiness',
    name: 'Vic’s Auto Body',
    requiresRating: 45,
    weeklyFee: 2_500,
    conditions: [],
    blurb: 'A banner over the entrance and somebody who wants their name said on the microphone.',
  },
  {
    id: 'regionalBrand',
    name: 'Calder & Sons Hardware',
    requiresRating: 62,
    weeklyFee: 12_000,
    conditions: [
      { kind: 'minAttendance', value: 2_000, text: 'Two thousand people, or it is not worth the banner.' },
      { kind: 'hardcoreCeiling', value: 60, text: 'Keep it out of the gutter.' },
    ],
    blurb: 'Regional, respectable, and reads the newspaper before renewing.',
  },
  {
    id: 'nationalBrand',
    name: 'Sunbright Cereal',
    requiresRating: 78,
    weeklyFee: 45_000,
    conditions: [
      { kind: 'hardcoreCeiling', value: 25, text: 'Family viewing. No blood, no weapons, none of it.' },
    ],
    blurb: 'The biggest cheque on the board, and the one with the shortest leash.',
  },
  {
    id: 'beerBrand',
    name: 'Ironhead Lager',
    requiresRating: 70,
    weeklyFee: 38_000,
    conditions: [
      { kind: 'hardcoreFloor', value: 35, text: 'Our customers are not watching this for the chain wrestling.' },
    ],
    blurb: 'Wants it loud, wants it rough, and will leave the moment you go family-friendly.',
  },
  {
    id: 'apparelBrand',
    name: 'Northgate Athletic',
    requiresRating: 74,
    weeklyFee: 30_000,
    conditions: [
      { kind: 'marketableStar', value: 75, text: 'We need somebody worth putting on a shirt.' },
    ],
    blurb: 'Does not care how you book as long as there is a face worth printing.',
  },
];

export function sponsorById(id: string): Sponsor | undefined {
  return SPONSORS.find((s) => s.id === id);
}

/**
 * Whether two sponsors could ever sit on the same show.
 *
 * The cereal brand wants violence under 25 and the beer brand wants it over
 * 35; there is no card that satisfies both, and that is deliberate.
 */
export function sponsorsConflict(a: Sponsor, b: Sponsor): boolean {
  const ceiling = (s: Sponsor) => s.conditions.find((c) => c.kind === 'hardcoreCeiling')?.value;
  const floor = (s: Sponsor) => s.conditions.find((c) => c.kind === 'hardcoreFloor')?.value;

  const aCeiling = ceiling(a);
  const bFloor = floor(b);
  if (aCeiling !== undefined && bFloor !== undefined && bFloor >= aCeiling) return true;

  const bCeiling = ceiling(b);
  const aFloor = floor(a);
  if (bCeiling !== undefined && aFloor !== undefined && aFloor >= bCeiling) return true;

  return false;
}
