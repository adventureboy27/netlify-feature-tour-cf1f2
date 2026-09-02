// A show that outspends the §14 expense cap used to have the overflow
// simply vanish — computeShowExpenseSplit's `deferred` was computed and
// discarded. The first fix folded old debt back into the next week's own
// cap-checked total, which sounded stricter but wasn't: once debt was large
// enough to fill whatever room was left under the cap, it stopped costing
// anything further, and a promotion could book the biggest room in the game
// every week forever for free — the debt number climbed into the millions
// while the bank stayed solvent, found by deliberately trying to bankrupt a
// save. This exercises the real fix: old debt bypasses the cap entirely and
// is due in full the very next week, the same "cannot be deferred" rule the
// active loan already uses, so it can never grow past one week's own
// overflow. See Promotion.deferredShowDebt and the resolveWeek wiring around
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
    breakfastBeltChancePerWeek: 0,
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

  it('does not compound past one week of overflow, even while the overspending continues', () => {
    // Under the old (broken) design this grew unboundedly across repeated
    // reckless weeks — found live, in a deliberate attempt to bankrupt a
    // save: $14.7M of "debt" by week 61 that never cost the bank a thing.
    // Now each week's own fresh overflow is what carries forward, not a
    // running total, so two identical reckless weeks land in the same
    // ballpark rather than one dwarfing the other.
    useGameStore.getState().setVenue('domeStadium');
    runWeek();
    const afterOne = useGameStore.getState().world!.promotion.deferredShowDebt ?? 0;
    expect(afterOne).toBeGreaterThan(0);

    runWeek();
    const afterTwo = useGameStore.getState().world!.promotion.deferredShowDebt ?? 0;
    expect(afterTwo).toBeGreaterThan(0);
    expect(afterTwo).toBeLessThan(afterOne * 3);
  });

  it('charges old debt as a real, unconditional bill the very next week — a genuine cash hit, not just a number', () => {
    useGameStore.getState().setVenue('domeStadium');
    runWeek();
    const debtOwed = useGameStore.getState().world!.promotion.deferredShowDebt ?? 0;
    expect(debtOwed).toBeGreaterThan(0);

    // Switch to a room the promotion can actually afford, so this week's own
    // fresh costs are small — whatever the bank loses beyond that has to be
    // last week's debt actually being paid.
    useGameStore.getState().setVenue('schoolGym');
    const bankBefore = useGameStore.getState().world!.promotion.bankBalance;
    runWeek();

    const world = useGameStore.getState().world!;
    const bankDrop = bankBefore - world.promotion.bankBalance;
    // A cheap room's own costs are a few thousand at most; anything close to
    // or beyond the size of the old debt has to be that debt actually
    // clearing, not a coincidence of a bad house.
    expect(bankDrop).toBeGreaterThan(debtOwed * 0.5);
    expect(world.promotion.deferredShowDebt ?? 0).toBe(0);
    expect(
      world.weeklyNews.some((n) => n.kind === 'business' && n.week === world.week && /got paid off in full this week/.test(n.text)),
    ).toBe(true);
  });

  it('announces both halves the same week when a payoff and a fresh overspend land together', () => {
    useGameStore.getState().setVenue('domeStadium');
    runWeek();
    expect(useGameStore.getState().world!.promotion.deferredShowDebt ?? 0).toBeGreaterThan(0);

    // Still reckless — this week both pays off what was owed AND digs a new hole.
    runWeek();

    const world = useGameStore.getState().world!;
    const thisWeeksNews = world.weeklyNews.filter((n) => n.kind === 'business' && n.week === world.week);
    expect(thisWeeksNews.some((n) => /got paid off in full this week/.test(n.text))).toBe(true);
    expect(thisWeeksNews.some((n) => /rolls over as debt/.test(n.text))).toBe(true);
  });
});
