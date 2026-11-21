import { describe, it, expect } from 'vitest';
import { eligibleForRogueTurn, pickRogueTarget, applyRogueTurn } from './rogueTurn';
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

describe('eligibleForRogueTurn', () => {
  it('will not fire before the week gate', () => {
    expect(eligibleForRogueTurn(settings.rogueEarliestWeek - 1, [promotion()], [], settings)).toBe(false);
  });

  it('has nothing left once everybody has already gone rogue', () => {
    const rivals = [promotion({ id: 'r1' }), promotion({ id: 'r2' })];
    expect(eligibleForRogueTurn(settings.rogueEarliestWeek, rivals, ['r1', 'r2'], settings)).toBe(false);
  });

  it('can still happen to whoever is left', () => {
    const rivals = [promotion({ id: 'r1' }), promotion({ id: 'r2' })];
    expect(eligibleForRogueTurn(settings.rogueEarliestWeek, rivals, ['r1'], settings)).toBe(true);
  });
});

describe('pickRogueTarget', () => {
  it('never picks somebody it has already happened to', () => {
    const rivals = [promotion({ id: 'r1' }), promotion({ id: 'r2' }), promotion({ id: 'r3' })];
    for (let i = 0; i < 15; i++) {
      const picked = pickRogueTarget(rngFromSeed(`pick-${i}`), rivals, ['r1', 'r2']);
      expect(picked.id).toBe('r3');
    }
  });
});

describe('applyRogueTurn', () => {
  it('permanently raises violence tolerance', () => {
    const rival = promotion({ styleProfile: { preferredStyles: [], violenceTolerance: 40, workrateVsStarPower: 50, divisionFocus: ['mens'], promoHeavy: false } });
    applyRogueTurn(rngFromSeed('rogue'), rival, settings);
    expect(rival.styleProfile.violenceTolerance).toBeGreaterThan(40);
  });

  it('can swing rating either way', () => {
    const swings = new Set<boolean>();
    for (let i = 0; i < 30; i++) {
      const rival = promotion();
      const outcome = applyRogueTurn(rngFromSeed(`swing-${i}`), rival, settings);
      swings.add(outcome.ratingSwing >= 0);
    }
    expect(swings.has(true)).toBe(true);
    expect(swings.has(false)).toBe(true);
  });
});
