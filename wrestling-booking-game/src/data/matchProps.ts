// Match hardware — the physical things a Ladder Match, a Steel Cage, or a
// Tables Match actually needs, as opposed to the abstract production-quality
// ladder in economy/production.ts (mat & ropes -> ring -> ... -> pyro), which
// is a house-gear investment, not a literal prop count.
//
// These are consumable, countable, ownable in more than one unit at once —
// the whole point being "4 ladders could put on a heck of a ladder match, and
// they don't all have to be the same ladder." A family is the category (a
// ladder, a cage, a table); a tier is the quality within it (a wooden ladder
// vs. a pro-spec aluminum one); a unit is one specific owned object, tracked
// in engine/economy/matchProps.ts.

import type { Id } from '../engine/types';

export interface MatchPropFamily {
  id: Id;
  name: string;
  blurb: string;
  /** Total units the promotion can own of this family at once, across all tiers. */
  maxUnitsOwned: number;
  /** How many can actually be assigned to one segment tonight, even if more are owned. */
  maxUnitsInMatch: number;
  /** Which data/stipulations.ts ids need this family owned to be booked for real. */
  stipulationIds: Id[];
}

export interface MatchPropTier {
  id: Id;
  familyId: Id;
  name: string;
  cost: number;
  blurb: string;
  /** Condition lost per show it's owned but not used tonight. */
  idleWearPerShow: number;
  /** Condition lost per show it IS used in a match. Always greater than idle wear. */
  useWearPerMatch: number;
  /** 0-1. Lower is safer. Cheap gear sits near 1.0; top-tier gear near 0.25. */
  qualityFactor: number;
}

export const MATCH_PROP_FAMILIES: MatchPropFamily[] = [
  {
    id: 'ladder',
    name: 'Ladder',
    blurb: 'Whatever is hanging up there settles the whole thing — assuming the ladder holds.',
    maxUnitsOwned: 6,
    maxUnitsInMatch: 4,
    stipulationIds: ['ladder'],
  },
  {
    id: 'steelCage',
    name: 'Steel Cage',
    blurb: 'Walls, a roof of chain-link, and a door that locks. One is plenty; a promotion running two shows a night is a promotion that does not exist yet.',
    maxUnitsOwned: 2,
    maxUnitsInMatch: 1,
    stipulationIds: ['steelCage'],
  },
  {
    id: 'tables',
    name: 'Table',
    blurb: 'Simple as it sounds — until the wood does not give the way it is supposed to.',
    maxUnitsOwned: 10,
    maxUnitsInMatch: 4,
    stipulationIds: ['tables', 'flamingTables'],
  },
];

export const MATCH_PROP_TIERS: MatchPropTier[] = [
  {
    id: 'ladderWood',
    familyId: 'ladder',
    name: 'Wooden Ladder',
    cost: 400,
    blurb: 'Bought from a hardware store, not a supplier. It will do the job. It will not do it for long.',
    idleWearPerShow: 0.4,
    useWearPerMatch: 9,
    qualityFactor: 1.0,
  },
  {
    id: 'ladderAluminum',
    familyId: 'ladder',
    name: 'Aluminum Ladder',
    cost: 1200,
    blurb: 'A real rental-house ladder. Lighter, straighter, and it survives more than one blowoff spot.',
    idleWearPerShow: 0.2,
    useWearPerMatch: 5,
    qualityFactor: 0.55,
  },
  {
    id: 'ladderProSpec',
    familyId: 'ladder',
    name: 'Pro-Spec Ladder',
    cost: 3200,
    blurb: 'Built for exactly this, inspected between shows, and priced like it.',
    idleWearPerShow: 0.1,
    useWearPerMatch: 2.5,
    qualityFactor: 0.25,
  },
  {
    id: 'cageRentedPanels',
    familyId: 'steelCage',
    name: 'Rented Panels',
    cost: 6000,
    blurb: 'Trucked in for the night from whoever had a cage free. The hinges have seen other people’s shows.',
    idleWearPerShow: 0.3,
    useWearPerMatch: 6,
    qualityFactor: 1.0,
  },
  {
    id: 'cageTouringRig',
    familyId: 'steelCage',
    name: 'Touring Rig',
    cost: 22000,
    blurb: 'Yours outright, built to go up and down every week without anybody worrying about the door.',
    idleWearPerShow: 0.12,
    useWearPerMatch: 2.5,
    qualityFactor: 0.4,
  },
  {
    id: 'tableFolding',
    familyId: 'tables',
    name: 'Folding Table',
    cost: 60,
    blurb: 'The kind you already own for catering. It will go through. So will the guy underneath it, wrong.',
    idleWearPerShow: 0.5,
    useWearPerMatch: 40,
    qualityFactor: 1.0,
  },
  {
    id: 'tableBanquetReinforced',
    familyId: 'tables',
    name: 'Reinforced Banquet Table',
    cost: 220,
    blurb: 'Scored to break clean, on purpose, which is the entire difference between this and a folding table.',
    idleWearPerShow: 0.2,
    useWearPerMatch: 18,
    qualityFactor: 0.5,
  },
];

export function familyById(id: Id): MatchPropFamily | undefined {
  return MATCH_PROP_FAMILIES.find((f) => f.id === id);
}

export function tierById(id: Id): MatchPropTier | undefined {
  return MATCH_PROP_TIERS.find((t) => t.id === id);
}

export function tiersForFamily(familyId: Id): MatchPropTier[] {
  return MATCH_PROP_TIERS.filter((t) => t.familyId === familyId);
}

/** Which family (if any) a stipulation needs owned to be booked for real. */
export function familyForStipulation(stipulationId: Id): MatchPropFamily | undefined {
  return MATCH_PROP_FAMILIES.find((f) => f.stipulationIds.includes(stipulationId));
}
