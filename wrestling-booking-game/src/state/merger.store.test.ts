// The billionaire merger, wired into the real weekly loop — see
// engine/world/merger.ts for the pure logic, already covered by its own
// tests. This file is only about resolveWeek actually calling it correctly:
// gated by week, applied once, and announced.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';

const TEST_ROSTER_SIZE = 24;

function freshSettings() {
  return {
    ...defaultWorldSettings(),
    seed: 'merger-store-test',
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

describe('the billionaire merger', () => {
  it('does nothing before the week gate, however certain the roll', () => {
    useGameStore.setState((s) => {
      s.world!.settings.mergerChancePerWeek = 1;
      // resolveWeek increments world.week before this check runs, so start
      // two short of the gate to land one short of it.
      s.world!.week = s.world!.settings.mergerEarliestWeek - 2;
    });
    runWeek();
    expect(useGameStore.getState().world!.mergerHappened).toBe(false);
    expect(useGameStore.getState().world!.rivals.some((r) => r.conglomerateId)).toBe(false);
  });

  it('buys two rivals, renames and boosts both, tags them, and announces it', () => {
    const before = useGameStore.getState().world!;
    const ratingBefore = new Map(before.rivals.map((r) => [r.id, r.rating]));

    useGameStore.setState((s) => {
      s.world!.settings.mergerChancePerWeek = 1;
      s.world!.week = s.world!.settings.mergerEarliestWeek;
    });
    runWeek();

    const after = useGameStore.getState().world!;
    expect(after.mergerHappened).toBe(true);

    const merged = after.rivals.filter((r) => r.conglomerateId);
    expect(merged).toHaveLength(2);
    expect(merged[0]!.conglomerateId).toBe(merged[1]!.conglomerateId);
    expect(merged.map((r) => r.name).sort()).toEqual([
      `${merged[0]!.name.replace(/ (East|West)$/, '')} East`,
      `${merged[0]!.name.replace(/ (East|West)$/, '')} West`,
    ].sort());
    for (const r of merged) {
      expect(r.rating).toBeGreaterThan(ratingBefore.get(r.id)!);
    }
    expect(after.weeklyNews.some((n) => n.kind === 'business' && n.week === after.week)).toBe(true);
  });

  it('never fires twice — a second eligible week changes nothing further', () => {
    useGameStore.setState((s) => {
      s.world!.settings.mergerChancePerWeek = 1;
      s.world!.week = s.world!.settings.mergerEarliestWeek;
    });
    runWeek();
    const namesAfterFirst = useGameStore.getState().world!.rivals.map((r) => r.name).sort();

    runWeek();
    const namesAfterSecond = useGameStore.getState().world!.rivals.map((r) => r.name).sort();
    expect(namesAfterSecond).toEqual(namesAfterFirst);
  });
});
