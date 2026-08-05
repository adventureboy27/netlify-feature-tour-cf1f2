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
import type { Wrestler, RatingBreakdownEntry, Stipulation } from '../types';
import { styleMeshScore } from '../../data/styles';
import { ratingToStars } from '../economy/showRating';

export interface MatchRatingContext {
  participants: Wrestler[];
  winProbability: number; // pFinal for the winning side — feeds the "balance" term
  isPPV: boolean;
  stipulation: Stipulation | null;
  requirementsMet: boolean;
  matchLengthMinutes: number;
  simVariance: number; // WorldSettings.simVariance

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
  pairChemistryBonus: number;
  overexposurePenalty: number;
}

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
  const avgWorkrate = mean(ctx.participants.map((p) => 0.45 * p.skill + 0.3 * p.agility + 0.25 * p.stamina));
  const avgCondition = mean(ctx.participants.map((p) => p.health)) / 100;

  const popComponent = term('Popularity', (avgPop / 100) * 42);
  const workComponent = term('Workrate', (avgWorkrate / 100) * 24 * (0.7 + 0.3 * avgCondition));

  const buckets = ctx.participants.map((p) => (p.alignment >= 15 ? 'face' : p.alignment <= -15 ? 'heel' : 'tween'));
  const hasFace = buckets.includes('face');
  const hasHeel = buckets.includes('heel');
  let chemistry = hasFace && hasHeel ? 13 : -6;
  chemistry += (ctx.rivalryHeat / 100) * 12;
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
  const pairChemistry = term('Pair chemistry', ctx.pairChemistryBonus);
  const overexposure = term('Overexposure', -Math.abs(ctx.overexposurePenalty));
  const hardcoreSaturation = term('Hardcore saturation', -(ctx.hardcoreSaturation / 100) * 12);
  const shootHeat = term('Bad blood', ctx.shootHeatBonus);

  // DESIGN: §11.4 references "expected length" for the boredom penalty
  // without a formula. Modeled as a popularity-scaled ceiling: an act with
  // avgPop 100 can hold 30 minutes, an act with avgPop 0 maybe 6.
  const supportedLengthMinutes = 6 + (avgPop / 100) * 24;
  const boredom = term(
    'Boredom',
    ctx.matchLengthMinutes > supportedLengthMinutes ? -(ctx.matchLengthMinutes - supportedLengthMinutes) * 0.8 : 0,
  );

  const mismatchedStipulation = term('Mismatched stipulation', ctx.stipulation && !ctx.requirementsMet ? -8 : 0);

  const jobberDrag = term(
    'Jobber drag',
    ctx.slotExpectedPopularity !== null && ctx.participants.some((p) => ctx.slotExpectedPopularity! - p.popularity >= 25)
      ? -5
      : 0,
  );

  const randomness = term('Randomness (off night / they clicked)', gaussian(rng, 0, ctx.simVariance));

  const total =
    popComponent +
    workComponent +
    chemistry +
    balance +
    styleMesh +
    stipulationBonus +
    instructionMod +
    territoryFit +
    pairChemistry +
    overexposure +
    hardcoreSaturation +
    shootHeat +
    boredom +
    mismatchedStipulation +
    jobberDrag +
    randomness;

  const rating = clamp(total, 3, 100);
  // Same conversion as the show rating — quarter stars, one source of truth.
  const stars = ratingToStars(rating);

  return { rating, stars, breakdown };
}
