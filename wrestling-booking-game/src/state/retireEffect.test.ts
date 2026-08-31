// The 'retire' EventEffect — engine/events/types.ts's closed vocabulary
// routing through the existing career/retirement.ts retire(), for
// data/events.ts's liveRetirement event.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';
import { applyEffect } from './storeHelpers';
import { rngFromSeed } from '../engine/rng';

function newGame() {
  useGameStore.getState().newGame({
    ...defaultWorldSettings(),
    seed: 'retire-effect-test',
    startingRosterSize: 14,
    ownerMandatesEnabled: false,
  });
}

beforeEach(newGame);

describe("the 'retire' effect", () => {
  it('takes the wrestler out of the business for good', () => {
    const wrestlerId = useGameStore.getState().world!.promotion.rosterIds[0]!;
    const name = useGameStore.getState().world!.wrestlers[wrestlerId]!.name;

    useGameStore.setState((s) => {
      applyEffect(s.world!, rngFromSeed('retire'), { kind: 'retire', wrestlerId });
    });

    const world = useGameStore.getState().world!;
    const w = world.wrestlers[wrestlerId]!;
    expect(w.careerStatus).toBe('retired');
    expect(w.promotionId).toBeNull();
    expect(w.contract).toBeNull();
    expect(world.promotion.rosterIds).not.toContain(wrestlerId);
    expect(world.weeklyNews.some((n) => n.text.includes(name) && n.text.includes('retired'))).toBe(true);
  });

  it('does nothing to somebody already retired or deceased', () => {
    const wrestlerId = useGameStore.getState().world!.promotion.rosterIds[0]!;
    useGameStore.setState((s) => {
      s.world!.wrestlers[wrestlerId]!.careerStatus = 'retired';
    });
    const before = useGameStore.getState().world!.weeklyNews.length;

    useGameStore.setState((s) => {
      applyEffect(s.world!, rngFromSeed('retire-again'), { kind: 'retire', wrestlerId });
    });

    expect(useGameStore.getState().world!.weeklyNews.length).toBe(before);
  });
});
