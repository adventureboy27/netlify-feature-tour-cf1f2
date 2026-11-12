import { describe, it, expect } from 'vitest';
import {
  slotExpectedPopularities,
  saturationFromShow,
  decaySaturation,
  accrueSaturation,
} from './cardPosition';
import { TV_SLOT_WEIGHTS } from './showRating';
import { defaultWorldSettings } from '../world/settings';

const settings = defaultWorldSettings();
const band = {
  percentileMin: settings.slotExpectationPercentileMin,
  percentileMax: settings.slotExpectationPercentileMax,
};

const roster = [20, 30, 35, 40, 45, 50, 55, 60, 70, 85];

describe('slotExpectedPopularities', () => {
  it('returns one expectation per slot', () => {
    const expectations = slotExpectedPopularities({ rosterPopularities: roster, slotWeights: TV_SLOT_WEIGHTS, ...band });
    expect(expectations).toHaveLength(TV_SLOT_WEIGHTS.length);
  });

  it('expects more of the main event than of the opener', () => {
    const [opener, ...rest] = slotExpectedPopularities({
      rosterPopularities: roster,
      slotWeights: TV_SLOT_WEIGHTS,
      ...band,
    });
    const mainEvent = rest[rest.length - 1]!;
    expect(mainEvent).toBeGreaterThan(opener!);
  });

  it('rises monotonically up the card, matching the slot weights', () => {
    const expectations = slotExpectedPopularities({ rosterPopularities: roster, slotWeights: TV_SLOT_WEIGHTS, ...band });
    for (let i = 1; i < expectations.length; i++) {
      expect(expectations[i]!).toBeGreaterThanOrEqual(expectations[i - 1]!);
    }
  });

  it('scales to the roster it is given, not to an absolute number', () => {
    // The jobberDrag penalty has to mean the same thing in a territory
    // promotion as in a national one, or a small roster is permanently
    // penalised for main-eventing the best talent it has.
    const small = slotExpectedPopularities({
      rosterPopularities: [20, 25, 30, 35, 40],
      slotWeights: TV_SLOT_WEIGHTS,
      ...band,
    });
    const big = slotExpectedPopularities({
      rosterPopularities: [70, 75, 80, 85, 95],
      slotWeights: TV_SLOT_WEIGHTS,
      ...band,
    });
    expect(small[small.length - 1]!).toBeLessThan(big[big.length - 1]!);
    expect(small[small.length - 1]!).toBeLessThanOrEqual(40);
    expect(big[big.length - 1]!).toBeGreaterThanOrEqual(80);
  });

  it('stays inside the roster popularity range', () => {
    const expectations = slotExpectedPopularities({ rosterPopularities: roster, slotWeights: TV_SLOT_WEIGHTS, ...band });
    for (const value of expectations) {
      expect(value).toBeGreaterThanOrEqual(Math.min(...roster));
      expect(value).toBeLessThanOrEqual(Math.max(...roster));
    }
  });

  it('handles an empty roster and a single-slot card without blowing up', () => {
    expect(slotExpectedPopularities({ rosterPopularities: [], slotWeights: TV_SLOT_WEIGHTS, ...band })).toEqual(
      TV_SLOT_WEIGHTS.map(() => 0),
    );
    const single = slotExpectedPopularities({ rosterPopularities: roster, slotWeights: [1], ...band });
    expect(single).toHaveLength(1);
    expect(single[0]!).toBeGreaterThan(0);
  });
});

describe('hardcore saturation', () => {
  it('adds violenceLevel * perViolenceLevel for every segment', () => {
    expect(saturationFromShow([4, 2, 0], settings.hardcoreSaturationPerViolence)).toBe(36);
    expect(saturationFromShow([], settings.hardcoreSaturationPerViolence)).toBe(0);
  });

  it('caps at 100 and floors at 0', () => {
    expect(accrueSaturation(95, 40)).toBe(100);
    expect(decaySaturation(3, settings.hardcoreSaturationDecayPerWeek)).toBe(0);
  });

  it('produces diminishing returns — a hardcore-every-week promotion pegs at the ceiling', () => {
    // Two violence-4 matches a week is +48 against -8 decay, so it saturates
    // fast and then sits there: the fourth hardcore match in a month buys
    // nothing the first one didn't.
    const week = (start: number) =>
      decaySaturation(
        accrueSaturation(start, saturationFromShow([4, 4], settings.hardcoreSaturationPerViolence)),
        settings.hardcoreSaturationDecayPerWeek,
      );

    let saturation = 0;
    for (let i = 0; i < 10; i++) saturation = week(saturation);

    expect(saturation).toBe(100 - settings.hardcoreSaturationDecayPerWeek);
    expect(week(saturation)).toBe(saturation); // steady state, not still climbing
  });

  it('recovers to zero once the promotion lays off the weapons', () => {
    let saturation = 100;
    for (let week = 0; week < 20; week++) {
      saturation = decaySaturation(saturation, settings.hardcoreSaturationDecayPerWeek);
    }
    expect(saturation).toBe(0);
  });
});
