// The mystery-video build-up a brand-new signee can get instead of an
// ordinary debut — Razor Ramon's toothpick-and-gold-chain vignettes, not a
// wire photo. Paid for the day the booker picks it, at signing time. Three
// real weeks off the card while it airs, and then one roll of the dice: the
// crowd either shows up already knowing every syllable of the name, or the
// whole investment lands with a shrug. See CLAUDE.md's non-negotiable that
// powers/decisions can change how somebody moves but never invent a result
// out of nothing — this doesn't skip the gamble, it just moves it off the
// wrestling and onto the marketing.

import { chance, rngFromSeed } from '../rng';
import type { Wrestler, WorldSettings } from '../types';

export interface Vignette {
  totalWeeks: number;
  weeksRemaining: number;
  /** The week the campaign started — the only thing the payoff roll is seeded from. */
  startWeek: number;
}

/** Start a fresh campaign, paid for the moment this is called. */
export function newVignette(settings: WorldSettings, startWeek: number): Vignette {
  return { totalWeeks: settings.vignetteWeeks, weeksRemaining: settings.vignetteWeeks, startWeek };
}

/** One week closer to the payoff. Returns the still-running campaign, or null once it's spent. */
export function tickVignette(v: Vignette): Vignette | null {
  const weeksRemaining = v.weeksRemaining - 1;
  return weeksRemaining > 0 ? { ...v, weeksRemaining } : null;
}

/** Which of the campaign's weeks this is, for display — 1 the week it started, `totalWeeks` the week it pays off. */
export function vignetteWeekNumber(v: Vignette): number {
  return v.totalWeeks - v.weeksRemaining + 1;
}

/** The dedicated card-slot tile's flavor line — the shape of the campaign, never a number. */
export function vignetteProgressLine(v: Vignette): string {
  const week = vignetteWeekNumber(v);
  if (week <= 1) return 'Grainy footage, no name, no face. The rumors just started.';
  if (week < v.totalWeeks) return 'The vignettes keep coming, and this crowd cannot stop talking about it.';
  return 'One more week of this, and then everybody finds out.';
}

export interface VignettePayoff {
  success: boolean;
  popularityDelta: number;
  momentumDelta: number;
}

/**
 * Whether three weeks of hype actually caught, and what it's worth either
 * way. Rolled once, off nothing but this wrestler's own id and the week the
 * campaign started — never the shared `rng` — so adding this decision can
 * never shift a single roll anywhere else. See root CLAUDE.md's RNG trap.
 */
export function resolveVignette(wrestler: Wrestler, v: Vignette, settings: WorldSettings): VignettePayoff {
  const rng = rngFromSeed(`vignette:${wrestler.id}:${v.startWeek}`);
  const oddsOfCatching = settings.vignetteSuccessChance + (wrestler.charisma / 100) * settings.vignetteCharismaBonus;
  const success = chance(rng, oddsOfCatching);
  return success
    ? { success: true, popularityDelta: settings.vignetteSuccessPopularity, momentumDelta: settings.vignetteSuccessMomentum }
    : { success: false, popularityDelta: 0, momentumDelta: 0 };
}
