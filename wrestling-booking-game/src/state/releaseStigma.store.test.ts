// Free agents wary of a promotion that's been visibly releasing people —
// reaching ordinary negotiation, not just the bidding war's signing bonus.
// See engine/economy/releaseStigma.ts.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';
import { tickReleaseStigma } from './storeHelpers';

function newGame() {
  useGameStore.getState().newGame({
    ...defaultWorldSettings(),
    seed: 'release-stigma-1',
    startingRosterSize: 14,
    ownerMandatesEnabled: false,
  });
}

beforeEach(newGame);

/** Puts one wrestler into the free agent pool with a controlled ego, ready to sign. */
function putUpForSigning(ego: number): string {
  const world = useGameStore.getState().world!;
  const roster = world.promotion.rosterIds.map((id) => world.wrestlers[id]!);
  const target = roster[0]!;
  useGameStore.setState((s) => {
    const w = s.world!;
    const person = w.wrestlers[target.id]!;
    w.promotion.rosterIds = w.promotion.rosterIds.filter((id) => id !== target.id);
    person.promotionId = null;
    person.contract = null;
    person.noCompeteWeeks = 0;
    person.ego = ego;
    w.freeAgents.push({
      wrestlerId: target.id,
      reason: 'released',
      askingRate: 1000,
      wantsWeeks: 52,
      weeksUnsigned: 0,
    });
  });
  return target.id;
}

describe('signing while the market is not wary at all', () => {
  it('signs at the ordinary ego-driven terms when the promotion has not released anybody recently', () => {
    const id = putUpForSigning(20);
    useGameStore.setState((s) => {
      s.world!.solventWeeksSinceLastRelease = s.world!.settings.releaseStigmaCooldownWeeks;
    });
    const bankBefore = useGameStore.getState().world!.promotion.bankBalance;
    useGameStore.getState().signFreeAgent(id);
    const world = useGameStore.getState().world!;
    expect(world.promotion.rosterIds).toContain(id);
    expect(world.wrestlers[id]!.contract!.guaranteedPct).toBe(0);
    expect(world.promotion.bankBalance).toBe(bankBefore); // no signing bonus deducted
  });
});

describe('signing while the market is wary', () => {
  it('demands a guaranteed floor from somebody who would otherwise get none', () => {
    const id = putUpForSigning(20);
    useGameStore.setState((s) => {
      s.world!.solventWeeksSinceLastRelease = 0;
    });
    useGameStore.getState().signFreeAgent(id);
    const world = useGameStore.getState().world!;
    expect(world.wrestlers[id]!.contract!.guaranteedPct).toBe(world.settings.releaseStigmaGuaranteedPct);
  });

  it('demands cash up front from a star who already commands a guarantee off ego', () => {
    const id = putUpForSigning(95);
    useGameStore.setState((s) => {
      s.world!.solventWeeksSinceLastRelease = 0;
    });
    const bankBefore = useGameStore.getState().world!.promotion.bankBalance;
    useGameStore.getState().signFreeAgent(id);
    const world = useGameStore.getState().world!;
    expect(world.wrestlers[id]!.contract!.guaranteedPct).toBe(1);
    expect(world.promotion.bankBalance).toBeLessThan(bankBefore);
  });

  it('does nothing at all when switched off entirely', () => {
    const id = putUpForSigning(20);
    useGameStore.setState((s) => {
      s.world!.solventWeeksSinceLastRelease = 0;
      s.world!.settings.releaseStigmaEnabled = false;
    });
    useGameStore.getState().signFreeAgent(id);
    const world = useGameStore.getState().world!;
    expect(world.wrestlers[id]!.contract!.guaranteedPct).toBe(0);
  });
});

describe('releasing somebody resets the clock', () => {
  it('drops the cooldown to zero the moment a release happens', () => {
    useGameStore.setState((s) => {
      s.world!.solventWeeksSinceLastRelease = s.world!.settings.releaseStigmaCooldownWeeks;
    });
    const anyone = useGameStore.getState().world!.promotion.rosterIds[0]!;
    useGameStore.getState().releaseWrestler(anyone);
    expect(useGameStore.getState().world!.solventWeeksSinceLastRelease).toBe(0);
  });
});

describe('the cooldown clock itself', () => {
  it('climbs one clean week at a time and resets on a red one', () => {
    useGameStore.setState((s) => {
      s.world!.solventWeeksSinceLastRelease = 0;
      s.world!.promotion.bankBalance = 10_000;
    });
    useGameStore.setState((s) => tickReleaseStigma(s.world!));
    expect(useGameStore.getState().world!.solventWeeksSinceLastRelease).toBe(1);

    useGameStore.setState((s) => {
      s.world!.promotion.bankBalance = -500;
    });
    useGameStore.setState((s) => tickReleaseStigma(s.world!));
    expect(useGameStore.getState().world!.solventWeeksSinceLastRelease).toBe(0);
  });
});
