import { describe, it, expect } from 'vitest';
import { randomRivalPricing, randomRivalPricingFor } from './pricing';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';

const settings = defaultWorldSettings();

describe('randomRivalPricing', () => {
  it('stays inside the configured bounds for every item', () => {
    for (let i = 0; i < 50; i++) {
      const p = randomRivalPricing(rngFromSeed(`seed-${i}`), settings);
      expect(p.ticketPrice).toBeGreaterThanOrEqual(settings.rivalTicketPriceMin);
      expect(p.ticketPrice).toBeLessThanOrEqual(settings.rivalTicketPriceMax);
      expect(p.merchPrice).toBeGreaterThanOrEqual(settings.rivalMerchPriceMin);
      expect(p.merchPrice).toBeLessThanOrEqual(settings.rivalMerchPriceMax);
      expect(p.ppvPrice).toBeGreaterThanOrEqual(settings.rivalPpvPriceMin);
      expect(p.ppvPrice).toBeLessThanOrEqual(settings.rivalPpvPriceMax);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = randomRivalPricing(rngFromSeed('rival-pricing:rival-7'), settings);
    const b = randomRivalPricing(rngFromSeed('rival-pricing:rival-7'), settings);
    expect(a).toEqual(b);
  });

  it('draws the three items independently — not a single correlated tier', () => {
    // Cheapest possible ticket band, most expensive possible merch band: if the
    // three items were drawn off one shared roll (a single cheap/mid/pricey
    // tier), a company that landed at the bottom of the ticket range could
    // never also land at the top of the merch range. Across enough seeds, a
    // real implementation finds at least one that does.
    let sawLowTicketHighMerch = false;
    const ticketMid = (settings.rivalTicketPriceMin + settings.rivalTicketPriceMax) / 2;
    const merchMid = (settings.rivalMerchPriceMin + settings.rivalMerchPriceMax) / 2;
    for (let i = 0; i < 200; i++) {
      const p = randomRivalPricing(rngFromSeed(`indep-${i}`), settings);
      if (p.ticketPrice < ticketMid && p.merchPrice > merchMid) {
        sawLowTicketHighMerch = true;
        break;
      }
    }
    expect(sawLowTicketHighMerch).toBe(true);
  });
});

describe('randomRivalPricingFor', () => {
  it('builds one entry per rival id, keyed correctly', () => {
    const map = randomRivalPricingFor(['rival-1', 'rival-2', 'rival-3'], settings);
    expect(Object.keys(map).sort()).toEqual(['rival-1', 'rival-2', 'rival-3']);
    for (const id of Object.keys(map)) {
      expect(map[id]!.ticketPrice).toBeGreaterThanOrEqual(settings.rivalTicketPriceMin);
    }
  });

  it('matches randomRivalPricing seeded off the same id', () => {
    const map = randomRivalPricingFor(['rival-9'], settings);
    const direct = randomRivalPricing(rngFromSeed('rival-pricing:rival-9'), settings);
    expect(map['rival-9']).toEqual(direct);
  });

  it('returns an empty map for no rivals', () => {
    expect(randomRivalPricingFor([], settings)).toEqual({});
  });
});
