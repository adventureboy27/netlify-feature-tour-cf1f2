// The three D-slice world stories (networkRealignment, ownerRivalry,
// rogueTurn), wired into the real weekly loop — see engine/world/*.ts for
// the pure logic, already covered by their own tests.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';

function freshSettings(overrides: Partial<ReturnType<typeof defaultWorldSettings>> = {}) {
  return {
    ...defaultWorldSettings(),
    seed: 'world-stories-d-store-test',
    startingRosterSize: 20,
    ownerMandatesEnabled: false,
    mergerChancePerWeek: 0,
    successionChancePerWeek: 0,
    contractRaidChancePerWeek: 0,
    networkRealignmentChancePerWeek: 0,
    ownerRivalryChancePerWeek: 0,
    rogueChancePerWeek: 0,
    // The rest of the world-story registry, zeroed for real isolation. At
    // rogueEarliestWeek (80) every one of these is also old enough to be
    // "eligible," and chance() always draws from the shared rng stream even
    // at p=0 — so leaving any of them at their nonzero default both risks
    // weightedPick actually picking one of them instead of rogueTurn, and
    // (regardless of that risk) shifts every seeded roll after it.
    scandalChancePerWeek: 0,
    breakawayChancePerWeek: 0,
    farewellTourChancePerWeek: 0,
    pricingWarChancePerWeek: 0,
    paperworkLockoutChancePerWeek: 0,
    familyBusinessChancePerWeek: 0,
    breakfastBeltChancePerWeek: 0,
    moneyEventChancePerWeek: 0,
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

describe('networkRealignment', () => {
  beforeEach(() => newGame());

  it('does nothing before its own week gate, however certain the roll', () => {
    useGameStore.setState((s) => {
      s.world!.settings.networkRealignmentChancePerWeek = 1;
      s.world!.week = s.world!.settings.networkRealignmentEarliestWeek - 2;
    });
    runWeek();
    // Ordinary weekly rating drift is expected and not what this checks —
    // only that this specific story never raised its own headline.
    const world = useGameStore.getState().world!;
    expect(world.weeklyNews.some((n) => n.text.includes('television real estate'))).toBe(false);
  });

  it('moves a real rival rating and reports it on the wire', () => {
    useGameStore.setState((s) => {
      s.world!.settings.networkRealignmentChancePerWeek = 1;
      s.world!.week = s.world!.settings.networkRealignmentEarliestWeek;
    });
    const before = useGameStore.getState().world!.rivals.map((r) => r.rating);
    runWeek();
    const world = useGameStore.getState().world!;
    const after = world.rivals.map((r) => r.rating);
    expect(after).not.toEqual(before);
    expect(world.weeklyNews.some((n) => n.kind === 'business' && n.week === world.week)).toBe(true);
  });

  it('permanently marks the rival it happened to and cannot repeat for them', () => {
    useGameStore.setState((s) => {
      s.world!.settings.networkRealignmentChancePerWeek = 1;
      s.world!.week = s.world!.settings.networkRealignmentEarliestWeek;
    });
    runWeek();
    const world = useGameStore.getState().world!;
    const happened = world.worldStoryHappenedFor['networkRealignment'] ?? [];
    expect(happened).toHaveLength(1);
    expect(world.rivals.some((r) => r.id === happened[0])).toBe(true);
  });
});

describe('ownerRivalry', () => {
  beforeEach(() => newGame());

  it('does nothing before its own week gate', () => {
    useGameStore.setState((s) => {
      s.world!.settings.ownerRivalryChancePerWeek = 1;
      s.world!.week = s.world!.settings.ownerRivalryEarliestWeek - 2;
    });
    runWeek();
    const world = useGameStore.getState().world!;
    expect(world.weeklyNews.some((n) => n.text.includes('going at each other publicly'))).toBe(false);
  });

  it('moves two real rivals and reports it on the wire', () => {
    useGameStore.setState((s) => {
      s.world!.settings.ownerRivalryChancePerWeek = 1;
      s.world!.week = s.world!.settings.ownerRivalryEarliestWeek;
    });
    const before = useGameStore.getState().world!.rivals.map((r) => r.rating);
    runWeek();
    const world = useGameStore.getState().world!;
    const after = world.rivals.map((r) => r.rating);
    expect(after).not.toEqual(before);
    expect(world.weeklyNews.some((n) => n.kind === 'ownership' && n.week === world.week)).toBe(true);
  });

  it('permanently marks both rivals it happened to, on either side, and cannot repeat for them', () => {
    useGameStore.setState((s) => {
      s.world!.settings.ownerRivalryChancePerWeek = 1;
      s.world!.week = s.world!.settings.ownerRivalryEarliestWeek;
    });
    runWeek();
    const world = useGameStore.getState().world!;
    const happened = world.worldStoryHappenedFor['ownerRivalry'] ?? [];
    expect(happened).toHaveLength(2);
    for (const id of happened) expect(world.rivals.some((r) => r.id === id)).toBe(true);
  });
});

describe('rogueTurn', () => {
  beforeEach(() => newGame());

  it('does nothing before its own week gate', () => {
    useGameStore.setState((s) => {
      s.world!.settings.rogueChancePerWeek = 1;
      s.world!.week = s.world!.settings.rogueEarliestWeek - 2;
    });
    runWeek();
    expect(useGameStore.getState().world!.worldStoryHappenedFor['rogueTurn'] ?? []).toEqual([]);
  });

  it('permanently marks a real rival and cannot repeat for them', () => {
    useGameStore.setState((s) => {
      s.world!.settings.rogueChancePerWeek = 1;
      s.world!.week = s.world!.settings.rogueEarliestWeek;
    });
    runWeek();
    const world = useGameStore.getState().world!;
    const turned = world.worldStoryHappenedFor['rogueTurn'] ?? [];
    expect(turned).toHaveLength(1);
    expect(world.rivals.some((r) => r.id === turned[0])).toBe(true);
    expect(world.weeklyNews.some((n) => n.kind === 'business' && n.week === world.week)).toBe(true);
  });
});
