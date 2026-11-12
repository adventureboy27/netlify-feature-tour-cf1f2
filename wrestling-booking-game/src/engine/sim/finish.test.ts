import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rng';
import { rollFinish, isDrawFinish, isNonDecisiveFinish } from './finish';
import type { MatchRules } from '../types';

function baseRules(overrides: Partial<MatchRules> = {}): MatchRules {
  return {
    preset: 'singles',
    format: 'individuals',
    ruleStrictness: 'lenient',
    aim: 'firstFall',
    falls: 'pinsAndSubs',
    timeLimit: 15,
    stoppage: 'referee',
    countOuts: 'normal',
    reward: 'none',
    pace: 'standard',
    ...overrides,
  };
}

describe('rollFinish', () => {
  it('never returns submission when falls is pinsOnly', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 300; i++) {
      const finish = rollFinish(rng, {
        rules: baseRules({ falls: 'pinsOnly' }),
        violenceLevel: 0,
        winnerIsTechnician: true,
        isUpset: false,
        isCloselyMatched: false,
      });
      expect(finish).not.toBe('submission');
    }
  });

  it('never returns countOut when countOuts is none', () => {
    const rng = mulberry32(2);
    for (let i = 0; i < 300; i++) {
      const finish = rollFinish(rng, {
        rules: baseRules({ countOuts: 'none' }),
        violenceLevel: 0,
        winnerIsTechnician: false,
        isUpset: false,
        isCloselyMatched: false,
      });
      expect(finish).not.toBe('countOut');
    }
  });

  it('never returns disqualification when ruleStrictness is none', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 300; i++) {
      const finish = rollFinish(rng, {
        rules: baseRules({ ruleStrictness: 'none' }),
        violenceLevel: 0,
        winnerIsTechnician: false,
        isUpset: false,
        isCloselyMatched: false,
      });
      expect(finish).not.toBe('disqualification');
    }
  });

  it('never returns timeLimitDraw when timeLimit is 0', () => {
    const rng = mulberry32(4);
    for (let i = 0; i < 300; i++) {
      const finish = rollFinish(rng, {
        rules: baseRules({ timeLimit: 0 }),
        violenceLevel: 0,
        winnerIsTechnician: false,
        isUpset: false,
        isCloselyMatched: false,
      });
      expect(finish).not.toBe('timeLimitDraw');
    }
  });

  it('never returns refereeStoppage when stoppage is none', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 300; i++) {
      const finish = rollFinish(rng, {
        rules: baseRules({ stoppage: 'none' }),
        violenceLevel: 0,
        winnerIsTechnician: false,
        isUpset: false,
        isCloselyMatched: false,
      });
      expect(finish).not.toBe('refereeStoppage');
    }
  });

  it('never returns equipmentFailure when no gear weight was supplied', () => {
    const rng = mulberry32(6);
    for (let i = 0; i < 300; i++) {
      const finish = rollFinish(rng, {
        rules: baseRules(),
        violenceLevel: 0,
        winnerIsTechnician: false,
        isUpset: false,
        isCloselyMatched: false,
      });
      expect(finish).not.toBe('equipmentFailure');
    }
  });

  it('reaches equipmentFailure once real gear weight is in the match, and more often the higher it is', () => {
    function equipmentFailureRate(weight: number, runs = 2000): number {
      const rng = mulberry32(7);
      let hits = 0;
      for (let i = 0; i < runs; i++) {
        const finish = rollFinish(rng, {
          rules: baseRules(),
          violenceLevel: 0,
          winnerIsTechnician: false,
          isUpset: false,
          isCloselyMatched: false,
          equipmentFailureWeight: weight,
        });
        if (finish === 'equipmentFailure') hits += 1;
      }
      return hits / runs;
    }
    expect(equipmentFailureRate(0)).toBe(0);
    const lowRisk = equipmentFailureRate(2);
    const highRisk = equipmentFailureRate(30);
    expect(lowRisk).toBeGreaterThan(0);
    expect(highRisk).toBeGreaterThan(lowRisk);
  });
});

describe('isDrawFinish / isNonDecisiveFinish', () => {
  it('classifies draws correctly', () => {
    expect(isDrawFinish('timeLimitDraw')).toBe(true);
    expect(isDrawFinish('doubleKO')).toBe(true);
    expect(isDrawFinish('cleanPin')).toBe(false);
  });

  it('every draw is also non-decisive, but not vice versa', () => {
    expect(isNonDecisiveFinish('timeLimitDraw')).toBe(true);
    expect(isNonDecisiveFinish('countOut')).toBe(true);
    expect(isNonDecisiveFinish('cleanPin')).toBe(false);
  });
});
