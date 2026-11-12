import { describe, it, expect } from 'vitest';
import { eligibleForSuccession, pickSuccessionTarget, rollHeirBranch, applySuccession } from './succession';
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

describe('who is old enough for this', () => {
  const rivals = [promotion({ id: 'r1' }), promotion({ id: 'r2' })];

  it('will not fire before the week gate', () => {
    expect(eligibleForSuccession(settings.successionEarliestWeek - 1, rivals, [], settings)).toBe(false);
  });

  it('fires once the gate clears and somebody hasn\'t already been through it', () => {
    expect(eligibleForSuccession(settings.successionEarliestWeek, rivals, [], settings)).toBe(true);
  });

  it('has nothing left once everybody has already had it happen', () => {
    expect(eligibleForSuccession(settings.successionEarliestWeek, rivals, ['r1', 'r2'], settings)).toBe(false);
  });

  it('can still happen to whoever is left, even if somebody already had theirs', () => {
    expect(eligibleForSuccession(settings.successionEarliestWeek, rivals, ['r1'], settings)).toBe(true);
  });
});

describe('who it happens to', () => {
  it('never picks somebody it has already happened to', () => {
    const rivals = [promotion({ id: 'r1' }), promotion({ id: 'r2' }), promotion({ id: 'r3' })];
    for (let i = 0; i < 20; i++) {
      const picked = pickSuccessionTarget(rngFromSeed(`pick-${i}`), rivals, ['r1', 'r2']);
      expect(picked.id).toBe('r3');
    }
  });
});

describe('which way it goes', () => {
  it('only ever produces a real branch', () => {
    const rng = rngFromSeed('branches');
    for (let i = 0; i < 30; i++) {
      expect(['steady', 'sharp', 'weak']).toContain(rollHeirBranch(rng));
    }
  });

  it('leaves a steady heir\'s company untouched', () => {
    const rival = promotion({ rating: 50, reputation: 50 });
    applySuccession(rival, 'steady', settings);
    expect(rival.rating).toBe(50);
    expect(rival.reputation).toBe(50);
  });

  it('makes a sharp heir\'s company genuinely stronger', () => {
    const rival = promotion({ rating: 50, reputation: 50 });
    applySuccession(rival, 'sharp', settings);
    expect(rival.rating).toBeGreaterThan(50);
    expect(rival.reputation).toBeGreaterThan(50);
  });

  it('costs a weak heir\'s company real ground', () => {
    const rival = promotion({ rating: 50, reputation: 50 });
    applySuccession(rival, 'weak', settings);
    expect(rival.rating).toBeLessThan(50);
    expect(rival.reputation).toBeLessThan(50);
  });

  it('never pushes rating or reputation out of bounds', () => {
    const high = promotion({ rating: 98, reputation: 98 });
    applySuccession(high, 'sharp', settings);
    expect(high.rating).toBeLessThanOrEqual(100);
    expect(high.reputation).toBeLessThanOrEqual(100);

    const low = promotion({ rating: 2, reputation: 2 });
    applySuccession(low, 'weak', settings);
    expect(low.rating).toBeGreaterThanOrEqual(0);
    expect(low.reputation).toBeGreaterThanOrEqual(0);
  });
});
