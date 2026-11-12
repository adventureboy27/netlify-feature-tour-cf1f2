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
import { rngFromSeed } from '../rng';
import { securityWanted } from '../career/theBody';
import { afterLeverage, negotiatingLeverage } from '../career/leverage';
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

  // What they are worth, and then what they are in a position to ask for. A
  // name past its prime, or one coming back from retirement, does not get to
  // charge what it charged — unless it can still work, in which case it does.
  return afterLeverage(rate, negotiatingLeverage(wrestler, settings));
}

/**
 * How long a deal somebody actually wants, in weeks.
 *
 * Every contract in the game used to be exactly one hundred and four weeks —
 * the opening roster, every signing, every renewal. `contractLengthMin` and
 * `contractLengthMax` existed in settings and were read by nothing. So the
 * length of a deal was never a decision anybody made, and every locker room
 * emptied on the same schedule.
 *
 * What people want now, and why:
 *
 *   - **The young want years.** Somebody twenty-three with no name yet wants
 *     the security and believes he will be worth far more by the end of it.
 *     Varied, but long.
 *   - **Veterans want months.** A man of forty-four does not know how many
 *     years he has left in him and will not promise you ones he might not
 *     have. A comeback wants the shortest deal on the board — he is proving
 *     something, to you and to himself.
 *   - **Leverage inverts all of it.** A draw with the whole business chasing
 *     him wants a *short* deal, because the sooner it runs out the sooner he
 *     is paid properly again. Somebody with no leverage wants a long one, for
 *     exactly the same reason in reverse. This is the interesting half: your
 *     best signing will not tie himself down, and the man nobody else wants
 *     will happily sign until the end of the decade.
 *
 * Then a spread on top, so two twenty-four year olds in the same pool do not
 * ask for the same thing.
 */
export function desiredContractWeeks(wrestler: Wrestler, settings: WorldSettings): number {
  const span = settings.contractLengthMax - settings.contractLengthMin;

  // Where this person sits between wanting the shortest and the longest deal.
  let want = settings.contractWantBase;

  if (wrestler.age <= settings.contractYouthAge) want += settings.contractYouthWant;
  else if (wrestler.age > settings.veteranAge) {
    want -= (wrestler.age - settings.veteranAge) * settings.contractWantLostPerVeteranYear;
  }
  if (wrestler.comebackWeek != null) want -= settings.contractComebackWant;

  // A body that has already let him down makes security worth more than the
  // chance to renegotiate. This is the term that changes over a career: sign
  // him at twenty-five and he wants cash and a short deal; the same man with a
  // rebuilt shoulder wants cover and years of it.
  want += securityWanted(wrestler, wrestler.injuryHistory ?? [], settings);

  // The inversion: the stronger the position, the shorter the deal wanted.
  want -= (negotiatingLeverage(wrestler, settings) - settings.contractLeverageNeutral) * settings.contractLeverageSwing;

  // And the spread, so a pool of similar people is not a pool of clones.
  //
  // Seeded from the person rather than drawn from the world's stream. Taking a
  // draw here shifted every seeded roll that came after it — the first version
  // did, and the academy's school leavers started graduating at 38 popularity
  // instead of under 20 because the generation downstream had moved. It also
  // means the term a booker reads on the free-agent page cannot change under
  // him if anything recomputes it.
  const spread = rngFromSeed(`term:${wrestler.id}`).next();
  want += (spread * 2 - 1) * settings.contractWantSpread;

  const weeks = settings.contractLengthMin + clamp(want, 0, 1) * span;
  return Math.round(clamp(weeks, settings.contractLengthMin, settings.contractLengthMax));
}

/** How the length reads on the page. Weeks, because the game counts in weeks. */
export function contractLengthLine(weeks: number): string {
  if (weeks <= 8) return `${weeks} weeks — a look, nothing more`;
  if (weeks <= 20) return `${weeks} weeks`;
  if (weeks <= 60) return `${weeks} weeks — most of a year`;
  return `${weeks} weeks — a long commitment`;
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
export function createStandardContract(
  wrestler: Wrestler,
  settings: WorldSettings,
  signedYear: number,
  /**
   * How long the deal runs. Optional, because the opening roster is written
   * before anybody has rolled anything and a fixed term is the right answer
   * there; every deal signed *in* a save passes the length that was agreed.
   */
  weeks: number = STARTING_CONTRACT_WEEKS,
): Contract {
  return {
    type: 'fullTime',
    ...splitRate(wrestler, settings),
    weeksRemaining: weeks,
    totalWeeks: weeks,
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

