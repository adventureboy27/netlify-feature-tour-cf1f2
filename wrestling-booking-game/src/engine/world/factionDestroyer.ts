// Faction Destroyer — an unlockable elimination war between two factions.
// See docs/BACKLOG.md for the full story. The short version: once the player
// has two factions (4+ member Stables) at once, this locks onto that pair
// and starts a countdown. Every week with a match involving a member of
// either faction ticks it down by one; a quiet week just doesn't move it.
// Membership of both factions is frozen for the duration (see store.ts's
// canKickFromGroup call site and its weekly defection/implosion loop) —
// additions are still allowed, so the booker can even up lopsided sides.
// When the countdown hits zero, the match is forced onto the next show's
// main event — no booker choice. The mechanics of the match itself live in
// sim/factionDestroyer.ts; this module only decides when it starts, whether
// a week counts, what the forced card slot looks like, and — once the match
// has a result — who gets released and which side(s) end up disbanded.

import type { DeckStacking, Id, MatchRules, Segment, SegmentResult, Stable } from '../types';
import { DEFAULT_PACE } from '../../data/pacing';

export interface FactionDestroyerStory {
  stableAId: Id;
  stableBId: Id;
  stableAName: string;
  stableBName: string;
  triggeredWeek: number;
  /** Only decrements on a week with a qualifying match. */
  weeksRemaining: number;
  /** Set once weeksRemaining hits 0 — the week the forced match belongs to. */
  matchScheduledForWeek: number | null;
}

/**
 * The first two non-disbanded factions (4+ members), in array order — "the
 * first two that ever coexist," not a booker pick. A third or later faction
 * simply isn't eligible until the active story resolves.
 */
export function eligiblePair(stables: readonly Stable[]): [Stable, Stable] | null {
  const factions = stables.filter((s) => s.kind === 'stable' && s.disbandedWeek === null);
  if (factions.length < 2) return null;
  return [factions[0]!, factions[1]!];
}

export function beginFactionDestroyer(stableA: Stable, stableB: Stable, week: number, countdownWeeks: number): FactionDestroyerStory {
  return {
    stableAId: stableA.id,
    stableBId: stableB.id,
    stableAName: stableA.name,
    stableBName: stableB.name,
    triggeredWeek: week,
    weeksRemaining: countdownWeeks,
    matchScheduledForWeek: null,
  };
}

/**
 * Did a resolved match this week involve a member of either faction? Any
 * match counts, same-faction matchups included — the loosest possible
 * containment test, on purpose ("any match will count").
 */
export function weekQualifies(memberIds: ReadonlySet<Id>, resolvedSegments: readonly Segment[]): boolean {
  return resolvedSegments.some(
    (seg) => seg.kind === 'match' && seg.result !== null && seg.participants.some((p) => p.role === 'competitor' && memberIds.has(p.wrestlerId)),
  );
}

/** Builds the forced main-event segment — every current member of each stable, one side apiece. */
export function buildForcedSegment(slot: number, stableA: Stable, stableB: Stable): Pick<
  Segment,
  'slot' | 'kind' | 'participants' | 'rules' | 'stipulation' | 'titleIds' | 'deckStacking' | 'result' | 'systemForced'
> {
  return {
    slot,
    kind: 'match',
    participants: [
      ...stableA.memberIds.map((wrestlerId) => ({ wrestlerId, side: 0, role: 'competitor' as const })),
      ...stableB.memberIds.map((wrestlerId) => ({ wrestlerId, side: 1, role: 'competitor' as const })),
    ],
    rules: {
      preset: 'battleRoyal',
      format: 'elimination',
      ruleStrictness: 'none',
      aim: 'lastStanding',
      falls: 'anyMeans',
      timeLimit: 0,
      stoppage: 'none',
      countOuts: 'none',
      reward: 'stipulation',
      pace: DEFAULT_PACE,
    } satisfies MatchRules,
    stipulation: 'factionDestroyer',
    titleIds: [],
    deckStacking: {
      favoredSideIndex: null,
      assignedReferee: null,
      ringsideManagers: [],
      plannedRunIn: null,
      lumberjacks: [],
      preMatchAngle: 'none',
      instructions: 'callItInTheRing',
    } satisfies DeckStacking,
    result: null,
    systemForced: 'factionDestroyer',
  };
}

export interface FactionDestroyerOutcome {
  /** Whichever stable id lost — always disbands regardless of remaining headcount. */
  loserStableId: Id;
  winnerStableId: Id;
  /** First two eliminated overall, whichever side — the ones who get released. */
  releasedIds: Id[];
}

/**
 * Pure decision only — who gets released, which stable lost. The actual
 * mutations (exitTerms/letThemGo, disbanding, wire lines) are store.ts's
 * job, same split stipulationConsequence() and its store.ts consumer
 * already use.
 *
 * Reads `factionEliminationOrder`, not `beats` — `beats` is a highlight
 * reel, capped and evenly spread across the real order (see
 * narrative.ts's ELIMINATION_BEATS_MAX), so it cannot reliably answer "who
 * went out first" the way the real, full order can.
 */
export function resolveFactionDestroyer(
  result: Pick<SegmentResult, 'winnerSide' | 'factionEliminationOrder'>,
  stableAId: Id,
  stableBId: Id,
): FactionDestroyerOutcome | null {
  if (result.winnerSide === null) return null;
  const winnerStableId = result.winnerSide === 0 ? stableAId : stableBId;
  const loserStableId = result.winnerSide === 0 ? stableBId : stableAId;
  const releasedIds = (result.factionEliminationOrder ?? []).slice(0, 2);
  return { loserStableId, winnerStableId, releasedIds };
}
