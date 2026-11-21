import { describe, expect, it } from 'vitest';
import { rngFromSeed } from '../rng';
import { orderFactionEliminations, pickFactionEliminators } from './factionDestroyer';
import type { Wrestler } from '../types';

function stub(id: string): Wrestler {
  return { id, name: id } as unknown as Wrestler;
}

const winners = [stub('w1'), stub('w2'), stub('w3')];
const losers = [stub('l1'), stub('l2'), stub('l3'), stub('l4'), stub('l5')];

describe('orderFactionEliminations', () => {
  it('always leaves at least one survivor on the winning side, even at extreme skew', () => {
    // Weighted heavily as if the "winner" side were actually the weaker one —
    // the reserved-survivor guarantee must hold regardless of how the draw lands.
    for (let i = 0; i < 30; i++) {
      const result = orderFactionEliminations(rngFromSeed(`skew-${i}`), losers, winners, 0.05, 0.95);
      expect(result.survivorIds.length).toBeGreaterThan(0);
      for (const id of result.survivorIds) {
        expect(winners.map((w) => w.id)).toContain(id);
      }
    }
  });

  it('eventually eliminates every member of the losing side', () => {
    const result = orderFactionEliminations(rngFromSeed('full-loser'), losers, winners, 0.4, 0.6);
    const eliminatedLosers = result.order.filter((id) => losers.some((l) => l.id === id));
    expect(eliminatedLosers.sort()).toEqual(losers.map((l) => l.id).sort());
  });

  it('never eliminates a survivor, and never survives an eliminated wrestler', () => {
    const result = orderFactionEliminations(rngFromSeed('no-overlap'), losers, winners, 0.4, 0.6);
    const eliminated = new Set(result.order);
    for (const survivorId of result.survivorIds) {
      expect(eliminated.has(survivorId)).toBe(false);
    }
  });

  it('accounts for every wrestler exactly once between eliminated and survivors', () => {
    const result = orderFactionEliminations(rngFromSeed('full-accounting'), losers, winners, 0.4, 0.6);
    const all = [...result.order, ...result.survivorIds].sort();
    const expected = [...losers, ...winners].map((w) => w.id).sort();
    expect(all).toEqual(expected);
  });

  it('handles uneven sides — a small winning side against a large losing side', () => {
    const bigLosers = Array.from({ length: 7 }, (_, i) => stub(`big-${i}`));
    const smallWinners = [stub('tiny-1')];
    const result = orderFactionEliminations(rngFromSeed('uneven'), bigLosers, smallWinners, 0.3, 0.7);
    // The single winner must be the sole survivor — there's nobody else to reserve.
    expect(result.survivorIds).toEqual(['tiny-1']);
    expect(result.order.sort()).toEqual(bigLosers.map((w) => w.id).sort());
  });

  it('a much weaker (loser) side tends to go out earlier than a much stronger (winner) side', () => {
    // Not a hard guarantee — a weighted draw — but over many trials the loser
    // side's members should on average exit earlier than the winner's.
    const trials = 200;
    let loserPosSum = 0;
    let winnerPosSum = 0;
    let winnerCount = 0;
    for (let i = 0; i < trials; i++) {
      const result = orderFactionEliminations(rngFromSeed(`trend-${i}`), losers, winners, 0.1, 0.9);
      loserPosSum += result.order.indexOf('l1');
      const idx = result.order.indexOf('w1');
      if (idx >= 0) {
        winnerPosSum += idx;
        winnerCount += 1;
      }
    }
    // w1 is eliminated less often (higher win prob = lower weight = safer),
    // and when it is, later on average than a loser-side member.
    expect(winnerCount).toBeLessThan(trials);
    if (winnerCount > 0) {
      expect(loserPosSum / trials).toBeLessThan(winnerPosSum / winnerCount);
    }
  });
});

describe('pickFactionEliminators', () => {
  it('gives every eliminated wrestler an eliminator', () => {
    const order = ['l1', 'l2', 'l3'];
    const survivorIds = ['w1'];
    const eliminators = pickFactionEliminators(order, survivorIds, 1);
    expect(eliminators.size).toBe(3);
  });

  it('is deterministic for the same eliminated wrestler and week', () => {
    const order = ['l1', 'l2', 'l3'];
    const survivorIds = ['w1'];
    const first = pickFactionEliminators(order, survivorIds, 7);
    const second = pickFactionEliminators(order, survivorIds, 7);
    expect(first.get('l1')).toBe(second.get('l1'));
  });

  it('never credits the eliminated wrestler with eliminating themselves', () => {
    const order = ['l1', 'l2', 'l3'];
    const survivorIds = ['w1'];
    for (let week = 1; week <= 30; week++) {
      const eliminators = pickFactionEliminators(order, survivorIds, week);
      expect(eliminators.get('l1')).not.toBe('l1');
      expect(eliminators.get('l2')).not.toBe('l2');
    }
  });

  it('only ever picks someone still active at that point in the order', () => {
    const order = ['l1', 'l2', 'l3'];
    const survivorIds = ['w1'];
    for (let week = 1; week <= 30; week++) {
      const eliminators = pickFactionEliminators(order, survivorIds, week);
      // l1 goes out first — l2, l3, and w1 are all still active.
      expect(['l2', 'l3', 'w1']).toContain(eliminators.get('l1'));
      // l3 goes out last of the losers — only the survivor remains.
      expect(eliminators.get('l3')).toBe('w1');
    }
  });
});
