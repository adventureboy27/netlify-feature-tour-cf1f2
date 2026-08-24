// Production, as a ladder you climb rather than a shop you browse.
//
// You start with a wooden mat on a pickup and trailer. Everything else in this
// file is somewhere above you, and the order you get it in is not up to you —
// it is decided by two things that are both about physically getting the show
// to the building:
//
//   1. **Rungs.** Each piece of the spine wants the one below it. There is no
//      point owning a video wall if the ring it stands behind is a mat on a
//      gym floor, so the ladder will not sell you one.
//   2. **Haulage.** Everything you own has to fit on the truck. A pickup and a
//      trailer carries a mat and not much else; a lighting rig and a stage
//      need a box truck; a video wall needs a semi. The truck is not scenery,
//      it is the gate on the whole ladder — which is why upgrading haulage
//      feels like nothing and unlocks everything.
//
// The result is a fixed order of ambition. A booker in year one is not choosing
// between pyro and a big screen; he is trying to afford a proper ring, and the
// truck that comes after it.

import type { Id, WorldSettings } from '../types';
import { productionAssetById, showExtraById } from '../../data/production';

// ---------------------------------------------------------------- haulage

export interface Haulage {
  id: Id;
  name: string;
  cost: number;
  /** Weekly, whether it moves or not — tax, insurance, a yard to keep it in. */
  upkeepPerWeek: number;
  /** How much gear it can carry. Everything owned has to fit. */
  capacity: number;
  blurb: string;
}

/**
 * The trucks, smallest first. You start on the first one.
 *
 * Deliberately unglamorous. Nobody buys a wrestling game to shop for lorries —
 * which is exactly why this is the right gate. It converts "I want a video
 * wall" into "I need a semi first", and that is a longer, better road.
 */
export const HAULAGE: Haulage[] = [
  {
    id: 'pickup',
    name: 'Pickup and trailer',
    cost: 0,
    upkeepPerWeek: 60,
    capacity: 3,
    blurb: 'Your own truck and a rented trailer. The mat fits. Just.',
  },
  {
    id: 'boxTruck',
    name: 'Box truck',
    cost: 28_000,
    upkeepPerWeek: 240,
    capacity: 9,
    blurb: 'A proper ring, sound, and lights go in the back and come out dry.',
  },
  {
    id: 'semi',
    name: 'Semi and trailer',
    cost: 145_000,
    upkeepPerWeek: 900,
    capacity: 20,
    blurb: 'A stage, a screen and a crew, moving overnight between towns.',
  },
  {
    id: 'fleet',
    name: 'Two rigs and a crew bus',
    cost: 420_000,
    upkeepPerWeek: 2_600,
    // 44 rather than 40: the full ladder loads to 41, so a 40 left the last
    // rung permanently unbuyable. A little headroom on the top truck, because
    // the reward for finishing the climb should not be a truck that is full.
    capacity: 44,
    blurb: 'Load one while the other is still on the road. Nothing waits.',
  },
];

export function haulageById(id: Id): Haulage | undefined {
  return HAULAGE.find((h) => h.id === id);
}

/** The rung above the one you are on, or null at the top. */
export function nextHaulage(currentId: Id): Haulage | null {
  const index = HAULAGE.findIndex((h) => h.id === currentId);
  if (index < 0) return HAULAGE[0] ?? null;
  return HAULAGE[index + 1] ?? null;
}

// ---------------------------------------------------------------- the spine

export interface ProductionRung {
  id: Id;
  name: string;
  cost: number;
  upkeepPerShow: number;
  /** Space on the truck. The reason haulage gates the ladder. */
  haulSpace: number;
  /** The rung immediately below. Null for the first real purchase. */
  requires: Id | null;
  blurb: string;
  /** What owning it is worth. Every field optional; missing means no effect. */
  effects: {
    showRating?: number;
    tvRating?: number;
    attendanceMultiplier?: number;
    merchMultiplier?: number;
    injuryReduction?: number;
  };
}

/**
 * The spine, bottom to top. This is the order, and it is not negotiable —
 * each rung names the one below it.
 *
 * The player begins owning none of these and working on a wooden mat, which is
 * modelled as the absence of `matRopes` rather than as an item: you cannot sell
 * the floor.
 */
