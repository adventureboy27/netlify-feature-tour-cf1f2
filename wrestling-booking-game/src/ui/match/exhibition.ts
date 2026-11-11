// A match the viewer can play that the simulation recorded only as a result.
//
// The player's own shows keep every beat of every match. A joint show with
// another company, and the interpromotional tournament, keep the outcome —
// who, against whom, who won and how — and nothing in between. This turns
// that outcome into something the ring can show.
//
// DESIGN: nothing here decides anything. The winner, the loser and the
// finish are the simulation's, read off the result; what is made up is the
// shape of the match on the way there, the same way stageMatch already makes
// up the unspoken work between recorded beats. It is a fixed shape, with no
// dice in it: the loser has the early going, the winner comes back, and it
// ends the way the result says it ended. There is no commentary, because
// nobody called it.

import type { FinishType, Id, MatchBeat, MatchRules, Segment, SegmentResult, SegmentRole } from '../../engine/types';

/** As much of a booked segment as the viewer reads. */
export type WatchSegment = Pick<Segment, 'participants' | 'stipulation' | 'rules' | 'titleIds' | 'managerIds'>;
/** As much of its result. */
export type WatchResult = Pick<SegmentResult, 'beats' | 'commentary' | 'finish' | 'winnerSide' | 'winnerWrestlerIds' | 'titleChanged' | 'injuries'>;

const RULES: MatchRules = {
  preset: 'singles',
  format: 'individuals',
  ruleStrictness: 'strict',
  aim: 'firstFall',
  falls: 'pinsAndSubs',
  timeLimit: 20,
  stoppage: 'referee',
  countOuts: 'normal',
  reward: 'none',
  pace: 'standard',
};

export function exhibitionOf(sides: readonly [readonly Id[], readonly Id[]], winnerIds: readonly Id[], finish: FinishType, stipulation: Id | null = null): { segment: WatchSegment; result: WatchResult } {
  const winningSide = winnerIds.length === 0 ? null : sides[0].some((id) => winnerIds.includes(id)) ? 0 : 1;
  const up = sides[winningSide ?? 0];
  const down = sides[winningSide === 0 ? 1 : 0];
  const w = (i: number) => up[i % up.length]!;
  const l = (i: number) => down[i % down.length]!;
  const beat = (kind: MatchBeat['kind'], actorId: Id, targetId: Id): MatchBeat => ({ kind, text: '', significant: true, actorId, targetId });
  const beats: MatchBeat[] = [
    beat('openingExchange', w(0), l(0)),
    beat('control', l(0), w(0)),
    beat('control', l(1), w(0)),
    beat('nearFall', l(1), w(0)),
    beat('hopeSpot', w(0), l(1)),
    beat('control', w(1), l(1)),
    beat('signature', w(1), l(0)),
    beat('nearFall', w(1), l(0)),
    beat('hopeSpot', l(0), w(1)),
    beat('control', l(0), w(0)),
    beat('hopeSpot', w(0), l(0)),
    beat('signature', w(0), l(0)),
    beat('finish', w(0), l(0)),
  ];
  const team = Math.max(sides[0].length, sides[1].length) > 1;
  const participants: SegmentRole[] = sides.flatMap((side, n) => side.map((wrestlerId) => ({ wrestlerId, role: 'competitor', side: n }) as SegmentRole));
  return {
    segment: { participants, stipulation, rules: team ? { ...RULES, preset: 'tag', format: 'teams' } : RULES, titleIds: [], managerIds: [] },
    result: { beats, commentary: [], finish, winnerSide: winningSide, winnerWrestlerIds: [...winnerIds], titleChanged: false, injuries: [] },
  };
}
