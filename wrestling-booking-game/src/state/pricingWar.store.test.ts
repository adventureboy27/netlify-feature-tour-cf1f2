// The billionaire pricing war, wired into the real weekly loop — see
// engine/world/pricingWar.ts for the pure logic, already covered by its own
// tests. Needs a real conglomerate rival first, so every test here triggers
// the merger to get one before testing the war itself.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';

function freshSettings(overrides: Partial<ReturnType<typeof defaultWorldSettings>> = {}) {
  return {
    ...defaultWorldSettings(),
    seed: 'pricing-war-store-test',
    startingRosterSize: 24,
    ownerMandatesEnabled: false,
    successionChancePerWeek: 0,
    contractRaidChancePerWeek: 0,
    networkRealignmentChancePerWeek: 0,
    ownerRivalryChancePerWeek: 0,
    rogueChancePerWeek: 0,
    scandalChancePerWeek: 0,
    breakawayChancePerWeek: 0,
    farewellTourChancePerWeek: 0,
    pricingWarChancePerWeek: 0,
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

function triggerMerger() {
  useGameStore.setState((s) => {
    s.world!.settings.mergerChancePerWeek = 1;
    s.world!.week = s.world!.settings.mergerEarliestWeek;
  });
  runWeek();
  useGameStore.setState((s) => {
    s.world!.settings.mergerChancePerWeek = 0;
  });
}

describe('the billionaire pricing war', () => {
  beforeEach(() => newGame());

  it('does nothing before a conglomerate exists, however certain the roll', () => {
    useGameStore.setState((s) => {
      s.world!.settings.pricingWarChancePerWeek = 1;
      s.world!.week = s.world!.settings.pricingWarEarliestWeek;
    });
    runWeek();
    expect(useGameStore.getState().world!.pricingWar).toBeNull();
  });

  it('slashes a real conglomerate rival, boosts their rating, and announces it', () => {
    triggerMerger();
    const world0 = useGameStore.getState().world!;
    const conglomerateRivals = world0.rivals.filter((r) => r.conglomerateId);
    expect(conglomerateRivals).toHaveLength(2);
    // Either half can be picked as the war's target — record both, then
    // compare against whichever one actually gets chosen below.
    const priceBeforeById = new Map(conglomerateRivals.map((r) => [r.id, world0.rivalPricing[r.id]!]));
    const ratingBeforeById = new Map(conglomerateRivals.map((r) => [r.id, r.rating]));

    useGameStore.setState((s) => {
      s.world!.settings.pricingWarChancePerWeek = 1;
      s.world!.week = s.world!.settings.pricingWarEarliestWeek;
    });
    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.pricingWar).not.toBeNull();
    const target = world.rivals.find((r) => r.id === world.pricingWar!.rivalId)!;
    expect(target.conglomerateId).toBeTruthy();
    expect(target.rating).toBeGreaterThan(ratingBeforeById.get(target.id)!);

    const priceBefore = priceBeforeById.get(target.id)!;
    const priceAfter = world.rivalPricing[target.id]!;
    expect(priceAfter.ticketPrice).toBeLessThan(priceBefore.ticketPrice);
    expect(priceAfter.merchPrice).toBeLessThan(priceBefore.merchPrice);
    expect(priceAfter.ppvPrice).toBeLessThan(priceBefore.ppvPrice);
    expect(world.weeklyNews.some((n) => n.kind === 'business' && n.week === world.week)).toBe(true);
  });

  it('never starts a second war while one is already running', () => {
    triggerMerger();
    useGameStore.setState((s) => {
      s.world!.settings.pricingWarChancePerWeek = 1;
      s.world!.week = s.world!.settings.pricingWarEarliestWeek;
    });
    runWeek();
    const rivalId = useGameStore.getState().world!.pricingWar!.rivalId;
    runWeek();
    expect(useGameStore.getState().world!.pricingWar!.rivalId).toBe(rivalId);
  });

  it('reverts to a fresh price and clears after its duration runs out', () => {
    triggerMerger();
    useGameStore.setState((s) => {
      s.world!.settings.pricingWarChancePerWeek = 1;
      s.world!.settings.pricingWarDurationWeeks = 2;
      s.world!.week = s.world!.settings.pricingWarEarliestWeek;
    });
    runWeek();
    const rivalId = useGameStore.getState().world!.pricingWar!.rivalId;
    useGameStore.setState((s) => {
      s.world!.settings.pricingWarChancePerWeek = 0;
    });

    runWeek();
    expect(useGameStore.getState().world!.pricingWar).not.toBeNull();
    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.pricingWar).toBeNull();
    expect(world.rivalPricing[rivalId]).toBeDefined();
    expect(world.weeklyNews.some((n) => n.kind === 'business' && n.week === world.week)).toBe(true);
  });
});
