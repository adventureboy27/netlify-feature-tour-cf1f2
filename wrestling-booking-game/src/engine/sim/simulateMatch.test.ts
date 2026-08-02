import { describe, expect, it } from 'vitest';
import { mulberry32, rngFromSeed } from '../rng';
import { generateWrestler } from '../generate/wrestler';
import { defaultWorldSettings } from '../world/settings';
import { simulateMatch, type SimParticipant, type SimulateMatchContext } from './simulateMatch';
import type { MatchRules, Wrestler } from '../types';

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

function baseContext(overrides: Partial<SimulateMatchContext> = {}): SimulateMatchContext {
  return {
    rules: baseRules(),
    stipulation: null,
    requirementsMet: true,
    isPPV: false,
    matchLengthMinutes: 12,
    settings: defaultWorldSettings(),
    ...overrides,
  };
}

function makeRoster(seed: number, count: number): Wrestler[] {
  const rng = mulberry32(seed);
  const names = new Set<string>();
  return Array.from({ length: count }, () => generateWrestler(rng, names));
}

describe('simulateMatch', () => {
  it('is deterministic for a given seed', () => {
    const roster = makeRoster(1, 2);
    const byId = new Map(roster.map((w) => [w.id, w]));
    const participants: SimParticipant[] = [
      { wrestlerId: roster[0]!.id, side: 0 },
      { wrestlerId: roster[1]!.id, side: 1 },
    ];

    const a = simulateMatch(rngFromSeed('match-seed'), participants, byId, baseContext());
    const b = simulateMatch(rngFromSeed('match-seed'), participants, byId, baseContext());
    expect(a.rating).toBe(b.rating);
    expect(a.winnerSide).toBe(b.winnerSide);
    expect(a.finish).toBe(b.finish);
  });

  it('the winner is always one of the two sides, or null on a draw finish', () => {
    const roster = makeRoster(2, 2);
    const byId = new Map(roster.map((w) => [w.id, w]));
    const participants: SimParticipant[] = [
      { wrestlerId: roster[0]!.id, side: 0 },
      { wrestlerId: roster[1]!.id, side: 1 },
    ];

    const rng = mulberry32(99);
    for (let i = 0; i < 100; i++) {
      const result = simulateMatch(rng, participants, byId, baseContext());
      if (result.winnerSide === null) {
        expect(['timeLimitDraw', 'doubleKO']).toContain(result.finish);
        expect(result.winnerWrestlerIds).toHaveLength(0);
      } else {
        expect([0, 1]).toContain(result.winnerSide);
        expect(result.winnerWrestlerIds).toEqual([byId.get(participants[result.winnerSide]!.wrestlerId)!.id]);
      }
    }
  });

  it('supports multi-man matches (more than two sides)', () => {
    const roster = makeRoster(3, 4);
    const byId = new Map(roster.map((w) => [w.id, w]));
    const participants: SimParticipant[] = roster.map((w, i) => ({ wrestlerId: w.id, side: i }));

    const result = simulateMatch(rngFromSeed('multi-man'), participants, byId, baseContext({ rules: baseRules({ preset: 'fatal4' }) }));
    expect(result.winProbabilitiesBySide).toBeDefined();
    expect(Object.keys(result.winProbabilitiesBySide)).toHaveLength(4);
    if (result.winnerSide !== null) {
      expect([0, 1, 2, 3]).toContain(result.winnerSide);
    }
  });

  it('an overwhelmingly stronger side wins far more often than not', () => {
    const rng = mulberry32(4);
    const names = new Set<string>();
    const strong = { ...generateWrestler(rng, names), popularity: 99, skill: 99, strength: 99, agility: 99, stamina: 99, health: 100, momentum: 100, age: 28 };
    const weak = { ...generateWrestler(rng, names), popularity: 5, skill: 5, strength: 5, agility: 5, stamina: 5, health: 100, momentum: 50, age: 28 };
    const byId = new Map([[strong.id, strong], [weak.id, weak]]);
    const participants: SimParticipant[] = [
      { wrestlerId: strong.id, side: 0 },
      { wrestlerId: weak.id, side: 1 },
    ];

    const simRng = mulberry32(777);
    let strongWins = 0;
    let total = 0;
    for (let i = 0; i < 200; i++) {
      const result = simulateMatch(simRng, participants, byId, baseContext());
      if (result.winnerSide === 0) strongWins++;
      if (result.winnerSide !== null) total++;
    }
    expect(strongWins / total).toBeGreaterThan(0.8);
  });

  it('always produces at least an opening and a finish beat', () => {
    const roster = makeRoster(5, 2);
    const byId = new Map(roster.map((w) => [w.id, w]));
    const participants: SimParticipant[] = [
      { wrestlerId: roster[0]!.id, side: 0 },
      { wrestlerId: roster[1]!.id, side: 1 },
    ];
    const result = simulateMatch(rngFromSeed('beats-check'), participants, byId, baseContext());
    expect(result.beats.length).toBeGreaterThanOrEqual(2);
    expect(result.beats[0]!.kind).toBe('openingExchange');
    expect(result.beats[result.beats.length - 1]!.kind).toBe('finish');
  });
});
