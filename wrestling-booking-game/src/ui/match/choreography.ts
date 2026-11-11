// What two wrestlers physically do during one beat of a match.
//
// The viewer has no skeleton to animate — a wrestler is one rigid figure —
// so a move is told the way a paper puppet tells it: where each body goes,
// how far it tips, and where the impact lands. Each table below is a short
// list of key poses for the attacker and the target.
//
// A pose is [time 0..1, forward, up, lean, squash?]:
//   forward — toward the opponent, in stage units (the two start GAP apart)
//   up      — off the mat
//   lean    — degrees, positive tips toward the opponent; ±90 is flat on the mat
//   squash  — vertical scale, for a crouch or a body taking an impact
// Rotation pivots on the feet, so a lean of 180 with the feet held high is a
// wrestler held upside down.
//
// One hard limit when writing a new one: a body flat on its back reaches
// about 20 units behind its own feet, and the ropes are 29 from centre.
// Keep `forward` at 0 or more for any -90 landing or the head ends up in
// the front row. Likewise `up`: a standing figure is about 20 tall and the
// stage has roughly 34 above the mat, so nobody upright goes above 12.
//
// Nothing here decides anything about the match. It only stages a beat the
// simulation already produced.

import type { FinishType, Move, MoveStyle, MoveType, Wrestler } from '../../engine/types';
import type { PlaybackBeat } from '../../engine/sim/matchPlayback';

export type Frame = readonly [at: number, x: number, y: number, rot: number, sy?: number];
/** Where a hit lands, in the TARGET's own frame: [time, forward, up, big?]. */
export type Impact = readonly [at: number, x: number, y: number, big?: boolean];

export interface Choreo {
  actor: readonly Frame[];
  target: readonly Frame[];
  impacts?: readonly Impact[];
  /** A moment the ropes take somebody's weight. */
  ropes?: number;
  /** The referee's count, if this beat has a cover in it. */
  cover?: { from: number; to: number; count: 2 | 3; at: number };
}

/** Distance between the two wrestlers' home marks, in stage units. */
export const GAP = 14;
/** How far off the mat a body's centreline sits when it is lying down. */
const DOWN = 2;

const STAND: Frame = [0, 0, 0, 0];

