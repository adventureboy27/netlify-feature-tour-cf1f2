// Show rating and the TV ladder, booking-game-design.md §13.
// Only broadcast shows (tvTaping/ppv) move the ladder — house shows have
// no effect on it (§8: "no broadcast, so no effect on the TV ladder").

import { clamp } from '../rng';
import type { WorldSettings } from '../types';

export const TV_SLOT_WEIGHTS = [1.0, 1.1, 1.25, 1.4, 1.7, 2.4];

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

/**
 * The one 0-100 -> star conversion, used for both matches and shows.
 *
 * Quarter-star increments: a 3.75-star match and a 4-star match are
 * meaningfully different bookings, and half-stars flattened that distinction
 * away. 20 rating points to the star, rounded to the nearest quarter.
 */
const STAR_INCREMENT = 0.25;

export function ratingToStars(rating: number): number {
  const steps = 1 / STAR_INCREMENT;
  return Math.round((rating / 20) * steps) / steps;
}

/**
 * Show stars -> the company rating those shows are worth. Interpolated
 * linearly between anchors.
 *
 * DESIGN: §13's table reads 1★→60, 2★→70, 3★→80, 4★→90, 5★→100, and the
 * sentence directly under it says the ladder exists to "make consistency the
 * dominant strategy and make a bad month genuinely expensive to climb out
 * of". Measured against what the sim actually produces, the table defeats
 * that sentence completely:
 *
 *   - Median show on an auto-filled card, no player skill at all, is 2.5-3.25
 *     stars across every preset. That maps to a target of 75-83. Booking
 *     nothing but the default converged on rating 74 inside 22 weeks.
 *   - The floor is 60. A promotion putting on the worst show the sim can
 *     generate, every week forever, still climbs to 60/100. The bottom three
 *     fifths of the scale cannot be reached by being bad at the game.
 *
 * So a bad month costs nothing (you were heading to 80 regardless) and
 * consistency is not a strategy (it is the default outcome). §0 says to take
 * the harder, more interesting reading when the spec argues with itself, so
 * the anchors move to WorldSettings and rescale across the whole range,
 * slightly convex at the top:
 *
 *   3.0★ (ordinary) -> 50   mid-table; cannot rent the Civic Arena
 *   3.5★ (competent) -> 62  a real building
 *   4.0★ (strong)    -> 75  the Major Arena
 *   4.5★ (elite)     -> 87  the Domed Stadium is finally in reach
 *
 * Flagged per the §0 working agreement: this contradicts the §13 table as
 * written, in service of the paragraph that explains what the table is for.
 */
export function targetCompanyRatingForStars(stars: number, settings: WorldSettings): number {
  const anchors = settings.ratingLadderAnchors;
  const clamped = clamp(stars, anchors[0]![0], anchors[anchors.length - 1]![0]);
  for (let i = 0; i < anchors.length - 1; i++) {
    const [starLo, targetLo] = anchors[i]!;
    const [starHi, targetHi] = anchors[i + 1]!;
    if (clamped >= starLo && clamped <= starHi) {
      const t = (clamped - starLo) / (starHi - starLo);
      return targetLo + t * (targetHi - targetLo);
    }
  }
  return anchors[anchors.length - 1]![1];
}

/**
 * The company rating moves toward the target a point a week, or two after a
 * PPV (settings.ratingLadderStepPerWeek), §13.
 *
 * Falling is slower than climbing. §13 gives one speed for both, which was
 * survivable while the ladder's floor was 60 and nothing could really drop.
 * Once the anchors used the whole scale it stopped being: a promotion putting
 * on ordinary shows shed fifteen rating points in nine weeks, and because the
 * audience curve is steep that is an eighty-eight per cent collapse in the
 * gate. Companies folded inside ten weeks with the player given no time to
 * notice, let alone react. `fallMultiplier` slowed that flat per-week fall
 * down to fix it.
 *
 * That flat fall has its own failure mode at the other end, found playing a
 * save out past a year: a promotion that had spent months earning its way to
 * a 90+ rating, then ran a roster into the ground until shows were routinely
 * rating 0 (an empty card, no wrestlers left to fill it), still sat at 90+
 * twenty weeks later. A flat per-week fall does not care how big the gap is —
 * it takes exactly as long to correct a company that is 5 points optimistic
 * about itself as one that is 79. `fallProportional` adds a second term, a
 * share of the *gap itself*, so an ordinary bad patch (a small gap) still
 * corrects at roughly the old flat rate — the "time to notice and react"
 * promise above still holds — while a genuinely severe, sustained collapse
 * (the gap `fallMultiplier` was never big enough to touch) closes for real
 * within a normal campaign's timescale instead of staying numb to it for
 * over a year. The two terms are combined with the larger one winning, not
 * added, so a small gap is never charged both.
 */
export function stepCompanyRatingTowardTarget(
  current: number,
  target: number,
  stepPerWeek: number,
  isPPV: boolean,
  fallMultiplier = 1,
  fallProportional = 0,
): number {
  const step = isPPV ? stepPerWeek * 2 : stepPerWeek;
  if (current < target) return Math.min(target, current + step);
  if (current > target) {
    const gap = current - target;
    const flatFall = step * fallMultiplier;
    const proportionalFall = gap * fallProportional * (isPPV ? 2 : 1);
    return Math.max(target, current - Math.max(flatFall, proportionalFall));
  }
  return current;
}
