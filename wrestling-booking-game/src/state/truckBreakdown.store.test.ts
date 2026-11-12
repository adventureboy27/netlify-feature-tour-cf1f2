// The truck breaking down, wired into the real weekly loop — see
// engine/world/truckBreakdown.ts for the pure logic, already covered by its
// own tests.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';

const TEST_ROSTER_SIZE = 24;

function freshSettings() {
  return {
    ...defaultWorldSettings(),
    seed: 'truck-breakdown-store-test',
    startingRosterSize: TEST_ROSTER_SIZE,
    ownerMandatesEnabled: false,
    ringCallConditionFloor: 0, // keep the (unrelated) ring call out of these weeks
    truckBreakdownChancePerWeek: 1,
  };
}

function newGame() {
  useGameStore.getState().newGame(freshSettings());
}

beforeEach(newGame);

describe('the truck breaking down', () => {
  it('holds the week open until the promoter answers', () => {
    useGameStore.getState().resolveWeek();
    const world = useGameStore.getState().world!;
    expect(world.pendingTruckCall).not.toBeNull();
    expect(world.week).toBe(1); // the week that raised it, never advanced past it unanswered
  });

  it('calling it off never unlocks Arena Floor', () => {
    useGameStore.getState().resolveWeek();
    useGameStore.getState().answerTruckCall('cancelShow');
    const world = useGameStore.getState().world!;
    expect(world.pendingTruckCall).toBeNull();
    expect(world.unlockedStipulationIds).not.toContain('arenaFloor');
  });

  it('holding it on the arena floor unlocks Arena Floor for good', () => {
    useGameStore.getState().resolveWeek();
    useGameStore.getState().answerTruckCall('arenaFloor');
    const world = useGameStore.getState().world!;
    expect(world.pendingTruckCall).toBeNull();
    expect(world.unlockedStipulationIds).toContain('arenaFloor');
    expect(world.weeklyNews.some((n) => n.text.includes('Arena Floor is now a bookable match type'))).toBe(true);
  });
});
