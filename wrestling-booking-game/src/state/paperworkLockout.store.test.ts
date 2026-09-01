// The paperwork lockout, wired into the real weekly loop — see
// engine/world/paperworkLockout.ts for the pure logic, already covered by
// its own tests. Industry-wide, so no rival needs setting up first, unlike
// the pricing war's dependency on a conglomerate merger.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';

const TEST_ROSTER_SIZE = 24;

function freshSettings(overrides: Partial<ReturnType<typeof defaultWorldSettings>> = {}) {
  return {
    ...defaultWorldSettings(),
    seed: 'paperwork-lockout-store-test',
    startingRosterSize: TEST_ROSTER_SIZE,
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
  useGameStore.getState().resolveWeek();
  if (useGameStore.getState().world?.pendingWeatherCall) {
    useGameStore.getState().answerWeatherCall('runIt');
  }
}

describe('the paperwork lockout', () => {
  beforeEach(() => newGame());

  it('does nothing before its own week gate, however certain the roll', () => {
    useGameStore.setState((s) => {
      s.world!.settings.paperworkLockoutChancePerWeek = 1;
      s.world!.week = s.world!.settings.paperworkLockoutEarliestWeek - 2;
    });
    runWeek();
    expect(useGameStore.getState().world!.paperworkLockout).toBeNull();
  });

  it('freezes roughly the configured share across the whole business and announces it', () => {
    useGameStore.setState((s) => {
      s.world!.settings.paperworkLockoutChancePerWeek = 1;
      s.world!.week = s.world!.settings.paperworkLockoutEarliestWeek;
    });
    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.paperworkLockout).not.toBeNull();
    expect(world.paperworkLockout!.weeksRemaining).toBe(world.settings.paperworkLockoutDurationWeeks);

    const everyId = [...world.promotion.rosterIds, ...world.rivals.flatMap((r) => r.rosterIds)];
    const wrestlers = everyId.map((id) => world.wrestlers[id]!).filter((w) => w?.role === 'wrestler');
    const frozen = wrestlers.filter((w) => w.paperworkFrozen);
    expect(frozen.length).toBeGreaterThan(0);
    expect(frozen.length).toBeLessThan(wrestlers.length);
    const share = frozen.length / wrestlers.length;
    expect(share).toBeGreaterThan(world.settings.paperworkLockoutFreezeShare - 0.15);
    expect(share).toBeLessThan(world.settings.paperworkLockoutFreezeShare + 0.15);

    expect(world.weeklyNews.some((n) => n.kind === 'business' && n.week === world.week)).toBe(true);
  });

  it('never starts a second lockout while one is already running', () => {
    useGameStore.setState((s) => {
      s.world!.settings.paperworkLockoutChancePerWeek = 1;
      s.world!.week = s.world!.settings.paperworkLockoutEarliestWeek;
    });
    runWeek();
    const frozenIdsBefore = Object.values(useGameStore.getState().world!.wrestlers)
      .filter((w) => w?.paperworkFrozen)
      .map((w) => w!.id)
      .sort();
    runWeek();
    const frozenIdsAfter = Object.values(useGameStore.getState().world!.wrestlers)
      .filter((w) => w?.paperworkFrozen)
      .map((w) => w!.id)
      .sort();
    expect(frozenIdsAfter).toEqual(frozenIdsBefore);
  });

  it("pauses a frozen wrestler's contract clock and pay, while a cleared one's keeps running", () => {
    useGameStore.setState((s) => {
      s.world!.settings.paperworkLockoutChancePerWeek = 1;
      s.world!.week = s.world!.settings.paperworkLockoutEarliestWeek;
    });
    runWeek();

    const before = useGameStore.getState().world!;
    const roster = before.promotion.rosterIds.map((id) => before.wrestlers[id]!).filter(Boolean);
    const frozenBefore = roster.find((w) => w.paperworkFrozen && w.contract);
    const clearedBefore = roster.find((w) => !w.paperworkFrozen && w.contract);
    expect(frozenBefore).toBeDefined();
    expect(clearedBefore).toBeDefined();
    const frozenWeeksBefore = frozenBefore!.contract!.weeksRemaining;
    const frozenEarningsBefore = frozenBefore!.ledger?.earnings ?? 0;
    const clearedWeeksBefore = clearedBefore!.contract!.weeksRemaining;

    useGameStore.setState((s) => {
      s.world!.settings.paperworkLockoutChancePerWeek = 0;
    });
    runWeek();

    const after = useGameStore.getState().world!;
    const frozenAfter = after.wrestlers[frozenBefore!.id];
    const clearedAfter = after.wrestlers[clearedBefore!.id];
    // Might have expired and rolled to a fresh contract in the ordinary
    // course of things — only assert the pause if the same deal is still
    // there to compare.
    if (frozenAfter?.contract && frozenAfter.paperworkFrozen) {
      expect(frozenAfter.contract.weeksRemaining).toBe(frozenWeeksBefore);
    }
    expect(frozenAfter?.ledger?.earnings ?? 0).toBe(frozenEarningsBefore);
    if (clearedAfter?.contract) {
      expect(clearedAfter.contract.weeksRemaining).toBeLessThanOrEqual(clearedWeeksBefore);
    }
  });

  it('cannot be booked while frozen — auto-fill skips them', () => {
    useGameStore.setState((s) => {
      s.world!.settings.paperworkLockoutChancePerWeek = 1;
      s.world!.week = s.world!.settings.paperworkLockoutEarliestWeek;
    });
    runWeek();

    useGameStore.getState().autoFillCard();
    const world = useGameStore.getState().world!;
    const bookedIds = new Set(world.currentCard.flatMap((seg) => seg.participants.map((p) => p.wrestlerId)));
    for (const id of world.promotion.rosterIds) {
      const w = world.wrestlers[id];
      if (w?.paperworkFrozen) expect(bookedIds.has(id)).toBe(false);
    }
  });

  it('refuses to manually book a frozen wrestler, on the main card or in a dark match', () => {
    useGameStore.setState((s) => {
      s.world!.settings.paperworkLockoutChancePerWeek = 1;
      s.world!.week = s.world!.settings.paperworkLockoutEarliestWeek;
    });
    runWeek();

    const world = useGameStore.getState().world!;
    const frozenId = world.promotion.rosterIds.find((id) => world.wrestlers[id]?.paperworkFrozen);
    expect(frozenId).toBeDefined();

    useGameStore.getState().setSegmentParticipant(0, frozenId!, 0);
    expect(useGameStore.getState().world!.currentCard[0]!.participants).toHaveLength(0);

    useGameStore.getState().setDarkMatchParticipant(0, frozenId!, 0);
    expect(useGameStore.getState().world!.currentDarkMatches[0]!.participants).toHaveLength(0);
  });

  it('clears every frozen flag and announces the end after its duration runs out', () => {
    useGameStore.setState((s) => {
      s.world!.settings.paperworkLockoutChancePerWeek = 1;
      s.world!.settings.paperworkLockoutDurationWeeks = 2;
      s.world!.week = s.world!.settings.paperworkLockoutEarliestWeek;
    });
    runWeek();
    expect(useGameStore.getState().world!.paperworkLockout).not.toBeNull();

    useGameStore.setState((s) => {
      s.world!.settings.paperworkLockoutChancePerWeek = 0;
    });
    runWeek();
    expect(useGameStore.getState().world!.paperworkLockout).not.toBeNull();
    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.paperworkLockout).toBeNull();
    expect(Object.values(world.wrestlers).some((w) => w?.paperworkFrozen)).toBe(false);
    expect(world.weeklyNews.some((n) => n.kind === 'business' && n.week === world.week)).toBe(true);
  });
});
