import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rng';
import { generateWrestler } from '../generate/wrestler';
import { ruleAdjustedWeights, kayfabeScore } from './kayfabe';
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
    ...overrides,
  };
}

describe('ruleAdjustedWeights', () => {
  it('weights sum roughly consistently and stay positive', () => {
    const w = ruleAdjustedWeights(baseRules(), false, false);
    for (const value of Object.values(w)) expect(value).toBeGreaterThan(0);
  });

  it('boosts stamina and cuts strength for long/iron-man matches', () => {
    const base = ruleAdjustedWeights(baseRules({ timeLimit: 15 }), false, false);
    const long = ruleAdjustedWeights(baseRules({ timeLimit: 60 }), false, false);
    expect(long.stamina).toBeGreaterThan(base.stamina);
    expect(long.strength).toBeLessThan(base.strength);
  });

  it('boosts strength and cuts stamina for short time limits', () => {
    const base = ruleAdjustedWeights(baseRules({ timeLimit: 15 }), false, false);
    const short = ruleAdjustedWeights(baseRules({ timeLimit: 5 }), false, false);
    expect(short.strength).toBeGreaterThan(base.strength);
    expect(short.stamina).toBeLessThan(base.stamina);
  });

  it('does not apply the short-time-limit bump when timeLimit is 0 (no limit)', () => {
    const base = ruleAdjustedWeights(baseRules({ timeLimit: 15 }), false, false);
    const noLimit = ruleAdjustedWeights(baseRules({ timeLimit: 0 }), false, false);
    expect(noLimit.strength).toBe(base.strength);
  });

  it('doubles skill weight for submission-only matches', () => {
    const base = ruleAdjustedWeights(baseRules({ aim: 'firstFall' }), false, false);
    const subOnly = ruleAdjustedWeights(baseRules({ aim: 'submissionOnly' }), false, false);
    expect(subOnly.skill).toBeCloseTo(base.skill * 2, 5);
  });

  it('boosts agility for ladder/high-spot stipulations', () => {
    const base = ruleAdjustedWeights(baseRules(), false, false);
    const ladder = ruleAdjustedWeights(baseRules(), true, false);
    expect(ladder.agility).toBeGreaterThan(base.agility);
  });

  it('boosts popularity weight for multi-man matches', () => {
    const base = ruleAdjustedWeights(baseRules(), false, false);
    const multi = ruleAdjustedWeights(baseRules(), false, true);
    expect(multi.popularity).toBeGreaterThan(base.popularity);
  });
});

describe('kayfabeScore', () => {
  const weights = ruleAdjustedWeights(baseRules(), false, false);

  it('is higher for a wrestler with better stats, all else equal', () => {
    const rng = mulberry32(1);
    const w1 = generateWrestler(rng, new Set());
    const w2 = { ...w1, popularity: 99, skill: 99, strength: 99, agility: 99, stamina: 99 };
    const w3 = { ...w1, popularity: 5, skill: 5, strength: 5, agility: 5, stamina: 5 };
    expect(kayfabeScore(w2, weights)).toBeGreaterThan(kayfabeScore(w3, weights));
  });

  it('penalizes low health', () => {
    const rng = mulberry32(2);
    const w = generateWrestler(rng, new Set());
    const healthy = { ...w, health: 100 };
    const hurt = { ...w, health: 20 };
    expect(kayfabeScore(healthy, weights)).toBeGreaterThan(kayfabeScore(hurt, weights));
  });

  it('penalizes age past 36', () => {
    const rng = mulberry32(3);
    const w = generateWrestler(rng, new Set());
    const young = { ...w, age: 30 };
    const old = { ...w, age: 50 };
    expect(kayfabeScore(young, weights)).toBeGreaterThan(kayfabeScore(old, weights));
  });
});
