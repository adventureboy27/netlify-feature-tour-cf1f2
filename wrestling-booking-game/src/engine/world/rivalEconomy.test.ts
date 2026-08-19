import { describe, it, expect } from 'vitest';
import { rivalWeek, shouldFold, foldRisk } from './rivalEconomy';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';
import { generateWrestlers } from '../generate/wrestler';
import type { Promotion, Wrestler } from '../types';

const settings = defaultWorldSettings();

function promotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 'rival-0',
    name: 'Atlas Pro',
    identity: 'athletic',
    isPlayer: false,
    rating: 60,
    bankBalance: 1_000_000,
    rosterIds: [],
    titleIds: [],
    ownedTerritoryIds: [],
    homeTerritoryId: 'territory-unassigned',
    styleProfile: {
      preferredStyles: [],
      violenceTolerance: 50,
      workrateVsStarPower: 50,
      divisionFocus: ['mens'],
      promoHeavy: false,
    },
    bookingCredibility: 50,
    reputation: 60,
    hardcoreSaturation: 0,
    recentShowQuality: 60,
    weeksInTheRed: 0,
    closedWeek: null,
    ownerId: 'owner',
    ownerPersonality: 'showman' as const,
    ppvCalendar: ['The Reckoning'],
    ...overrides,
  };
}

function roster(count: number, popularity = 60): Wrestler[] {
  return generateWrestlers(rngFromSeed('auction'), count, { currentYear: 1985 }).map((w) => ({
    ...w,
    popularity,
    contract: { ...w.contract, weeklyRate: 300 } as Wrestler['contract'],
  }));
}

describe('a rival’s books', () => {
  it('makes real money at the top of the ladder and very little at the bottom', () => {
    const big = rivalWeek(promotion({ rating: 85, recentShowQuality: 75 }), roster(24), settings);
    const small = rivalWeek(promotion({ rating: 30, recentShowQuality: 40 }), roster(10), settings);
    expect(big.revenue).toBeGreaterThan(small.revenue * 5);
    expect(big.net).toBeGreaterThan(0);
  });

  it('punishes a big payroll on a bad run', () => {
    const bloated = rivalWeek(promotion({ rating: 35, recentShowQuality: 25 }), roster(26), settings);
    expect(bloated.net).toBeLessThan(0);
  });

  it('counts recent shows, not just standing', () => {
    const hot = rivalWeek(promotion({ rating: 60, recentShowQuality: 90 }), roster(15), settings);
    const cold = rivalWeek(promotion({ rating: 60, recentShowQuality: 20 }), roster(15), settings);
    expect(hot.revenue).toBeGreaterThan(cold.revenue);
  });
});

describe('closing the doors', () => {
  const base = { bankBalance: -100_000, companiesOpen: 7, settings };

  it('takes years of losses, not a bad quarter', () => {
    expect(shouldFold({ ...base, weeksInTheRed: 20 })).toBe(false);
    expect(shouldFold({ ...base, weeksInTheRed: 60 })).toBe(false);
    expect(shouldFold({ ...base, weeksInTheRed: settings.rivalBankruptcyGraceWeeks + 1 })).toBe(true);
  });

  it('never happens to a company that still has money', () => {
    expect(shouldFold({ ...base, bankBalance: 5, weeksInTheRed: 500 })).toBe(false);
  });

  it('never empties the business below the floor', () => {
    expect(
      shouldFold({ ...base, weeksInTheRed: 500, companiesOpen: settings.minimumPromotions }),
    ).toBe(false);
  });

  it('can be switched off entirely', () => {
    expect(
      shouldFold({ ...base, weeksInTheRed: 500, settings: { ...settings, rivalsCanGoBankrupt: false } }),
    ).toBe(false);
  });

  it('reads out how close they are', () => {
    expect(foldRisk(0, settings)).toBe('healthy');
    expect(foldRisk(10, settings)).toBe('struggling');
    expect(foldRisk(settings.rivalBankruptcyGraceWeeks - 5, settings)).toBe('inTrouble');
    expect(foldRisk(settings.rivalBankruptcyGraceWeeks + 1, settings)).toBe('closing');
  });
});
