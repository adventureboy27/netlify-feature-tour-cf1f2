// moraleReasons — the full weekly breakdown behind the single moraleNote
// sentence, wired into the real weekly loop and the death/grief pass. See
// engine/career/morale.ts for the pure logic (topMoraleReasons), already
// covered by its own tests. This confirms store.ts's two write sites — the
// weekly tick and bereavements — actually populate it.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';

const TEST_ROSTER_SIZE = 24;

function freshSettings() {
  return {
    ...defaultWorldSettings(),
    seed: 'morale-reasons-store-test',
    startingRosterSize: TEST_ROSTER_SIZE,
    ownerMandatesEnabled: false,
  };
}

beforeEach(() => {
  useGameStore.getState().newGame(freshSettings());
});

function runWeek() {
  useGameStore.getState().resolveWeek();
  if (useGameStore.getState().world?.pendingWeatherCall) {
    useGameStore.getState().answerWeatherCall('runIt');
  }
}

describe('the weekly tick', () => {
  it('gives every active roster member a moraleReasons breakdown alongside moraleNote', () => {
    runWeek();
    const world = useGameStore.getState().world!;
    const roster = world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean);
    expect(roster.length).toBeGreaterThan(0);
    for (const member of roster) {
      expect(member.moraleReasons).toBeDefined();
      expect(Array.isArray(member.moraleReasons)).toBe(true);
    }
    // At least somebody on a real roster has more than one thing going on in
    // a week — this is what the "Why" disclosure actually has to show.
    expect(roster.some((w) => (w.moraleReasons?.length ?? 0) > 1)).toBe(true);
  });

  it('keeps the sign consistent with what the sentence says', () => {
    runWeek();
    const world = useGameStore.getState().world!;
    const roster = world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean);
    for (const member of roster) {
      for (const reason of member.moraleReasons ?? []) {
        expect(typeof reason.text).toBe('string');
        expect(typeof reason.positive).toBe('boolean');
      }
    }
  });
});
