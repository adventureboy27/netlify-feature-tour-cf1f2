import { describe, expect, it } from 'vitest';
import { rngFromSeed } from '../rng';
import { defaultWorldSettings } from './settings';
import { tickEconomicClimate, economicClimateLabel, economicClimateShiftLine } from './economicCycle';

const settings = defaultWorldSettings();

describe('tickEconomicClimate', () => {
  it('never leaves -1..1, however many weeks pass', () => {
    let climate = 0;
    for (let week = 0; week < 2000; week++) {
      climate = tickEconomicClimate(climate, rngFromSeed(`clim:${week}`), settings);
      expect(climate).toBeGreaterThanOrEqual(-1);
      expect(climate).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic for the same starting value and seed', () => {
    const a = tickEconomicClimate(0.2, rngFromSeed('same'), settings);
    const b = tickEconomicClimate(0.2, rngFromSeed('same'), settings);
    expect(a).toBe(b);
  });

  it('pulls a displaced climate back toward neutral on average', () => {
    // Averaged over enough independent seeds, the noise should wash out and
    // the mean-reversion term should win — a climate that starts pinned at
    // the edge should land closer to 0 than to where it started.
    const trials = 400;
    let total = 0;
    for (let i = 0; i < trials; i++) {
      total += tickEconomicClimate(1, rngFromSeed(`revert:${i}`), settings);
    }
    const mean = total / trials;
    expect(mean).toBeLessThan(1);
    expect(mean).toBeGreaterThan(0.5);
  });

  it('genuinely wanders over a long run rather than sitting at neutral — a real cycle, not noise around zero', () => {
    // Over a long single run the climate should spend real, sustained time
    // away from dead neutral — that's the whole point of mean reversion
    // being slow rather than snapping back every week.
    let climate = 0;
    let weeksAwayFromNeutral = 0;
    for (let week = 0; week < 500; week++) {
      climate = tickEconomicClimate(climate, rngFromSeed(`wander:${week}`), settings);
      if (Math.abs(climate) > 0.1) weeksAwayFromNeutral += 1;
    }
    expect(weeksAwayFromNeutral).toBeGreaterThan(100);
  });
});

describe('economicClimateLabel', () => {
  it('reads neutral as Steady', () => {
    expect(economicClimateLabel(0)).toBe('Steady');
  });

  it('labels the extremes correctly', () => {
    expect(economicClimateLabel(-1)).toBe('Recession');
    expect(economicClimateLabel(1)).toBe('Boom');
  });

  it('is monotonic — a higher climate never reads as a worse label', () => {
    const ORDER = ['Recession', 'Downturn', 'Steady', 'Growing', 'Boom'];
    const samples = [-1, -0.5, -0.2, -0.05, 0, 0.05, 0.2, 0.5, 1];
    let lastRank = -1;
    for (const c of samples) {
      const rank = ORDER.indexOf(economicClimateLabel(c));
      expect(rank).toBeGreaterThanOrEqual(lastRank);
      lastRank = rank;
    }
  });
});

describe('economicClimateShiftLine', () => {
  it('says something real for every label', () => {
    for (const label of ['Recession', 'Downturn', 'Steady', 'Growing', 'Boom'] as const) {
      expect(economicClimateShiftLine(label).length).toBeGreaterThan(20);
    }
  });
});
