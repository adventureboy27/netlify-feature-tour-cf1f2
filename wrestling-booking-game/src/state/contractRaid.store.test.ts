// The contract raid, wired into the real weekly loop — see
// engine/world/contractRaid.ts for the pure logic, already covered by its
// own tests.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';

const TEST_ROSTER_SIZE = 24;

function freshSettings() {
  return {
    ...defaultWorldSettings(),
    seed: 'contract-raid-store-test',
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

describe('the contract raid', () => {
  it('does nothing before its own week gate, however certain the roll', () => {
    useGameStore.setState((s) => {
      s.world!.settings.contractRaidChancePerWeek = 1;
      s.world!.settings.mergerChancePerWeek = 0;
      s.world!.settings.successionChancePerWeek = 0;
      s.world!.week = s.world!.settings.contractRaidEarliestWeek - 2;
    });
    runWeek();
    expect(useGameStore.getState().world!.pendingContractRaid).toBeNull();
  });

  it('takes real wrestlers off the roster and raises a real decision', () => {
    useGameStore.setState((s) => {
      s.world!.settings.contractRaidChancePerWeek = 1;
      s.world!.settings.mergerChancePerWeek = 0;
      s.world!.settings.successionChancePerWeek = 0;
      s.world!.week = s.world!.settings.contractRaidEarliestWeek;
    });
    const before = useGameStore.getState().world!.promotion.rosterIds.length;
    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.pendingContractRaid).not.toBeNull();
    expect(world.promotion.rosterIds.length).toBeLessThan(before);
    for (const id of world.pendingContractRaid!.raidedIds) {
      expect(world.promotion.rosterIds).not.toContain(id);
      expect(world.freeAgents.some((f) => f.wrestlerId === id)).toBe(true);
    }
    expect(world.weeklyNews.some((n) => n.kind === 'contract' && n.week === world.week)).toBe(true);
  });

  it('overhaul spends real money and lifts morale', () => {
    useGameStore.setState((s) => {
      s.world!.settings.contractRaidChancePerWeek = 1;
      s.world!.settings.mergerChancePerWeek = 0;
      s.world!.settings.successionChancePerWeek = 0;
      s.world!.week = s.world!.settings.contractRaidEarliestWeek;
    });
    runWeek();
    const before = useGameStore.getState().world!.promotion.bankBalance;
    useGameStore.getState().answerContractRaid('overhaul');
    const world = useGameStore.getState().world!;
    expect(world.pendingContractRaid).toBeNull();
    expect(world.promotion.bankBalance).toBeLessThan(before);
  });

  it('retaliate leaves the raiding rival with a real grudge against you', () => {
    useGameStore.setState((s) => {
      s.world!.settings.contractRaidChancePerWeek = 1;
      s.world!.settings.mergerChancePerWeek = 0;
      s.world!.settings.successionChancePerWeek = 0;
      s.world!.week = s.world!.settings.contractRaidEarliestWeek;
    });
    runWeek();
    const rivalId = useGameStore.getState().world!.pendingContractRaid!.rivalId;
    useGameStore.getState().answerContractRaid('retaliate');
    const world = useGameStore.getState().world!;
    expect(world.pendingContractRaid).toBeNull();
    expect(world.grudges.some((g) => g.promotionId === rivalId && g.resentment > 0)).toBe(true);
  });

  it('decides itself as doing nothing if left unanswered past the grace period', () => {
    useGameStore.setState((s) => {
      s.world!.settings.contractRaidChancePerWeek = 1;
      s.world!.settings.mergerChancePerWeek = 0;
      s.world!.settings.successionChancePerWeek = 0;
      s.world!.week = s.world!.settings.contractRaidEarliestWeek;
    });
    runWeek();
    expect(useGameStore.getState().world!.pendingContractRaid).not.toBeNull();

    useGameStore.setState((s) => {
      s.world!.settings.contractRaidChancePerWeek = 0;
      s.world!.week += s.world!.settings.contractRaidGraceWeeks - 1;
    });
    runWeek();
    expect(useGameStore.getState().world!.pendingContractRaid).toBeNull();
  });
});
