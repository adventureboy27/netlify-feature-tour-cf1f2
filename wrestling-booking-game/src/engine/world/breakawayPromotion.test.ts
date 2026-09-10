import { describe, it, expect } from 'vitest';
import { eligibleForBreakaway, pickBreakawaySource } from './breakawayPromotion';
import { defaultWorldSettings } from './settings';
import { defaultFanTaste } from './fanTaste';
import { rngFromSeed } from '../rng';
import type { Promotion } from '../types';

const settings = defaultWorldSettings();

function promotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 'rival-0',
    name: 'Atlas Pro',
    identity: 'athletic',
    fanTaste: defaultFanTaste('athletic'),
    isPlayer: false,
    rating: 60,
    bankBalance: 100_000,
    rosterIds: Array.from({ length: settings.breakawayMinRosterSize }, (_, i) => `w${i}`),
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
    ownerId: 'owner-rival-0',
    ownerPersonality: 'showman' as const,
    ppvCalendar: ['The Reckoning'],
    ...overrides,
  };
}

describe('eligibleForBreakaway', () => {
  it('will not fire before the week gate', () => {
    expect(eligibleForBreakaway(settings.breakawayEarliestWeek - 1, [promotion()], [], settings)).toBe(false);
  });

  it('will not fire against a roster too thin to spare a chunk of it', () => {
    const thin = promotion({ rosterIds: ['w1', 'w2'] });
    expect(eligibleForBreakaway(settings.breakawayEarliestWeek, [thin], [], settings)).toBe(false);
  });

  it('has nothing left once everybody has already had a breakaway', () => {
    const rivals = [promotion({ id: 'r1' }), promotion({ id: 'r2' })];
    expect(eligibleForBreakaway(settings.breakawayEarliestWeek, rivals, ['r1', 'r2'], settings)).toBe(false);
  });

  it('fires once the gate clears with a real, deep-enough rival', () => {
    expect(eligibleForBreakaway(settings.breakawayEarliestWeek, [promotion()], [], settings)).toBe(true);
  });
});

describe('pickBreakawaySource', () => {
  it('never picks somebody it has already happened to, or a roster too thin', () => {
    const rivals = [
      promotion({ id: 'r1' }),
      promotion({ id: 'r2' }),
      promotion({ id: 'r3', rosterIds: ['thin1', 'thin2'] }),
    ];
    for (let i = 0; i < 15; i++) {
      const picked = pickBreakawaySource(rngFromSeed(`pick-${i}`), rivals, ['r1'], settings);
      expect(picked.id).toBe('r2');
    }
  });
});
