import { describe, expect, it } from 'vitest';
import { rngFromSeed } from '../rng';
import { orderEliminations, pickEliminators } from './battleRoyal';
import type { Wrestler } from '../types';

function stub(id: string): Wrestler {
  return { id, name: id } as unknown as Wrestler;
}

describe('orderEliminations', () => {
  const sides = [0, 1, 2, 3, 4, 5, 6, 7];

  it('always ends on the pre-decided winner', () => {
    for (let i = 0; i < 20; i++) {
      const order = orderEliminations(rngFromSeed(`winner-${i}`), sides, 4, {
        0: 0.1, 1: 0.1, 2: 0.1, 3: 0.1, 4: 0.3, 5: 0.1, 6: 0.1, 7: 0.1,
      });
      expect(order[order.length - 1]).toBe(4);
    }
  });

  it('includes every side exactly once', () => {
    const order = orderEliminations(rngFromSeed('full-field'), sides, 2, {
      0: 0.1, 1: 0.1, 2: 0.2, 3: 0.1, 4: 0.1, 5: 0.1, 6: 0.1, 7: 0.2,
    });
    expect([...order].sort((a, b) => a - b)).toEqual([...sides].sort((a, b) => a - b));
  });

  it('a much weaker side tends to go out earlier than a much stronger one', () => {
    // Not a hard guarantee (it's a weighted draw), but over many trials the
    // weak side's average exit position should land well before the strong
    // side's — otherwise the "weaker sides go out first" premise is fake.
    const probs = { 0: 0.02, 1: 0.44, 2: 0.35, 3: 0.03, 4: 0.03, 5: 0.03, 6: 0.03, 7: 0.03 };
    let weakPosSum = 0;
    let strongPosSum = 0;
    const trials = 400;
    for (let i = 0; i < trials; i++) {
      const order = orderEliminations(rngFromSeed(`weighted-${i}`), sides, 1, probs);
      weakPosSum += order.indexOf(0);
      strongPosSum += order.indexOf(2);
    }
    expect(weakPosSum / trials).toBeLessThan(strongPosSum / trials);
  });

  it('handles the smallest possible field — two sides plus the winner', () => {
    const order = orderEliminations(rngFromSeed('two-sides'), [0, 1], 0, { 0: 0.6, 1: 0.4 });
    expect(order).toEqual([1, 0]);
  });
});

describe('pickEliminators', () => {
  const sideMembers = new Map<number, readonly Wrestler[]>([
    [0, [stub('a')]],
    [1, [stub('b')]],
    [2, [stub('c')]],
    [3, [stub('d')]],
  ]);
  const order = [0, 1, 2, 3]; // 0 goes out first, 3 is the winner.

  it('is deterministic for the same eliminated wrestler and week', () => {
    const first = pickEliminators(order, sideMembers, 7);
    const second = pickEliminators(order, sideMembers, 7);
    expect(first.get(0)).toBe(second.get(0));
    expect(first.get(1)).toBe(second.get(1));
  });

  it('can change when the week changes, since the seed includes it', () => {
    const results = new Set<string>();
    for (let week = 1; week <= 30; week++) {
      results.add(pickEliminators(order, sideMembers, week).get(0)!);
    }
    // Not a hard guarantee any single week differs, but across 30 weeks the
    // pick should not always land on the same eliminator.
    expect(results.size).toBeGreaterThan(1);
  });

  it('never credits the eliminated side with eliminating itself', () => {
    for (let week = 1; week <= 50; week++) {
      const eliminators = pickEliminators(order, sideMembers, week);
      expect(eliminators.get(0)).not.toBe('a');
      expect(eliminators.get(1)).not.toBe('b');
      expect(eliminators.get(2)).not.toBe('c');
    }
  });

  it('only ever picks someone still active at that point in the order', () => {
    for (let week = 1; week <= 50; week++) {
      const eliminators = pickEliminators(order, sideMembers, week);
      // Side 0 goes out first — everyone else (b, c, d) is still active.
      expect(['b', 'c', 'd']).toContain(eliminators.get(0));
      // Side 1 goes out second — only c and d (and the winner) remain.
      expect(['c', 'd']).toContain(eliminators.get(1));
      // Side 2 goes out third — only the winner, d, remains.
      expect(eliminators.get(2)).toBe('d');
    }
  });

  it('has no entry for the winner, who is never eliminated', () => {
    const eliminators = pickEliminators(order, sideMembers, 1);
    expect(eliminators.has(3)).toBe(false);
  });
});
