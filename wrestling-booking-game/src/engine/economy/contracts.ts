// Contracts, Wrestling Empire style: a wage and a length, and that is the
// whole deal.
//
// The spec's §3 clause list (creativeControl, incentive, downside, payPerView
// and eighteen others) stays in the type and stays supported by the payroll
// maths — an event or a negotiation can still hand one out. But nothing gets
// signed with them by default, and the opening roster gets none at all. A
// contract you can read in one line is a contract you can make decisions
// about.
//
// What a wrestler costs is driven off what they are worth: popularity first,
// because that is what draws, with a smaller weight on the in-ring stats and
// a premium for the ones who are still going to get better.

import type { Rng } from '../rng';
import { clamp } from '../rng';
import type { Contract, Wrestler, WorldSettings } from '../types';

/** Two years. The default for the roster the player opens with. */
export const STARTING_CONTRACT_WEEKS = 104;

/**
 * What this wrestler asks for per week.
 *
 * Popularity dominates, because a promotion pays for draw rather than for
 * workrate — a beloved limited brawler costs more than a brilliant technician
 * nobody has heard of, which is both true to the business and the source of
 * a lot of good decisions.
 */
export function askingRate(wrestler: Wrestler, settings: WorldSettings): number {
  const draw = wrestler.popularity / 100;
  const craft = (wrestler.skill + wrestler.agility + wrestler.stamina + wrestler.strength) / 400;
  // Young talent with a high ceiling knows what it is worth.
  const upside = wrestler.age < 28 ? (wrestler.talent / 100) * 0.35 : 0;

  const value = draw * settings.contractDrawWeight + craft * settings.contractCraftWeight + upside;

  // Curved, so a genuine draw costs several times what a midcarder does
  // rather than a little more. A flat scale made every signing feel the same.
  const rate = settings.contractBaseWeeklyRate + value ** settings.contractRateCurve * settings.contractRateRange;
  return Math.round(rate / 25) * 25;
}

/**
 * A plain two-year deal. No creative control, no bonuses, nothing to read
 * twice.
 */
export function createStandardContract(wrestler: Wrestler, settings: WorldSettings, signedYear: number): Contract {
  return {
    type: 'fullTime',
    weeklyRate: askingRate(wrestler, settings),
    weeksRemaining: STARTING_CONTRACT_WEEKS,
    totalWeeks: STARTING_CONTRACT_WEEKS,
    clauses: [],
    // Nothing guaranteed. The opening roster is all handshake deals, which
    // is what makes the first star you have to *re-sign* feel different —
    // that is when guaranteed money enters the game.
    guaranteedPct: 0,
    signedYear,
  };
}

/** Total weekly wage bill for a roster, whether or not anyone is booked. */
export function weeklyWageBill(roster: readonly Wrestler[]): number {
  return roster.reduce((sum, w) => sum + (w.contract?.weeklyRate ?? 0), 0);
}

/** Tick every deal down a week. Returns the ids whose contracts just expired. */
export function expireContracts(roster: readonly Wrestler[]): string[] {
  const expired: string[] = [];
  for (const wrestler of roster) {
    if (!wrestler.contract) continue;
    wrestler.contract.weeksRemaining -= 1;
    if (wrestler.contract.weeksRemaining <= 0) expired.push(wrestler.id);
  }
  return expired;
}

/** Words, not weeks — how much runway is left on a deal. */
export type ContractUrgency = 'Secure' | 'Comfortable' | 'Running down' | 'Expiring';

export function contractUrgency(contract: Contract | null): ContractUrgency {
  if (!contract) return 'Expiring';
  if (contract.weeksRemaining > 52) return 'Secure';
  if (contract.weeksRemaining > 20) return 'Comfortable';
  if (contract.weeksRemaining > 8) return 'Running down';
  return 'Expiring';
}

/**
 * What it costs to renew, once they know what they are worth to you. A
 * wrestler who has grown since signing wants the difference; one who has
 * fallen off will still ask for what they used to get.
 */
export function renewalRate(wrestler: Wrestler, settings: WorldSettings): number {
  const asking = askingRate(wrestler, settings);
  const current = wrestler.contract?.weeklyRate ?? asking;
  return Math.max(asking, Math.round((current * settings.contractRenewalFloor) / 25) * 25);
}

/** Will they re-sign at this number? Morale and booking matter as much as money. */
export function willResign(wrestler: Wrestler, offeredRate: number, settings: WorldSettings): number {
  const asking = renewalRate(wrestler, settings);
  const money = clamp(offeredRate / Math.max(asking, 1), 0, 1.5) / 1.5;
  const happy = wrestler.morale / 100;
  const used = wrestler.momentum / 100;
  return clamp(money * 0.55 + happy * 0.3 + used * 0.15, 0, 1);
}

/**
 * Free agents and school graduates the player can sign. Cheaper than the
 * roster on average — that is the point of a pool, you are buying potential
 * rather than proven draw.
 */
export function isAffordable(wrestler: Wrestler, bankBalance: number, settings: WorldSettings): boolean {
  // A deal you cannot service for a season is a deal you cannot make.
  return askingRate(wrestler, settings) * settings.contractAffordabilityWeeks <= bankBalance;
}

export function rollSigningBonus(rng: Rng, wrestler: Wrestler, settings: WorldSettings): number {
  // Only the genuinely over ask for anything up front.
  if (wrestler.popularity < settings.mainEventPopularity) return 0;
  return Math.round((askingRate(wrestler, settings) * (2 + rng.next() * 4)) / 100) * 100;
}
