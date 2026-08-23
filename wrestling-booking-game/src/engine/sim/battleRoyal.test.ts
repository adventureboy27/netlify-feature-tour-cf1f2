import { describe, expect, it } from 'vitest';
import { rngFromSeed } from '../rng';
import { orderEliminations } from './battleRoyal';

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
