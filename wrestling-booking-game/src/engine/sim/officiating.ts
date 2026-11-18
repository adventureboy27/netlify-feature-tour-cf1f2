// The official's part in the match, put where it happened.
//
// Several things that happen to a match are decided after its beats are
// written: what the referee missed (sim/referees.ts), the mugging a corner
// pulls (sim/ringside.ts), who ran in, what a guest referee with an agenda
// did with his hand. Before this file they reached the write-up as separate
// sentences and never reached the match itself, so the viewer showed a
// clean three-count over a foot the write-up says was on the rope.
//
// Every function here takes the beats and gives back beats, with the moment
// either stamped on the beat it belongs to (`official`) or as a beat of its
// own just before the finish. Nothing here rolls the shared stream: line
// choice uses the rng the caller seeds from the segment.
import { pick, type Rng } from '../rng';
import type { FinishType, Id, MatchBeat, OfficialMoment, RefereeMissRecord } from '../types';
import { refereeMissById } from '../../data/refereeMisses';
import {
  DQ_RUN_IN_LINES,
  FAST_COUNT_LINES,
  RUN_IN_LINES,
  SLOW_COUNT_LINES,
  SLOW_NOT_ENOUGH_LINES,
} from '../../data/officiating';

/** Finishes the referee's hand counted three on. */
export const PINFALL_FINISHES: ReadonlySet<FinishType> = new Set(['cleanPin', 'rollup', 'interference']);

/**
 * The finish that ended it: the last one. A manager caught at ringside is
 * written as a finish of its own at the top of the reel (sim/simulateMatch.ts).
 */
const finishAt = (beats: readonly MatchBeat[]) => {
  for (let i = beats.length - 1; i >= 0; i--) if (beats[i]!.kind === 'finish') return i;
  return -1;
};

/** Just before the finish — or at the end, for a reel without one. */
function beforeFinish(beats: readonly MatchBeat[], beat: MatchBeat): MatchBeat[] {
  const i = finishAt(beats);
  const at = i < 0 ? beats.length : i;
  return [...beats.slice(0, at), beat, ...beats.slice(at)];
}

const say = (template: string, names: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => names[key] ?? whole);

/**
 * What the official missed, where he missed it. A miss on the finish is
 * stamped on the finish; a slow count on every count he made; anything else
 * is its own moment just before the finish — said by the miss panel in the
 * write-up, so not repeated in the highlights.
 */
export function placeMiss(
  beats: readonly MatchBeat[],
  miss: RefereeMissRecord,
  ctx: { winnerIds: readonly Id[]; loserIds: readonly Id[]; finish: FinishType },
): MatchBeat[] {
  const kind = refereeMissById(miss.missId);
  if (!kind) return [...beats];
  const official = miss.missId as OfficialMoment;
  const out = beats.map((b) => ({ ...b }));
  const fi = finishAt(out);

  if (kind.when === 'finish') {
    if (fi >= 0) out[fi]!.official = official;
    return out;
  }
  if (kind.when === 'counts') {
    for (const [i, b] of out.entries()) {
      const counted = b.kind === 'nearFall' || (i === fi && PINFALL_FINISHES.has(ctx.finish));
      if (counted && !b.official) b.official = official;
    }
    return out;
  }
  // Missed somebody coming in: it is the run-in (or the corner) he missed.
  if (official === 'missedInterference') {
    const outside = out.findIndex((b) => b.official === 'runIn' || b.official === 'mugging' || b.official === 'distracted');
    if (outside >= 0) {
      out[outside]!.official = official;
      return out;
    }
  }
  const victim = miss.victimId ?? ctx.loserIds[0] ?? null;
  return beforeFinish(out, {
    kind: official === 'missedInterference' ? 'interference' : 'control',
    significant: false,
    text: miss.text,
    official,
    actorId: ctx.winnerIds[0] ?? null,
    targetId: victim,
  });
}

