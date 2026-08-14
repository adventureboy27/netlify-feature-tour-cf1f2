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
  // What they can ask for follows their reputation, not their ceiling.
  const upside = wrestler.age < 28 ? (wrestler.hype / 100) * 0.35 : 0;

  const value = draw * settings.contractDrawWeight + craft * settings.contractCraftWeight + upside;

  // Curved, so a genuine draw costs several times what a midcarder does
  // rather than a little more. A flat scale made every signing feel the same.
  const rate = settings.contractBaseWeeklyRate + value ** settings.contractRateCurve * settings.contractRateRange;
  return Math.round(rate / 25) * 25;
}

/**
 * What share of a wrestler's asking price they want as a retainer — money
 * that arrives whether they are booked or not — with the rest paid per
 * appearance.
 *
 * Everybody used to be on a full weekly salary regardless of use, which had
 * two consequences that fought the game. A thirty-five person roster cost
 * thirty-five full wages against a card that uses fourteen, so it was
 * unaffordable; and since a small roster was strictly cheaper with no
 * downside, the optimal play was to carry as few people as the card allowed.
 * Depth was punished.
 *
 * Stars are the ones with leverage, so they are the ones who get guaranteed
 * money; enhancement talent works for what it works for. That makes a deep
 * roster of cheap hands genuinely affordable and a deep roster of stars
 * genuinely ruinous, which is the right shape.
 */
export function retainerShare(wrestler: Wrestler, settings: WorldSettings): number {
  const standing = clamp(wrestler.popularity / 100, 0, 1);
  return settings.retainerShareBase + standing * settings.retainerShareRange;
}

/** The two halves of a deal: paid every week, and paid only when they work. */
export function splitRate(
  wrestler: Wrestler,
  settings: WorldSettings,
  total = askingRate(wrestler, settings),
): { weeklyRate: number; perAppearance: number } {
  const share = retainerShare(wrestler, settings);
  const weeklyRate = Math.round((total * share) / 5) * 5;
  // Sized so somebody booked every single week earns roughly their full ask.
  const perAppearance = Math.round((total - weeklyRate) / 5) * 5;
  return { weeklyRate, perAppearance: Math.max(0, perAppearance) };
}

/**
 * A plain two-year deal. No creative control, no bonuses, nothing to read
 * twice.
 */
export function createStandardContract(wrestler: Wrestler, settings: WorldSettings, signedYear: number): Contract {
  return {
    type: 'fullTime',
    ...splitRate(wrestler, settings),
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

/**
 * The retainer bill: what the roster costs before anybody is booked. This is
 * the cost of depth, and it is deliberately the smaller half of the money.
 */
export function weeklyWageBill(roster: readonly Wrestler[]): number {
  return roster.reduce((sum, w) => sum + (w.contract?.weeklyRate ?? 0), 0);
}

/** What tonight's card costs on top of the retainers. */
export function appearanceBill(worked: readonly Wrestler[]): number {
  return worked.reduce((sum, w) => sum + (w.contract?.perAppearance ?? 0), 0);
}

/** What somebody costs across a week they were booked — the full ask. */
export function fullWeeklyCost(wrestler: Wrestler): number {
  return (wrestler.contract?.weeklyRate ?? 0) + (wrestler.contract?.perAppearance ?? 0);
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

