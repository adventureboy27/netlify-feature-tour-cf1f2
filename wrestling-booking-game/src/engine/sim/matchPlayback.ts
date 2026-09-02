// Turning a decided match into something a viewer can watch.
//
// The sim has already picked the winner by the time anything here runs — see
// `simulateMatch.ts` — so this file never decides anything. It only stages
// `MatchBeat[]` (prose, no actor/target) into `PlaybackBeat[]` (who's doing
// what to whom, in what shape) for `MatchViewerScreen` to render as portraits
// moving around a ring.
//
// DESIGN: this deliberately re-derives its own copy of the tiny "who's on
// top" flip rule that `commentary.ts`'s `callTheMatch` already tracks,
// instead of importing or refactoring it out of there. `callTheMatch` is
// interwoven with a line budget, an opener/stakes/closer outside the beat
// loop, and same-beat "comeback" replies — extracting a clean per-beat
// momentum state from it safely would be a much bigger, riskier change than
// this feature needs. The cost of duplicating ~10 lines is a ring visual and
// a commentary feed that agree on who's on top at any point in the match
// (thematic sync) rather than a guarantee that a specific line lands on the
// exact beat its pose plays (line-for-line sync) — see docs/BACKLOG.md.
import type { FinishType, Id, MatchBeat, MatchBeatKind, Wrestler } from '../types';

export type BeatPose =
  | 'exchange'
  | 'whip'
  | 'control'
  | 'comeback'
  | 'nearFall'
  | 'signature'
  | 'interference'
  | 'botch'
  | 'environmental'
  | 'elimination'
  | 'finish';

export interface PlaybackBeat {
  kind: MatchBeatKind;
  pose: BeatPose;
  text: string;
  significant: boolean;
  actorId: Id | null;
  targetId: Id | null;
  /** Only ever set for 'signature' and 'finish' — reuses the actor's own MoveSet, never invents a name. */
  moveName: string | null;
}

/** Beats with no clean "one side did something to the other" shape — a ring-side effect, not a pose. */
const NO_ACTOR_KINDS: ReadonlySet<MatchBeatKind> = new Set(['pyroBurn', 'gearFailure']);

function poseFor(kind: MatchBeatKind, index: number): BeatPose {
  switch (kind) {
    case 'openingExchange':
      return 'exchange';
    case 'control':
      // Every 3rd control beat plays as an Irish whip instead of a plain
      // strike — a presentation-only embellishment (the sim has no concept
      // of a whip specifically), picked deterministically by beat index so
      // it never needs a new RNG draw.
      return index % 3 === 0 ? 'whip' : 'control';
    case 'hopeSpot':
      return 'comeback';
    case 'nearFall':
      return 'nearFall';
    case 'signature':
      return 'signature';
    case 'interference':
      return 'interference';
    case 'botch':
      return 'botch';
    case 'pyroBurn':
    case 'gearFailure':
      return 'environmental';
    case 'elimination':
      return 'elimination';
    case 'finish':
      return 'finish';
  }
}

/**
 * Stage a decided match's beats for the viewer.
 *
 * `sideA`/`sideB`/`winningSide` are exactly the shape `commentary.ts`'s
 * `CommentaryContext` already takes — even a multi-man match gets reduced to
 * two corners for narration, so this reuses that same reduction rather than
 * inventing a richer one.
 */
export function buildPlaybackTimeline(
  beats: readonly MatchBeat[],
  sideA: readonly Wrestler[],
  sideB: readonly Wrestler[],
  winningSide: 'a' | 'b' | null,
): PlaybackBeat[] {
  const winners = winningSide === 'b' ? sideB : sideA;
  const losers = winningSide === 'b' ? sideA : sideB;
  const byId = new Map<Id, Wrestler>([...sideA, ...sideB].map((w) => [w.id, w]));

  // The loser takes over first, the winner fights out of it — the same shape
  // `callTheMatch` calls the match in, so a beat that reads as a comeback
  // there reads as one here too. Only ever consulted as a fallback now — most
  // beats carry their own real `actorId`/`targetId`, stamped where they're
  // generated (see narrative.ts); this rotation guess only covers a beat that
  // genuinely doesn't (today, just the interference beat — see BACKLOG.md).
  let onTop: readonly Wrestler[] = losers;
  let inTrouble: readonly Wrestler[] = winners;

  return beats.map((beat, index) => {
    if (beat.kind === 'hopeSpot') {
      const nextOnTop = inTrouble;
      inTrouble = onTop;
      onTop = nextOnTop;
    }
    if (beat.kind === 'finish') {
      onTop = winners;
      inTrouble = losers;
    }

    const pose = poseFor(beat.kind, index);

    const actor = beat.actorId ? (byId.get(beat.actorId) ?? null) : null;
    const target = beat.targetId ? (byId.get(beat.targetId) ?? null) : null;
    // Guess only when the beat truly gave nothing — checked against the raw
    // ids, not the resolved wrestlers. An interference beat can carry a real
    // manager id that will never resolve against `byId` (competitors only),
    // and that id is still meaningful to the viewer; guessing over it would
    // throw away a real actor for a fake one.
    let resolvedActor = actor;
    let resolvedTarget = target;
    if (!beat.actorId && !beat.targetId && !NO_ACTOR_KINDS.has(beat.kind) && onTop.length > 0 && inTrouble.length > 0) {
      resolvedActor = onTop[index % onTop.length]!;
      resolvedTarget = inTrouble[index % inTrouble.length]!;
    }

    let moveName: string | null = null;
    if (resolvedActor) {
      if (pose === 'finish') {
        moveName = resolvedActor.moveSet.finisher.name;
      } else if (pose === 'signature' && resolvedActor.moveSet.signatures.length > 0) {
        moveName = resolvedActor.moveSet.signatures[index % resolvedActor.moveSet.signatures.length]!.name;
      }
    }

    return {
      kind: beat.kind,
      pose,
      text: beat.text,
      significant: beat.significant,
      // A raw id that never resolved against `byId` (a manager, for the
      // interference beat) is still real and worth keeping — only fall
      // through to the guessed wrestler when the beat gave nothing at all.
      actorId: beat.actorId ?? resolvedActor?.id ?? null,
      targetId: beat.targetId ?? resolvedTarget?.id ?? null,
      moveName,
    };
  });
}

/** The big comic-style word the finish earns, once the last pose is held. */
export function finishCallout(finish: FinishType): string {
  switch (finish) {
    case 'cleanPin':
    case 'rollup':
      return '1... 2... 3!';
    case 'submission':
      return 'TAPS OUT!';
    case 'knockout':
      return 'KNOCKED OUT!';
    case 'interference':
      return 'INTERFERENCE!';
    case 'disqualification':
      return 'DISQUALIFICATION!';
    case 'countOut':
      return 'COUNTED OUT!';
    case 'timeLimitDraw':
      return 'TIME LIMIT DRAW!';
    case 'doubleKO':
      return 'DOUBLE KO!';
    case 'refereeStoppage':
      return 'THE REF STOPS IT!';
    case 'injuryStoppage':
      return "IT'S OVER!";
    case 'escape':
      return 'ESCAPE!';
    case 'equipmentFailure':
      return 'IT BROKE!';
  }
}