/**
 * A guest referee with an agenda, at work: a fast three for the side he
 * favours, a slow count on the other side's cover. Only where there was a
 * count to make — the agenda already moved the odds (store.ts), and this is
 * the part of it anybody could see.
 */
export function placeGuestCounts(
  beats: readonly MatchBeat[],
  ctx: {
    guestName: string;
    favoured: ReadonlySet<Id>;
    finish: FinishType;
    nameOf: (id: Id) => string;
    rng: Rng;
  },
): MatchBeat[] {
  const out = beats.map((b) => ({ ...b }));
  const names = (b: MatchBeat) => ({
    guest: ctx.guestName,
    coverer: b.actorId ? ctx.nameOf(b.actorId) : 'the challenger',
    pinned: b.targetId ? ctx.nameOf(b.targetId) : 'the champion',
  });
  const against = (b: MatchBeat) =>
    Boolean(b.actorId && b.targetId && !ctx.favoured.has(b.actorId) && ctx.favoured.has(b.targetId));
  const forHim = (b: MatchBeat) => Boolean(b.actorId && ctx.favoured.has(b.actorId));

  // The first cover he slow-counted.
  const near = out.find((b) => b.kind === 'nearFall' && !b.official && against(b));
  if (near) {
    near.official = 'guestSlowCount';
    near.significant = true;
    near.text = `${near.text} ${say(pick(ctx.rng, SLOW_COUNT_LINES), names(near))}`;
  }

  const fi = finishAt(out);
  const finish = fi >= 0 ? out[fi]! : null;
  if (finish && PINFALL_FINISHES.has(ctx.finish) && !finish.official) {
    if (forHim(finish)) {
      finish.official = 'fastCount';
      finish.text = `${finish.text} ${say(pick(ctx.rng, FAST_COUNT_LINES), names(finish))}`;
    } else if (against(finish)) {
      finish.official = 'guestSlowCount';
      finish.text = `${finish.text} ${say(pick(ctx.rng, SLOW_NOT_ENOUGH_LINES), names(finish))}`;
    }
  }
  return out;
}

/**
 * Somebody who is not in the match hits the ring. For the side that wins it
 * is the interference that turned it; for the side that loses it is the
 * disqualification.
 */
export function placeRunIn(
  beats: readonly MatchBeat[],
  ctx: { runnerId: Id; runnerName: string; victimId: Id; victimName: string; disqualified: boolean; rng: Rng },
): MatchBeat[] {
  const line = pick(ctx.rng, ctx.disqualified ? DQ_RUN_IN_LINES : RUN_IN_LINES);
  return beforeFinish(beats, {
    kind: 'interference',
    significant: true,
    text: say(line, { runner: ctx.runnerName, victim: ctx.victimName }),
    official: 'runIn',
    ringsideId: ctx.runnerId,
    actorId: ctx.runnerId,
    targetId: ctx.victimId,
  });
}

/** The mouthpiece holds the official at the ropes while the muscle goes to work on the floor. */
export function placeMugging(
  beats: readonly MatchBeat[],
  ctx: { muscleId: Id; distractorId: Id | null; victimId: Id; text: string },
): MatchBeat[] {
  return beforeFinish(beats, {
    kind: 'interference',
    significant: true,
    text: ctx.text,
    official: 'mugging',
    actorId: ctx.muscleId,
    targetId: ctx.victimId,
    ...(ctx.distractorId ? { ringsideId: ctx.distractorId } : {}),
  });
}

/**
 * Who runs in. An ally — somebody in a team or stable with the side being
 * helped — if there is one in the building; otherwise anybody on the roster
 * who is, because somebody did, and the write-up has to say who.
 */
export function pickRunIn<T extends { id: Id }>(rng: Rng, allies: readonly T[], anybody: readonly T[]): T | null {
  if (allies.length > 0) return pick(rng, allies);
  if (anybody.length > 0) return pick(rng, anybody);
  return null;
}
