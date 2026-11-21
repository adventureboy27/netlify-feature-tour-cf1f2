import { describe, it, expect } from 'vitest';
import {
  nameManagerStable,
  formManagerStable,
  dissolveManagerStable,
  stableOf,
  managerStableLine,
  managerStableDissolvedLine,
} from './managerStable';
import { rngFromSeed } from '../rng';

describe("a manager's client stable", () => {
  it('names it off the pool, with the manager worked in', () => {
    const name = nameManagerStable(rngFromSeed('n1'), 'Big Daddy');
    expect(name).toContain('Big Daddy');
  });

  it('forms with a name, the manager, and the week', () => {
    const stable = formManagerStable(rngFromSeed('f1'), 'm1', 'Big Daddy', 12);
    expect(stable.managerId).toBe('m1');
    expect(stable.formedWeek).toBe(12);
    expect(stable.name).toContain('Big Daddy');
  });

  it('is found by stableOf once formed, and not before', () => {
    const stable = formManagerStable(rngFromSeed('f2'), 'm1', 'Big Daddy', 12);
    expect(stableOf([], 'm1')).toBeNull();
    expect(stableOf([stable], 'm1')).toEqual(stable);
    expect(stableOf([stable], 'm2')).toBeNull();
  });

  it('dissolves cleanly, leaving other stables alone', () => {
    const a = formManagerStable(rngFromSeed('a'), 'm1', 'A', 1);
    const b = formManagerStable(rngFromSeed('b'), 'm2', 'B', 1);
    const after = dissolveManagerStable([a, b], 'm1');
    expect(after).toHaveLength(1);
    expect(after[0]!.managerId).toBe('m2');
  });

  it('re-forms under a fresh roll if it dissolves and crosses the threshold again', () => {
    const first = formManagerStable(rngFromSeed('first'), 'm1', 'Big Daddy', 1);
    const dissolved = dissolveManagerStable([first], 'm1');
    expect(stableOf(dissolved, 'm1')).toBeNull();
    const second = formManagerStable(rngFromSeed('second'), 'm1', 'Big Daddy', 20);
    expect(second.formedWeek).toBe(20);
  });

  it('names never crash on the formed and dissolved wire lines', () => {
    const stable = formManagerStable(rngFromSeed('l1'), 'm1', 'Big Daddy', 5);
    expect(managerStableLine(stable, 3)).toContain(stable.name);
    expect(managerStableDissolvedLine(stable)).toContain(stable.name);
  });
});
