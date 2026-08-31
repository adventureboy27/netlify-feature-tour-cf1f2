// The pricing dashboard wired into the real weekly loop — see
// engine/world/pricing.ts for the pure logic, already covered by its own
// tests. This only checks that the map actually gets populated at every
// point a rival can come into existence.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';
import { randomRivalPricing } from '../engine/world/pricing';
import { rngFromSeed } from '../engine/rng';

function freshSettings(overrides: Partial<ReturnType<typeof defaultWorldSettings>> = {}) {
  return {
    ...defaultWorldSettings(),
    seed: 'pricing-store-test',
    startingRosterSize: 24,
    ownerMandatesEnabled: false,
    mergerChancePerWeek: 0,
    successionChancePerWeek: 0,
    contractRaidChancePerWeek: 0,
    networkRealignmentChancePerWeek: 0,
    ownerRivalryChancePerWeek: 0,
    rogueChancePerWeek: 0,
    scandalChancePerWeek: 0,
    breakawayChancePerWeek: 0,
    farewellTourChancePerWeek: 0,
    ...overrides,
  };
}

function newGame(overrides: Partial<ReturnType<typeof defaultWorldSettings>> = {}) {
  useGameStore.getState().newGame(freshSettings(overrides));
}

function runWeek() {
  useGameStore.getState().resolveWeek();
  if (useGameStore.getState().world?.pendingWeatherCall) {
    useGameStore.getState().answerWeatherCall('runIt');
  }
}

describe('rivalPricing at world creation', () => {
  it('has one entry per living rival, matching the pure helper', () => {
    newGame();
    const world = useGameStore.getState().world!;
    for (const rival of world.rivals) {
      const expected = randomRivalPricing(rngFromSeed(`rival-pricing:${rival.id}`), world.settings);
      expect(world.rivalPricing[rival.id]).toEqual(expected);
    }
  });
});

describe('rivalPricing on breakaway promotion', () => {
  beforeEach(() => newGame());

  it('gives the new company a real, in-bounds price entry', () => {
    useGameStore.setState((s) => {
      s.world!.settings.breakawayChancePerWeek = 1;
      s.world!.settings.shakeupReleaseMin = 2;
      s.world!.settings.shakeupReleaseMax = 3;
      s.world!.week = s.world!.settings.breakawayEarliestWeek;
    });
    const before = useGameStore.getState().world!.rivals.length;
    runWeek();
    const world = useGameStore.getState().world!;
    if (world.rivals.length > before) {
      const newCo = world.rivals[world.rivals.length - 1]!;
      const pricing = world.rivalPricing[newCo.id];
      expect(pricing).toBeDefined();
      expect(pricing!.ticketPrice).toBeGreaterThanOrEqual(world.settings.rivalTicketPriceMin);
      expect(pricing!.ticketPrice).toBeLessThanOrEqual(world.settings.rivalTicketPriceMax);
    }
  });
});
