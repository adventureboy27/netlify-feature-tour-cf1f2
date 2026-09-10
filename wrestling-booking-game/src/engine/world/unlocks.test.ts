import { describe, it, expect } from 'vitest';
import { checkUnlocks } from './unlocks';
import { UNLOCK_CONDITIONS } from '../../data/unlocks';

describe('checkUnlocks', () => {
  it('returns nothing when no condition is met', () => {
    expect(checkUnlocks([], { companyRating: 10, showsRun: 0 })).toEqual([]);
  });

  it('returns fallsCountAnywhere once company rating hits its threshold', () => {
    const result = checkUnlocks([], { companyRating: 85, showsRun: 0 });
    expect(result.map((c) => c.stipulationId)).toContain('fallsCountAnywhere');
  });

  it('returns blindfoldMatch once enough shows have run', () => {
    const result = checkUnlocks([], { companyRating: 0, showsRun: 100 });
    expect(result.map((c) => c.stipulationId)).toContain('blindfoldMatch');
  });

  it('can return more than one at once', () => {
    const result = checkUnlocks([], { companyRating: 90, showsRun: 150 });
    const ids = result.map((c) => c.stipulationId);
    expect(ids).toContain('fallsCountAnywhere');
    expect(ids).toContain('blindfoldMatch');
  });

  it('never returns something already unlocked, however far past the threshold', () => {
    const result = checkUnlocks(['fallsCountAnywhere', 'blindfoldMatch'], { companyRating: 100, showsRun: 500 });
    expect(result).toEqual([]);
  });

  it('every condition carries a real, non-empty announcement line', () => {
    for (const c of UNLOCK_CONDITIONS) {
      expect(c.earnedLine.length).toBeGreaterThan(0);
    }
  });

  it('every condition targets a unique stipulation', () => {
    const ids = UNLOCK_CONDITIONS.map((c) => c.stipulationId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