export const PRODUCTION_LADDER: ProductionRung[] = [
  {
    id: 'matRopes',
    name: 'Mat and ropes',
    cost: 9_000,
    upkeepPerShow: 40,
    haulSpace: 2,
    requires: null,
    blurb: 'Sprung boards and real ropes instead of plywood and hemp.',
    effects: { showRating: 2, injuryReduction: 0.08 },
  },
  {
    id: 'ring',
    name: 'Professional ring',
    cost: 34_000,
    upkeepPerShow: 120,
    haulSpace: 4,
    requires: 'matRopes',
    blurb: 'Steel frame, proper canvas. It sounds right when somebody lands.',
    effects: { showRating: 4, injuryReduction: 0.14, attendanceMultiplier: 1.02 },
  },
  {
    id: 'sound',
    name: 'Touring sound',
    cost: 26_000,
    upkeepPerShow: 95,
    haulSpace: 3,
    requires: 'ring',
    blurb: 'Entrance music that does not sound like a phone in a bucket.',
    effects: { showRating: 3, attendanceMultiplier: 1.03 },
  },
  {
    id: 'lights',
    name: 'Lighting rig',
    cost: 58_000,
    upkeepPerShow: 190,
    haulSpace: 5,
    requires: 'sound',
    blurb: 'The difference between a show and a gym with the lights on.',
    effects: { showRating: 5, tvRating: 0.15, attendanceMultiplier: 1.03 },
  },
  {
    id: 'cameras',
    name: 'Camera crew and switcher',
    cost: 86_000,
    upkeepPerShow: 340,
    haulSpace: 4,
    requires: 'lights',
    blurb: 'Hard camera, two handhelds, and somebody cutting between them.',
    effects: { showRating: 3, tvRating: 0.45, merchMultiplier: 1.04 },
  },
  {
    id: 'stage',
    name: 'Entrance stage and ramp',
    cost: 120_000,
    upkeepPerShow: 380,
    haulSpace: 7,
    requires: 'cameras',
    blurb: 'Somewhere to come out of. Makes everybody look bigger.',
    effects: { showRating: 6, attendanceMultiplier: 1.05, tvRating: 0.2 },
  },
  {
    id: 'screen',
    name: 'Video wall',
    cost: 240_000,
    upkeepPerShow: 700,
    haulSpace: 10,
    requires: 'stage',
    blurb: 'Two storeys of screen behind the stage. It travels, once it is yours.',
    effects: { showRating: 8, attendanceMultiplier: 1.07, tvRating: 0.35, merchMultiplier: 1.06 },
  },
  {
    id: 'pyro',
    name: 'Pyro rig',
    cost: 165_000,
    upkeepPerShow: 900,
    haulSpace: 6,
    requires: 'screen',
    blurb: 'The last thing you buy, and the first thing anybody remembers.',
    effects: { showRating: 7, attendanceMultiplier: 1.05, tvRating: 0.3 },
  },
];

export function rungById(id: Id): ProductionRung | undefined {
  return PRODUCTION_LADDER.find((r) => r.id === id);
}

// ---------------------------------------------------------------- the climb

export type BlockedReason = 'owned' | 'needsRung' | 'needsTruck' | 'cannotAfford' | null;

export interface RungStatus {
  rung: ProductionRung;
  owned: boolean;
  /** Why it cannot be bought right now, or null if it can. */
  blocked: BlockedReason;
  /** What is missing, in words. Stated plainly; §0 warns about nothing. */
  note: string;
}

/** Total space everything owned takes up on the truck. */
export function haulUsed(owned: readonly Id[]): number {
  return owned.reduce((sum, id) => sum + (rungById(id)?.haulSpace ?? 0), 0);
}

/** Would this fit, on top of what is already loaded? */
export function fitsOnTruck(owned: readonly Id[], rung: ProductionRung, truck: Haulage): boolean {
  return haulUsed(owned) + rung.haulSpace <= truck.capacity;
}

/**
 * Where the company stands on every rung, in order.
 *
 * The `note` is the interesting output: it says *why* something is out of reach,
 * which is information about the world rather than a warning about a decision.
 * "You need a bigger truck" is the sentence that makes the ladder legible.
 */
export function ladderStatus(
  owned: readonly Id[],
  truck: Haulage,
  bank: number,
): RungStatus[] {
  const has = new Set(owned);

  return PRODUCTION_LADDER.map((rung) => {
    if (has.has(rung.id)) {
      return { rung, owned: true, blocked: 'owned' as const, note: 'Owned.' };
    }
    if (rung.requires && !has.has(rung.requires)) {
      const below = rungById(rung.requires);
      return {
        rung,
        owned: false,
        blocked: 'needsRung' as const,
        note: `Needs ${below?.name ?? 'the rung below'} first.`,
      };
    }
    if (!fitsOnTruck(owned, rung, truck)) {
      return {
        rung,
        owned: false,
        blocked: 'needsTruck' as const,
        note: `Will not fit on the ${truck.name.toLowerCase()}.`,
      };
    }
    if (bank < rung.cost) {
      return { rung, owned: false, blocked: 'cannotAfford' as const, note: 'You cannot cover it.' };
    }
    return { rung, owned: false, blocked: null, note: 'Ready to buy.' };
  });
}

