// The "Chance card" pool, wired into the real weekly loop — see
// engine/world/moneyEvents.ts for the pure logic. Fires through the same
// single-story-per-week roll every other world story uses, so this only
// needs to check it dispatches correctly and stays inside its own clamp.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';

function freshSettings(overrides: Partial<ReturnType<typeof defaultWorldSettings>> = {}) {
  return {
    ...defaultWorldSettings(),
    seed: 'money-event-store-test',
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
    moneyEventChancePerWeek: 0,
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

describe('the money-event chance card', () => {
  beforeEach(() => newGame());

  it('does nothing before its own week gate, however certain the roll — below the gate, eligibility excludes it from the roll entirely, so it cannot even touch the RNG stream', () => {
    // Below the gate, eligibleForMoneyEvent filters the story out of the
    // roll before chance() ever runs for it — so chancePerWeek being 1
    // should make literally no difference to the outcome. Same seed, same
    // week, only the setting differs; the whole week should come out
    // bit-for-bit identical.
    newGame({ moneyEventChancePerWeek: 0 });
    useGameStore.setState((s) => {
      s.world!.week = s.world!.settings.moneyEventEarliestWeek - 2;
    });
    runWeek();
    const withOff = useGameStore.getState().world!;
    const bankOff = withOff.promotion.bankBalance;
    const newsCountOff = withOff.weeklyNews.length;

    newGame({ moneyEventChancePerWeek: 1 });
    useGameStore.setState((s) => {
      s.world!.week = s.world!.settings.moneyEventEarliestWeek - 2;
    });
    runWeek();
    const withOn = useGameStore.getState().world!;

    expect(withOn.promotion.bankBalance).toBe(bankOff);
    expect(withOn.weeklyNews.length).toBe(newsCountOff);
  });

  // The bank balance also moves from the week's ordinary business (gate,
  // payroll, overhead) at the same time, so the card's own contribution has
  // to be read off the wire line it posts rather than off the whole week's
  // bankBalance delta.
  function cardAmountFromNews(world: ReturnType<typeof useGameStore.getState>['world']) {
    const item = world!.weeklyNews.find((n) => n.kind === 'business' && n.week === world!.week && n.weight === 'minor');
    expect(item).toBeDefined();
    const match = item!.text.match(/\$([\d,]+)/);
    expect(match).not.toBeNull();
    return Number(match![1]!.replace(/,/g, ''));
  }

  it('announces a card once forced certain, on or after the gate, sized within the configured clamp', () => {
    useGameStore.setState((s) => {
      s.world!.settings.moneyEventChancePerWeek = 1;
      s.world!.week = s.world!.settings.moneyEventEarliestWeek;
    });
    runWeek();

    const world = useGameStore.getState().world!;
    const amount = cardAmountFromNews(world);
    expect(amount).toBeGreaterThanOrEqual(world.settings.moneyEventMinAmount);
    expect(amount).toBeLessThanOrEqual(world.settings.moneyEventMaxAmount);
  });

  it('never swings a large bank balance by more than the hard ceiling', () => {
    useGameStore.setState((s) => {
      s.world!.settings.moneyEventChancePerWeek = 1;
      s.world!.week = s.world!.settings.moneyEventEarliestWeek;
      s.world!.promotion.bankBalance = 5_000_000;
    });
    runWeek();
    const world = useGameStore.getState().world!;
    const amount = cardAmountFromNews(world);
    expect(amount).toBeLessThanOrEqual(world.settings.moneyEventMaxAmount);
  });

  it('can post a real loss without the grace-period bankruptcy check misfiring on a single card', () => {
    useGameStore.setState((s) => {
      s.world!.settings.moneyEventChancePerWeek = 1;
      s.world!.week = s.world!.settings.moneyEventEarliestWeek;
      // Comfortably solvent going in, so a single worst-case card cannot
      // plausibly tip a healthy promotion into the red on its own.
      s.world!.promotion.bankBalance = 500_000;
    });
    runWeek();
    const world = useGameStore.getState().world!;
    expect(world.promotion.bankBalance).toBeGreaterThan(0);
    expect(world.weeksInTheRed).toBe(0);
    expect(world.folded).toBeNull();
  });
});
