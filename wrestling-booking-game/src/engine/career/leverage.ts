// What somebody is in a position to ask for, as opposed to what they were
// once worth.
//
// The problem this fixes: asking price was driven by popularity, and
// popularity is the slowest-moving thing a wrestler has. A forty-five year old
// who main-evented for a decade still carried the fame, so he still asked
// top money, and a booker could not do anything about it except release him.
// A retired legend who came back asked the same as the day he left.
//
// That is not how the business works. Past a certain age the phone stops
// ringing as often, everybody knows it, and the number comes down — not
// because the man is worse but because his *position* is worse. A comeback is
// the extreme case: somebody who has already walked away once needs the job
// considerably more than the job needs him.
//
// The other half, and the reason this is not just an age tax: **if he can
// still go, he still gets paid.** Leverage is floored by what a wrestler can
// actually do in a ring, measured against the best on the roster. A fifty year
// old who is still one of the two or three best workers in the company keeps
// his money, because a booker who lets him walk will regret it and both of
// them know it. What collapses is the price of a name with nothing left
// behind it.

import { clamp } from '../rng';
import type { Wrestler, WorldSettings } from '../types';

export interface LeverageContext {
  /** The best in-ring ability on the roster, for comparison. */
  rosterPeakCraft: number;
  settings: WorldSettings;
}

/**
 * In-ring ability, on the same four attributes the asking price uses.
 *
 * Deliberately not popularity: fame is what a veteran has too much of, and
 * using it here would defeat the whole point.
 */
export function craftOf(wrestler: Wrestler): number {
  return (wrestler.skill + wrestler.agility + wrestler.stamina + wrestler.strength) / 4;
}

/**
 * How much of their asking price somebody is actually in a position to get,
 * from 0 to 1.
 *
 * A wrestler in their prime is on 1 and nothing here touches them.
 */
export function negotiatingLeverage(wrestler: Wrestler, ctx: LeverageContext): number {
  const { settings } = ctx;

  const yearsPastPrime = Math.max(0, wrestler.age - settings.veteranAge);
  const fromAge = 1 - yearsPastPrime * settings.leverageLostPerYearPastPrime;

  // The floor: if he can still work, he can still ask. A veteran who is
  // genuinely one of the best in the building loses very little to the years,
  // which is the whole reason this is not simply an age penalty.
  const share = ctx.rosterPeakCraft > 0 ? craftOf(wrestler) / ctx.rosterPeakCraft : 0;
  const earned = clamp(share, 0, 1) ** settings.leverageCraftCurve;

  // A comeback is applied last, to the whole thing, rather than to the age
  // term alone. Applied earlier it was cancelled out by the craft floor, so a
  // returning legend who could still go paid nothing at all for having walked
  // away — and walking away is exactly what the discount is for. Being able to
  // work is why somebody takes him back; it is not why he gets his rate back.
  const returning = wrestler.comebackWeek != null ? settings.comebackLeverage : 1;

  return clamp(Math.max(fromAge, earned) * returning, settings.leverageFloor, 1);
}

/**
 * Where they stand, in words, for the negotiating screen.
 *
 * States the position rather than advising on it. A booker reading "he needs
 * this more than you do" can still hand him a main-event deal.
 */
export function leverageLine(leverage: number, settings: WorldSettings): string {
  if (leverage >= settings.leverageStrongAt) return 'He can ask for whatever he likes and get it.';
  if (leverage >= settings.leverageFairAt) return 'He knows what he is worth, and so does everybody else.';
  if (leverage >= settings.leverageWeakAt) return 'There is not a queue for him any more.';
  return 'He needs this more than you do.';
}

/** Why the number is what it is, when it is not simply their prime. */
export function leverageReason(wrestler: Wrestler, ctx: LeverageContext): string | null {
  const { settings } = ctx;
  if (negotiatingLeverage(wrestler, ctx) >= settings.leverageFairAt) return null;
  if (wrestler.comebackWeek != null) return 'He walked away once. Coming back costs him the rate he left on.';
  if (wrestler.age > settings.veteranAge) return 'The phone does not ring the way it did.';
  return null;
}

/**
 * The asking price, after position is taken into account.
 *
 * Rounded to the same twenty-five the rest of the contract maths uses so the
 * figures on the page stay tidy.
 */
export function afterLeverage(rate: number, leverage: number): number {
  return Math.round((rate * leverage) / 25) * 25;
}
