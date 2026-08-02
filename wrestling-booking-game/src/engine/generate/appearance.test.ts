import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rng';
import { generateAppearance, appearanceHammingDistance, generateDistinctAppearance, MIN_DISTINCT_HAMMING_DISTANCE } from './appearance';

describe('generateAppearance', () => {
  it('produces values within the documented ranges', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 500; i++) {
      const a = generateAppearance(rng);
      expect(a.skinTone).toBeGreaterThanOrEqual(0);
      expect(a.skinTone).toBeLessThanOrEqual(11);
      expect(a.hairStyle).toBeGreaterThanOrEqual(0);
      expect(a.hairStyle).toBeLessThanOrEqual(23);
      expect(a.mask).toBeGreaterThanOrEqual(0);
      expect(a.mask).toBeLessThanOrEqual(11);
    }
  });
});

describe('appearanceHammingDistance', () => {
  it('is zero for identical appearances', () => {
    const rng = mulberry32(2);
    const a = generateAppearance(rng);
    expect(appearanceHammingDistance(a, { ...a })).toBe(0);
  });

  it('counts exactly the fields that differ', () => {
    const rng = mulberry32(3);
    const a = generateAppearance(rng);
    const b = { ...a, skinTone: a.skinTone === 0 ? 1 : 0, mask: a.mask === 0 ? 1 : 0 };
    expect(appearanceHammingDistance(a, b)).toBe(2);
  });
});

describe('generateDistinctAppearance', () => {
  it('stays at or above the minimum distance from every existing appearance', () => {
    const rng = mulberry32(4);
    const roster: ReturnType<typeof generateAppearance>[] = [];
    for (let i = 0; i < 150; i++) {
      const candidate = generateDistinctAppearance(rng, roster);
      for (const existing of roster) {
        expect(appearanceHammingDistance(candidate, existing)).toBeGreaterThanOrEqual(MIN_DISTINCT_HAMMING_DISTANCE);
      }
      roster.push(candidate);
    }
  });

  it('returns a valid appearance even with an empty roster', () => {
    const rng = mulberry32(5);
    const a = generateDistinctAppearance(rng, []);
    expect(a.skinTone).toBeGreaterThanOrEqual(0);
  });
});
