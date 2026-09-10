// Getting out, and coming back.
//
// Nobody wrestles forever. They go because their body has gone, because the
// crowd stopped caring, or because they are 55 and there is nothing left to
// prove. The game needs all three, because a roster that only ever grows is
// a roster with no history in it.
//
// And then some of them come back. Not for money — for a score. A retired
// legend returning to settle something with the man who put him out is one
// of the best stories wrestling has, so the comeback here is driven by
// unfinished business (shoot heat), not by a payday.

import type { Rng } from '../rng';
import { clamp } from '../rng';
import type { Rivalry, Wrestler, WorldSettings } from '../types';
import { yearsPro } from './status';
import { hasTrait, injuryProneness } from './personality';

export interface RetirementContext {
  currentYear: number;
  settings: WorldSettings;
}

export type RetirementReason = 'age' | 'body' | 'nobodyIsBooking' | 'onTop';

export const RETIREMENT_REASON_TEXT: Record<RetirementReason, string> = {
  age: 'Called it a career, right on schedule and right on their own terms.',
  body: "The doctors made the call the body had already made. This ring wasn't in the cards anymore.",
  nobodyIsBooking: 'The phone stopped ringing, and the waiting stopped right along with it.',
  onTop: 'Walked away at the absolute peak, not one step past it — a mic-drop exit if this business has ever seen one.',
};

export interface RetirementCall {
  retiring: boolean;
  reason: RetirementReason;
  /** 0-1. Surfaced so the UI can warn a booker their main eventer is close. */
  pressure: number;
}

/**
 * How much this person wants out, 0-1. Age is the floor of it; a wrecked body
 * and a career nobody is booking push it up fast.
 */
export function retirementPressure(w: Wrestler, ctx: RetirementContext): number {
  const s = ctx.settings;
  if (w.careerStatus === 'retired') return 1;

  // Age. Nothing before the soft age, everything by the hard one.
  const ageSpan = Math.max(1, s.retirementAgeHard - s.retirementAgeSoft);
  const fromAge = clamp((w.age - s.retirementAgeSoft) / ageSpan, 0, 1);

  // The body. Condition that never comes back, and time already spent hurt.
  // Made Of Glass worries about it more than the same amount of wear worries
  // anybody else — the same number that raises how often they get hurt
  // (sim/casualties.ts) raises how much a given amount of hurt weighs on them.
  const fromBody = clamp((100 - w.health) / 100, 0, 1) * s.retirementBodyWeight * injuryProneness(w);
  const careerEnding = w.injury?.severity === 'careerThreatening' ? s.retirementCareerEndingInjury : 0;

  // Nobody is booking them. Measured against their own peak, not the roster's
  // — falling from 90 to 40 is a reason to quit; never having been over is not.
  const decline = w.careerHighPopularity > 0 ? 1 - w.popularity / w.careerHighPopularity : 0;
  const fromDecline = clamp(decline, 0, 1) * s.retirementDeclineWeight;

  // Still drawing? Then not yet, whatever the birth certificate says.
  const stillDrawing = w.popularity >= s.mainEventPopularity ? s.retirementStillDrawingRelief : 0;

  // Two traits with something to say about hanging it up specifically, rather
  // than about the job in general — see career/personality.ts.
  const loveOfTheGame = hasTrait(w, 'gratefulForTheWork') ? s.retirementLoveOfTheGameRelief : 0;
  const roadWeary = hasTrait(w, 'wantsMoreTimeOff') ? s.retirementRoadWearyPush : 0;

  return clamp(fromAge + fromBody + careerEnding + fromDecline - stillDrawing - loveOfTheGame + roadWeary, 0, 1);
}

function reasonFor(w: Wrestler, ctx: RetirementContext): RetirementReason {
  if (w.injury?.severity === 'careerThreatening') return 'body';
  if (w.popularity >= ctx.settings.mainEventPopularity) return 'onTop';
  if (w.careerHighPopularity > 0 && w.popularity < w.careerHighPopularity * 0.5) return 'nobodyIsBooking';
  return w.health < 50 ? 'body' : 'age';
}

/**
 * The annual call. Rolled once a year rather than weekly: retiring is a
 * decision somebody makes in the off-season, not a coin flipped every Monday.
 */
export function rollRetirement(rng: Rng, w: Wrestler, ctx: RetirementContext): RetirementCall {
  const pressure = retirementPressure(w, ctx);
  const reason = reasonFor(w, ctx);

  if (!ctx.settings.retirementEnabled || w.careerStatus === 'retired') {
    return { retiring: false, reason, pressure };
  }

  // Past the hard age it is not a roll any more.
  if (w.age >= ctx.settings.retirementAgeHard) return { retiring: true, reason: 'age', pressure: 1 };
  // Somebody has to have been in the business a while to retire from it.
  if (yearsPro(w, ctx.currentYear) < ctx.settings.retirementMinYearsPro) {
    return { retiring: false, reason, pressure };
  }

  return { retiring: rng.next() < pressure * ctx.settings.retirementChanceAtMaxPressure, reason, pressure };
}

/** Take somebody out of the business. Their contract goes with them. */
export function retire(w: Wrestler): void {
  w.careerStatus = 'retired';
  w.promotionId = null;
  w.contract = null;
  w.cardStatus = 'enhancement';
  w.momentum = 0;
}

export interface ComebackContext {
  currentYear: number;
  /** Every rivalry in the world — a comeback needs something to come back for. */
  rivalries: readonly Rivalry[];
  settings: WorldSettings;
}

/**
 * The unfinished score, if there is one. A retired wrestler comes back when
 * somebody they hate is still working — and the more real the animosity, the
 * likelier they lace the boots up again.
 */
export function unfinishedBusiness(w: Wrestler, ctx: ComebackContext): Rivalry | null {
  const scores = ctx.rivalries
    .filter((r) => r.resolvedWeek === null && r.participantIds.includes(w.id))
    .filter((r) => r.shootHeat >= ctx.settings.comebackShootHeatThreshold)
    .sort((a, b) => b.shootHeat - a.shootHeat);
  return scores[0] ?? null;
}

export interface ComebackCall {
  returning: boolean;
  /** The score they are coming back to settle, if that is why. */
  over: Rivalry | null;
}

/**
 * Rolled annually alongside retirement. Two ways back in: a score worth
 * settling, or — much more rarely — simply missing it.
 */
export function rollComeback(rng: Rng, w: Wrestler, ctx: ComebackContext): ComebackCall {
  if (w.careerStatus !== 'retired') return { returning: false, over: null };
  // Past a certain age the crowd would rather remember them as they were.
  if (w.age > ctx.settings.comebackMaxAge) return { returning: false, over: null };

  const score = unfinishedBusiness(w, ctx);
  const chance = score
    ? ctx.settings.comebackChanceWithScore * (score.shootHeat / 100)
    : ctx.settings.comebackChanceForLove;

  return { returning: rng.next() < chance, over: score };
}

/** Bring them back. They are not what they were, and the game says so. */
export function unretire(w: Wrestler, settings: WorldSettings, week?: number): void {
  w.careerStatus = 'veteran';
  // Marked so the negotiating table knows. Somebody who has walked away once
  // is in the weakest position in the business — see career/leverage.ts.
  if (week !== undefined) w.comebackWeek = week;
  w.health = clamp(w.health, settings.comebackStartingHealth, 100);
  // Ring rust. They get it back by working, like everybody else.
  w.momentum = clamp(w.momentum + settings.comebackMomentum, 0, 100);
}
