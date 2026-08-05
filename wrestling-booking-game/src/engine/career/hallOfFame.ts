// The Hall of Fame — §19.
//
// A hall of fame is only worth having if it is hard to get into. The criteria
// here are the ones the business actually uses, in the order it uses them:
// how over you got, how long you carried something, and how long you lasted.
// A ten-year midcarder does not go in. A three-year phenomenon who drew like
// nobody else does.
//
// Induction happens once a year, a fixed few at a time, and you have to be
// out of the ring for it — with one exception, which is that somebody who
// died goes in straight away. That is how it works and it is the right call.

import type { Id, Wrestler, WorldSettings } from '../types';
import { yearsPro, weeksAsChampion } from './status';

export interface HallOfFameEntry {
  wrestlerId: Id;
  week: number;
  /** What they went in for, in one line. */
  citation: string;
}

export interface HallOfFameContext {
  currentWeek: number;
  currentYear: number;
  settings: WorldSettings;
}

/**
 * Can this person be considered at all? Active wrestlers cannot — the hall is
 * for finished careers. The dead go in whenever they die.
 */
export function isEligible(w: Wrestler, ctx: HallOfFameContext): boolean {
  if (!ctx.settings.hallOfFameEnabled) return false;
  if (w.hallOfFameWeek !== undefined) return false;
  if (w.deceased) return true;
  if (w.careerStatus !== 'retired') return false;
  return true;
}

/**
 * The case for them, 0-100. Weighted toward drawing power because that is
 * what a hall of fame is really measuring, with real credit for a long run
 * on top and for having been in the business a long time.
 */
export function hallOfFameScore(w: Wrestler, ctx: HallOfFameContext): number {
  const s = ctx.settings;

  const peak = (w.careerHighPopularity / 100) * s.hofPeakWeight;
  const reigns = Math.min(1, w.titleReigns.length / s.hofReignsForFullCredit) * s.hofReignsWeight;
  const weeksHeld = Math.min(1, weeksAsChampion(w, ctx.currentWeek) / s.hofChampionWeeksForFullCredit) * s.hofChampionWeeksWeight;
  const longevity = Math.min(1, yearsPro(w, ctx.currentYear) / s.hofYearsForFullCredit) * s.hofLongevityWeight;

  return peak + reigns + weeksHeld + longevity;
}

/** Why they went in. Reads off whichever part of the case is strongest. */
export function citationFor(w: Wrestler, ctx: HallOfFameContext): string {
  const years = yearsPro(w, ctx.currentYear);
  const weeks = weeksAsChampion(w, ctx.currentWeek);

  if (w.titleReigns.length >= ctx.settings.hofReignsForFullCredit) {
    return `${w.titleReigns.length}-time champion across ${years} years in the business`;
  }
  if (weeks >= ctx.settings.hofChampionWeeksForFullCredit) {
    return `Carried a championship for ${weeks} weeks`;
  }
  if (w.careerHighPopularity >= ctx.settings.mainEventPopularity) {
    return `Drew money everywhere, for ${years} years`;
  }
  return `${years} years in the business, and every one of them earned`;
}

/**
 * This year's class. Capped, and ordered by the case for them, so the hall
 * fills at a believable rate instead of absorbing everybody who ever retired.
 */
export function annualInductions(
  candidates: readonly Wrestler[],
  ctx: HallOfFameContext,
): HallOfFameEntry[] {
  return candidates
    .filter((w) => isEligible(w, ctx))
    .map((w) => ({ w, score: hallOfFameScore(w, ctx) }))
    .filter(({ score }) => score >= ctx.settings.hofScoreThreshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, ctx.settings.hofInductionsPerYear)
    .map(({ w }) => ({
      wrestlerId: w.id,
      week: ctx.currentWeek,
      citation: citationFor(w, ctx),
    }));
}
