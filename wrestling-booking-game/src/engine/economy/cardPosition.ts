// What the crowd expects from each slot on the card — booking-game-design.md
// §11.4's `jobberDrag` term ("-5 if any competitor's popularity is 25+ below
// the segment's slot expectation").
//
// The expectation is derived from the roster you actually have, not from a
// fixed popularity number. A territory promotion whose biggest star sits at
// 55 shouldn't be penalised for main-eventing them; the same booking in a
// promotion stacked with 90s is a genuinely thin main event. Slot weight is
// the ranking signal — it's already the measure of how much a slot matters
// (engine/economy/showRating.ts) — mapped onto a percentile of the roster's
// own popularity spread.

import { clamp } from '../rng';

export interface SlotExpectationContext {
  /** Popularity of everyone available to be booked. */
  rosterPopularities: number[];
  /** Slot weights for this show type, opener first. */
  slotWeights: number[];
  percentileMin: number; // WorldSettings.slotExpectationPercentileMin
  percentileMax: number; // WorldSettings.slotExpectationPercentileMax
}

/** Linear-interpolated quantile of a sorted-ascending list. */
function quantile(sortedAscending: number[], q: number): number {
  if (sortedAscending.length === 0) return 0;
  if (sortedAscending.length === 1) return sortedAscending[0]!;
  const position = clamp(q, 0, 1) * (sortedAscending.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sortedAscending[lower]! * (1 - weight) + sortedAscending[upper]! * weight;
}

/**
 * Expected popularity for each slot on the card, opener first.
 *
 * Returns one entry per slot weight. With a single-slot card there's no
 * spread to interpolate across, so that lone slot is the main event and takes
 * the top of the band.
 */
export function slotExpectedPopularities(ctx: SlotExpectationContext): number[] {
  const sorted = [...ctx.rosterPopularities].sort((a, b) => a - b);
  if (sorted.length === 0) return ctx.slotWeights.map(() => 0);

  const minWeight = Math.min(...ctx.slotWeights);
  const maxWeight = Math.max(...ctx.slotWeights);
  const weightSpread = maxWeight - minWeight;

  return ctx.slotWeights.map((weight) => {
    const position = weightSpread === 0 ? 1 : (weight - minWeight) / weightSpread;
    const percentile = ctx.percentileMin + position * (ctx.percentileMax - ctx.percentileMin);
    return quantile(sorted, percentile);
  });
}

// Promotion-level violence counter — §11.4 "Hardcore saturation is a
// promotion-level counter, 0-100. Each segment adds violenceLevel * 6; it
// decays 8/week. This reproduces the diminishing returns on weapons from the
// reference game."
//
// It's the whole weapons model: there are no chair or table objects, only how
// hard the promotion has been leaning on violence lately. Book three
// hardcore matches a week and the fourth stops paying.

export function saturationFromShow(violenceLevels: number[], perViolenceLevel: number): number {
  return violenceLevels.reduce((sum, level) => sum + level * perViolenceLevel, 0);
}

export function decaySaturation(current: number, decayPerWeek: number): number {
  return clamp(current - decayPerWeek, 0, 100);
}

export function accrueSaturation(current: number, added: number): number {
  return clamp(current + added, 0, 100);
}