/** The one thing to be working towards. Always the lowest unowned rung. */
export function nextRung(owned: readonly Id[]): ProductionRung | null {
  const has = new Set(owned);
  return PRODUCTION_LADDER.find((r) => !has.has(r.id)) ?? null;
}

/**
 * What the whole kit is worth on a night, folded together.
 *
 * Multipliers compound and flat bonuses add, which is why the top of the ladder
 * is worth so much more than the sum of its rungs looks — and why a company
 * that climbed it is very hard to catch.
 */
export function productionEffects(owned: readonly Id[]): {
  showRating: number;
  tvRating: number;
  attendanceMultiplier: number;
  merchMultiplier: number;
  injuryReduction: number;
} {
  let showRating = 0;
  let tvRating = 0;
  let attendanceMultiplier = 1;
  let merchMultiplier = 1;
  let injuryReduction = 0;

  for (const id of owned) {
    const rung = rungById(id);
    if (!rung) continue;
    showRating += rung.effects.showRating ?? 0;
    tvRating += rung.effects.tvRating ?? 0;
    attendanceMultiplier *= rung.effects.attendanceMultiplier ?? 1;
    merchMultiplier *= rung.effects.merchMultiplier ?? 1;
    // Shields stack but never reach certainty — a safer ring is not a safe one.
    injuryReduction = 1 - (1 - injuryReduction) * (1 - (rung.effects.injuryReduction ?? 0));
  }

  return { showRating, tvRating, attendanceMultiplier, merchMultiplier, injuryReduction };
}

/**
 * Both systems' safety gear, combined, for whoever needs to know how
 * protected tonight actually is — this ladder's own rungs (matRopes, ring)
 * plus the older one-time asset shop's (ringUpgrade, trainingFacility,
 * steelBarricades) and the security show extra, all of which declare
 * injuryReduction/incidentReduction and none of which, before this
 * function existed, ever had anything read them. Deliberately not
 * wear-scaled — the fuller, per-show wear/venue-fit pass store.ts already
 * runs for revenue purposes is not duplicated here, so a badly worn asset
 * protects slightly more here than its true effectiveness. A known,
 * accepted simplification rather than an oversight; see the two-systems
 * note in docs/BACKLOG.md.
 */
export function equipmentSafetyEffects(
  ownedAssetIds: readonly Id[],
  productionRungs: readonly Id[],
  extraIds: readonly Id[] = [],
): { injuryReduction: number; incidentReduction: number } {
  let injuryReduction = productionEffects(productionRungs).injuryReduction;
  let incidentReduction = 0;

  const stack = (value: number | undefined) => {
    if (!value) return;
    injuryReduction = 1 - (1 - injuryReduction) * (1 - value);
  };
  const stackIncident = (value: number | undefined) => {
    if (!value) return;
    incidentReduction = 1 - (1 - incidentReduction) * (1 - value);
  };

  for (const id of ownedAssetIds) {
    const asset = productionAssetById(id);
    if (!asset) continue;
    stack(asset.effects.injuryReduction);
    stackIncident(asset.effects.incidentReduction);
  }
  for (const id of extraIds) {
    const extra = showExtraById(id);
    if (!extra) continue;
    // Ringside medical is chosen fresh every show, not owned — it declares
    // injuryReduction too (0.3), not just security's incidentReduction.
    stack(extra.effects.injuryReduction);
    stackIncident(extra.effects.incidentReduction);
  }

  return { injuryReduction, incidentReduction };
}

/** What the kit costs to put on, per show. */
export function productionUpkeepPerShow(owned: readonly Id[]): number {
  return owned.reduce((sum, id) => sum + (rungById(id)?.upkeepPerShow ?? 0), 0);
}

/**
 * How the production reads to somebody who turned up, in words rather than a
 * number — §0 keeps figures off the face of the game.
 */
export function productionLabel(owned: readonly Id[], settings: WorldSettings): string {
  const climbed = owned.filter((id) => rungById(id)).length;
  if (climbed === 0) return 'A mat on a gym floor';
  if (climbed <= settings.productionShoestringRungs) return 'Shoestring, but honest';
  if (climbed <= settings.productionTouringRungs) return 'A proper touring show';
  if (climbed < PRODUCTION_LADDER.length) return 'Television-grade';
  return 'The full arena spectacle';
}