const MOVES = {
  lockup: {
    actor: [STAND, [0.2, 5.5, 0, 8], [0.4, 6.5, 0, 13], [0.55, 4.5, 0, 5], [0.7, 6.8, 0, 13], [0.85, 4, 0, 4], [1, 0, 0, 0]],
    target: [STAND, [0.2, 5.5, 0, 8], [0.4, 4.5, 0, 4], [0.55, 6.5, 0, 13], [0.7, 4.2, 0, 3], [0.85, 4, 0, 4], [1, 0, 0, 0]],
  },
  strike: {
    actor: [STAND, [0.25, 4, 0, -8], [0.4, 9, 0, 16], [0.55, 7, 0, 4], [1, 0, 0, 0]],
    target: [STAND, [0.4, 0, 0, 0], [0.5, -3, 0, -18], [0.65, -4, 0, -10], [1, 0, 0, 0]],
    impacts: [[0.42, 2, 12]],
  },
  flurry: {
    actor: [STAND, [0.12, 7, 0, 13], [0.22, 5, 0, 0], [0.34, 8, 0, 15], [0.44, 6, 0, 0], [0.58, 10, 0.6, 20], [0.72, 7, 0, 2], [1, 2, 0, 0]],
    target: [STAND, [0.12, 0, 0, 0], [0.18, -2, 0, -13], [0.3, -2, 0, -4], [0.4, -4, 0, -15], [0.52, -4, 0, -5], [0.64, -7, 0, -26], [0.8, -7, 0, -12], [1, -5, 0, 0]],
    impacts: [[0.14, 2, 12], [0.36, 1, 11], [0.6, -1, 12, true]],
  },
  hold: {
    actor: [STAND, [0.2, 7.5, 0, 6], [0.35, 8, 0, 10], [0.5, 8, 0, 15], [0.65, 8, 0, 10], [0.8, 8, 0, 15], [1, 4, 0, 0]],
    target: [STAND, [0.2, 3, 0, 12], [0.35, 3.5, 0, 40], [0.5, 3.5, 0, 45], [0.65, 3.5, 0, 38], [0.8, 3.5, 0, 45], [1, 0, 0, 0]],
  },
  slam: {
    actor: [STAND, [0.18, 7, 0, 8], [0.4, 7, 0, -7], [0.55, 7, 0, 10], [0.68, 7, 0, 24, 0.93], [0.85, 6, 0, 6], [1, 5, 0, 0]],
    target: [STAND, [0.18, 2, 0, 0], [0.4, 4, 9, -80], [0.55, 4, 10.5, -96], [0.68, 2, DOWN, -90, 0.9], [0.75, 2, DOWN + 1, -90], [0.82, 2, DOWN, -90], [1, 2, DOWN, -90]],
    impacts: [[0.68, -6, 1, true]],
  },
  suplex: {
    actor: [STAND, [0.15, 6, 0, 6], [0.33, 6.5, 0, -8], [0.48, 6.5, 0, -26], [0.62, 6.5, 0, -62], [0.72, 6.5, 0.5, -76], [0.86, 6.5, 0, -40], [1, 6, 0, 0]],
    target: [STAND, [0.15, 2, 0, 5], [0.33, 5, 14, 120], [0.48, 8, 21, 180], [0.62, 16, 12, 240], [0.72, 21, DOWN, 270, 0.9], [0.78, 21, DOWN + 1, 270], [0.85, 21, DOWN, 270], [1, 21, DOWN, 270]],
    impacts: [[0.72, 13, 1, true]],
  },
  powerbomb: {
    actor: [STAND, [0.15, 7, 0, 13], [0.35, 7, 0, -6], [0.5, 7, 0, -9], [0.68, 8, 0, 36, 0.92], [0.85, 8, 0, 20], [1, 7, 0, 0]],
    target: [STAND, [0.15, 3, 0, 12], [0.35, 5, 8.5, -10], [0.5, 5, 9.5, -5], [0.68, 1, DOWN, -90, 0.88], [0.74, 1, DOWN + 1.4, -90], [0.82, 1, DOWN, -90], [1, 1, DOWN, -90]],
    impacts: [[0.68, -7, 1, true]],
  },
  driver: {
    actor: [STAND, [0.2, 6, 0, 8], [0.4, 6, 0, -5], [0.55, 6, 1, -5], [0.66, 6, 0, 0, 0.8], [0.8, 6, 0, 0, 0.86], [1, 5, 0, 0]],
    target: [STAND, [0.2, 4, 0, 30], [0.4, 5, 17, 180], [0.55, 5, 19, 180], [0.66, 5, 16, 180], [0.72, 5, 17, 180], [0.9, 9, DOWN, 270], [1, 9, DOWN, 270]],
    impacts: [[0.66, 5, 0.5, true]],
  },
  stunner: {
    actor: [STAND, [0.2, 8, 0, 0], [0.35, 8.5, 0, -10], [0.5, 8.5, 0, 0, 0.7], [0.65, 8.5, 0, 0, 0.76], [1, 5, 0, 0]],
    target: [STAND, [0.2, 2, 0, 8], [0.35, 3, 0, 22], [0.5, 3, 0, 32, 0.9], [0.6, 1, 3, -10], [0.75, 2, DOWN, -60], [0.85, 1, DOWN, -90], [1, 1, DOWN, -90]],
    impacts: [[0.5, 6, 11, true]],
  },
  clothesline: {
    actor: [STAND, [0.15, -3, 0, -8], [0.45, 11, 0, 15], [0.6, 16, 0, 8], [0.8, 18, 0, 0], [1, 18, 0, 0]],
    target: [STAND, [0.42, 0, 0, 0], [0.5, 0, 3, -50], [0.6, 0, 4, -100], [0.68, 0, DOWN, -90, 0.92], [0.74, 0, DOWN + 0.8, -90], [1, 0, DOWN, -90]],
    impacts: [[0.45, 1, 13, true]],
  },
  whip: {
    actor: [STAND, [0.12, 5, 0, 8], [0.25, 4, 0, -20], [0.5, 2, 0, 0], [0.7, 5, 0, -8], [0.76, 8, 0, 17], [1, 5, 0, 0]],
    target: [STAND, [0.12, 4, 0, 10], [0.38, -13, 0, -6], [0.48, -14.5, 0, -15], [0.72, 6, 0, 10], [0.78, 6, 3, -50], [0.86, 4, DOWN, -90, 0.92], [1, 4, DOWN, -90]],
    impacts: [[0.76, 5, 12]],
    ropes: 0.47,
  },
  aerial: {
    actor: [STAND, [0.15, -9, 0, 0], [0.3, -13, 8, 0], [0.42, -13, 8, 0, 0.88], [0.6, 1, 12.5, 60], [0.74, 10, 3.6, 90], [0.8, 10, 4.4, 90], [1, 10, 3.6, 90]],
    target: [STAND, [0.1, 1, 0, -14], [0.22, 1, DOWN, -90], [0.7, 1, DOWN, -90], [0.76, 1, DOWN - 0.4, -90, 0.84], [0.85, 1, DOWN, -90], [1, 1, DOWN, -90]],
    impacts: [[0.74, -9, 2, true]],
    ropes: 0.44,
  },
  submission: {
    actor: [STAND, [0.2, 6, 0, 8], [0.38, 7, 0, -8], [0.5, 7, 0, -16], [0.6, 7, 0, -10], [0.7, 7, 0, -18], [0.8, 7, 0, -10], [0.9, 7, 0, -18], [1, 7, 0, -12]],
    target: [STAND, [0.2, 2, 0, 30], [0.38, 1, DOWN, 90], [0.5, 1.4, DOWN, 90], [0.6, 0.8, DOWN, 90], [0.7, 1.4, DOWN, 90], [0.8, 0.8, DOWN, 90], [0.9, 1.4, DOWN, 90], [1, 1, DOWN, 90]],
  },
  elimination: {
    actor: [STAND, [0.2, 7, 0, 10], [0.4, 8, 0, -10], [0.55, 9, 0, 22], [1, 5, 0, 0]],
    target: [STAND, [0.2, 1, 0, 5], [0.4, 2, 8, -40], [0.55, -6, 15, -110], [0.7, -17, 14, -190], [0.85, -24, -2, -250], [1, -25, -6.5, -270]],
    ropes: 0.6,
  },
  botch: {
    actor: [STAND, [0.25, 5, 2, 10], [0.4, 8, 3, 60], [0.5, 10, DOWN, 90], [0.6, 10, DOWN + 0.7, 90], [0.8, 10, DOWN, 90], [1, 10, DOWN, 90]],
    target: [STAND, [0.45, 0, 0, 0], [0.55, -2, 0.6, -6], [0.7, -2, 0, 0], [1, -2, 0, 0]],
  },
  // Somebody at ringside got involved: the target is hit from behind.
  blindside: {
    actor: [STAND, [1, 0, 0, 0]],
    target: [STAND, [0.4, 0, 0, 0], [0.5, 3, 0, 26], [0.7, 5, 1, 55], [0.85, 5, DOWN, 90], [1, 5, DOWN, 90]],
    impacts: [[0.45, -2, 12, true]],
  },
  still: { actor: [STAND, [1, 0, 0, 0]], target: [STAND, [1, 0, 0, 0]] },
} as const satisfies Record<string, Choreo>;

