import { describe, expect, it } from 'vitest';
import { pairWinProbability, multiManWinProbabilities } from './winProbability';

describe('pairWinProbability', () => {
  it('is 0.5 for equal kayfabe scores and no stacking', () => {
    expect(pairWinProbability(50, 50, 0, 0.08, 0.92)).toBeCloseTo(0.5, 5);
  });

  it('favors the higher-kayfabe side', () => {
    expect(pairWinProbability(80, 50, 0, 0.08, 0.92)).toBeGreaterThan(0.5);
    expect(pairWinProbability(50, 80, 0, 0.08, 0.92)).toBeLessThan(0.5);
  });

  it('never breaches the odds clamp regardless of how lopsided the gap is', () => {
    expect(pairWinProbability(1000, 0, 0, 0.08, 0.92)).toBeLessThanOrEqual(0.92);
    expect(pairWinProbability(0, 1000, 0, 0.08, 0.92)).toBeGreaterThanOrEqual(0.08);
  });

  it('deck-stacking shifts move the probability in the stacked direction', () => {
    const base = pairWinProbability(50, 50, 0, 0.08, 0.92);
    const stacked = pairWinProbability(50, 50, 20, 0.08, 0.92);
    expect(stacked).toBeGreaterThan(base);
  });
});

describe('multiManWinProbabilities', () => {
  it('sums to 1', () => {
    const probs = multiManWinProbabilities([50, 50, 50, 50], [0, 0, 0, 0]);
    const sum = probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('gives an equal split for equal scores', () => {
    const probs = multiManWinProbabilities([50, 50, 50, 50], [0, 0, 0, 0]);
    for (const p of probs) expect(p).toBeCloseTo(0.25, 2);
  });

  it('favors the highest-kayfabe participant', () => {
    const probs = multiManWinProbabilities([90, 50, 50, 50], [0, 0, 0, 0]);
    expect(probs[0]).toBeGreaterThan(probs[1]!);
  });

  it('respects the clamp range before renormalizing', () => {
    const probs = multiManWinProbabilities([1000, 0, 0, 0], [0, 0, 0, 0], 0.03, 0.85);
    // even the dominant participant can't exceed what the clamp + renormalization allows
    expect(Math.max(...probs)).toBeLessThanOrEqual(1);
    expect(Math.min(...probs)).toBeGreaterThan(0);
  });
});
