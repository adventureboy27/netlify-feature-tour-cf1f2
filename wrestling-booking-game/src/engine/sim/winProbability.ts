// Win probability — booking-game-design.md §11.2.
// The [8%, 92%] clamp (settings.oddsClampMin/Max) is the rule that makes
// the game work: no combination of levers produces a certainty, §10.

import { clamp } from '../rng';

/** Two-side (singles, tag, etc.) win probability for side A. */
export function pairWinProbability(
  kayfabeA: number,
  kayfabeB: number,
  stackingShiftAPoints: number,
  oddsClampMin: number,
  oddsClampMax: number,
): number {
  const delta = kayfabeA - kayfabeB;
  const pRaw = 1 / (1 + Math.exp(-delta / 8));
  const p = pRaw + stackingShiftAPoints / 100;
  return clamp(p, oddsClampMin, oddsClampMax);
}

/**
 * Multi-man win probabilities: softmax over kayfabe scores (temperature 9),
 * deck-stacking shifts applied, each clamped to [0.03, 0.85], then
 * renormalized so they sum to 1.
 */
export function multiManWinProbabilities(
  kayfabeScores: number[],
  stackingShiftsPoints: number[],
  minClamp = 0.03,
  maxClamp = 0.85,
): number[] {
  const temperature = 9;
  const exps = kayfabeScores.map((k) => Math.exp(k / temperature));
  const total = exps.reduce((a, b) => a + b, 0);
  const raw = exps.map((e, i) => e / total + (stackingShiftsPoints[i] ?? 0) / 100);
  const clamped = raw.map((p) => clamp(p, minClamp, maxClamp));
  const sum = clamped.reduce((a, b) => a + b, 0);
  return clamped.map((p) => p / sum);
}
