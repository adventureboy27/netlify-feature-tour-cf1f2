import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rng';
import { generateWrestler } from '../generate/wrestler';
import { computeMatchRating, type MatchRatingContext } from './matchRating';

function baseContext(overrides: Partial<MatchRatingContext> = {}): MatchRatingContext {
  const rng = mulberry32(1);
  const a = generateWrestler(rng, new Set());
  const b = generateWrestler(rng, new Set());
  return {
    participants: [a, b],
    winProbability: 0.5,
    isPPV: false,
    stipulation: null,
    requirementsMet: true,
    matchLengthMinutes: 12,
    simVariance: 0, // deterministic for these tests
    finish: 'cleanPin',
    titlePrestige: null,
    rivalryHeat: 0,
    shootHeatBonus: 0,
    hardcoreSaturation: 0,
    slotExpectedPopularity: null,
    instructionModifier: 0,
    territoryFit: 0,
    pairChemistryBonus: 0,
    overexposurePenalty: 0,
    ...overrides,
  };
}

describe('computeMatchRating', () => {
  it('stays within [3, 100] and converts to a quarter-star rating within [0, 5]', () => {
    const rng = mulberry32(2);
    for (let i = 0; i < 100; i++) {
      const { rating, stars } = computeMatchRating(rng, baseContext({ simVariance: 6.5 }));
      expect(rating).toBeGreaterThanOrEqual(3);
      expect(rating).toBeLessThanOrEqual(100);
      expect(stars).toBeGreaterThanOrEqual(0);
      expect(stars).toBeLessThanOrEqual(5);
      expect((stars * 4) % 1).toBe(0); // quarter-star granularity
    }
  });

  it('rates higher for more popular, higher-workrate participants', () => {
    const rng = mulberry32(3);
    const strong = { ...generateWrestler(rng, new Set()), popularity: 95, skill: 95, agility: 90, stamina: 90, health: 100 };
    const weak = { ...generateWrestler(rng, new Set()), popularity: 10, skill: 10, agility: 10, stamina: 10, health: 100 };
    const highRating = computeMatchRating(rng, baseContext({ participants: [strong, strong] })).rating;
    const lowRating = computeMatchRating(rng, baseContext({ participants: [weak, weak] })).rating;
    expect(highRating).toBeGreaterThan(lowRating);
  });

  it('rewards a face/heel mix over two wrestlers of the same alignment', () => {
    const rng = mulberry32(4);
    const face = { ...generateWrestler(rng, new Set()), alignment: 80 };
    const heel = { ...generateWrestler(rng, new Set()), alignment: -80 };
    const otherFace = { ...face, id: 'other-face' };
    const mixed = computeMatchRating(rng, baseContext({ participants: [face, heel] })).rating;
    const sameAlignment = computeMatchRating(rng, baseContext({ participants: [face, otherFace] })).rating;
    expect(mixed).toBeGreaterThan(sameAlignment);
  });

  it('penalizes a mismatched stipulation', () => {
    const rng = mulberry32(5);
    const met = computeMatchRating(rng, baseContext({ stipulation: { id: 'ladder' } as never, requirementsMet: true })).rating;
    const unmet = computeMatchRating(rng, baseContext({ stipulation: { id: 'ladder' } as never, requirementsMet: false })).rating;
    expect(unmet).toBeLessThan(met);
  });

  it('penalizes jobber drag when a participant is far below the slot expectation', () => {
    const rng = mulberry32(6);
    const withoutDrag = computeMatchRating(rng, baseContext({ slotExpectedPopularity: null })).rating;
    const withDrag = computeMatchRating(rng, baseContext({ slotExpectedPopularity: 95 })).rating;
    expect(withDrag).toBeLessThanOrEqual(withoutDrag);
  });

  it('produces a breakdown entry for every term', () => {
    const rng = mulberry32(7);
    const { breakdown } = computeMatchRating(rng, baseContext());
    const labels = breakdown.map((b) => b.label);
    expect(labels).toContain('Popularity');
    expect(labels).toContain('Workrate');
    expect(labels).toContain('Chemistry');
    expect(labels).toContain('Balance');
  });
});
