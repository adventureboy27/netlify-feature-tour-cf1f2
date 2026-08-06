import { describe, it, expect } from 'vitest';
import {
  isPPVWeek,
  weeksUntilPPV,
  ppvNameForWeek,
  segmentsForWeek,
  computeBuys,
  computeBuyRevenue,
  type BuysContext,
} from './calendar';
import { ppvCalendarFor, PPV_SETS, UNIVERSAL_PPV_NAMES } from '../../data/ppvNames';
import { defaultWorldSettings } from './settings';

const settings = defaultWorldSettings();

describe('the calendar', () => {
  it('runs one pay-per-view a month and television the rest of the time', () => {
    const ppvWeeks = [];
    for (let week = 1; week <= 52; week++) if (isPPVWeek(week, settings)) ppvWeeks.push(week);
    expect(ppvWeeks).toEqual([4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52]);
  });

  it('counts down to the next one', () => {
    expect(weeksUntilPPV(4, settings)).toBe(0);
    expect(weeksUntilPPV(5, settings)).toBe(3);
    expect(weeksUntilPPV(7, settings)).toBe(1);
  });

  it('gives a bigger card on the night', () => {
    expect(segmentsForWeek(3, settings)).toBe(settings.segmentsPerTV);
    expect(segmentsForWeek(4, settings)).toBe(settings.segmentsPerPPV);
    expect(settings.segmentsPerPPV).toBeGreaterThan(settings.segmentsPerTV);
  });
});

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

  it('brings the same event round at the same point every year', () => {
    const calendar = ppvCalendarFor('territory', settings.ppvCalendarSize, 0);
    const weeksPerYear = settings.weeksBetweenPPVs * settings.ppvCalendarSize;
    // Whatever ran in week 4 runs again exactly one cycle later.
    expect(ppvNameForWeek(4, calendar, settings)).toBe(ppvNameForWeek(4 + weeksPerYear, calendar, settings));
    expect(ppvNameForWeek(8, calendar, settings)).not.toBe(ppvNameForWeek(4, calendar, settings));
  });

  it('has no name for a television week', () => {
    const calendar = ppvCalendarFor('athletic', 4, 0);
    expect(ppvNameForWeek(5, calendar, settings)).toBeNull();
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
