import { describe, it, expect } from 'vitest';
import {
  bracketSize,
  seedOrder,
  createTournament,
  bookableMatches,
  recordResult,
  roundName,
  totalRounds,
  matchesWorkedTonight,
  nightFatigueMultiplier,
  nightHealthCost,
  matchCount,
} from './bracket';
import { defaultWorldSettings } from '../world/settings';
import type { Tournament, TournamentFormat } from '../types';

const settings = defaultWorldSettings();

const entrants = (n: number) => Array.from({ length: n }, (_, i) => `w${i + 1}`);

function build(n: number, format: TournamentFormat = 'multiWeek'): Tournament {
  return createTournament({
    id: 't1',
    name: 'Test Cup',
    entrantIds: entrants(n),
    format,
    reward: 'titleShot',
    startWeek: 1,
  });
}

/** Play the whole bracket out, always advancing the higher seed. */
function runToCompletion(start: Tournament): Tournament {
  let t = start;
  let guard = 0;
  while (t.status === 'active' && guard++ < 100) {
    const bookable = bookableMatches(t);
    expect(bookable.length).toBeGreaterThan(0);
    for (const match of bookable) {
      const seedOf = (id: string) => t.entrantIds.indexOf(id);
      const winner = seedOf(match.entrantA!) < seedOf(match.entrantB!) ? match.entrantA! : match.entrantB!;
      t = recordResult(t, match.id, winner);
    }
  }
  return t;
}

describe('bracketSize', () => {
  it('rounds up to the next power of two', () => {
    expect(bracketSize(2)).toBe(2);
    expect(bracketSize(3)).toBe(4);
    expect(bracketSize(8)).toBe(8);
    expect(bracketSize(9)).toBe(16);
  });
});

