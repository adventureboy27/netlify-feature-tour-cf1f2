// Match rating — booking-game-design.md §11.4.
//
// DESIGN: several inputs here belong to systems later than M2 — rivalry
// heat (M5), title prestige and pair chemistry / overexposure from match
// history (M3), hardcore saturation (a promotion-level counter, M3), deck-
// stacking instruction modifiers (M4), territory fit (M6). Each is a
// parameter on MatchRatingContext defaulting to a neutral value (0 or
// null) rather than baked into this function, so the formula is complete
// today and each system lights up its term the moment it lands — no
// rewrite needed here later.

import type { Rng } from '../rng';
import { gaussian, clamp } from '../rng';
import type { Wrestler, RatingBreakdownEntry, Stipulation, FinishType, WorldSettings } from '../types';
import { carried } from './ringcraft';
import { styleMeshScore } from '../../data/styles';
import { ratingToStars } from '../economy/showRating';

export interface MatchRatingContext {
  participants: Wrestler[];
  /** Needed by the terms that read tunables directly, e.g. carrying. */
  settings: WorldSettings;
  winProbability: number; // pFinal for the winning side — feeds the "balance" term
  isPPV: boolean;
  stipulation: Stipulation | null;
  requirementsMet: boolean;
  matchLengthMinutes: number;
  simVariance: number; // WorldSettings.simVariance
  /**
   * How the match actually ended. A crowd that has been given a draw, a
   * count-out or a stretcher job goes home unhappy however good the wrestling
   * was — and the better the match had been, the more they resent it.
   */
  finish: FinishType;

  titlePrestige: number | null;
  rivalryHeat: number;
  /**
   * Rating points from real backstage animosity (engine/sim/rivalry.ts).
   * Its own term rather than folded into chemistry so the breakdown panel
   * shows it: §11.5 requires the player can always see exactly why a match
   * rated what it did, and "these two actually hate each other" is the most
   * important thing that panel can tell them.
   */
  shootHeatBonus: number;
  hardcoreSaturation: number;
  slotExpectedPopularity: number | null;
  instructionModifier: number;
  territoryFit: number;
  /** How well these workers suit the company they are working for. */
  houseStyleFit: number;
  /**
   * Friends and enemies in the same match. Allies work a smoother, better
   * match; enemies work a stiffer, more dangerous one that the crowd can
   * feel. Positive either way — the difference between them is the injury
   * multiplier, not the rating.
   */
  relationshipHeat?: number;
  pairChemistryBonus: number;
  overexposurePenalty: number;
  /**
   * What a worn-out act costs. Separate from overexposure because they are
   * different problems with different fixes: a stale gimmick wants a
   * repackage, an overexposed one wants a night off.
   */
  staleGimmickPenalty?: number;
  /**
   * A belt defended the way it is meant to be, or not.
   *
   * Title.signatureStipulationId has existed since championships were built
   * and nothing ever read it, so a deathmatch title contested under normal
   * rules was worth exactly as much as one in a barbed-wire match. Positive
   * when the tradition is honoured, negative when it is ignored.
   */
  signatureStipulationFit?: number;
  /**
   * More match hardware in play is a bigger spectacle — diminishing per
   * extra unit. See engine/economy/matchProps.ts's spectacleBonus(). Traded
   * against compounding breakage odds, not shown here.
   */
  gearSpectacleBonus?: number;
  /** What the booker asked them to go out and do — see sim/pacing.ts. */
  paceBonus: number;
  /**
   * Hard ceiling the pace imposes. A sprint cannot produce a classic however
   * good the people in it are, which is the trade for how cheap it is.
   */
  paceCeiling: number;
}

/**
 * What each ending is worth to the people who paid to be there.
 *
 * The spread is deliberately wide. A clean decisive finish is the baseline
 * good night. A count-out is the worst thing you can send a crowd home on —
 * nothing happened, and they know it. An injury stoppage is worse than a bad
 * finish; it is not a finish at all.
 */
const FINISH_SATISFACTION: Record<FinishType, number> = {
  cleanPin: 3,
  submission: 3.5,
  knockout: 3,
  rollup: 1.5,
  refereeStoppage: -1,
  interference: -3,
  disqualification: -5.5,
  countOut: -7,
  timeLimitDraw: -4.5,
  doubleKO: -4,
  injuryStoppage: -9,
  // A Steel Cage escape is its own kind of decisive finish — the crowd sees
  // the whole climb, not just a cover. Rated with the other clean finishes.
  escape: 3.5,
  // Worse than a count-out fizzling out, but a real story rather than
  // nothing happening — the crowd saw something dramatic, it just wasn't a
  // finish.
  equipmentFailure: -6,
};

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export interface MatchRatingResult {
  rating: number; // 0-100 internal, clamped [3, 100]
  stars: number; // 0-5.0, quarter-star granularity
  breakdown: RatingBreakdownEntry[];
}

