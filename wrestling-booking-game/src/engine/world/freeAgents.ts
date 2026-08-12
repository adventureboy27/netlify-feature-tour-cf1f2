// The free agent pool — everyone in the business who is not signed anywhere.
//
// It is not a shop. It is a real population of wrestlers living their own
// careers: people whose deals ran out, people a promotion released, people who
// came out of a school and nobody picked up, and a few who used to be a much
// bigger deal than they are now. They age, they drift, and if you leave them
// there long enough a rival takes them.
//
// The pool is what makes releasing somebody a decision instead of a delete
// key, and it is where the opening roster comes from.

import type { Rng } from '../rng';
import { chance, randInt } from '../rng';
import type { Wrestler, WorldSettings, CareerStatus, Appearance } from '../types';
import { generateWrestlers } from '../generate/wrestler';
import { askingRate, isAffordable } from '../economy/contracts';

/**
 * Why this person is available. Shown to the player, because "released last
 * month" and "nobody has ever signed them" are different propositions at the
 * same price.
 */
export type AvailabilityReason =
  | 'neverSigned'
  | 'contractExpired'
  | 'released'
  | 'schoolGraduate'
  /** Never trained. Walked in off the street asking for a look — see walkOns.ts. */
  | 'walkOn'
  | 'returning';

export interface FreeAgent {
  wrestlerId: string;
  reason: AvailabilityReason;
  askingRate: number;
  /** Weeks they have been sitting unsigned. Long enough and they get cheaper. */
  weeksUnsigned: number;
}

export const AVAILABILITY_LABELS: Record<AvailabilityReason, string> = {
  neverSigned: 'Never been signed',
  contractExpired: 'Contract ran out',
  released: 'Released',
  schoolGraduate: 'Out of the school',
  walkOn: 'Walked in off the street',
  returning: 'Coming back',
};

/**
 * Build the opening pool. Deliberately weaker on average than a signed
 * roster — you are mostly buying potential and second chances, with the
 * occasional genuine name who fell out of favour somewhere.
 */
export function generateFreeAgentPool(
  rng: Rng,
  settings: WorldSettings,
  existingAppearances: Appearance[] = [],
  existingNames: ReadonlySet<string> = new Set(),
): {
  wrestlers: Wrestler[];
  freeAgents: FreeAgent[];
} {
  const wrestlers = generateWrestlers(rng, settings.freeAgentPoolSize, {
    currentYear: settings.startingYear,
    existingAppearances,
    existingNames: new Set(existingNames),
  });

  const freeAgents: FreeAgent[] = wrestlers.map((w) => {
    w.promotionId = null;
    w.contract = null;

    const reason: AvailabilityReason =
      w.age < 24
        ? chance(rng, 0.6)
          ? 'schoolGraduate'
          : 'neverSigned'
        : w.age > 36
          ? chance(rng, 0.4)
            ? 'returning'
            : 'contractExpired'
          : chance(rng, 0.5)
            ? 'contractExpired'
            : 'released';

    return {
      wrestlerId: w.id,
      reason,
      askingRate: askingRate(w, settings),
      weeksUnsigned: randInt(rng, 0, 40),
    };
  });

  return { wrestlers, freeAgents };
}

/**
 * Somebody nobody has signed in a long time will take less. This is what
 * makes patience a strategy and what keeps the pool from being a static
 * price list.
 */
export function currentAskingRate(agent: FreeAgent, settings: WorldSettings): number {
  const decay = Math.min(agent.weeksUnsigned * settings.freeAgentRateDecayPerWeek, settings.freeAgentMaxDiscount);
  return Math.max(settings.contractBaseWeeklyRate, Math.round((agent.askingRate * (1 - decay)) / 25) * 25);
}

/** Can this promotion actually take them on? */
export function canSign(
  wrestler: Wrestler,
  bankBalance: number,
  signingBanWeeks: number,
  settings: WorldSettings,
): boolean {
  if (signingBanWeeks > 0) return false;
  return isAffordable(wrestler, bankBalance, settings);
}

export interface PoolTickContext {
  freeAgents: readonly FreeAgent[];
  wrestlerById: (id: string) => Wrestler | undefined;
  statusOf: (wrestler: Wrestler) => CareerStatus;
  /** Combined pull of every AI promotion, 0-1. */
  rivalDemand: number;
  settings: WorldSettings;
}

/**
 * A week in the pool: everyone gets a week older on the shelf, and rivals
 * quietly sign the good ones. Leave a prospect sitting there and somebody
 * else will take them — the pool is not a reservation.
 */
export function tickPool(rng: Rng, ctx: PoolTickContext): { updated: FreeAgent[]; signedAway: string[] } {
  const signedAway: string[] = [];
  const updated: FreeAgent[] = [];

  for (const agent of ctx.freeAgents) {
    const wrestler = ctx.wrestlerById(agent.wrestlerId);
    if (!wrestler) continue;

    const status = ctx.statusOf(wrestler);
    // Rivals go for the same people you would.
    const desirability =
      (wrestler.popularity / 100) * 0.6 + (wrestler.talent / 100) * (wrestler.age < 30 ? 0.4 : 0.1);
    const takenChance = desirability * ctx.rivalDemand * ctx.settings.freeAgentRivalSigningChance;

    if (status !== 'retired' && chance(rng, takenChance)) {
      signedAway.push(agent.wrestlerId);
      continue;
    }

    updated.push({ ...agent, weeksUnsigned: agent.weeksUnsigned + 1 });
  }

  return { updated, signedAway };
}

/** Sort the pool the way a booker actually reads it: best available first. */
export function rankPool(
  freeAgents: readonly FreeAgent[],
  wrestlerById: (id: string) => Wrestler | undefined,
): FreeAgent[] {
  return [...freeAgents].sort((a, b) => {
    const wa = wrestlerById(a.wrestlerId);
    const wb = wrestlerById(b.wrestlerId);
    return (wb?.popularity ?? 0) - (wa?.popularity ?? 0);
  });
}
