// A show that outspends the §14 expense cap used to have the overflow
// simply vanish — computeShowExpenseSplit's `deferred` was computed and
// discarded. This exercises the real thing: an oversized venue leaves a
// promotion carrying debt into next week, and it does not forgive itself
// until there is room under the cap to pay it down. See
// Promotion.deferredShowDebt and the resolveWeek wiring around
// computeShowExpenseSplit in store.ts.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';

function freshSettings(overrides: Partial<ReturnType<typeof defaultWorldSettings>> = {}) {
  return {
    ...defaultWorldSettings(),
    seed: 'deferred-show-debt-store-test',
    startingRosterSize: 16,
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
    paperworkLockoutChancePerWeek: 0,
    ...overrides,
  };
}

function newGame(overrides: Partial<ReturnType<typeof defaultWorldSettings>> = {}) {
  useGameStore.getState().newGame(freshSettings(overrides));
}

function runWeek() {
  useGameStore.getState().autoFillCard();
  useGameStore.getState().resolveWeek();
  if (useGameStore.getState().world?.pendingWeatherCall) {
    useGameStore.getState().answerWeatherCall('runIt');
  }
}

describe('deferred show debt', () => {
  beforeEach(() => newGame());

  it('starts at zero for a fresh promotion', () => {
    expect(useGameStore.getState().world!.promotion.deferredShowDebt ?? 0).toBe(0);
  });

  it('carries a real debt when a show badly outspends what the cap will let it pay', () => {
    // A small, cheap opening roster booked into the biggest room in the
    // game — rent and crew alone dwarf anything this promotion can draw.
    useGameStore.getState().setVenue('domeStadium');
    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.promotion.deferredShowDebt ?? 0).toBeGreaterThan(0);
    expect(world.weeklyNews.some((n) => n.kind === 'business' && n.week === world.week && /rolls over as debt/.test(n.text))).toBe(
      true,
    );
  });

  it('keeps growing week over week while the overspending continues, rather than quietly resetting', () => {
    useGameStore.getState().setVenue('domeStadium');
    runWeek();
    const afterOne = useGameStore.getState().world!.promotion.deferredShowDebt ?? 0;
    expect(afterOne).toBeGreaterThan(0);

    runWeek();
    const afterTwo = useGameStore.getState().world!.promotion.deferredShowDebt ?? 0;
    expect(afterTwo).toBeGreaterThan(0);
  });

  it('pays itself down, and announces it, once the promotion stops overspending', () => {
    useGameStore.getState().setVenue('domeStadium');
    runWeek();
    const debtBefore = useGameStore.getState().world!.promotion.deferredShowDebt ?? 0;
    expect(debtBefore).toBeGreaterThan(0);

    // Back to a room the promotion can actually afford.
    useGameStore.getState().setVenue('schoolGym');
    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.promotion.deferredShowDebt ?? 0).toBeLessThan(debtBefore);
  });
});
