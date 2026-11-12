import { describe, expect, it } from 'vitest';
import { mulberry32, rngFromSeed, randInt, randFloat, gaussian, weightedPick, pick, clamp, chance } from './rng';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces values within [0, 1)', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds diverge', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });
});

describe('rngFromSeed', () => {
  it('is deterministic for the same string seed', () => {
    const seqA = Array.from({ length: 10 }, () => rngFromSeed('hello-world').next());
    const seqB = Array.from({ length: 10 }, () => rngFromSeed('hello-world').next());
    expect(seqA).toEqual(seqB);
  });
});

describe('randInt', () => {
  it('stays within [min, max] inclusive', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      const v = randInt(rng, 3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

describe('randFloat', () => {
  it('stays within [min, max)', () => {
    const rng = mulberry32(11);
    for (let i = 0; i < 500; i++) {
      const v = randFloat(rng, -5, 5);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThan(5);
    }
  });
});

describe('gaussian', () => {
  it('has roughly the requested mean over a large sample', () => {
    const rng = mulberry32(99);
    const n = 20000;
    const samples = Array.from({ length: n }, () => gaussian(rng, 50, 10));
    const mean = samples.reduce((a, b) => a + b, 0) / n;
    expect(mean).toBeGreaterThan(48);
    expect(mean).toBeLessThan(52);
  });
});

describe('weightedPick', () => {
  it('only ever returns entries with positive weight', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 200; i++) {
      const v = weightedPick(rng, [
        ['a', 1],
        ['b', 0],
        ['c', 3],
      ] as const);
      expect(v).not.toBe('b');
    }
  });

  it('throws on non-positive total weight', () => {
    const rng = mulberry32(5);
    expect(() => weightedPick(rng, [['a', 0]] as const)).toThrow();
  });
});

describe('pick', () => {
  it('throws on an empty array', () => {
    const rng = mulberry32(5);
    expect(() => pick(rng, [] as number[])).toThrow();
  });

  it('always returns an element from the array', () => {
    const rng = mulberry32(5);
    const arr = [1, 2, 3, 4, 5];
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(pick(rng, arr));
    }
  });
});

describe('clamp', () => {
  it('clamps below min and above max', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(5, 0, 10)).toBe(5);
  });
});

describe('chance', () => {
  it('p=0 is always false, p=1 is always true', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 50; i++) {
      expect(chance(rng, 0)).toBe(false);
      expect(chance(rng, 1)).toBe(true);
    }
  });
});
