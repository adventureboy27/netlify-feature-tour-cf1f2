import { describe, expect, it } from 'vitest';
import {
  eligiblePair,
  beginFactionDestroyer,
  weekQualifies,
  buildForcedSegment,
  resolveFactionDestroyer,
} from './factionDestroyer';
import type { Segment, Stable } from '../types';

function stable(id: string, memberIds: string[], overrides: Partial<Stable> = {}): Stable {
  return {
    id,
    name: id,
    kind: memberIds.length >= 4 ? 'stable' : 'tagTeam',
    memberIds,
    leaderId: memberIds[0] ?? null,
    formedWeek: 1,
    disbandedWeek: null,
    record: { wins: 0, losses: 0, draws: 0 },
    ...overrides,
  };
}

describe('eligiblePair', () => {
  it('finds the first two non-disbanded factions, in array order', () => {
    const stables = [
      stable('team-a', ['a1', 'a2']), // a tagTeam, not a faction — skipped
      stable('faction-a', ['a1', 'a2', 'a3', 'a4']),
      stable('faction-b', ['b1', 'b2', 'b3', 'b4']),
      stable('faction-c', ['c1', 'c2', 'c3', 'c4']),
    ];
    const pair = eligiblePair(stables);
    expect(pair).not.toBeNull();
    expect(pair!.map((s) => s.id)).toEqual(['faction-a', 'faction-b']);
  });

  it('ignores a disbanded faction', () => {
    const stables = [
      stable('faction-a', ['a1', 'a2', 'a3', 'a4'], { disbandedWeek: 5 }),
      stable('faction-b', ['b1', 'b2', 'b3', 'b4']),
      stable('faction-c', ['c1', 'c2', 'c3', 'c4']),
    ];
    const pair = eligiblePair(stables);
    expect(pair!.map((s) => s.id)).toEqual(['faction-b', 'faction-c']);
  });

  it('returns null when fewer than two factions exist', () => {
    const stables = [stable('faction-a', ['a1', 'a2', 'a3', 'a4']), stable('team-a', ['t1', 't2'])];
    expect(eligiblePair(stables)).toBeNull();
  });
});

describe('beginFactionDestroyer', () => {
  it('builds a story with the countdown at full and nothing scheduled yet', () => {
    const a = stable('faction-a', ['a1', 'a2', 'a3', 'a4']);
    const b = stable('faction-b', ['b1', 'b2', 'b3', 'b4']);
    const story = beginFactionDestroyer(a, b, 10, 6);
    expect(story).toEqual({
      stableAId: 'faction-a',
      stableBId: 'faction-b',
      stableAName: 'faction-a',
      stableBName: 'faction-b',
      triggeredWeek: 10,
      weeksRemaining: 6,
      matchScheduledForWeek: null,
    });
  });
});

function matchSegment(slot: number, competitorIds: string[], resolved = true): Segment {
  return {
    slot,
    kind: 'match',
    managerIds: [],
    refereeId: null,
    guestRefereeId: null,
    participants: competitorIds.map((wrestlerId, i) => ({ wrestlerId, side: i, role: 'competitor' as const })),
    rules: {} as Segment['rules'],
    stipulation: null,
    titleIds: [],
    deckStacking: {} as Segment['deckStacking'],
    result: resolved ? ({} as Segment['result']) : null,
  };
}

describe('weekQualifies', () => {
  it('true when a resolved match includes a member of either faction', () => {
    const memberIds = new Set(['a1', 'b1']);
    const segments = [matchSegment(0, ['x', 'y']), matchSegment(1, ['a1', 'z'])];
    expect(weekQualifies(memberIds, segments)).toBe(true);
  });

  it('false when no resolved match involves either faction', () => {
    const memberIds = new Set(['a1', 'b1']);
    const segments = [matchSegment(0, ['x', 'y']), matchSegment(1, ['q', 'z'])];
    expect(weekQualifies(memberIds, segments)).toBe(false);
  });

  it('a same-faction matchup still counts — any match qualifies', () => {
    const memberIds = new Set(['a1', 'a2']);
    const segments = [matchSegment(0, ['a1', 'a2'])];
    expect(weekQualifies(memberIds, segments)).toBe(true);
  });

  it('an unresolved segment does not count', () => {
    const memberIds = new Set(['a1']);
    const segments = [matchSegment(0, ['a1', 'x'], false)];
    expect(weekQualifies(memberIds, segments)).toBe(false);
  });

  it('a non-match segment does not count', () => {
    const memberIds = new Set(['a1']);
    const segments = [{ ...matchSegment(0, ['a1', 'x']), kind: 'promo' as const }];
    expect(weekQualifies(memberIds, segments)).toBe(false);
  });
});

describe('buildForcedSegment', () => {
  it('puts every current member of each stable on its own side, locked and stipulated', () => {
    const a = stable('faction-a', ['a1', 'a2', 'a3', 'a4']);
    const b = stable('faction-b', ['b1', 'b2', 'b3', 'b4', 'b5']);
    const segment = buildForcedSegment(5, a, b);
    expect(segment.slot).toBe(5);
    expect(segment.kind).toBe('match');
    expect(segment.stipulation).toBe('factionDestroyer');
    expect(segment.systemForced).toBe('factionDestroyer');
    expect(segment.participants.filter((p) => p.side === 0).map((p) => p.wrestlerId)).toEqual(a.memberIds);
    expect(segment.participants.filter((p) => p.side === 1).map((p) => p.wrestlerId)).toEqual(b.memberIds);
    expect(segment.rules.ruleStrictness).toBe('none');
    expect(segment.rules.timeLimit).toBe(0);
  });
});

describe('resolveFactionDestroyer', () => {
  it('returns null for a draw (no winner side)', () => {
    const result = resolveFactionDestroyer(
      { winnerSide: null, factionEliminationOrder: [] },
      'faction-a',
      'faction-b',
    );
    expect(result).toBeNull();
  });

  it('maps winnerSide 0/1 back to the right stable ids', () => {
    const result = resolveFactionDestroyer(
      { winnerSide: 0, factionEliminationOrder: ['l1'] },
      'faction-a',
      'faction-b',
    );
    expect(result!.winnerStableId).toBe('faction-a');
    expect(result!.loserStableId).toBe('faction-b');
  });

  it('releases exactly the first two eliminated, regardless of which side they were on', () => {
    // The real chronological order — not the trimmed highlight reel in
    // `beats`, which cannot answer "who went out first."
    const factionEliminationOrder = ['w1', 'l1', 'l2', 'l3']; // w1: winner-side, eliminated early
    const result = resolveFactionDestroyer({ winnerSide: 0, factionEliminationOrder }, 'faction-a', 'faction-b');
    expect(result!.releasedIds).toEqual(['w1', 'l1']);
  });

  it('falls back to no releases when the order is missing', () => {
    const result = resolveFactionDestroyer(
      { winnerSide: 0, factionEliminationOrder: undefined },
      'faction-a',
      'faction-b',
    );
    expect(result!.releasedIds).toEqual([]);
  });
});
