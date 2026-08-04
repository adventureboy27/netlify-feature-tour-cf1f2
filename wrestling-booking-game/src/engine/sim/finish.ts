// Finish type roll — booking-game-design.md §11.3.

import type { Rng } from '../rng';
import { weightedPick } from '../rng';
import type { FinishType, MatchRules } from '../types';

export interface FinishRollContext {
  rules: MatchRules;
  violenceLevel: number; // from the stipulation, 0 if none
  winnerIsTechnician: boolean;
  isUpset: boolean; // the side that won was the underdog
  isCloselyMatched: boolean; // widens the time-limit-draw weight
  /**
   * Stipulation.finishWeights — multipliers applied after the rules-based
   * weights. A gimmick match with one legal way to win zeroes everything
   * else out, so a tables match cannot end in a clean pin.
   */
  finishWeights?: Partial<Record<FinishType, number>>;
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

  const refereeStoppage = ctx.rules.stoppage !== 'none' ? 3 : 0;
  entries.push(['refereeStoppage', refereeStoppage]);

  const weighted = ctx.finishWeights
    ? entries.map(([finish, weight]) => [finish, weight * (ctx.finishWeights![finish] ?? 1)] as [FinishType, number])
    : entries;

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
