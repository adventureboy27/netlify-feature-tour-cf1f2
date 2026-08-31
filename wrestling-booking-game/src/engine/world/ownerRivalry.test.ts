import { describe, it, expect } from 'vitest';
import { eligibleForOwnerRivalry, pickOwnerRivalryPair, applyOwnerRivalry } from './ownerRivalry';
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
    ownerId: 'owner-rival-0',
    ownerPersonality: 'showman' as const,
    ppvCalendar: ['The Reckoning'],
    ...overrides,
  };
}

describe('eligibleForOwnerRivalry', () => {
  it('needs at least two living rivals', () => {
    expect(eligibleForOwnerRivalry(settings.ownerRivalryEarliestWeek, [promotion()], settings)).toBe(false);
    expect(
      eligibleForOwnerRivalry(settings.ownerRivalryEarliestWeek, [promotion({ id: 'a' }), promotion({ id: 'b' })], settings),
    ).toBe(true);
  });

  it('will not fire before the week gate', () => {
    const rivals = [promotion({ id: 'a' }), promotion({ id: 'b' })];
    expect(eligibleForOwnerRivalry(settings.ownerRivalryEarliestWeek - 1, rivals, settings)).toBe(false);
  });
});

describe('pickOwnerRivalryPair', () => {
  it('always picks two distinct rivals from the list', () => {
    const rivals = [promotion({ id: 'a' }), promotion({ id: 'b' }), promotion({ id: 'c' })];
    for (let i = 0; i < 10; i++) {
      const [x, y] = pickOwnerRivalryPair(rngFromSeed(`pick-${i}`), rivals);
      expect(x.id).not.toBe(y.id);
      expect(rivals.some((r) => r.id === x.id)).toBe(true);
      expect(rivals.some((r) => r.id === y.id)).toBe(true);
    }
  });
});

describe('applyOwnerRivalry', () => {
  it('leaves the winner better off and the loser worse off', () => {
    const a = promotion({ id: 'a', rating: 50 });
    const b = promotion({ id: 'b', rating: 50 });
    const outcome = applyOwnerRivalry(rngFromSeed('feud'), a, b, settings);
    expect(outcome.winner.rating).toBeGreaterThan(50);
    expect(outcome.loser.rating).toBeLessThan(50);
  });

  it('picks a winner from either side across enough rolls', () => {
    const wins = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const a = promotion({ id: 'a', rating: 50 });
      const b = promotion({ id: 'b', rating: 50 });
      const outcome = applyOwnerRivalry(rngFromSeed(`roll-${i}`), a, b, settings);
      wins.add(outcome.winner.id);
    }
    expect(wins.has('a')).toBe(true);
    expect(wins.has('b')).toBe(true);
  });
});
