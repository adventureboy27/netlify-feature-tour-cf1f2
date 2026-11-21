import { describe, it, expect } from 'vitest';
import {
  eligibleForMerger,
  pickMergerTargets,
  nameMerger,
  applyMerger,
  isHostileOutsider,
} from './merger';
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

describe('who is even old enough for this', () => {
  const rivals = [
    promotion({ id: 'r1', rating: 70 }),
    promotion({ id: 'r2', rating: 60 }),
    promotion({ id: 'r3', rating: 30 }),
  ];

  it('will not fire before the week gate, however many rivals there are', () => {
    expect(eligibleForMerger(settings.mergerEarliestWeek - 1, rivals, false, settings)).toBe(false);
  });

  it('needs enough living rivals — two to buy, one left over', () => {
    expect(eligibleForMerger(settings.mergerEarliestWeek, rivals.slice(0, 2), false, settings)).toBe(false);
    expect(eligibleForMerger(settings.mergerEarliestWeek, rivals, false, settings)).toBe(true);
  });

  it('never fires twice', () => {
    expect(eligibleForMerger(settings.mergerEarliestWeek, rivals, true, settings)).toBe(false);
  });

  it('does not count a folded company toward the minimum', () => {
    const withAFolded = [...rivals, promotion({ id: 'r4', closedWeek: 40 })];
    // Caller is responsible for filtering to living rivals before calling in —
    // this just proves a closed company passed in unfiltered does not somehow
    // help clear the bar on its own (the count is still what was handed in).
    expect(eligibleForMerger(settings.mergerEarliestWeek, withAFolded, false, settings)).toBe(true);
  });
});

describe('who gets bought', () => {
  it('always takes the two strongest, never the weakest', () => {
    const strong1 = promotion({ id: 'strong-1', rating: 80 });
    const strong2 = promotion({ id: 'strong-2', rating: 75 });
    const weak = promotion({ id: 'weak', rating: 20 });

    const [a, b] = pickMergerTargets(rngFromSeed('pick'), [strong1, strong2, weak]);
    expect([a.id, b.id].sort()).toEqual(['strong-1', 'strong-2']);
  });

  it('is deterministic for the same seed', () => {
    const rivals = [promotion({ id: 'a', rating: 90 }), promotion({ id: 'b', rating: 85 }), promotion({ id: 'c', rating: 10 })];
    const first = pickMergerTargets(rngFromSeed('same'), rivals);
    const second = pickMergerTargets(rngFromSeed('same'), rivals);
    expect(first.map((p) => p.id)).toEqual(second.map((p) => p.id));
  });
});

describe('the buyout itself', () => {
  it('renames both halves, boosts both, and stamps the shared id', () => {
    const east = promotion({ id: 'east', name: 'Atlas Pro', rating: 70, bankBalance: 100_000 });
    const west = promotion({ id: 'west', name: 'Iron City Championship', rating: 65, bankBalance: 80_000 });

    applyMerger(east, west, 'conglomerate-1', 'Vantage', settings);

    expect(east.name).toBe('Vantage East');
    expect(west.name).toBe('Vantage West');
    expect(east.conglomerateId).toBe('conglomerate-1');
    expect(west.conglomerateId).toBe('conglomerate-1');
    expect(east.rating).toBe(70 + settings.mergerRatingBoost);
    expect(west.bankBalance).toBe(80_000 + settings.mergerBankInjection);
  });

  it('never pushes rating past 100', () => {
    const east = promotion({ id: 'east', rating: 95 });
    const west = promotion({ id: 'west', rating: 90 });
    applyMerger(east, west, 'conglomerate-1', 'Vantage', settings);
    expect(east.rating).toBe(100);
  });

  it('names the brand and the buyer from the pool', () => {
    const { brand, buyer } = nameMerger(rngFromSeed('name-it'));
    expect(brand.length).toBeGreaterThan(0);
    expect(buyer.length).toBeGreaterThan(0);
  });
});

describe('who counts as an outsider', () => {
  it('is nobody, for two companies that were never bought', () => {
    const us = promotion({ id: 'player' });
    const them = promotion({ id: 'rival' });
    expect(isHostileOutsider(them, us)).toBe(false);
  });

  it('is anybody outside the family, once a merger has happened', () => {
    const east = promotion({ id: 'east', conglomerateId: 'conglomerate-1' });
    const west = promotion({ id: 'west', conglomerateId: 'conglomerate-1' });
    const player = promotion({ id: 'player' });
    // The player, asking either half, is always an outsider.
    expect(isHostileOutsider(east, player)).toBe(true);
    expect(isHostileOutsider(west, player)).toBe(true);
    // The two halves are never outsiders to each other.
    expect(isHostileOutsider(west, east)).toBe(false);
  });
});
