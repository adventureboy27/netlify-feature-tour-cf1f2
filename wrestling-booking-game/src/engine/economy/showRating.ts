// Show rating and the TV ladder, booking-game-design.md §13.
// Only broadcast shows (tvTaping/ppv) move the ladder — house shows have
// no effect on it (§8: "no broadcast, so no effect on the TV ladder").

import { clamp } from '../rng';

export const TV_SLOT_WEIGHTS = [1.0, 1.1, 1.25, 1.4, 1.7, 2.4];
export const PPV_SLOT_WEIGHTS = [0.8, 0.9, 1.0, 1.1, 1.25, 1.4, 1.6, 1.9, 2.3, 3.0];

/**
 * showRating = sum(segmentRating * slotWeight) / sum(allSlotWeights).
 * An unfilled segment (null) counts as rating 0 against the full
 * denominator — a short card is judged as if you'd filled it, §13.
 */
export function computeShowRating(segmentRatings: (number | null)[], slotWeights: number[]): number {
  const totalWeight = slotWeights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return 0;
  const weightedSum = segmentRatings.reduce<number>((sum, rating, i) => sum + (rating ?? 0) * (slotWeights[i] ?? 0), 0);
  return weightedSum / totalWeight;
}

/** Same 0-100 -> half-star conversion used everywhere ratings are displayed. */
export function ratingToStars(rating: number): number {
  return Math.round((rating / 20) * 2) / 2;
}

// §13 ladder table: show stars -> target company rating. Interpolated
// linearly for half-stars, per the spec.
const LADDER_ANCHORS: [stars: number, target: number][] = [
  [1, 60],
  [2, 70],
  [3, 80],
  [4, 90],
  [5, 100],
];

export function targetCompanyRatingForStars(stars: number): number {
  const clamped = clamp(stars, 1, 5);
  for (let i = 0; i < LADDER_ANCHORS.length - 1; i++) {
    const [starLo, targetLo] = LADDER_ANCHORS[i]!;
    const [starHi, targetHi] = LADDER_ANCHORS[i + 1]!;
    if (clamped >= starLo && clamped <= starHi) {
      const t = (clamped - starLo) / (starHi - starLo);
      return targetLo + t * (targetHi - targetLo);
    }
  }
  return LADDER_ANCHORS[LADDER_ANCHORS.length - 1]![1];
}

/**
 * The company rating moves 1 point/week toward the target, or 2 points
 * after a PPV (settings.ratingLadderStepPerWeek), §13.
 */
export function stepCompanyRatingTowardTarget(current: number, target: number, stepPerWeek: number, isPPV: boolean): number {
  const step = isPPV ? stepPerWeek * 2 : stepPerWeek;
  if (current < target) return Math.min(target, current + step);
  if (current > target) return Math.max(target, current - step);
  return current;
}
