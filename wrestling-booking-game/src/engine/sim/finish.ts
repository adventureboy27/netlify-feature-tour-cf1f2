// Finish type roll — booking-game-design.md §11.3.

import type { Rng } from '../rng';
import { weightedPick } from '../rng';
import type { FinishType, MatchRules } from '../types';

export interface FinishRollContext {
  rules: MatchRules;
  violenceLevel: number; // from the stipulation, 0 if none
  /**
   * Combined injury multiplier (stipulation violence x real animosity). A
   * violent gimmick match between two people who genuinely dislike each other
   * really can end with somebody being carried out — and that match draws
   * nothing, no matter who was in it.
   */
  injuryMultiplier?: number;
  winnerIsTechnician: boolean;
  isUpset: boolean; // the side that won was the underdog
  isCloselyMatched: boolean; // widens the time-limit-draw weight
  /**
   * Stipulation.finishWeights — multipliers applied after the rules-based
   * weights. A gimmick match with one legal way to win zeroes everything
   * else out, so a tables match cannot end in a clean pin.
   */
  finishWeights?: Partial<Record<FinishType, number>>;
  /**
   * Ringside personnel (§10). A poor or bought official pushes the screwy
   * finishes up; a devious manager pushes interference up.
   */
  ringsideWeights?: { screwy: number; interference: number; decisive?: number; hasOfficial?: boolean };
}

export function rollFinish(rng: Rng, ctx: FinishRollContext): FinishType {
  const entries: [FinishType, number][] = [];

  let cleanPin = 40;
  if (ctx.rules.ruleStrictness === 'strict') cleanPin += 15;
  entries.push(['cleanPin', cleanPin]);

  let submission = ctx.rules.falls === 'pinsOnly' ? 0 : 15;
  if (submission > 0 && ctx.winnerIsTechnician) submission *= 3;
  entries.push(['submission', submission]);

  let knockout = 8;
  if (ctx.violenceLevel >= 3) knockout *= 2;
  entries.push(['knockout', knockout]);

  let rollup = 8;
  if (ctx.isUpset) rollup *= 2.5;
  entries.push(['rollup', rollup]);

  entries.push(['interference', 6]);

  // DESIGN: §11.3 gives disqualification "×3 under strict + interference";
  // read as strict rules alone tripling the base weight here, since a
  // planted run-in is its own separate 'interference' finish entry above
  // (the deck-stacking system that plants run-ins is M4).
  let disqualification = ctx.rules.ruleStrictness === 'none' ? 0 : 6;
  if (disqualification > 0 && ctx.rules.ruleStrictness === 'strict') disqualification *= 3;
  entries.push(['disqualification', disqualification]);

  const countOut = ctx.rules.countOuts === 'none' ? 0 : 5;
  entries.push(['countOut', countOut]);

  let timeLimitDraw = ctx.rules.timeLimit > 0 ? 4 : 0;
  if (timeLimitDraw > 0 && ctx.isCloselyMatched) timeLimitDraw *= 3;
  entries.push(['timeLimitDraw', timeLimitDraw]);

  let doubleKO = 2;
  if (ctx.violenceLevel >= 4) doubleKO *= 2;
  entries.push(['doubleKO', doubleKO]);

  // Steel Cage only — climbing over or walking out the door, before either
  // side's shoulders ever hit the mat. Zero for every other stipulation, so
  // this can never surface anywhere it wasn't explicitly booked.
  const escape = ctx.rules.aim === 'escape' ? 5 : 0;
  entries.push(['escape', escape]);

  // Somebody has to make the call. With nobody in the shirt there is no
  // stoppage available, however badly one is needed.
  const refereeStoppage =
    ctx.rules.stoppage !== 'none' && (ctx.ringsideWeights?.hasOfficial ?? true) ? 3 : 0;
  entries.push(['refereeStoppage', refereeStoppage]);

  // Rare at baseline, and climbing fast with violence and bad blood.
  const injuryStoppage = 1.2 * (ctx.injuryMultiplier ?? 1) ** 2;
  entries.push(['injuryStoppage', injuryStoppage]);

  const stipulationWeighted = ctx.finishWeights
    ? entries.map(([finish, weight]) => [finish, weight * (ctx.finishWeights![finish] ?? 1)] as [FinishType, number])
    : entries;

  const ringside = ctx.ringsideWeights;
  // Finishes that need somebody to make them official. Without a referee
  // these get hard to reach and the messy ones take their place — which is
  // what "the match got out of hand" actually looks like in the results.
  const NEEDS_AN_OFFICIAL: FinishType[] = ['cleanPin', 'submission', 'rollup', 'refereeStoppage'];

  const weighted = ringside
    ? stipulationWeighted.map(([finish, weight]) => {
        if (finish === 'disqualification' || finish === 'countOut') return [finish, weight * ringside.screwy] as [FinishType, number];
        if (finish === 'interference') return [finish, weight * ringside.interference] as [FinishType, number];
        if (NEEDS_AN_OFFICIAL.includes(finish)) {
          return [finish, weight * (ringside.decisive ?? 1)] as [FinishType, number];
        }
        return [finish, weight] as [FinishType, number];
      })
    : stipulationWeighted;

  const positive = weighted.filter(([, weight]) => weight > 0);
  // A stipulation can zero out every finish the rules would otherwise have
  // allowed (submission-only rules crossed with a tables match, say). Falling
  // back to a knockout keeps the sim total — someone has to win.
  if (positive.length === 0) return 'knockout';
  return weightedPick(rng, positive);
}

/** Non-decisive finishes (DQ, count-out, draw) cut popularity transfer to 30% and add rivalry heat, §11.3/§12. */
export function isNonDecisiveFinish(finish: FinishType): boolean {
  return finish === 'disqualification' || finish === 'countOut' || isDrawFinish(finish);
}


/** A draw finish has no winner at all — distinct from a non-decisive-but-still-a-winner DQ/count-out. */
export function isDrawFinish(finish: FinishType): boolean {
  return finish === 'timeLimitDraw' || finish === 'doubleKO';
}
