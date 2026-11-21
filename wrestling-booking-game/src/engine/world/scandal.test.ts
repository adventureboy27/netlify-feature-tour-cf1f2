import { describe, it, expect } from 'vitest';
import { eligibleForScandal, pickScandalTarget, applyScandal } from './scandal';
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

describe('eligibleForScandal', () => {
  it('will not fire before the week gate', () => {
    expect(eligibleForScandal(settings.scandalEarliestWeek - 1, [promotion()], [], settings)).toBe(false);
  });

  it('has nothing left once everybody has already had one', () => {
    const rivals = [promotion({ id: 'r1' }), promotion({ id: 'r2' })];
    expect(eligibleForScandal(settings.scandalEarliestWeek, rivals, ['r1', 'r2'], settings)).toBe(false);
  });

  it('can still happen to whoever is left', () => {
    const rivals = [promotion({ id: 'r1' }), promotion({ id: 'r2' })];
    expect(eligibleForScandal(settings.scandalEarliestWeek, rivals, ['r1'], settings)).toBe(true);
  });
});

describe('pickScandalTarget', () => {
  it('never picks somebody it has already happened to', () => {
    const rivals = [promotion({ id: 'r1' }), promotion({ id: 'r2' }), promotion({ id: 'r3' })];
    for (let i = 0; i < 15; i++) {
      const picked = pickScandalTarget(rngFromSeed(`pick-${i}`), rivals, ['r1', 'r2']);
      expect(picked.id).toBe('r3');
    }
  });
});

describe('applyScandal', () => {
  it('costs real rating and reputation, never a gain', () => {
    const rival = promotion({ rating: 60, reputation: 60 });
    applyScandal(rival, settings);
    expect(rival.rating).toBeLessThan(60);
    expect(rival.reputation).toBeLessThan(60);
  });

  it('never pushes below zero', () => {
    const rival = promotion({ rating: 2, reputation: 2 });
    applyScandal(rival, settings);
    expect(rival.rating).toBeGreaterThanOrEqual(0);
    expect(rival.reputation).toBeGreaterThanOrEqual(0);
  });
});
