// The general unlockables check, wired into the real weekly loop — see
// engine/world/unlocks.ts for the pure check, already covered by its own
// tests. This is only about resolveWeek actually calling it every week,
// with no random roll gating it.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';

function freshSettings(overrides: Partial<ReturnType<typeof defaultWorldSettings>> = {}) {
  return {
    ...defaultWorldSettings(),
    seed: 'unlocks-store-test',
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
    pricingWarChancePerWeek: 0,
    truckBreakdownChancePerWeek: 0,
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

describe('unlockables', () => {
  beforeEach(() => newGame());

  it('does not unlock anything on an ordinary fresh save', () => {
    runWeek();
    const world = useGameStore.getState().world!;
    expect(world.unlockedStipulationIds).not.toContain('fallsCountAnywhere');
    expect(world.unlockedStipulationIds).not.toContain('blindfoldMatch');
  });

  it('unlocks Falls Count Anywhere the moment company rating crosses the threshold, no dice involved', () => {
    useGameStore.setState((s) => {
      // Pinned at the ceiling rather than exactly on the threshold — an
      // ordinary week's own rating movement (from the show it just ran)
      // happens before this check does, and a value picked to just clear
      // 85 could drift back under it before the unlock check ever reads it.
      s.world!.promotion.rating = 100;
    });
    runWeek();
    const world = useGameStore.getState().world!;
    expect(world.unlockedStipulationIds).toContain('fallsCountAnywhere');
    expect(world.weeklyNews.some((n) => n.text.includes('Falls Count Anywhere') && n.week === world.week)).toBe(true);
  });

  it('never unlocks the same stipulation twice', () => {
    useGameStore.setState((s) => {
      s.world!.promotion.rating = 100;
    });
    runWeek();
    const countAfterFirst = useGameStore.getState().world!.unlockedStipulationIds.filter(
      (id) => id === 'fallsCountAnywhere',
    ).length;
    runWeek();
    const countAfterSecond = useGameStore.getState().world!.unlockedStipulationIds.filter(
      (id) => id === 'fallsCountAnywhere',
    ).length;
    expect(countAfterFirst).toBe(1);
    expect(countAfterSecond).toBe(1);
  });

  it('unlocks Blindfold Match once enough shows have been run', () => {
    useGameStore.setState((s) => {
      s.world!.showHistory = Array.from({ length: 100 }, (_, i) => ({ week: i + 1, segments: [] }) as any);
    });
    runWeek();
    const world = useGameStore.getState().world!;
    expect(world.unlockedStipulationIds).toContain('blindfoldMatch');
  });
});
