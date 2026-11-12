import { describe, it, expect } from 'vitest';
import {
  computeBuys,
  computeBuyRevenue,
  type BuysContext,
} from './calendar';
import { ppvCalendarFor, PPV_SETS, UNIVERSAL_PPV_NAMES } from '../../data/ppvNames';
import { defaultWorldSettings } from './settings';

const settings = defaultWorldSettings();

describe('signature events', () => {
  it('gives a promotion a calendar that sounds like it', () => {
    const hardcore = ppvCalendarFor('hardcore', 4, 0);
    expect(hardcore).toHaveLength(4);
    // The first ones come from the house's own set.
    const own = PPV_SETS.find((s) => s.archetype === 'hardcore')!.names;
    expect(own).toContain(hardcore[0]);
  });

  it('never runs dry', () => {
    for (const set of PPV_SETS) {
      const calendar = ppvCalendarFor(set.archetype, 12, 0);
      expect(calendar).toHaveLength(12);
      for (const name of calendar) expect(name.length).toBeGreaterThan(0);
    }
  });

  it('tops up from the universal pool when a house set runs out', () => {
    const long = ppvCalendarFor('hardcore', 8, 0);
    expect(long.some((name) => UNIVERSAL_PPV_NAMES.includes(name))).toBe(true);
  });

  it('gives a promotion enough names to fill its own year', () => {
    // Which week each of these lands on is the promotion's own decision now —
    // engine/world/schedule.ts owns the rotation and tests it there. What is
    // still this module's business is that the names exist and are distinct.
    const calendar = ppvCalendarFor('territory', settings.ppvCalendarSize, 0);
    expect(new Set(calendar).size).toBe(calendar.length);
  });

  it('gives different promotions different calendars', () => {
    const a = ppvCalendarFor('oldSchool', 4, 0);
    const b = ppvCalendarFor('oldSchool', 4, 2);
    expect(a).not.toEqual(b);
  });
});

describe('buys', () => {
  const ctxFor = (over: Partial<BuysContext> = {}): BuysContext => ({
    showRating: 70,
    companyRating: 60,
    heatOnTheCard: [50, 50],
    settings,
    ...over,
  });

  it('scales steeply with how big the company is', () => {
    const small = computeBuys(ctxFor({ companyRating: 30 }));
    const big = computeBuys(ctxFor({ companyRating: 90 }));
    // Three times the rating is far more than three times the buys.
    expect(big).toBeGreaterThan(small * 3);
  });

  it('rewards the build more than the night', () => {
    // Same show quality, wildly different heat going in.
    const cold = computeBuys(ctxFor({ heatOnTheCard: [0, 0] }));
    const hot = computeBuys(ctxFor({ heatOnTheCard: [100, 100] }));
    expect(hot).toBeGreaterThan(cold);

    // And the build term outweighs the quality term at the same swing.
    const goodShowNoHeat = computeBuys(ctxFor({ showRating: 100, heatOnTheCard: [0, 0] }));
    const badShowAllHeat = computeBuys(ctxFor({ showRating: 0, heatOnTheCard: [100, 100] }));
    expect(badShowAllHeat).toBeGreaterThan(goodShowNoHeat);
  });

  it('sells nothing for a promotion nobody has heard of', () => {
    expect(computeBuys(ctxFor({ companyRating: 0 }))).toBe(0);
  });

  it('copes with a card that had no feuds on it', () => {
    const buys = computeBuys(ctxFor({ heatOnTheCard: [] }));
    expect(buys).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(buys)).toBe(true);
  });

  it('turns buys into money', () => {
    expect(computeBuyRevenue(1000, settings)).toBe(1000 * settings.ppvBuyPrice);
    expect(computeBuyRevenue(0, settings)).toBe(0);
  });
});