describe('seedOrder', () => {
  it('produces the standard bracket for eight', () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('keeps the top two seeds apart until the final at every size', () => {
    for (const size of [2, 4, 8, 16, 32]) {
      const order = seedOrder(size);
      expect(order).toHaveLength(size);
      expect(new Set(order).size).toBe(size);
      // Seeds 1 and 2 land in opposite halves of the bracket.
      expect(order.indexOf(1)).toBeLessThan(size / 2);
      expect(order.indexOf(2)).toBeGreaterThanOrEqual(size / 2);
    }
  });

  it('pairs each seed with the one that sums to bracket size + 1 in round one', () => {
    const order = seedOrder(8);
    for (let i = 0; i < order.length; i += 2) {
      expect(order[i]! + order[i + 1]!).toBe(9);
    }
  });
});

describe('createTournament', () => {
  it('refuses a bracket with nobody in it', () => {
    expect(() => createTournament({ id: 't', name: 'x', entrantIds: ['a'], format: 'multiWeek', reward: 'none', startWeek: 1 })).toThrow(
      /at least two/,
    );
  });

  it('builds the right number of rounds and matches', () => {
    const t = build(8);
    expect(totalRounds(t)).toBe(3);
    expect(t.rounds.map((r) => r.length)).toEqual([4, 2, 1]);
    expect(matchCount(t)).toBe(7);
  });

  it('seats the top seed against the bottom seed in round one', () => {
    const t = build(8);
    const opener = t.rounds[0]![0]!;
    expect([opener.entrantA, opener.entrantB]).toEqual(['w1', 'w8']);
  });

  it('gives byes to the top seeds when the field is not a power of two', () => {
    const t = build(6); // bracket of 8, two byes
    const byes = t.rounds[0]!.filter((m) => m.isBye);
    expect(byes).toHaveLength(2);
    // The byes go to the strongest entrants, not at random.
    expect(byes.map((m) => m.winnerId).sort()).toEqual(['w1', 'w2']);
    expect(matchCount(t)).toBe(5);
  });

  it('does not ask the player to book a bye', () => {
    const t = build(6);
    expect(bookableMatches(t).every((m) => !m.isBye)).toBe(true);
    expect(bookableMatches(t)).toHaveLength(2);
  });
});

describe('advancement', () => {
  it('feeds a winner into the correct next-round slot', () => {
    let t = build(8);
    t = recordResult(t, t.rounds[0]![0]!.id, 'w8');
    expect(t.rounds[1]![0]!.entrantA).toBe('w8');

    t = recordResult(t, t.rounds[0]![1]!.id, 'w4');
    expect(t.rounds[1]![0]!.entrantB).toBe('w4');
  });

  it('does not advance the round until every match in it is settled', () => {
    let t = build(8);
    t = recordResult(t, t.rounds[0]![0]!.id, 'w1');
    expect(t.currentRound).toBe(0);
    expect(bookableMatches(t)).toHaveLength(3);
  });

  it('rejects a winner who was not in the match', () => {
    const t = build(8);
    expect(() => recordResult(t, t.rounds[0]![0]!.id, 'w5')).toThrow(/not in tournament match/);
    expect(() => recordResult(t, 'nonsense', 'w1')).toThrow(/No such tournament match/);
  });

  it('never mutates the tournament it was handed', () => {
    const t = build(8);
    const before = JSON.stringify(t);
    recordResult(t, t.rounds[0]![0]!.id, 'w1');
    expect(JSON.stringify(t)).toBe(before);
  });

  it.each([2, 3, 4, 5, 6, 8, 12, 16])('runs a %i-entrant bracket to exactly one winner', (n) => {
    const finished = runToCompletion(build(n));
    expect(finished.status).toBe('complete');
    expect(finished.winnerId).toBe('w1'); // top seed always advanced
    expect(bookableMatches(finished)).toEqual([]);
  });

  it('lets an underdog take the whole thing', () => {
    let t = build(4);
    for (const m of bookableMatches(t)) t = recordResult(t, m.id, m.entrantB!);
    const final = bookableMatches(t)[0]!;
    t = recordResult(t, final.id, final.entrantB!);
    expect(t.status).toBe('complete');
    expect(t.winnerId).not.toBe('w1');
  });
});

describe('roundName', () => {
  it('names the stages from the end backwards', () => {
    expect(roundName(2, 3)).toBe('Final');
    expect(roundName(1, 3)).toBe('Semi-final');
    expect(roundName(0, 3)).toBe('Quarter-final');
    expect(roundName(0, 4)).toBe('Round 1');
    expect(roundName(0, 1)).toBe('Final');
  });
});

describe('one-night fatigue — the cost of the format', () => {
  it('counts nothing for a multi-week bracket, however far it has run', () => {
    const finished = runToCompletion(build(8, 'multiWeek'));
    expect(matchesWorkedTonight(finished, 'w1')).toBe(0);
  });

  it('counts every match the winner worked in a single night', () => {
    const finished = runToCompletion(build(8, 'singleNight'));
    expect(matchesWorkedTonight(finished, 'w1')).toBe(3);
  });

  it('does not count a bye as a match worked', () => {
    const t = build(6, 'singleNight');
    expect(matchesWorkedTonight(t, 'w1')).toBe(0);
  });

  it('makes each successive match of the night measurably harder to win', () => {
    const fresh = nightFatigueMultiplier(0, settings);
    const second = nightFatigueMultiplier(1, settings);
    const third = nightFatigueMultiplier(2, settings);
    expect(fresh).toBe(1);
    expect(second).toBeLessThan(fresh);
    expect(third).toBeLessThan(second);
  });

  it('never fatigues someone into being unable to win at all', () => {
    expect(nightFatigueMultiplier(20, settings)).toBeGreaterThanOrEqual(0.4);
  });

  it('charges health for the extra matches', () => {
    expect(nightHealthCost(0, settings)).toBe(0);
    expect(nightHealthCost(3, settings)).toBe(3 * settings.tournamentNightHealthCostPerMatch);
  });
});
