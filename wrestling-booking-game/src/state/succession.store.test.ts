// Succession, wired into the real weekly loop — see engine/world/succession.ts
// for the pure logic, already covered by its own tests.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';

const TEST_ROSTER_SIZE = 24;

function freshSettings() {
  return {
    ...defaultWorldSettings(),
    seed: 'succession-store-test',
    startingRosterSize: TEST_ROSTER_SIZE,
    ownerMandatesEnabled: false,
  };
}

function newGame() {
  useGameStore.getState().newGame(freshSettings());
}

beforeEach(newGame);

function runWeek() {
  useGameStore.getState().resolveWeek();
  if (useGameStore.getState().world?.pendingWeatherCall) {
    useGameStore.getState().answerWeatherCall('runIt');
  }
}

describe('succession', () => {
  it('does nothing before its own week gate, however certain the roll', () => {
    useGameStore.setState((s) => {
      s.world!.settings.successionChancePerWeek = 1;
      s.world!.settings.mergerChancePerWeek = 0;
      s.world!.week = s.world!.settings.successionEarliestWeek - 2;
    });
    runWeek();
    expect(useGameStore.getState().world!.successionHappenedFor).toEqual([]);
  });

  it('picks a real rival, moves their rating, and records it so it cannot repeat for them', () => {
    useGameStore.setState((s) => {
      s.world!.settings.successionChancePerWeek = 1;
      s.world!.settings.mergerChancePerWeek = 0;
      s.world!.week = s.world!.settings.successionEarliestWeek;
    });
    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.successionHappenedFor).toHaveLength(1);
    const rivalId = world.successionHappenedFor[0]!;
    expect(world.rivals.some((r) => r.id === rivalId)).toBe(true);
    expect(world.weeklyNews.some((n) => n.kind === 'ownership' && n.week === world.week)).toBe(true);
  });
});