export type MoveId = keyof typeof MOVES;

const BY_TYPE: Record<MoveType, MoveId> = {
  slam: 'slam',
  suplex: 'suplex',
  submission: 'submission',
  strike: 'flurry',
  aerial: 'aerial',
  driver: 'driver',
  stunner: 'stunner',
  powerbomb: 'powerbomb',
  clothesline: 'clothesline',
};

// What somebody does when they are simply in control, by how they wrestle.
const CONTROL: Record<MoveStyle, readonly MoveId[]> = {
  power: ['slam', 'clothesline', 'hold', 'strike'],
  technical: ['hold', 'suplex', 'strike', 'slam'],
  aerial: ['strike', 'clothesline', 'suplex', 'strike'],
  strike: ['strike', 'flurry', 'clothesline', 'strike'],
  brawl: ['strike', 'flurry', 'slam', 'clothesline'],
};

const scale = (frames: readonly Frame[], to: number): Frame[] => frames.map(([at, ...rest]) => [at * to, ...rest] as Frame);

/** A lean brought back into -180..180, so "270" and "-90" are the same pose. */
export function normalizeRot(rot: number): number {
  const r = ((rot % 360) + 540) % 360 - 180;
  return r === -180 ? 180 : r;
}

/**
 * Plays `base` in the first `split` of the beat, then has the attacker hook
 * the leg. `count` 2 is a kickout; 3 is the finish.
 */
