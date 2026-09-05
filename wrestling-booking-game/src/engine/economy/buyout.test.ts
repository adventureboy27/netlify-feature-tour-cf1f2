import { describe, it, expect } from 'vitest';
import { rollBuyoutTerms } from './buyout';
import { defaultWorldSettings } from '../world/settings';
import { rngFromSeed } from '../rng';

const settings = defaultWorldSettings();

describe('rolling a buyout offer', () => {
  it('never asks for the whole roster, and never for nobody', () => {
    for (let i = 0; i < 200; i++) {
      const rng = rngFromSeed(`roll-${i}`);
      const terms = rollBuyoutTerms(rng, 10_000, 20, settings);
      expect(terms.count).toBeGreaterThanOrEqual(1);
      expect(terms.count).toBeLessThan(20);
    }
  });

  it('stays sane against a tiny roster', () => {
    const terms = rollBuyoutTerms(rngFromSeed('tiny'), 2_000, 2, settings);
    expect(terms.count).toBe(1);
  });

  it('the price is anchored to payroll, not to the count', () => {
    // Same payroll, different rosters — the price should land in the same
    // rough band regardless of how many people are actually on it, since it
    // is never derived from who gets taken.
    const small = rollBuyoutTerms(rngFromSeed('price-a'), 10_000, 6, settings);
    const big = rollBuyoutTerms(rngFromSeed('price-b'), 10_000, 40, settings);
    const minPrice = 10_000 * settings.buyoutPriceMultiplierMin;
    const maxPrice = 10_000 * settings.buyoutPriceMultiplierMax;
    expect(small.price).toBeGreaterThanOrEqual(minPrice);
    expect(small.price).toBeLessThanOrEqual(maxPrice);
    expect(big.price).toBeGreaterThanOrEqual(minPrice);
    expect(big.price).toBeLessThanOrEqual(maxPrice);
  });

  it('is deterministic for the same seed', () => {
    const a = rollBuyoutTerms(rngFromSeed('same'), 8_000, 18, settings);
    const b = rollBuyoutTerms(rngFromSeed('same'), 8_000, 18, settings);
    expect(a).toEqual(b);
  });
});
