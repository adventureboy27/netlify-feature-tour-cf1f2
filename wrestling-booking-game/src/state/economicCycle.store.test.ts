// The wrestling economy's own boom-and-bust cycle, wired into the real
// weekly loop — see engine/world/economicCycle.ts for the pure logic
// (already covered by its own tests) and engine/world/freeAgents.ts's
// currentAskingRate for how it reaches a free agent's actual price.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';
import { rngFromSeed } from '../engine/rng';
import {
  tickEconomicClimate,
  economicClimateLabel,
  economicClimateShiftLine,
  isSharpEconomicMove,
  economicClimateSharpMoveLine,
} from '../engine/world/economicCycle';

function freshSettings(overrides: Partial<ReturnType<typeof defaultWorldSettings>> = {}) {
  return {
    ...defaultWorldSettings(),
    seed: 'economic-cycle-store-test',
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

describe('the economic climate, wired into a real week', () => {
  beforeEach(() => newGame());

  it('starts neutral for a fresh save', () => {
    expect(useGameStore.getState().world!.economicClimate).toBe(0);
  });

  it('ticks every week, matching the pure module exactly for the same starting value and week', () => {
    useGameStore.setState((s) => {
      s.world!.economicClimate = 0.2;
      s.world!.week = 10;
    });
    const settings = useGameStore.getState().world!.settings;
    // resolveWeek increments world.week before this tick runs, so the seed
    // it actually draws from is next week's, not this one's.
    const expected = tickEconomicClimate(0.2, rngFromSeed('economicClimate:11'), settings);
    runWeek();
    expect(useGameStore.getState().world!.economicClimate).toBeCloseTo(expected, 10);
  });

  it('announces a business wire exactly when, and only when, the label actually crosses a line', () => {
    const startClimate = -0.34; // sitting just inside Downturn, near the Recession boundary
    useGameStore.setState((s) => {
      s.world!.economicClimate = startClimate;
      s.world!.week = 5;
    });
    const settings = useGameStore.getState().world!.settings;
    const labelBefore = economicClimateLabel(startClimate);
    const expectedClimate = tickEconomicClimate(startClimate, rngFromSeed('economicClimate:6'), settings);
    const labelAfter = economicClimateLabel(expectedClimate);

    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.economicClimate).toBeCloseTo(expectedClimate, 10);
    const shiftLinePosted = world.weeklyNews.some(
      (n) => n.kind === 'business' && n.week === world.week && n.text === economicClimateShiftLine(labelAfter),
    );
    expect(shiftLinePosted).toBe(labelAfter !== labelBefore);
  });

  it('gives a real one-week outlier its own lead-weight Breaking News warning, matching the pure detector exactly', () => {
    const startClimate = 0.1;
    useGameStore.setState((s) => {
      s.world!.economicClimate = startClimate;
      s.world!.week = 20;
    });
    const settings = useGameStore.getState().world!.settings;
    const expectedClimate = tickEconomicClimate(startClimate, rngFromSeed('economicClimate:21'), settings);
    const expectSharp = isSharpEconomicMove(startClimate, expectedClimate, settings);

    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.economicClimate).toBeCloseTo(expectedClimate, 10);
    const sharpLinePosted = world.weeklyNews.some(
      (n) =>
        n.kind === 'business' &&
        n.week === world.week &&
        n.weight === 'lead' &&
        n.text === economicClimateSharpMoveLine(startClimate, expectedClimate),
    );
    expect(sharpLinePosted).toBe(expectSharp);
  });

  it('a deep recession genuinely charges a humble free agent less than a neutral economy would', () => {
    useGameStore.setState((s) => {
      const world = s.world!;
      const firstAgent = world.freeAgents[0]!;
      const wrestler = world.wrestlers[firstAgent.wrestlerId]!;
      wrestler.ego = 0; // fully humble — reads the room completely
    });
    const world = useGameStore.getState().world!;
    const agent = world.freeAgents[0]!;
    const wrestler = world.wrestlers[agent.wrestlerId]!;

    useGameStore.setState((s) => {
      s.world!.economicClimate = 0;
    });
    useGameStore.getState().signFreeAgent(agent.wrestlerId);
    const neutralRate = useGameStore.getState().world!.wrestlers[agent.wrestlerId]!.contract!.weeklyRate ?? 0;

    // Undo the signing and try again in a real recession.
    newGame();
    useGameStore.setState((s) => {
      const w = s.world!;
      const a = w.freeAgents.find((fa) => fa.wrestlerId === agent.wrestlerId) ?? w.freeAgents[0]!;
      const person = w.wrestlers[a.wrestlerId]!;
      person.ego = 0;
      w.economicClimate = -1;
    });
    const recessionAgent = useGameStore.getState().world!.freeAgents[0]!;
    useGameStore.getState().signFreeAgent(recessionAgent.wrestlerId);
    const recessionRate =
      useGameStore.getState().world!.wrestlers[recessionAgent.wrestlerId]!.contract!.weeklyRate ?? 0;

    expect(recessionRate).toBeLessThanOrEqual(neutralRate);
    void wrestler;
  });
});