function withCover(base: Choreo, split: number, count: 2 | 3): Choreo {
  const actor = scale(base.actor, split);
  const target = scale(base.target, split);
  const last = target[target.length - 1]!;
  // The cover only reads if the target is flat on their back.
  const flat = Math.abs(normalizeRot(last[3]) + 90) < 1;
  const tx = flat ? last[1] : Math.max(0, last[1] - 2);
  if (!flat) target.push([split + 0.07, tx, DOWN, -90]);
  // The target's feet, seen from the attacker's mark, are GAP - tx away; the
  // body lies beyond that. Dropping forward from just short of the feet lays
  // the attacker across it.
  const ax = GAP - tx - 3;
  const down = split + 0.15;
  actor.push([split + 0.06, Math.min(ax, actor[actor.length - 1]![1] + 2), 0, 12], [down, ax, 3.6, 90]);
  if (count === 3) {
    actor.push([1, ax, 3.6, 90]);
    target.push([1, tx, DOWN, -90]);
    return { ...base, actor, target, impacts: base.impacts?.map(([at, ...r]) => [at * split, ...r] as Impact), cover: { from: down, to: 0.97, count, at: tx } };
  }
  actor.push([0.86, ax, 3.6, 90], [0.93, ax - 4, 4, 30], [1, ax - 6, 0, 0]);
  target.push([0.86, tx, DOWN, -90], [0.93, tx, DOWN + 1.5, -70], [1, tx, DOWN, -62]);
  return { ...base, actor, target, impacts: base.impacts?.map(([at, ...r]) => [at * split, ...r] as Impact), cover: { from: down, to: 0.86, count, at: tx } };
}

function moveNamed(wrestler: Wrestler | undefined, name: string | null): Move | undefined {
  if (!wrestler || !name) return undefined;
  const { finisher, secondaryFinisher, signatures } = wrestler.moveSet;
  return [finisher, secondaryFinisher, ...signatures].find((m) => m?.name === name);
}

export interface StagedBeat {
  move: MoveId;
  choreo: Choreo;
  /** Milliseconds the choreography runs for. */
  duration: number;
}

/**
 * The staging for one beat. `actorInRing` is false when the beat's actor is
 * somebody at ringside (a manager) rather than one of the two in the ring.
 */
export function stageBeat(
  beat: PlaybackBeat,
  index: number,
  actor: Wrestler | undefined,
  actorInRing: boolean,
  finish: FinishType,
): StagedBeat {
  const style = actor?.moveSet.style ?? 'brawl';
  const routine = CONTROL[style];
  const named = moveNamed(actor, beat.moveName);
  const pick = (id: MoveId, duration = 1700): StagedBeat => ({ move: id, choreo: MOVES[id], duration });

  switch (beat.pose) {
    case 'exchange':
      return pick('lockup');
    case 'whip':
      return pick('whip');
    case 'control':
      return pick(routine[index % routine.length]!);
    case 'comeback':
      return pick('flurry');
    case 'signature':
      return pick(named ? BY_TYPE[named.type] : routine[(index + 1) % routine.length]!);
    case 'nearFall': {
      const lead = (['slam', 'clothesline', 'suplex', 'stunner'] as const)[index % 4]!;
      return { move: lead, choreo: withCover(MOVES[lead], 0.48, 2), duration: 1800 };
    }
    case 'interference':
      return actorInRing ? pick('strike') : pick('blindside');
    case 'botch':
      return pick('botch');
    case 'elimination':
      return pick('elimination');
    case 'environmental':
      return pick('still');
    case 'finish': {
      const lead: MoveId = named ? BY_TYPE[named.type] : 'slam';
      if (finish === 'submission') return { move: 'submission', choreo: MOVES.submission, duration: 2400 };
      // A hold cannot be pinned out of; put them down with something else first.
      const pinnable: MoveId = lead === 'submission' ? 'slam' : lead;
      if (finish === 'cleanPin' || finish === 'rollup') return { move: pinnable, choreo: withCover(MOVES[pinnable], 0.5, 3), duration: 3000 };
      return { move: pinnable, choreo: MOVES[pinnable], duration: 1900 };
    }
  }
}

/** Where a figure is left standing (or lying) when a choreography ends. */
export type Pose = readonly [x: number, y: number, rot: number];
export const endPose = (frames: readonly Frame[]): Pose => {
  const [, x, y, rot] = frames[frames.length - 1]!;
  return [x, y, normalizeRot(rot)];
};
export const isHome = ([x, y, rot]: Pose) => x === 0 && y === 0 && rot === 0;

/** The share of a beat spent getting back to the mark before the move starts. */
export const LEAD_IN = 0.14;

/**
 * Prepends "get up and get back to your mark" to a set of poses, when the
 * previous beat left this wrestler somewhere else — otherwise a body lying
 * on the mat would blink upright the instant the next beat started.
 */
export function fromPose(frames: readonly Frame[], from: Pose | undefined, lead: number): Frame[] {
  if (lead === 0) return [...frames];
  const start: Frame = from ? [0, from[0], from[1], from[2]] : STAND;
  return [start, ...frames.map(([at, ...rest]) => [lead + at * (1 - lead), ...rest] as Frame)];
}
