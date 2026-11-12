// A struggling rival cutting its own payroll — not the player's loan system,
// just enough visible struggle to make "in real trouble" mean something.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';
import { maybeTrimRivalPayroll } from './storeHelpers';
import { rngFromSeed } from '../engine/rng';

function newGame() {
  useGameStore.getState().newGame({
    ...defaultWorldSettings(),
    seed: 'rival-trim-1',
    startingRosterSize: 14,
    ownerMandatesEnabled: false,
  });
}

beforeEach(newGame);

describe('a struggling rival cutting costs', () => {
  it('does nothing while healthy', () => {
    const rivalId = useGameStore.getState().world!.rivals[0]!.id;
    const before = useGameStore.getState().world!.rivals.find((r) => r.id === rivalId)!.rosterIds.length;
    useGameStore.setState((s) => {
      const r = s.world!.rivals.find((x) => x.id === rivalId)!;
      r.weeksInTheRed = 0;
      s.world!.settings.rivalTrimWeeklyChance = 1;
      maybeTrimRivalPayroll(s.world!, rngFromSeed('t1'), r);
    });
    const after = useGameStore.getState().world!.rivals.find((x) => x.id === rivalId)!;
    expect(after.rosterIds.length).toBe(before);
  });

  it('releases the cheapest hand once far enough into its own grace period', () => {
    const rivalId = useGameStore.getState().world!.rivals[0]!.id;
    const before = useGameStore.getState().world!.rivals.find((r) => r.id === rivalId)!.rosterIds.length;
    useGameStore.setState((s) => {
      const r = s.world!.rivals.find((x) => x.id === rivalId)!;
      r.weeksInTheRed = Math.ceil(s.world!.settings.rivalBankruptcyGraceWeeks * s.world!.settings.rivalTrimAtGraceShare);
      s.world!.settings.rivalTrimWeeklyChance = 1;
      maybeTrimRivalPayroll(s.world!, rngFromSeed('t2'), r);
    });

    const world = useGameStore.getState().world!;
    const rival = world.rivals.find((r) => r.id === rivalId)!;
    expect(rival.rosterIds.length).toBe(before - 1);
    expect(world.freeAgents.some((a) => a.reason === 'released')).toBe(true);
    const item = world.weeklyNews.find((n) => n.text.includes('under control'));
    expect(item).toBeTruthy();
    // Stamped for the week resolveWeek is about to turn into, not the
    // current one — this function runs before World.week's own increment,
    // and weeklyNews is filtered against the incremented value afterward.
    // See the CLAUDE.md note on wire items stamped too early vanishing.
    expect(item!.week).toBe(world.week + 1);
  });

  it('never shrinks a roster down to the floor', () => {
    const rivalId = useGameStore.getState().world!.rivals[0]!.id;
    useGameStore.setState((s) => {
      const r = s.world!.rivals.find((x) => x.id === rivalId)!;
      r.weeksInTheRed = s.world!.settings.rivalBankruptcyGraceWeeks;
      r.rosterIds = r.rosterIds.slice(0, s.world!.settings.rivalRosterSizeMin);
      s.world!.settings.rivalTrimWeeklyChance = 1;
      maybeTrimRivalPayroll(s.world!, rngFromSeed('t3'), r);
    });
    const world = useGameStore.getState().world!;
    const rival = world.rivals.find((r) => r.id === rivalId)!;
    expect(rival.rosterIds.length).toBe(world.settings.rivalRosterSizeMin);
  });

  it('respects the weekly chance — never a guaranteed cut', () => {
    const rivalId = useGameStore.getState().world!.rivals[0]!.id;
    const before = useGameStore.getState().world!.rivals.find((r) => r.id === rivalId)!.rosterIds.length;
    useGameStore.setState((s) => {
      const r = s.world!.rivals.find((x) => x.id === rivalId)!;
      r.weeksInTheRed = s.world!.settings.rivalBankruptcyGraceWeeks;
      s.world!.settings.rivalTrimWeeklyChance = 0;
      maybeTrimRivalPayroll(s.world!, rngFromSeed('t4'), r);
    });
    const world = useGameStore.getState().world!;
    const rival = world.rivals.find((r) => r.id === rivalId)!;
    expect(rival.rosterIds.length).toBe(before);
  });

  it('does nothing to a rival that has already closed', () => {
    const rivalId = useGameStore.getState().world!.rivals[0]!.id;
    const before = useGameStore.getState().world!.rivals.find((r) => r.id === rivalId)!.rosterIds.length;
    useGameStore.setState((s) => {
      const r = s.world!.rivals.find((x) => x.id === rivalId)!;
      r.closedWeek = s.world!.week;
      r.weeksInTheRed = s.world!.settings.rivalBankruptcyGraceWeeks;
      s.world!.settings.rivalTrimWeeklyChance = 1;
      maybeTrimRivalPayroll(s.world!, rngFromSeed('t5'), r);
    });
    const world = useGameStore.getState().world!;
    const rival = world.rivals.find((r) => r.id === rivalId)!;
    expect(rival.rosterIds.length).toBe(before);
  });

  it('can be switched off entirely', () => {
    const rivalId = useGameStore.getState().world!.rivals[0]!.id;
    const before = useGameStore.getState().world!.rivals.find((r) => r.id === rivalId)!.rosterIds.length;
    useGameStore.setState((s) => {
      const r = s.world!.rivals.find((x) => x.id === rivalId)!;
      r.weeksInTheRed = s.world!.settings.rivalBankruptcyGraceWeeks;
      s.world!.settings.rivalTrimWeeklyChance = 1;
      s.world!.settings.rivalTrimEnabled = false;
      maybeTrimRivalPayroll(s.world!, rngFromSeed('t6'), r);
    });
    const world = useGameStore.getState().world!;
    const rival = world.rivals.find((r) => r.id === rivalId)!;
    expect(rival.rosterIds.length).toBe(before);
  });
});
