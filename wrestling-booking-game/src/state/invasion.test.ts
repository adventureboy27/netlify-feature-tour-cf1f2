// couldInvade (who a rival with a real grudge could send through the
// curtain) and the grudgeRelief effect it feeds into rivalInvasion — see
// storeHelpers.ts and data/incidents.ts's rivalInvasion.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';
import { couldInvade, applyEffect } from './storeHelpers';
import { rngFromSeed } from '../engine/rng';
import type { Grudge } from '../engine/world/grudges';
import type { Id } from '../engine/types';

function newGame() {
  useGameStore.getState().newGame({
    ...defaultWorldSettings(),
    seed: 'invasion-test',
    startingRosterSize: 14,
    ownerMandatesEnabled: false,
  });
}

beforeEach(newGame);

function setGrudge(rivalId: Id, resentment: number) {
  useGameStore.setState((s) => {
    s.world!.grudges = [{ promotionId: rivalId, resentment, reason: 'test', since: 1 } satisfies Grudge];
  });
}

describe('couldInvade', () => {
  it('sends nobody before the world is old enough, however hot the grudge', () => {
    const world = useGameStore.getState().world!;
    const rival = world.rivals[0]!;
    setGrudge(rival.id, 100);
    useGameStore.setState((s) => {
      s.world!.week = s.world!.settings.invasionEarliestWeek - 1;
    });
    const now = useGameStore.getState().world!;
    expect(couldInvade(now, now.promotion.id, new Set(), [])).toEqual([]);
  });

  it('sends nobody when no rival has resentment past the threshold', () => {
    const world = useGameStore.getState().world!;
    const rival = world.rivals[0]!;
    setGrudge(rival.id, world.settings.invasionGrudgeThreshold - 1);
    useGameStore.setState((s) => {
      s.world!.week = s.world!.settings.invasionEarliestWeek;
    });
    const now = useGameStore.getState().world!;
    expect(couldInvade(now, now.promotion.id, new Set(), [])).toEqual([]);
  });

  it('offers up the aggrieved rival roster once both gates are cleared', () => {
    const world = useGameStore.getState().world!;
    const rival = world.rivals[0]!;
    setGrudge(rival.id, world.settings.invasionGrudgeThreshold + 10);
    useGameStore.setState((s) => {
      s.world!.week = s.world!.settings.invasionEarliestWeek;
    });
    const now = useGameStore.getState().world!;
    const invaders = couldInvade(now, now.promotion.id, new Set(), []);
    expect(invaders.length).toBeGreaterThan(0);
    for (const invader of invaders) {
      expect(invader.fromPromotionId).toBe(rival.id);
      expect(rival.rosterIds).toContain(invader.wrestler.id);
    }
  });

  it('never offers anybody for a rival show — grudges only track feelings about the player', () => {
    const world = useGameStore.getState().world!;
    const rival = world.rivals[0]!;
    setGrudge(rival.id, 100);
    useGameStore.setState((s) => {
      s.world!.week = s.world!.settings.invasionEarliestWeek;
    });
    const now = useGameStore.getState().world!;
    expect(couldInvade(now, rival.id, new Set(), [])).toEqual([]);
  });

  it('leaves out a rival wrestler who is hurt', () => {
    const world = useGameStore.getState().world!;
    const rival = world.rivals[0]!;
    const casualtyId = rival.rosterIds[0]!;
    setGrudge(rival.id, world.settings.invasionGrudgeThreshold + 10);
    useGameStore.setState((s) => {
      s.world!.week = s.world!.settings.invasionEarliestWeek;
      s.world!.wrestlers[casualtyId]!.injury = {
        severity: 'severe',
        grade: 80,
        description: 'test injury',
        sufferedWeek: 1,
        totalWeeks: 10,
        weeksRemaining: 10,
        permanentStatLoss: {},
        earlyReturnWeeksUsed: 0,
      };
    });
    const now = useGameStore.getState().world!;
    const invaders = couldInvade(now, now.promotion.id, new Set(), []);
    expect(invaders.some((i) => i.wrestler.id === casualtyId)).toBe(false);
  });
});

describe('the grudgeRelief effect', () => {
  it('drains resentment off the named rival and nobody else', () => {
    const world = useGameStore.getState().world!;
    const [rivalA, rivalB] = world.rivals;
    useGameStore.setState((s) => {
      s.world!.grudges = [
        { promotionId: rivalA!.id, resentment: 50, reason: 'a', since: 1 },
        { promotionId: rivalB!.id, resentment: 50, reason: 'b', since: 1 },
      ];
      applyEffect(s.world!, rngFromSeed('relief'), { kind: 'grudgeRelief', promotionId: rivalA!.id, delta: 20 });
    });
    const grudges = useGameStore.getState().world!.grudges;
    expect(grudges.find((g) => g.promotionId === rivalA!.id)!.resentment).toBe(30);
    expect(grudges.find((g) => g.promotionId === rivalB!.id)!.resentment).toBe(50);
  });

  it('clears the grudge entirely rather than leaving it at or below zero', () => {
    const world = useGameStore.getState().world!;
    const rival = world.rivals[0]!;
    useGameStore.setState((s) => {
      s.world!.grudges = [{ promotionId: rival.id, resentment: 15, reason: 'a', since: 1 }];
      applyEffect(s.world!, rngFromSeed('relief'), { kind: 'grudgeRelief', promotionId: rival.id, delta: 30 });
    });
    const grudges = useGameStore.getState().world!.grudges;
    expect(grudges.find((g) => g.promotionId === rival.id)).toBeUndefined();
  });

  it('does nothing when the promotion has no grudge on the books', () => {
    const world = useGameStore.getState().world!;
    const rival = world.rivals[0]!;
    useGameStore.setState((s) => {
      s.world!.grudges = [];
      applyEffect(s.world!, rngFromSeed('relief'), { kind: 'grudgeRelief', promotionId: rival.id, delta: 30 });
    });
    expect(useGameStore.getState().world!.grudges).toEqual([]);
  });
});
