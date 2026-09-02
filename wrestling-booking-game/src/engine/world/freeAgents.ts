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
import { chance, clamp, randInt } from '../rng';
import type { Wrestler, WorldSettings } from '../types';
import { generateWrestlers } from '../generate/wrestler';
import { askingRate, desiredContractWeeks, isAffordable } from '../economy/contracts';

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
  /**
   * The length of deal they want, in weeks. Rolled once when they hit the
   * pool rather than every time the screen renders, so the number a booker
   * reads on Tuesday is the number he signs on Thursday.
   */
  wantsWeeks: number;
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
  existingNames: ReadonlySet<string> = new Set(),
): {
  wrestlers: Wrestler[];
  freeAgents: FreeAgent[];
} {
  const wrestlers = generateWrestlers(rng, settings.freeAgentPoolSize, {
    // Rolls what the business believes about them, as against what is true.
    settings,
    // Built to the split rather than rolled per head, for the same reason the
    // player's roster is: left to chance a small batch comes out lopsided,
    // and a division of two is one match repeated forever.
    divisionShare: settings.womensRosterShare,
    divisionFloor: settings.womensDivisionFloor,
    currentYear: settings.startingYear,
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
      wantsWeeks: desiredContractWeeks(w, settings),
      weeksUnsigned: randInt(rng, 0, 40),
    };
  });

  return { wrestlers, freeAgents };
}

/**
 * What somebody actually wants right now — the stored base ask, moved by
 * everything that has changed since they hit the pool.
 *
 * Two live adjustments, stacked: shelf time (somebody nobody has signed in a
 * long time will take less — what makes patience a strategy and keeps the
 * pool from being a static price list) and the wider economy. The second one
 * is not flat across everybody, and deliberately not symmetric either. A
 * downturn is read by humility: a humble wrestler settles for real money
 * less, a maximum-ego one does not move at all — stubborn, not realistic.
 * A boom runs the other way: everybody's price drifts up a little because
 * the market genuinely improved, but a high-ego wrestler leverages a hot
 * market hard on top of that baseline and wants a bigger piece of it than
 * the market alone earned them. Same trait, opposite jobs depending on which
 * way the wind is blowing — see engine/world/economicCycle.ts.
 */
export function currentAskingRate(
  agent: FreeAgent,
  wrestler: Wrestler,
  economicClimate: number,
  settings: WorldSettings,
  week = 0,
): number {
  const decay = Math.min(agent.weeksUnsigned * settings.freeAgentRateDecayPerWeek, settings.freeAgentMaxDiscount);
  const climate = clamp(economicClimate, -1, 1);
  const egoShare = clamp(wrestler.ego, 0, 100) / 100;
  const climateSwing =
    climate >= 0
      ? climate * settings.climateAskingRateSwing * (1 + egoShare * settings.climateBoomEgoPremium)
      : climate * settings.climateAskingRateSwing * (1 - egoShare);
  // Secular wage drift: the whole market's floor creeps up over the years
  // regardless of where the boom-and-bust cycle above happens to sit at the
  // moment — see WorldSettings.salaryInflation, which used to be declared
  // and defaulted but read by nothing. Linear per year rather than
  // compounding per week, so a long save's prices climb steadily without
  // running away to an absurd number the way unbounded growth already bit
  // this game once this session (see Promotion.deferredShowDebt).
  const inflation = 1 + settings.salaryInflation * (Math.max(0, week) / 52);
  const adjusted = agent.askingRate * (1 - decay) * (1 + climateSwing) * inflation;
  return Math.max(settings.contractBaseWeeklyRate, Math.round(adjusted / 25) * 25);
}

/** Can this promotion actually take them on? */
export function canSign(wrestler: Wrestler, bankBalance: number, settings: WorldSettings): boolean {
  return isAffordable(wrestler, bankBalance, settings);
}

/**
 * A week on the shelf.
 *
 * The only thing that changes about a free agent while nobody signs him, and
 * the thing `currentAskingRate` reads to bring his price down — so without
 * this the pool is a frozen price list. It was: measured over forty weeks, not
 * one asking rate and not one `weeksUnsigned` moved, because the function that
 * did it had no caller. The "39 weeks unsigned" on the signing page was a
 * number dealt at world creation and never touched again.
 *
 * This replaced a `tickPool` that also had rivals sign people out of the pool.
 * That half was cut rather than wired: the store already has short-handed
 * rivals signing from the pool, and two systems quietly doing the same thing
 * is how a business ends up with a rule nobody can find.
 */
export function agePool(freeAgents: readonly FreeAgent[]): FreeAgent[] {
  return freeAgents.map((agent) => ({ ...agent, weeksUnsigned: agent.weeksUnsigned + 1 }));
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