export function computeMatchRating(rng: Rng, ctx: MatchRatingContext): MatchRatingResult {
  const breakdown: RatingBreakdownEntry[] = [];
  const term = (label: string, value: number): number => {
    breakdown.push({ label, value });
    return value;
  };

  const avgPop = mean(ctx.participants.map((p) => p.popularity));
  const avgCondition = mean(ctx.participants.map((p) => p.health)) / 100;

  // What each of them brings, before anybody helps anybody.
  const rawWork = ctx.participants.map((p) => 0.45 * p.skill + 0.3 * p.agility + 0.25 * p.stamina);

  // And then the best hand in the match gets hold of it. This used to be a
  // flat mean, which is the arithmetic that made carrying impossible to
  // express: a limited opponent dragged a great worker down by exactly as much
  // however good the great worker was, so there was never a reason to put your
  // best technician opposite somebody who needed the help. See sim/ringcraft.ts.
  const lifted = carried(ctx.participants, rawWork, ctx.settings);
  const scaleWork = (value: number) =>
    (value / 100) * ctx.settings.matchRatingWorkrateWeight * (0.7 + 0.3 * avgCondition);

  const popComponent = term('Popularity', (avgPop / 100) * ctx.settings.matchRatingPopularityWeight);
  const workComponent = term('Workrate', scaleWork(mean(rawWork)));
  // Broken out rather than folded in, so the breakdown says who saved the
  // match rather than reporting a workrate nobody in it actually has.
  const carryComponent = term('Carried', scaleWork(mean(lifted.contributions)) - workComponent);

  const buckets = ctx.participants.map((p) => (p.alignment >= 15 ? 'face' : p.alignment <= -15 ? 'heel' : 'tween'));
  const hasFace = buckets.includes('face');
  const hasHeel = buckets.includes('heel');
  let chemistry = hasFace && hasHeel ? 13 : -6;
  chemistry += (ctx.rivalryHeat / 100) * ctx.settings.rivalryHeatRatingBonus;
  if (ctx.titlePrestige !== null) chemistry += (ctx.titlePrestige / 100) * 8;
  if (ctx.isPPV) chemistry += 4;
  term('Chemistry', chemistry);

  const isSquash = ctx.stipulation?.id === 'squash';
  const balanceRaw = 11 * (1 - Math.abs(ctx.winProbability - 0.5) * 2);
  const balance = term('Balance', isSquash ? -balanceRaw : balanceRaw);

  let meshSum = 0;
  let meshCount = 0;
  for (let i = 0; i < ctx.participants.length; i++) {
    for (let j = i + 1; j < ctx.participants.length; j++) {
      meshSum += styleMeshScore(ctx.participants[i]!.style, ctx.participants[j]!.style);
      meshCount++;
    }
  }
  const styleMesh = term('Style mesh', meshCount > 0 ? meshSum / meshCount : 0);

  const stipulationBonus = term('Stipulation', ctx.stipulation?.ratingBonus ?? 0);
  const instructionMod = term('Instruction', ctx.instructionModifier);
  const territoryFit = term('Territory fit', ctx.territoryFit);
  const houseStyle = term('House style', ctx.houseStyleFit);
  const relationships = term('History between them', ctx.relationshipHeat ?? 0);
  const pairChemistry = term('Pair chemistry', ctx.pairChemistryBonus);
  const overexposure = term('Overexposure', -Math.abs(ctx.overexposurePenalty));
  const staleGimmick = term('Stale act', -Math.abs(ctx.staleGimmickPenalty ?? 0));
  const signature = term('Signature', ctx.signatureStipulationFit ?? 0);
  const hardcoreSaturation = term('Hardcore saturation', -(ctx.hardcoreSaturation / 100) * 12);
  const shootHeat = term('Bad blood', ctx.shootHeatBonus);
  const pace = term('Pace', ctx.paceBonus);

  // DESIGN: §11.4 references "expected length" for the boredom penalty
  // without a formula. Modeled as a popularity-scaled ceiling: an act with
  // avgPop 100 can hold 30 minutes, an act with avgPop 0 maybe 6.
  const supportedLengthMinutes = 6 + (avgPop / 100) * 24;
  const boredom = term(
    'Boredom',
    ctx.matchLengthMinutes > supportedLengthMinutes ? -(ctx.matchLengthMinutes - supportedLengthMinutes) * 0.8 : 0,
  );

  const mismatchedStipulation = term('Mismatched stipulation', ctx.stipulation && !ctx.requirementsMet ? -8 : 0);
  const gearSpectacle = term('Gear spectacle', ctx.gearSpectacleBonus ?? 0);

  const jobberDrag = term(
    'Jobber drag',
    ctx.slotExpectedPopularity !== null && ctx.participants.some((p) => ctx.slotExpectedPopularity! - p.popularity >= 25)
      ? -5
      : 0,
  );

  // How it ended. Decisive finishes send people home happy; screwjobs,
  // draws and injuries do not — and the resentment scales with how good the
  // match was up to that point, so a screwjob wastes a great match harder
  // than it wastes a bad one. (§11.3 pays that back in rivalry heat: a
  // non-decisive finish builds twice the heat. That is the trade.)
  const satisfactionBase = FINISH_SATISFACTION[ctx.finish];
  const upToNow = popComponent + workComponent + carryComponent + chemistry + balance + styleMesh;
  const resentmentScale = satisfactionBase < 0 ? 1 + clamp(upToNow / 60, 0, 1) : 1;
  const finishSatisfaction = term('Finish', satisfactionBase * resentmentScale);

  const randomness = term('Randomness (off night / they clicked)', gaussian(rng, 0, ctx.simVariance));

  const total =
    popComponent +
    carryComponent +
    workComponent +
    chemistry +
    balance +
    styleMesh +
    stipulationBonus +
    instructionMod +
    territoryFit +
    houseStyle +
    relationships +
    pairChemistry +
    overexposure +
    staleGimmick +
    signature +
    hardcoreSaturation +
    shootHeat +
    pace +
    boredom +
    mismatchedStipulation +
    gearSpectacle +
    jobberDrag +
    finishSatisfaction +
    randomness;

  // The pace ceiling binds last, after everything else has been counted. A
  // sprint with two of the best in the world in it is still a sprint: it can
  // be the best short match you ever ran and it is not a classic.
  const rating = clamp(Math.min(total, ctx.paceCeiling), 3, 100);
  // Same conversion as the show rating — quarter stars, one source of truth.
  const stars = ratingToStars(rating);

  return { rating, stars, breakdown };
}
