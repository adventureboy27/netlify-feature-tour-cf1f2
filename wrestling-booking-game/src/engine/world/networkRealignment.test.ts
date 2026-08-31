import { describe, it, expect } from 'vitest';
import { eligibleForNetworkRealignment, pickNetworkRealignmentTarget, applyNetworkRealignment } from './networkRealignment';
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

describe('eligibleForNetworkRealignment', () => {
  it('will not fire before the week gate', () => {
    expect(eligibleForNetworkRealignment(settings.networkRealignmentEarliestWeek - 1, [promotion()], settings)).toBe(false);
  });

  it('will not fire with no living rival', () => {
    expect(eligibleForNetworkRealignment(settings.networkRealignmentEarliestWeek, [], settings)).toBe(false);
  });

  it('fires once the gate clears with a real rival', () => {
    expect(eligibleForNetworkRealignment(settings.networkRealignmentEarliestWeek, [promotion()], settings)).toBe(true);
  });
});

describe('applyNetworkRealignment', () => {
  it('can swing either direction, never a guaranteed win', () => {
    const swings = new Set<boolean>();
    for (let i = 0; i < 30; i++) {
      const rival = promotion();
      const outcome = applyNetworkRealignment(rngFromSeed(`swing-${i}`), rival, settings);
      swings.add(outcome.ratingSwing >= 0);
    }
    expect(swings.has(true)).toBe(true);
    expect(swings.has(false)).toBe(true);
  });

  it('never pushes rating out of bounds', () => {
    const high = promotion({ rating: 99 });
    for (let i = 0; i < 20; i++) applyNetworkRealignment(rngFromSeed(`hi-${i}`), high, settings);
    expect(high.rating).toBeLessThanOrEqual(100);

    const low = promotion({ rating: 1 });
    for (let i = 0; i < 20; i++) applyNetworkRealignment(rngFromSeed(`lo-${i}`), low, settings);
    expect(low.rating).toBeGreaterThanOrEqual(0);
  });

  it('always picks a rival actually in the list', () => {
    const rivals = [promotion({ id: 'r1' }), promotion({ id: 'r2' })];
    for (let i = 0; i < 10; i++) {
      const picked = pickNetworkRealignmentTarget(rngFromSeed(`pick-${i}`), rivals);
      expect(rivals.some((r) => r.id === picked.id)).toBe(true);
    }
  });
});
