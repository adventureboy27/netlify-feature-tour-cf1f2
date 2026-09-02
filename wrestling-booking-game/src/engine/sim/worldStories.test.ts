import { describe, it, expect } from 'vitest';
import { eligibleWorldStories, rollWorldStory, type WorldStoryContext } from './worldStories';
import { defaultWorldSettings } from '../world/settings';
import { defaultFanTaste } from '../world/fanTaste';
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

function ctxFor(overrides: Partial<WorldStoryContext> = {}): WorldStoryContext {
  return {
    week: 1,
    livingRivals: [],
    mergerHappened: false,
    successionHappenedFor: [],
    happenedFor: {},
    pricingWarActive: false,
    paperworkLockoutActive: false,
    familyBusinessActive: false,
    settings,
    ...overrides,
  };
}

describe('the pool', () => {
  it('offers nothing at all before any story is old enough', () => {
    const rivals = [promotion({ id: 'r1' }), promotion({ id: 'r2' }), promotion({ id: 'r3' })];
    expect(eligibleWorldStories(ctxFor({ week: 1, livingRivals: rivals }))).toEqual([]);
  });

  it('offers succession once its own gate clears, well before the merger\'s', () => {
    const rivals = [promotion({ id: 'r1' }), promotion({ id: 'r2' })];
    const ids = eligibleWorldStories(
      ctxFor({ week: settings.successionEarliestWeek, livingRivals: rivals }),
    ).map((d) => d.id);
    expect(ids).toContain('succession');
    expect(ids).not.toContain('merger');
  });

  it('offers both once both gates have cleared and both have real targets', () => {
    const rivals = [promotion({ id: 'r1' }), promotion({ id: 'r2' }), promotion({ id: 'r3' })];
    const ids = eligibleWorldStories(
      ctxFor({ week: settings.mergerEarliestWeek, livingRivals: rivals }),
    ).map((d) => d.id);
    expect(ids).toContain('succession');
    expect(ids).toContain('merger');
  });
});

describe('rolling one', () => {
  it('never fires with nothing eligible', () => {
    const rng = rngFromSeed('nothing');
    for (let i = 0; i < 30; i++) {
      expect(rollWorldStory(rng, ctxFor({ week: 1, livingRivals: [] }))).toBeNull();
    }
  });

  it('only ever returns something actually eligible', () => {
    const rivals = [promotion({ id: 'r1' }), promotion({ id: 'r2' }), promotion({ id: 'r3' })];
    // Every story's own chance forced to certain, so this actually exercises
    // the whole pool rather than just the two oldest entries — the real
    // claim this test makes is "whatever comes back was eligible," not
    // "only these two ids ever exist."
    const ctx = ctxFor({
      week: settings.mergerEarliestWeek,
      livingRivals: rivals,
      settings: {
        ...settings,
        mergerChancePerWeek: 1,
        successionChancePerWeek: 1,
        networkRealignmentChancePerWeek: 1,
        ownerRivalryChancePerWeek: 1,
        rogueChancePerWeek: 1,
        scandalChancePerWeek: 1,
        breakawayChancePerWeek: 1,
        farewellTourChancePerWeek: 1,
      },
    });
    for (let i = 0; i < 30; i++) {
      const picked = rollWorldStory(rngFromSeed(`roll-${i}`), ctx);
      if (picked) expect(eligibleWorldStories(ctx).map((d) => d.id)).toContain(picked.id);
    }
  });
});
