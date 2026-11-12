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

import type { FinishType, Id, Move, MoveStyle, MoveType, Wrestler } from '../../engine/types';
import type { PlaybackBeat } from '../../engine/sim/matchPlayback';
import type { StanceId } from './rig';
import { STANDARD, type Conduct } from './conduct';

/**
 * The sixth slot names what the limbs are doing (see rig.ts). Left out, a
 * stance is guessed from what the body as a whole is doing.
 */
export type Frame = readonly [at: number, x: number, y: number, rot: number, sy?: number, stance?: StanceId];
/** Where a hit lands, in the TARGET's own frame: [time, forward, up, big?]. */
export type Impact = readonly [at: number, x: number, y: number, big?: boolean];

export interface Choreo {
  actor: readonly Frame[];
  target: readonly Frame[];
  impacts?: readonly Impact[];
  /** A moment the ropes take somebody's weight. */
  ropes?: number;
  /**
   * The referee's count, if this beat has one in it: over a cover (to
   * three), or standing over somebody who is down (to ten).
   */
  cover?: { from: number; to: number; count: number; at: number };
  /**
   * What a referee would be shouting, without the referee: big words over
   * the ring at the moment they are true. "KICK OUT!!", "TAP OUT!".
   */
  shouts?: readonly Shout[];
}

export interface Shout {
  at: number;
  text: string;
}

/** Distance between the two wrestlers' home marks, in stage units. */
export const GAP = 14;
/** How far off the mat a body's centreline sits when it is lying down. */
export const DOWN = 2;
/** The arena floor, measured from the mat (the ring stands this far above it). */
export const FLOOR = -10.8;
/** A body lying on the arena floor. */
const FLOOR_DOWN = FLOOR + DOWN;
/**
 * The floor in front of the ring, where a fight that spills outside is
 * staged — nearer the camera than the apron, so lower on screen than the
 * floor at the sides where an eliminated wrestler lands.
 */
export const FRONT_FLOOR = -14.3;
const G = FRONT_FLOOR;

const STAND: Frame = [0, 0, 0, 0];

const BODIES = {
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
    actor: [STAND, [0.15, -9, 0, 0], [0.3, -13, 11, 0], [0.42, -13, 11, 0, 0.88], [0.6, 1, 14, 60], [0.74, 10, 3.6, 90], [0.8, 10, 4.4, 90], [1, 10, 3.6, 90]],
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
    target: [STAND, [0.2, 1, 0, 5], [0.4, 2, 8, -40], [0.55, -6, 15, -110], [0.7, -17, 14, -190], [0.85, -24, -2, -250], [1, -25, FLOOR_DOWN, -270]],
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
  dropkick: {
    actor: [STAND, [0.2, 3, 0, -10], [0.42, 7, 7, -80], [0.5, 8, 7, -86], [0.7, 6, DOWN, -90], [0.85, 6, DOWN, -55], [1, 5, 0, 0]],
    target: [STAND, [0.45, 0, 0, 0], [0.52, 0, 1, -30], [0.62, 0, 3, -80], [0.7, 0, DOWN, -90, 0.92], [1, 0, DOWN, -90]],
    impacts: [[0.46, 2, 13, true]],
  },
  superkick: {
    actor: [STAND, [0.25, 5, 0, -25], [0.4, 7, 0, -36], [0.55, 6, 0, -10], [1, 2, 0, 0]],
    target: [STAND, [0.4, 0, 0, 0], [0.5, 0, 1, -30], [0.62, 0, 3, -76], [0.7, 0, DOWN, -90, 0.92], [1, 0, DOWN, -90]],
    impacts: [[0.42, 2, 17, true]],
  },
  headbutt: {
    actor: [STAND, [0.2, 7, 0, 0], [0.35, 8, 0, -13], [0.45, 9, 0, 30], [0.6, 8, 0, 5], [1, 3, 0, 0]],
    target: [STAND, [0.45, 0, 0, 0], [0.52, -1, 0, -24], [0.7, -3, 0, -12], [0.85, -3, 0, 9], [1, -2, 0, 0]],
    impacts: [[0.46, 3, 17]],
  },
  spear: {
    actor: [STAND, [0.15, -3, 0, -6], [0.4, 7, 1, 55], [0.5, 10, 2.4, 80], [0.6, 11, 3.6, 90], [0.68, 11, 4.2, 90], [1, 11, 3.6, 90]],
    target: [STAND, [0.42, 0, 0, 0], [0.5, 0, 3, -60], [0.6, 0, DOWN, -90, 0.9], [0.68, 0, DOWN + 0.6, -90], [1, 0, DOWN, -90]],
    impacts: [[0.45, 1, 9, true]],
  },
  // The target is put down first, then something is dropped on them.
  elbowDrop: {
    actor: [STAND, [0.1, 6, 0, 14], [0.3, 4, 0, 0], [0.45, 6, 7, 20], [0.6, 9, 3.4, 82], [0.66, 9, 3.8, 90], [0.8, 9, 3.4, 90], [1, 8, 0, 0]],
    target: [STAND, [0.1, 0, 0, -18], [0.26, 1, DOWN, -90], [0.6, 1, DOWN, -90], [0.66, 1, DOWN - 0.4, -90, 0.84], [0.76, 1, DOWN, -90], [1, 1, DOWN, -90]],
    impacts: [[0.12, 2, 12], [0.6, -8, 2, true]],
  },
  backBodyDrop: {
    actor: [STAND, [0.3, 2, 0, 24, 0.85], [0.45, 3, 0, -26], [0.6, 3, 0, -10], [1, 2, 0, 0]],
    target: [STAND, [0.3, 7, 0, 12], [0.45, 12, 8, 70], [0.6, 18, 10, 180], [0.72, 22, DOWN, 270, 0.9], [0.78, 22, DOWN + 1, 270], [1, 22, DOWN, 270]],
    impacts: [[0.72, 14, 1, true]],
  },
  cornerSplash: {
    actor: [STAND, [0.1, 5, 0, 8], [0.3, 3, 0, -18], [0.5, 6, 0, 0], [0.68, 25, 2, 12], [0.74, 27, 1, 18], [1, 22, 0, 0]],
    target: [STAND, [0.1, 3, 0, 8], [0.35, -17, 0, -8], [0.45, -18, 0, -13], [0.7, -18, 0, -17, 0.93], [0.85, -15, 0, 12], [1, -10, DOWN, 90]],
    impacts: [[0.7, -16, 12, true]],
    ropes: 0.45,
  },
  // Three more ways off the top turnbuckle, beside `aerial` (an elbow onto a downed opponent).
  missileDropkick: {
    actor: [STAND, [0.15, -9, 0, 0], [0.3, -13, 11, 0], [0.42, -13, 11, 0, 0.88], [0.62, 6, 9, -80], [0.68, 8, 8, -86], [0.82, 7, DOWN, -90], [1, 6, 0, 0]],
    target: [STAND, [0.62, 0, 0, 0], [0.7, 0, 3, -50], [0.8, 0, DOWN, -90, 0.92], [1, 0, DOWN, -90]],
    impacts: [[0.64, 2, 14, true]],
    ropes: 0.44,
  },
  moonsault: {
    actor: [STAND, [0.15, -9, 0, 0], [0.3, -13, 11, 0], [0.42, -13, 11, 0, 0.88], [0.58, -2, 22, -180], [0.7, 8, 12, -250], [0.76, 10, 3.6, -270], [0.82, 10, 4.4, -270], [1, 10, 3.6, -270]],
    target: [STAND, [0.1, 1, 0, -14], [0.22, 1, DOWN, -90], [0.72, 1, DOWN, -90], [0.78, 1, DOWN - 0.4, -90, 0.84], [0.87, 1, DOWN, -90], [1, 1, DOWN, -90]],
    impacts: [[0.76, -9, 2, true]],
    ropes: 0.44,
  },
  crossbody: {
    actor: [STAND, [0.15, -9, 0, 0], [0.3, -13, 11, 0], [0.42, -13, 11, 0, 0.88], [0.6, 2, 12, 70], [0.7, 9, 8, 90], [0.8, 11, 3.6, 90], [1, 11, 3.6, 90]],
    target: [STAND, [0.66, 0, 0, 0], [0.72, 0, 3, -50], [0.8, 0, DOWN, -90, 0.9], [1, 0, DOWN, -90]],
    impacts: [[0.7, 0, 11, true]],
    ropes: 0.44,
  },
  // Two more ways over the top rope, beside `elimination` (a press and toss).
  clotheslineOver: {
    actor: [STAND, [0.15, -3, 0, -8], [0.45, 11, 0, 15], [0.6, 16, 0, 8], [0.75, 20, 0, 14], [1, 19, 0, 0]],
    target: [STAND, [0.42, 0, 0, 0], [0.5, -6, 4, -50], [0.62, -12, 13.5, -140], [0.78, -20, 3, -230], [1, -23, FLOOR_DOWN, -270]],
    impacts: [[0.45, 1, 13, true]],
    ropes: 0.62,
  },
  backdropOver: {
    actor: [STAND, [0.3, 3, 0, 22, 0.85], [0.45, 4, 0, -22], [0.6, 3, 0, -30], [1, 0, 0, 0]],
    target: [STAND, [0.3, 8, 0, 10], [0.45, 14, 8, 60], [0.6, 24, 14, 150], [0.78, 36, 2, 240], [1, 39, FLOOR_DOWN, 270]],
    ropes: 0.62,
  },
  // ---- written to match specific calls on commentary -----------------------
  lockupCorner: {
    actor: [STAND, [0.2, 5.5, 0, 8], [0.4, 6, 0, 12], [0.7, 16, 0, 14], [0.85, 16, 0, 10], [1, 13, 0, 0]],
    target: [STAND, [0.2, 5.5, 0, 8], [0.4, 5, 0, 6], [0.7, -5, 0, -6], [0.8, -6, 0, -11], [1, -6, 0, -4]],
    ropes: 0.72,
  },
  sprawl: {
    actor: [STAND, [0.3, 0, 0, 0], [0.45, -2, 0, 45, 0.8], [0.6, -2, 0, 55, 0.76], [0.8, -1, 0, 30], [1, 0, 0, 0]],
    target: [STAND, [0.25, 3, 0, 20], [0.42, 7, 1, 70], [0.6, 8, DOWN, 90], [0.8, 6, DOWN, 90], [1, 4, 0, 10]],
  },
  shove: {
    actor: [STAND, [0.2, 5, 0, 5], [0.3, 6, 0, 14], [0.45, 5, 0, 0], [0.6, 5, 0, 0], [0.7, 3, 0, -15], [0.85, 2, 0, -6], [1, 2, 0, 0]],
    target: [STAND, [0.3, 4, 0, 0], [0.36, 2, 0, -15], [0.5, 3, 0, 0], [0.62, 5, 0, 5], [0.68, 6, 0, 16], [0.85, 5, 0, 4], [1, 4, 0, 0]],
    impacts: [[0.31, 3, 13]],
  },
  shoulderBlock: {
    actor: [STAND, [0.12, 3, 0, 0], [0.35, -9, 0, -8], [0.42, -10.5, 0, -15], [0.68, 8, 0, 22], [0.8, 9, 0, 8], [1, 8, 0, 0]],
    target: [STAND, [0.66, 0, 0, 0], [0.74, 0, 3, -55], [0.84, 0, DOWN, -90, 0.92], [1, 0, DOWN, -90]],
    impacts: [[0.68, 1, 12, true]],
    ropes: 0.42,
  },
  cornerStomp: {
    actor: [STAND, [0.15, 5, 0, 12], [0.32, 13, 0, 8], [0.45, 14, 0, 0], [0.56, 14, 0, -8], [0.6, 14, 0, 10], [0.72, 14, 0, -8], [0.78, 14, 0, 10], [0.9, 14, 0, -4], [1, 12, 0, 0]],
    target: [STAND, [0.15, -2, 0, -10], [0.32, -7, 0, -8], [0.45, -7, 0, -6], [0.6, -7, 0, -13], [0.68, -7, 0, -6], [0.78, -7, 0, -13], [0.88, -7, 0, -6], [1, -7, 0, -6]],
    impacts: [[0.14, 1, 12], [0.6, -5, 4], [0.78, -5, 4, true]],
    ropes: 0.34,
  },
  groundHold: {
    actor: [STAND, [0.2, 7, 0, 8], [0.35, 9, 0, 18], [0.5, 9, 0, 23], [0.65, 9, 0, 16], [0.8, 9, 0, 23], [1, 9, 0, 18]],
    target: [STAND, [0.2, 2, 0, 15], [0.35, 3, 0, 4], [0.5, 3.3, 0, 8], [0.65, 2.8, 0, 2], [0.8, 3.3, 0, 8], [1, 3, 0, 4]],
  },
  cornerWhip: {
    actor: [STAND, [0.12, 5, 0, 8], [0.28, 4, 0, -20], [0.5, 3, 0, 0], [1, 3, 0, 0]],
    target: [STAND, [0.12, 4, 0, 10], [0.42, -9, 0, -6], [0.5, -10.5, 0, -17], [0.62, -9, 0, 8], [0.75, -8, 0, 42], [0.9, -7, DOWN, 90], [1, -7, DOWN, 90]],
    impacts: [[0.5, -9, 12, true]],
    ropes: 0.5,
  },
  kneeLift: {
    actor: [STAND, [0.25, 6, 0, 0], [0.4, 8, 0.5, -12], [0.5, 8, 0, 0], [1, 4, 0, 0]],
    target: [STAND, [0.4, 1, 0, 0], [0.46, 1, 0.8, 35], [0.6, 1, 0, 42], [0.8, 1, 0, 34], [1, 1, 0, 20]],
    impacts: [[0.42, 3, 9]],
  },
  backbreaker: {
    actor: [STAND, [0.2, 7, 0, 8], [0.4, 7, 0, -6], [0.55, 7, 0, 0], [0.8, 7, 0, 0], [1, 6, 0, 0]],
    target: [STAND, [0.2, 3, 0, 5], [0.4, 4, 7, -80], [0.55, 4, 4.6, -90], [0.62, 4, 5.2, -90], [0.8, 4, 4.6, -90], [1, 3, DOWN, -90]],
    impacts: [[0.55, -5, 5, true]],
  },
  counter: {
    actor: [STAND, [0.25, 0, 0, 0], [0.36, 1, 0, 30, 0.72], [0.5, 3, 0, -10], [0.58, 5, 0, 20], [0.75, 4, 0, 0], [1, 3, 0, 0]],
    target: [STAND, [0.2, 4, 0, 10], [0.35, 8, 0, 18], [0.5, 9, 0, 6], [0.6, 8, 1, -32], [0.72, 7, DOWN, -90, 0.92], [1, 7, DOWN, -90]],
    impacts: [[0.58, 8, 11, true]],
  },
  fireUp: {
    actor: [STAND, [0.15, 0, 0, -8], [0.3, 0, 0.6, 0], [0.42, 0, 0, -6], [0.55, 6, 0, 14], [0.65, 5, 0, 0], [0.78, 8, 0, 16], [1, 5, 0, 0]],
    target: [STAND, [0.5, 0, 0, 0], [0.58, -1, 0, -14], [0.7, -1, 0, -4], [0.82, -3, 0, -20], [1, -3, 0, -8]],
    impacts: [[0.56, 2, 12], [0.79, 0, 12, true]],
  },
  takedown: {
    actor: [STAND, [0.22, 3, 0, 0], [0.4, 5, 0, 10], [0.55, 7, 0, 25, 0.86], [0.7, 7, 0, 10], [1, 5, 0, 0]],
    target: [STAND, [0.2, 4, 0, -8], [0.4, 4, 0, -12], [0.55, 3, 2, -60], [0.68, 2, DOWN, -90, 0.92], [1, 2, DOWN, -90]],
    impacts: [[0.68, -6, 1, true]],
  },
  taunt: {
    actor: [STAND, [0.2, -1, 0, -4], [0.4, -1, 0, -8], [0.7, -1, 0, -8], [1, 0, 0, 0]],
    target: [STAND, [0.3, 0, 0, 8], [0.6, 0, 0, 14], [1, 0, 0, 10]],
  },
  // ---- ground work: the target is already on the mat when these start --------
  stomp: {
    actor: [STAND, [0.2, 8, 0, 0], [0.36, 11, 0, -6], [0.44, 11, 0, 8], [0.6, 11, 0, -6], [0.74, 11, 0, 8], [0.9, 11, 0, 0], [1, 10, 0, 0]],
    target: [[0, 1, DOWN, -90], [0.42, 1, DOWN, -90], [0.46, 1, DOWN - 0.3, -90, 0.9], [0.56, 1, DOWN, -90], [0.72, 1, DOWN, -90], [0.76, 1, DOWN - 0.3, -90, 0.88], [0.88, 1, DOWN, -90], [1, 1, DOWN, -90]],
    impacts: [[0.45, -4, 2], [0.75, -4, 2, true]],
  },
  legDrop: {
    actor: [STAND, [0.2, 8, 0, 0], [0.4, 11, 6, -20], [0.55, 13, 3.4, -80], [0.62, 13, 3.8, -84], [0.8, 13, 3.4, -80], [1, 11, 0, 0]],
    target: [[0, 1, DOWN, -90], [0.52, 1, DOWN, -90], [0.57, 1, DOWN - 0.4, -90, 0.84], [0.68, 1, DOWN, -90], [1, 1, DOWN, -90]],
    impacts: [[0.55, -5, 2, true]],
  },
  groundPound: {
    actor: [STAND, [0.2, 8, 0, 0], [0.35, 14, 2.6, 35], [0.45, 14, 2.6, 52], [0.52, 14, 2.6, 35], [0.62, 14, 2.6, 52], [0.7, 14, 2.6, 35], [0.8, 14, 2.6, 52], [1, 13, 0, 0]],
    target: [[0, 1, DOWN, -90], [0.44, 1, DOWN, -90], [0.47, 1, DOWN - 0.2, -90], [0.6, 1, DOWN, -90], [0.63, 1, DOWN - 0.2, -90], [0.78, 1, DOWN, -90], [0.81, 1, DOWN - 0.2, -90], [1, 1, DOWN, -90]],
    impacts: [[0.45, -6, 3], [0.62, -6, 3], [0.8, -6, 3, true]],
  },
  pickUp: {
    actor: [STAND, [0.25, 9, 0, 30, 0.86], [0.55, 9, 0, 8], [0.68, 8, 0, -8], [0.76, 10, 0, 16], [1, 7, 0, 0]],
    target: [[0, 1, DOWN, -90], [0.3, 1, DOWN, -90], [0.55, 1, 0, -20], [0.7, 1, 0, 0], [0.8, 0, 0, -16], [1, -1, 0, -6]],
    impacts: [[0.77, 2, 12]],
  },
  // ---- going outside, and coming back -------------------------------------
  // Only staged where the match's rules allow it; see stageMatch. These two
  // are written with real heights: `G` is the floor in front of the ring.
  tossOutside: {
    actor: [STAND, [0.2, 7, 0, 10], [0.38, 7, 0, 24], [0.55, 7, 0, 0], [0.72, 6, 1.5, 12], [0.88, 5, G, 0, 0.9], [1, 5, G, 0]],
    target: [STAND, [0.2, 2, 0, 12], [0.38, 2, 1, 70], [0.5, 2, 0.6, 90], [0.66, 2, G + 4, 90], [0.74, 2, G + DOWN, 90, 0.9], [1, 2, G + DOWN, 90]],
    impacts: [[0.74, 8, G + 1, true]],
    ropes: 0.5,
  },
  rollInside: {
    actor: [[0, 0, G, 0], [0.25, 8, G, 28, 0.88], [0.45, 8, G, -8], [0.62, 8, G, 6], [0.8, 7, 1.5, 14], [0.92, 6, 0, 0, 0.9], [1, 6, 0, 0]],
    target: [[0, 1, G + DOWN, -90], [0.25, 1, G + DOWN, -90], [0.45, 1, G + 6, -80], [0.6, 1, 1, -90], [0.7, 1, DOWN, -90], [1, 1, DOWN, -90]],
    ropes: 0.6,
  },
  // ---- what particular rules call for -------------------------------------
  // Thrown face-first into the cage wall. Only where there is one.
  intoCage: {
    actor: [STAND, [0.12, 5, 0, 8], [0.28, 4, 0, -22], [0.5, 3, 0, 0], [0.8, 3, 0, 0], [1, 3, 0, 0]],
    target: [STAND, [0.12, 4, 0, 10], [0.4, -9, 0, -8], [0.48, -10.5, 1.5, -24], [0.58, -10.5, 1, -20], [0.72, -8, 0, 30], [0.88, -6, DOWN, 90], [1, -6, DOWN, 90]],
    impacts: [[0.48, -10, 13, true]],
    ropes: 0.48,
  },
  // Legal only where the rules say there are no disqualifications.
  chairShot: {
    actor: [STAND, [0.25, 5, 0, -14], [0.42, 9, 0, 22], [0.6, 7, 0, 6], [1, 3, 0, 0]],
    target: [STAND, [0.42, 0, 0, 0], [0.5, 0, 2, -45], [0.62, 0, DOWN, -90, 0.92], [1, 0, DOWN, -90]],
    impacts: [[0.43, 2, 15, true]],
  },
  // A battle royal's near thing: bent back over the top rope, and not going.
  teeter: {
    actor: [STAND, [0.2, 6, 0, 10], [0.4, 13, 0, 15], [0.52, 14, 0, 20], [0.7, 14, 0, 18], [0.85, 11, 0, 0], [1, 9, 0, 0]],
    target: [STAND, [0.2, -4, 0, -8], [0.4, -9, 0, -20], [0.52, -9.5, 2, -42], [0.7, -9.5, 2.4, -46], [0.85, -8, 0, -15], [1, -6, 0, 0]],
    ropes: 0.5,
  },
  doubleDown: {
    actor: [STAND, [0.3, 5, 0, 10], [0.45, 7, 0, 16], [0.55, 6, 2, -50], [0.7, 4, DOWN, -90, 0.92], [1, 4, DOWN, -90]],
    target: [STAND, [0.3, 5, 0, 10], [0.45, 7, 0, 16], [0.55, 6, 2, -50], [0.7, 4, DOWN, -90, 0.92], [1, 4, DOWN, -90]],
    impacts: [[0.46, 7, 13, true]],
  },
  // Over the cage wall and down to the floor: the attacker is the one who leaves.
  // Halfway up the cage wall and dragged back down: a cage match's near thing.
  cageClimb: {
    actor: [STAND, [0.1, 6, 0, 14], [0.22, 2, 0, 0], [0.4, -13, 5, 0], [0.56, -13, 11, 0], [0.72, -13, 11, 0], [0.82, -11, 4, -50], [0.92, -9, DOWN, -90], [1, -9, DOWN, -90]],
    target: [STAND, [0.1, 1, 0, -14], [0.22, 1, DOWN, -90], [0.46, 1, DOWN, -90], [0.56, 3, 0.4, -30], [0.68, 22, 0, 8], [0.76, 23, 0, 12], [0.9, 21, 0, 0], [1, 20, 0, 0]],
    impacts: [[0.1, 2, 12], [0.9, -9, 2, true]],
    ropes: 0.44,
  },
  // Both of them up the wall, trading on top of it, and one comes off the hard way.
  cageTop: {
    actor: [STAND, [0.12, 2, 0, 0], [0.3, -13, 5, 0], [0.45, -13, 12.5, 0], [0.6, -13, 12.5, 8], [0.7, -13, 12.5, -6], [0.84, -13, 12.5, 0], [0.94, -12, 3, 0], [1, -11, 0, 0]],
    target: [STAND, [0.15, 10, 0, 8], [0.32, 23.5, 4, 0], [0.47, 23.5, 12, 0], [0.6, 23.5, 12, -8], [0.7, 22, 11, -30], [0.82, 19, 3, -80], [0.9, 18, DOWN, -90], [1, 18, DOWN, -90]],
    impacts: [[0.62, -12, 27], [0.9, -4, 2, true]],
    ropes: 0.4,
  },
  escapeCage: {
    actor: [STAND, [0.1, 6, 0, 14], [0.22, 2, 0, 0], [0.4, -13, 5, 0], [0.56, -13, 13, 0], [0.7, -15.5, 15, -28], [0.85, -19, 2, 0], [1, -19, FLOOR, 0, 0.9]],
    target: [STAND, [0.1, 1, 0, -14], [0.22, 1, DOWN, -90], [1, 1, DOWN, -90]],
    impacts: [[0.1, 2, 12]],
    ropes: 0.44,
  },
  // Up the ladder for whatever is hanging above the ring.
  climbLadder: {
    actor: [STAND, [0.1, 6, 0, 14], [0.22, 4, 0, 0], [0.4, 7, 4, 0], [0.58, 7, 9, 0], [0.74, 7, 12.5, 0], [0.86, 7, 12.5, 0], [1, 7, 12.5, 0]],
    target: [STAND, [0.1, 1, 0, -14], [0.22, 0, DOWN, -90], [1, 0, DOWN, -90]],
    impacts: [[0.1, 2, 12]],
  },
  // Thrown out under the ropes and not followed: what a count-out starts with.
  throwOut: {
    actor: [STAND, [0.2, 7, 0, 10], [0.38, 7, 0, 24], [0.55, 7, 0, 0], [1, 5, 0, 0]],
    target: [STAND, [0.2, 2, 0, 12], [0.38, 2, 1, 70], [0.5, 2, 0.6, 90], [0.66, 2, G + 4, 90], [0.74, 2, G + DOWN, 90, 0.9], [1, 2, G + DOWN, 90]],
    impacts: [[0.74, 8, G + 1, true]],
    ropes: 0.5,
  },
  still: { actor: [STAND, [1, 0, 0, 0]], target: [STAND, [1, 0, 0, 0]] },
} as const satisfies Record<string, Choreo>;

export type MoveId = keyof typeof BODIES;

// What the limbs do, pose by pose, alongside the tables above — one word per
// pose in the same order, "-" to leave it to rig.ts's guess. Kept apart from
// the body tables so each can be read on its own: where the bodies go up
// there, what the arms and legs are doing down here.
const LIMBS: Partial<Record<MoveId, { actor?: string; target?: string }>> = {
  lockup: { actor: '- reach reach reach reach reach -', target: '- reach reach reach reach reach -' },
  strike: { actor: '- wind punch guard -', target: '- guard stagger stagger -' },
  flurry: { actor: '- punch guard punch wind punch guard -' },
  hold: { actor: '- reach choke choke choke choke -', target: '- bend bend bend bend bend -' },
  slam: { actor: '- reach lift lift bend guard -', target: '- guard fall fall flat flat flat flat' },
  suplex: { actor: '- reach carry lift fall flat stagger -', target: '- bend hang hang fall flat flat flat flat' },
  powerbomb: { actor: '- reach lift lift crouch guard -', target: '- bend seated seated flat flat flat flat' },
  driver: { actor: '- reach carry carry seated seated -', target: '- bend hang hang hang hang flat flat' },
  stunner: { actor: '- reach choke seated seated -', target: '- guard bend bend stagger fall flat flat' },
  clothesline: { actor: '- wind clothes clothes run -', target: '- guard fall fall flat flat flat' },
  whip: { actor: '- reach wind guard wind clothes -', target: '- guard run stagger run fall flat flat' },
  aerial: { actor: '- run crouch crouch fly elbowUp cover cover', target: '- stagger flat flat flat flat flat' },
  submission: { actor: '- reach choke carry choke carry choke carry choke', target: '- bend tap flat tap flat tap flat tap' },
  elimination: { actor: '- reach lift punch -', target: '- guard fall fall fall fall flat' },
  botch: { actor: '- run fall flat flat flat flat' },
  blindside: { target: '- guard stagger fall flat flat' },
  dropkick: { actor: '- crouch dropkick dropkick flat stagger -', target: '- guard stagger fall flat flat' },
  superkick: { actor: '- wind kick guard -', target: '- guard stagger fall flat flat' },
  headbutt: { actor: '- reach wind bend guard -', target: '- guard stagger stagger stagger -' },
  spear: { actor: '- crouch spear spear cover cover cover', target: '- guard fall flat flat flat' },
  elbowDrop: { actor: '- punch guard elbowUp elbowUp cover cover -', target: '- stagger flat flat flat flat flat' },
  backBodyDrop: { actor: '- crouch lift guard -', target: '- run fly hang flat flat flat' },
  cornerSplash: { actor: '- reach wind guard run fly guard', target: '- guard run stagger stagger bend flat' },
  missileDropkick: { actor: '- run crouch crouch dropkick dropkick flat -', target: '- guard fall flat flat' },
  moonsault: { actor: '- run crouch crouch tuck fly cover cover cover', target: '- stagger flat flat flat flat flat' },
  crossbody: { actor: '- run crouch crouch fly fly cover cover', target: '- guard fall flat flat' },
  clotheslineOver: { actor: '- wind clothes run punch -', target: '- guard fall fall fall flat' },
  backdropOver: { actor: '- crouch lift lift -', target: '- run fly hang fall flat' },
  lockupCorner: { actor: '- reach reach reach reach guard', target: '- reach reach stagger stagger guard' },
  sprawl: { actor: '- guard bend bend bend guard', target: '- crouch spear flat flat crouch' },
  shove: { actor: '- reach punch guard guard stagger stagger guard', target: '- guard stagger guard reach punch guard guard' },
  shoulderBlock: { actor: '- guard run stagger run clothes guard', target: '- guard fall flat flat' },
  cornerStomp: { actor: '- punch run guard stomp guard stomp guard guard guard', target: '- stagger stagger seated seated seated seated seated seated' },
  groundHold: { actor: '- reach choke choke choke choke choke', target: '- bend seated seated seated seated seated' },
  cornerWhip: { actor: '- reach wind guard guard', target: '- guard run stagger bend bend flat flat' },
  kneeLift: { actor: '- guard knee guard guard', target: '- guard bend kneel kneel bend' },
  backbreaker: { actor: '- reach lift kneel kneel guard', target: '- guard fall fall fall fall flat' },
  counter: { actor: '- guard crouch wind punch guard guard', target: '- run clothes stagger fall flat flat' },
  fireUp: { actor: '- celebrate guard celebrate punch guard punch guard' },
  takedown: { actor: '- guard reach bend guard guard', target: '- kick kick fall flat flat' },
  taunt: { actor: '- celebrate celebrate celebrate guard', target: '- bend bend bend' },
  stomp: { actor: '- run stomp guard stomp guard guard guard', target: 'flat flat flat flat flat flat flat flat' },
  legDrop: { actor: '- run dropkick dropkick dropkick dropkick guard', target: 'flat flat flat flat flat' },
  groundPound: { actor: '- run kneel punch wind punch wind punch guard', target: 'flat flat flat flat flat flat flat flat' },
  pickUp: { actor: '- bend carry wind punch guard', target: 'flat flat stagger guard stagger stagger' },
  tossOutside: { actor: '- reach punch guard crouch crouch guard', target: '- bend spear flat flat flat flat' },
  intoCage: { actor: '- reach wind guard celebrate guard', target: '- guard run stagger stagger bend flat flat' },
  chairShot: { actor: '- swingUp swingDown guard -', target: '- guard fall flat flat' },
  teeter: { actor: '- reach reach punch reach stagger guard', target: '- stagger stagger fall fall stagger guard' },
  doubleDown: { actor: '- run clothes fall flat flat', target: '- run clothes fall flat flat' },
  cageClimb: { actor: '- punch run climb climb climb fall flat flat', target: '- stagger flat flat kneel run reach guard guard' },
  cageTop: { actor: '- run climb climb punch punch celebrate climb guard', target: '- run climb climb punch fall fall flat flat' },
  escapeCage: { actor: '- punch run climb climb tuck fall crouch', target: '- stagger flat flat' },
  climbLadder: { actor: '- punch run climb climb climb lift celebrate', target: '- stagger flat flat' },
  throwOut: { actor: '- reach punch guard celebrate', target: '- bend spear flat flat flat flat' },
  rollInside: { actor: 'guard bend lift guard crouch crouch guard', target: 'flat flat fall flat flat flat' },
};

function withLimbs(frames: readonly Frame[], words: string | undefined): Frame[] {
  const list = words?.split(' ') ?? [];
  return frames.map((frame, i) => {
    const word = list[i];
    return word && word !== '-' ? ([frame[0], frame[1], frame[2], frame[3], frame[4] ?? 1, word as StanceId] as Frame) : frame;
  });
}

const MOVES = Object.fromEntries(
  (Object.entries(BODIES) as [MoveId, Choreo][]).map(([id, move]) => [
    id,
    { ...move, actor: withLimbs(move.actor, LIMBS[id]?.actor), target: withLimbs(move.target, LIMBS[id]?.target) },
  ]),
) as unknown as Record<MoveId, Choreo>;

// ---- where a move happens ----------------------------------------------------
// Most moves happen wherever the two wrestlers already are. Some need a
// particular piece of the ring: a whip needs ropes to hit, a dive needs a
// turnbuckle to climb. `at` is the point in that wrestler's own frame which
// has to sit ON the ropes; ringPhysics.ts moves the whole exchange there.

export interface MoveMeta {
  /** Put this wrestler's `at` on the ropes behind them. */
  anchor?: { who: 'actor' | 'target'; at: number };
  /** The target leaves the ring over the top rope from this time on. */
  exits?: number;
  /** The attacker does (over a cage wall). */
  actorExits?: number;
  /** The target has to be lying on the mat already for this to make sense. */
  needsDown?: boolean;
  /**
   * The move opens by putting the target down, by this time. If the target
   * is down already that opening is skipped and they stay where they lie.
   */
  knockdownBy?: number;
}

export const META: Partial<Record<MoveId, MoveMeta>> = {
  whip: { anchor: { who: 'target', at: -14.5 } },
  intoCage: { anchor: { who: 'target', at: -10.5 } },
  cornerWhip: { anchor: { who: 'target', at: -10.5 } },
  cornerSplash: { anchor: { who: 'target', at: -18 } },
  cornerStomp: { anchor: { who: 'target', at: -8.5 } },
  lockupCorner: { anchor: { who: 'target', at: -7.5 } },
  shoulderBlock: { anchor: { who: 'actor', at: -10.5 } },
  aerial: { anchor: { who: 'actor', at: -13 }, knockdownBy: 0.22 },
  moonsault: { anchor: { who: 'actor', at: -13 }, knockdownBy: 0.22 },
  missileDropkick: { anchor: { who: 'actor', at: -13 } },
  crossbody: { anchor: { who: 'actor', at: -13 } },
  elbowDrop: { knockdownBy: 0.26 },
  elimination: { anchor: { who: 'target', at: -9 }, exits: 0.5 },
  clotheslineOver: { anchor: { who: 'target', at: -9 }, exits: 0.55 },
  backdropOver: { anchor: { who: 'actor', at: -10 }, exits: 0.55 },
  teeter: { anchor: { who: 'target', at: -9.5 } },
  cageClimb: { anchor: { who: 'actor', at: -13 }, knockdownBy: 0.22 },
  cageTop: { anchor: { who: 'actor', at: -13 } },
  escapeCage: { anchor: { who: 'actor', at: -13 }, actorExits: 0.6, knockdownBy: 0.22 },
  climbLadder: { knockdownBy: 0.22 },
  stomp: { needsDown: true },
  legDrop: { needsDown: true },
  groundPound: { needsDown: true },
  pickUp: { needsDown: true },
};

// ---- which move ----------------------------------------------------------------

// What the words say happened. Checked in order against the play-by-play
// line for a beat (and, when the caller had nothing, the beat's own
// highlight text), and against a finisher's or signature's name. This is
// the rule that keeps the ring honest: if the man on the headset says
// "backbreaker", a backbreaker is what happens.
const SAID: readonly (readonly [RegExp, MoveId | 'top' | 'finisher' | 'over'])[] = [
  [/over the top|over the ropes|heaved|over and out|got rid of|on the apron after|landed/i, 'over'],
  [/setting up for/i, 'finisher'],
  // A move that was avoided is not the move that happened: these come
  // before the names of the moves they are about. ("Ducks the clothesline"
  // is a counter, not a clothesline.)
  [/ducks |blocks it|coming in|knees up|boot up|counters?\b/i, 'counter'],
  [/top of the cage|atop the cage|up on the cage|both (of them )?climbing/i, 'cageTop'],
  [/into the (cage|steel|mesh|fence)|off the cage|cage wall/i, 'intoCage'],
  [/buckles|whip into the corner|into the turnbuckle/i, 'cornerWhip'],
  [/reversal|reverses|sends .* across and follows|irish whip/i, 'whip'],
  // Moves by name. The most specific name first: a "missile dropkick" is
  // not a dropkick and an "elbow drop" is not an elbow.
  [/missile dropkick/i, 'missileDropkick'],
  [/moonsault/i, 'moonsault'],
  [/crossbody|cross body|plancha/i, 'crossbody'],
  [/charges into the corner|corner splash|avalanche/i, 'cornerSplash'],
  [/back body drop|hip toss|arm drag|up and over/i, 'backBodyDrop'],
  [/backbreaker/i, 'backbreaker'],
  [/powerbomb|\bbomb!/i, 'powerbomb'],
  [/piledriver|tombstone|brainbuster|\bddt\b|\bdriver\b/i, 'driver'],
  [/stunner|cutter|jawbreaker|neckbreaker/i, 'stunner'],
  [/suplex/i, 'suplex'],
  [/spear|\bgore\b/i, 'spear'],
  [/superkick|enzuigiri|roundhouse/i, 'superkick'],
  [/dropkick/i, 'dropkick'],
  [/clothesline|lariat/i, 'clothesline'],
  [/headbutt/i, 'headbutt'],
  [/leg ?drop/i, 'legDrop'],
  [/drops the elbow|elbow drop|knee drop/i, 'elbowDrop'],
  [/stomps? in the corner/i, 'cornerStomp'],
  [/stomping|stomps/i, 'stomp'],
  [/hauls .* up|drags .* up|off the mat and/i, 'pickUp'],
  [/shoulder block|off the ropes/i, 'shoulderBlock'],
  [/body slam|scoops/i, 'slam'],
  // Then what is being described rather than named.
  [/collar and elbow|backs .* into the corner/i, 'lockupCorner'],
  [/lock up|chain wrestling|feeling-out|test of strength/i, 'lockup'],
  [/goes for the leg|sprawl/i, 'sprawl'],
  [/shove/i, 'shove'],
  [/chinlock|sleeper|grounds |wearing .* down|slows it/i, 'groundHold'],
  [/knee into|knee ?lift|to the midsection/i, 'kneeLift'],
  [/fires back|throwing bombs|is up!|will not stay down/i, 'fireUp'],
  [/right hands|elbow\. elbow|one after another|picking .* apart/i, 'flurry'],
  [/catches the foot|takedown|sweeps? the leg/i, 'takedown'],
  [/calling for it|calling for the end/i, 'taunt'],
  [/up top|going to fly|off the top|top rope|from the top|skyfall|flying|aerial|swanton|shooting star|splash/i, 'top'],
  [/lifts .* up|through the mat/i, 'powerbomb'],
  [/what a shot|caught .* square|\bkick\b/i, 'superkick'],
  [/wristlock|has the arm|armbar|headlock|hammerlock/i, 'hold'],
  [/choke|\block\b|clutch|stretch|\bcrab\b|submission|cloverleaf|figure.?four/i, 'submission'],
  [/slam|hoist|rag doll|threw .* around|picked (them|him|her) up|plucked/i, 'slam'],
  [/first real strike|chop|punch|forearm|uppercut|\bstrikes?\b|\bshot\b/i, 'strike'],
];

function saidIn(text: string | null | undefined): MoveId | 'top' | 'finisher' | 'over' | null {
  if (!text) return null;
  for (const [pattern, move] of SAID) if (pattern.test(text)) return move;
  return null;
}

// A named move's type narrows it to a family; its name picks the member —
// by what the name says if it says anything ("Iron Suplex"), otherwise by a
// hash, so a finisher is always the same move and never a moonsault one
// week and a crossbody the next.
const BY_TYPE: Record<MoveType, readonly MoveId[]> = {
  slam: ['slam', 'backBodyDrop', 'spear', 'backbreaker'],
  suplex: ['suplex'],
  submission: ['submission'],
  strike: ['flurry', 'superkick', 'headbutt', 'dropkick', 'kneeLift'],
  aerial: ['aerial', 'moonsault', 'missileDropkick', 'crossbody'],
  driver: ['driver'],
  stunner: ['stunner'],
  powerbomb: ['powerbomb'],
  clothesline: ['clothesline', 'spear', 'shoulderBlock'],
};
const TOP_ROPE: readonly MoveId[] = ['crossbody', 'missileDropkick', 'aerial', 'moonsault'];
const OVER_THE_TOP: readonly MoveId[] = ['elimination', 'clotheslineOver', 'backdropOver'];

function forMove(move: Move): MoveId {
  const family = BY_TYPE[move.type];
  const named = saidIn(move.name);
  if (named && named !== 'top' && named !== 'finisher' && named !== 'over' && family.includes(named)) return named;
  let hash = 0;
  for (let i = 0; i < move.name.length; i++) hash = (hash * 31 + move.name.charCodeAt(i)) >>> 0;
  return family[hash % family.length]!;
}

// What somebody does when the call does not say: by how they wrestle.
const CONTROL: Record<MoveStyle, readonly MoveId[]> = {
  power: ['slam', 'clothesline', 'headbutt', 'backbreaker', 'cornerSplash', 'hold', 'backBodyDrop', 'kneeLift', 'shoulderBlock'],
  technical: ['hold', 'suplex', 'takedown', 'dropkick', 'groundHold', 'slam', 'kneeLift', 'strike', 'backbreaker'],
  aerial: ['dropkick', 'crossbody', 'strike', 'missileDropkick', 'takedown', 'clothesline', 'suplex', 'superkick'],
  strike: ['strike', 'superkick', 'kneeLift', 'flurry', 'headbutt', 'clothesline', 'dropkick', 'cornerSplash'],
  brawl: ['strike', 'headbutt', 'flurry', 'slam', 'cornerStomp', 'clothesline', 'spear', 'kneeLift', 'cornerWhip'],
};
// What two people do to each other when nobody is calling it — the brawls
// in a battle royal's field. Nothing that needs the ropes, a corner or a
// downed opponent, and nothing that puts anybody out: in a battle royal
// that would be an elimination, and those only happen where the simulation
// says they did.
export const BRAWL: readonly MoveId[] = ['strike', 'headbutt', 'lockup', 'flurry', 'kneeLift', 'clothesline', 'shove', 'hold', 'takedown', 'fireUp', 'dropkick', 'counter', 'slam', 'superkick'];
// With somebody already on the mat, the fight goes down there with them.
const GROUND: readonly MoveId[] = ['stomp', 'elbowDrop', 'pickUp', 'legDrop', 'groundPound', 'aerial', 'moonsault'];
const OPENING: readonly MoveId[] = ['lockup', 'shove', 'hold', 'sprawl', 'lockupCorner', 'shoulderBlock'];
const COMEBACK: readonly MoveId[] = ['fireUp', 'counter', 'flurry', 'takedown', 'dropkick'];
const WHIPS: readonly MoveId[] = ['whip', 'cornerWhip', 'shoulderBlock', 'cornerSplash'];
// What gets somebody a two-count. Every one of these leaves the attacker on
// their feet and the target flat on their back, which is what a cover needs.
const NEAR_FALL_LEADS: readonly MoveId[] = ['slam', 'clothesline', 'suplex', 'stunner', 'dropkick', 'backBodyDrop', 'superkick', 'missileDropkick', 'backbreaker', 'takedown', 'shoulderBlock', 'powerbomb'];

const scale = (frames: readonly Frame[], to: number): Frame[] => frames.map(([at, ...rest]) => [at * to, ...rest] as Frame);

/** A lean brought back into -180..180, so "270" and "-90" are the same pose. */
export function normalizeRot(rot: number): number {
  const r = ((rot % 360) + 540) % 360 - 180;
  return r === -180 ? 180 : r;
}

/** Flat on the mat, either way up. */
export const isDown = (pose: readonly [x: number, y: number, rot: number]) => Math.abs(Math.abs(normalizeRot(pose[2])) - 90) <= 25 && pose[1] <= 5;

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
  if (!flat) target.push([split + 0.07, tx, DOWN, -90, 1, 'flat']);
  // The target's feet, seen from the attacker's mark, are GAP - tx away; the
  // body lies beyond that. Dropping forward from just short of the feet lays
  // the attacker across it.
  const ax = GAP - tx - 3;
  const down = split + 0.15;
  actor.push([split + 0.06, Math.min(ax, actor[actor.length - 1]![1] + 2), 0, 12, 1, 'reach'], [down, ax, 3.6, 90, 1, 'cover']);
  const impacts = base.impacts?.map(([at, ...r]) => [at * split, ...r] as Impact);
  const ropes = base.ropes === undefined ? undefined : base.ropes * split;
  if (count === 3) {
    actor.push([1, ax, 3.6, 90, 1, 'cover']);
    target.push([1, tx, DOWN, -90, 1, 'flat']);
    return { ...base, actor, target, impacts, ropes, cover: { from: down, to: 0.97, count, at: tx } };
  }
  actor.push([0.86, ax, 3.6, 90, 1, 'cover'], [0.93, ax - 4, 4, 30, 1, 'stagger'], [1, ax - 6, 0, 0, 1, 'guard']);
  target.push([0.86, tx, DOWN, -90, 1, 'flat'], [0.93, tx, DOWN + 1.5, -70, 1, 'kickout'], [1, tx, DOWN, -62, 1, 'kickout']);
  return { ...base, actor, target, impacts, ropes, cover: { from: down, to: 0.86, count, at: tx }, shouts: [{ at: 0.87, text: 'KICK OUT!!' }] };
}

/** A cover on somebody who is already down: no move first, just the pin. */
function coverOnly(count: 2 | 3): Choreo {
  const lying: Choreo = { actor: [STAND, [1, 4, 0, 0, 1, 'guard']], target: [[0, 1, DOWN, -90, 1, 'flat'], [1, 1, DOWN, -90, 1, 'flat']] };
  return withCover(lying, 0.2, count);
}

/**
 * Plays `base`, then the attacker steps back and the referee counts over
 * the one who is down — to ten if they stay there, short of it if they
 * beat the count. A last-man-standing match's near fall and its finish.
 */
function withCount(base: Choreo, split: number, count: number, beatsIt: boolean): Choreo {
  const actor = scale(base.actor, split);
  const target = scale(base.target, split);
  const last = target[target.length - 1]!;
  const flat = isDown([last[1], last[2] - (last[2] < FLOOR ? G : 0), last[3]]);
  const [tx, ty, trot] = flat ? [last[1], last[2], last[3]] : [Math.max(0, last[1] - 2), DOWN, -90];
  if (!flat) target.push([split + 0.08, tx, ty, trot, 1, 'flat']);
  const stood = actor[actor.length - 1]!;
  actor.push([split + 0.1, Math.min(stood[1], 2), stood[2], 0, 1, 'guard']);
  const from = split + 0.1;
  if (beatsIt) {
    actor.push([1, Math.min(stood[1], 2), stood[2], 0, 1, 'guard']);
    target.push([0.84, tx, ty, trot, 1, 'flat'], [0.93, tx, ty - DOWN + 0.2, normalizeRot(trot) * 0.3, 1, 'kneel'], [1, tx, ty - DOWN, 0, 1, 'stagger']);
    return { ...base, actor, target, impacts: base.impacts?.map(([at, ...r]) => [at * split, ...r] as Impact), ropes: base.ropes === undefined ? undefined : base.ropes * split, cover: { from, to: 0.84, count, at: tx }, shouts: [{ at: 0.86, text: 'BACK UP!' }] };
  }
  actor.push([0.9, Math.min(stood[1], 2), stood[2], 0, 1, 'guard'], [1, Math.min(stood[1], 2), stood[2], 0, 1, 'celebrate']);
  target.push([1, tx, ty, trot, 1, 'flat']);
  return { ...base, actor, target, impacts: base.impacts?.map(([at, ...r]) => [at * split, ...r] as Impact), ropes: base.ropes === undefined ? undefined : base.ropes * split, cover: { from, to: 0.96, count, at: tx } };
}

/** A hold somebody fights their way out of: a submission match's near fall. */
function holdEscaped(): Choreo {
  const actor = scale(MOVES.submission.actor, 0.8);
  const target = scale(MOVES.submission.target, 0.8);
  actor.push([0.9, 5, 0, -20, 1, 'stagger'], [1, 3, 0, 0, 1, 'guard']);
  target.push([0.9, 1, 0.4, 40, 1, 'kneel'], [1, 1, 0, 8, 1, 'guard']);
  return { actor, target, shouts: [{ at: 0.8, text: 'BREAKS FREE!' }] };
}

function moveNamed(wrestler: Wrestler | undefined, name: string | null): Move | undefined {
  if (!wrestler || !name) return undefined;
  const { finisher, secondaryFinisher, signatures } = wrestler.moveSet;
  return [finisher, secondaryFinisher, ...signatures].find((m) => m?.name === name);
}

/**
 * Where a staged beat takes place. 'out' starts in the ring and ends on the
 * floor; 'in' is the way back; 'floor' is an ordinary move done down there.
 */
export type Zone = 'ring' | 'out' | 'floor' | 'in';

/** What a no-disqualification match finds under the ring. All swung the same way. */
export const WEAPONS = ['chair', 'kendo', 'can'] as const;
export type Weapon = (typeof WEAPONS)[number];
const weaponAt = (n: number): Weapon => WEAPONS[Math.abs(n) % WEAPONS.length]!;

export interface StagedBeat {
  move: MoveId;
  choreo: Choreo;
  meta: MoveMeta;
  /** Absent means the ring. */
  zone?: Zone;
  /** Something in the attacker's hands. */
  prop?: Weapon;
  /** Furniture this beat needs in the ring. */
  scene?: 'ladder' | 'table' | 'flamingTable' | 'casket';
  /** Milliseconds the choreography runs for. */
  duration: number;
}

/** One move by id, as written — for a move reel, or anything else that wants to look at a single move. */
export const stageMove = (move: MoveId, duration = 1700): StagedBeat => ({ move, choreo: MOVES[move], meta: META[move] ?? {}, duration });
export const MOVE_IDS = Object.keys(MOVES) as MoveId[];

/** What the staging needs to know about the moment a beat starts. */
export interface BeatContext {
  /** What the play-by-play man says over this beat, if anything. */
  said: string | null;
  /** The target is lying on the mat as the beat starts. */
  targetDown: boolean;
  /** The last few moves staged, most recent last — so the next one is something else. */
  recent: readonly MoveId[];
  /** The rules this match is fought under. Absent: an ordinary one-fall match. */
  conduct?: Conduct;
}

/** Whether a line says anything the staging can act on at all. */
export const understands = (text: string) => saidIn(text) !== null;

/** The move a line of commentary names outright, if it names one. */
export function moveSaid(text: string | null | undefined): MoveId | null {
  const word = saidIn(text);
  return word && word !== 'top' && word !== 'finisher' && word !== 'over' ? word : null;
}

/**
 * The staging for one beat.
 *
 * In order of authority: what the commentary line says happened; what the
 * beat's own highlight text says; the attacker's named signature or
 * finisher; and only then a choice of our own, which avoids anything staged
 * in the last few beats and goes to the mat if that is where the target is.
 * `actorInRing` is false when the beat's actor is somebody at ringside (a
 * manager) rather than one of the two in the ring.
 */
export function stageBeat(
  beat: PlaybackBeat,
  index: number,
  actor: Wrestler | undefined,
  actorInRing: boolean,
  context: BeatContext = { said: null, targetDown: false, recent: [] },
): StagedBeat {
  const style = actor?.moveSet.style ?? 'brawl';
  const named = moveNamed(actor, beat.moveName);
  const conduct = context.conduct ?? STANDARD;
  const built = (move: MoveId, choreo: Choreo, duration: number): StagedBeat => ({ move, choreo, meta: META[move] ?? {}, duration, ...(move === 'chairShot' ? { prop: weaponAt(index + context.recent.length) } : {}) });
  // Where there are no disqualifications, a chair is one more thing to do.
  // And where there is a cage, the cage is one more thing to hit somebody with.
  const armed = (options: readonly MoveId[]): readonly MoveId[] => {
    const withChair: readonly MoveId[] = conduct.weapons ? [...options.slice(0, 2), 'chairShot', ...options.slice(2)] : options;
    return conduct.cage ? [withChair[0]!, 'intoCage', withChair[1] ?? 'strike', 'cageTop', ...withChair.slice(2)] : withChair;
  };
  // With no ring there are no ropes to run, no corner to be put in and
  // nothing to climb: anything that needs one becomes a slam on the concrete.
  const needsRing = (id: MoveId) => Boolean(META[id]?.anchor || META[id]?.exits || META[id]?.actorExits) || id === 'tossOutside' || id === 'rollInside';
  const grounded = (id: MoveId): MoveId => (conduct.noRing && needsRing(id) ? 'slam' : !conduct.cage && (id === 'intoCage' || id === 'cageTop') ? 'cornerWhip' : id);
  const pick = (id: MoveId, duration = 1700) => built(id, MOVES[id], duration);
  // The same beat with a word shouted over it.
  const shouting = (staged: StagedBeat, text: string, at = 0.8): StagedBeat => ({ ...staged, choreo: { ...staged.choreo, shouts: [...(staged.choreo.shouts ?? []), { at, text }] } });
  // The first of these not staged recently; if they all were, rotate.
  const fresh = (options: readonly MoveId[]): MoveId => {
    const usable = options.filter((id) => ((META[id]?.needsDown ?? false) === false || context.targetDown) && grounded(id) === id);
    const pool = usable.length > 0 ? usable : conduct.noRing ? (['slam'] as const) : options;
    // Start somewhere different in the list each time, or every knockdown
    // would be followed by the same first two things on it.
    const turn = index % pool.length;
    const order = [...pool.slice(turn), ...pool.slice(0, turn)];
    return order.find((id) => !context.recent.includes(id)) ?? order[0]!;
  };
  const resolve = (word: ReturnType<typeof saidIn>): MoveId | null => {
    if (!word) return null;
    if (word === 'top') return fresh(TOP_ROPE);
    if (word === 'over') return fresh(OVER_THE_TOP);
    if (word === 'finisher') return actor ? forMove(actor.moveSet.finisher) : null;
    return word;
  };
  // Commentary first, then the highlight text the beat was written with.
  const said = resolve(saidIn(context.said)) ?? resolve(saidIn(beat.text));
  const heard = said ? grounded(said) : null;
  // Something done to a downed opponent, called while they are on their
  // feet: put them down first, in the same breath. An elbow drop does that
  // by itself; for the rest, the nearest thing that opens with a knockdown.
  const spoken: MoveId | null = heard && META[heard]?.needsDown && !context.targetDown ? (heard === 'stomp' ? 'cornerStomp' : heard === 'pickUp' ? 'strike' : 'elbowDrop') : heard;

  switch (beat.pose) {
    case 'interference':
      return actorInRing ? pick('strike') : pick('blindside');
    case 'botch':
      return pick('botch');
    case 'environmental':
      return pick('still');
    case 'elimination': {
      if (conduct.elimination === 'overTop') return shouting(pick(spoken && OVER_THE_TOP.includes(spoken) ? spoken : fresh(OVER_THE_TOP)), 'ELIMINATED!', 0.82);
      // Anywhere else somebody is eliminated the ordinary way: beaten.
      if (context.targetDown) return shouting(built('still', coverOnly(3), 2200), 'ELIMINATED!', 0.98);
      const lead = fresh(NEAR_FALL_LEADS);
      return shouting(built(lead, withCover(MOVES[lead], 0.5, 3), 3000), 'ELIMINATED!', 0.98);
    }
    case 'nearFall': {
      if (conduct.nearFall === 'teeter') return shouting(pick('teeter', 1900), 'HANGS ON!', 0.72);
      if (conduct.nearFall === 'hold') return built('submission', holdEscaped(), 2200);
      if (conduct.nearFall === 'climb') return shouting(pick('cageClimb', 2800), 'DRAGGED BACK!', 0.8);
      const lead = spoken && NEAR_FALL_LEADS.includes(spoken) ? spoken : fresh(NEAR_FALL_LEADS);
      if (conduct.nearFall === 'count') return built(lead, withCount(MOVES[lead], 0.42, 8, true), 3200);
      if (context.targetDown) return built('still', coverOnly(2), 1600);
      return built(lead, withCover(MOVES[lead], 0.48, 2), 2000);
    }
    case 'finish': {
      const lead: MoveId = grounded(named ? forMove(named) : (spoken ?? 'slam'));
      // Something that leaves the attacker standing over a flat opponent.
      const decisive: MoveId = NEAR_FALL_LEADS.includes(lead) || ['driver', 'stunner', 'superkick'].includes(lead) ? lead : 'slam';
      switch (conduct.finish) {
        case 'submission':
          return shouting(built('submission', MOVES.submission, 2600), 'TAP OUT!', 0.78);
        case 'pin':
          return built(decisive, withCover(MOVES[decisive], 0.5, 3), 3200);
        case 'count10':
          return shouting(built(decisive, withCount(MOVES[decisive], 0.36, 10, false), 4400), 'OUT!', 0.985);
        case 'overTop':
          return shouting(pick(fresh(OVER_THE_TOP), 2000), 'ELIMINATED!', 0.82);
        case 'escape':
          return shouting(pick('escapeCage', 2800), 'ESCAPED!', 0.88);
        case 'climb':
          return { ...shouting(pick('climbLadder', 3200), 'GOT IT!', 0.9), scene: 'ladder' };
        case 'table':
        case 'flamingTable':
          return { ...shouting(pick('powerbomb', 2200), 'THROUGH THE TABLE!', 0.78), scene: conduct.finish };
        case 'casket':
          return { ...shouting(pick('tossOutside', 2400), 'LID SHUT!', 0.9), zone: 'out', scene: 'casket' };
        case 'countOut':
          return { ...shouting(built('throwOut', withCount(MOVES.throwOut, 0.4, 10, false), 4600), 'COUNT OUT!', 0.985), zone: 'out' };
        case 'dq':
          return { ...shouting(pick('chairShot', 1900), 'DISQUALIFIED!', 0.72), prop: 'chair' };
        case 'draw':
          return shouting(pick('lockup', 1900), "TIME'S UP!", 0.7);
        case 'doubleKO':
          return shouting(pick('doubleDown', 2200), 'BOTH DOWN!', 0.75);
        case 'blood':
          return shouting(pick('headbutt', 1900), 'FIRST BLOOD!', 0.7);
        case 'knockout':
          return shouting(built(lead === 'submission' ? 'slam' : lead, MOVES[lead === 'submission' ? 'slam' : lead], 2000), 'KNOCKED OUT!', 0.85);
      }
      // (Unreachable; the switch above is exhaustive. Keeps the compiler honest if a finish is added.)
      return pick(decisive);
    }
    case 'signature':
      return pick(grounded(named ? forMove(named) : (spoken ?? fresh(CONTROL[style].filter((id) => id !== 'hold' && id !== 'strike')))), 1800);
    case 'exchange':
      return pick(spoken ?? fresh(OPENING));
    case 'comeback':
      return pick(spoken ?? fresh(armed(COMEBACK)));
    case 'whip':
      return pick(spoken ?? (context.targetDown ? fresh(GROUND) : fresh(WHIPS)));
    case 'control':
      return pick(spoken ?? (context.targetDown ? fresh(GROUND) : fresh(armed(CONTROL[style]))));
  }
}

/** Where a figure is left standing (or lying) when a choreography ends. */
export type Pose = readonly [x: number, y: number, rot: number];
export const endPose = (frames: readonly Frame[]): Pose => {
  const [, x, y, rot] = frames[frames.length - 1]!;
  return [x, y, normalizeRot(rot)];
};

export interface StagedLine {
  speaker: 'play' | 'colour';
  name: string;
  text: string;
}

/** One beat of the match, fully decided: who, what, and what is said over it. */
export interface MatchMoment {
  beat: PlaybackBeat;
  actorId: Id | null;
  targetId: Id | null;
  staged: StagedBeat;
  lines: readonly StagedLine[];
  /** How long the viewer holds on this beat: the move, plus time to read the call. */
  holdMs: number;
  /**
   * An exchange the simulation did not record and nobody calls — the work
   * between the moments worth a line. See stageMatch.
   */
  filler: boolean;
}

interface CalledLine extends StagedLine {
  beat?: number;
  actorId?: Id;
  targetId?: Id;
}

/**
 * The whole match, staged beat by beat before any of it plays — which move,
 * between whom, under which line. Done in one pass because each beat
 * depends on the last: whether the target is still down, and what has been
 * done recently enough to be boring.
 *
 * `moments` is longer than `timeline`: see the DESIGN note inside on the
 * unspoken exchanges staged between recorded beats.
 *
 * Returns the lines said before the bell and after the finish separately.
 * `synced` is false for a match whose commentary predates per-line beat
 * tags; the viewer then paces the words on their own clock, as it used to.
 */
export function stageMatch(
  timeline: readonly PlaybackBeat[],
  commentary: readonly CalledLine[],
  wrestlers: ReadonlyMap<Id, Wrestler>,
  finish: FinishType,
  options: {
    /** The rules the match is fought under (conduct.ts). Absent: an ordinary one-fall match. */
    conduct?: Conduct;
    /**
     * The two sides of a tag match. With it, the team in control makes its
     * own tags during the unspoken stretches — the sim only says who was in
     * for the moments it recorded, and a team that never tags is not a team.
     */
    teams?: readonly (readonly Id[])[];
  } = {},
): { moments: MatchMoment[]; before: StagedLine[]; after: StagedLine[]; synced: boolean } {
  const synced = commentary.some((line) => line.beat !== undefined);
  const before = synced ? commentary.filter((line) => line.beat === undefined) : [];
  const after: StagedLine[] = synced ? commentary.filter((line) => line.beat !== undefined && line.beat >= timeline.length) : [];

  // With no rulebook given, an ordinary match that ended the way `finish` says.
  const conduct = options.conduct ?? { ...STANDARD, finish: finish === 'submission' ? ('submission' as const) : finish === 'cleanPin' || finish === 'rollup' ? ('pin' as const) : ('knockout' as const) };
  const teams = conduct.tags ? (options.teams ?? []) : [];
  const allowOutside = conduct.outside;
  const recent: MoveId[] = [];
  let downId: Id | null = null;
  const moments: MatchMoment[] = [];
  const stage = (beat: PlaybackBeat, index: number, lines: readonly CalledLine[], filler: boolean, avoid: readonly MoveId[] = []) => {
    const call = lines.find((line) => line.speaker === 'play');
    // If the call names who is on top, those are the two in the ring: the
    // ring may never show one person winning while the words name the other.
    let actorId = call?.actorId ?? beat.actorId;
    let targetId = call?.actorId ? (call.targetId ?? beat.targetId) : beat.targetId;
    // A disqualification is something the LOSER did: it is their chair.
    if (beat.pose === 'finish' && conduct.finish === 'dq') [actorId, targetId] = [targetId, actorId];
    const actor = actorId ? wrestlers.get(actorId) : undefined;
    const staged = stageBeat(beat, index, actor, Boolean(actor), {
      said: call?.text ?? null,
      targetDown: targetId !== null && targetId === downId,
      recent: [...recent.slice(-5), ...avoid],
      conduct,
    });
    recent.push(staged.move);
    downId = targetId && isDown(endPose(staged.choreo.target)) ? targetId : actorId && isDown(endPose(staged.choreo.actor)) ? actorId : null;
    // A beat lasts exactly as long as its move. Nobody stands waiting for
    // the commentary to finish: the time it takes to read what was said is
    // covered by the exchanges that follow (see `between` below).
    moments.push({ beat, actorId: actorId ?? null, targetId: targetId ?? null, staged, lines, holdMs: staged.duration, filler });
  };

  // DESIGN: the simulation records a handful of beats a match — the moments
  // worth a sentence in the write-up. Played back bare that is five moves and
  // a pin. So between two recorded beats the viewer stages the work that
  // connects them: whoever was just on top keeps at it, with moves from their
  // own style, unspoken. Nothing is invented about the result — control only
  // changes hands where the simulation says it did, at the next real beat —
  // and every line of commentary still lands on exactly the move it describes.
  const CARRIES_ON: readonly PlaybackBeat['pose'][] = ['exchange', 'control', 'whip', 'comeback', 'signature', 'nearFall'];
  const most = timeline.length > 16 ? 1 : timeline.length > 9 ? 2 : 4;
  /** Milliseconds it takes to read a line. */
  const reading = (line: StagedLine) => 700 + line.text.length * 30;
  let fillerIndex = 0;
  // A trip to the floor replaces the unspoken work in one gap, about a third
  // of the way in: out, a couple of moves down there, and back, all before
  // the next thing the caller has a line for — which is always in the ring.
  const FLOOR_WORK: readonly MoveId[] = conduct.weapons ? ['whip', 'chairShot', 'slam', 'flurry', 'headbutt', 'clothesline', 'kneeLift', 'suplex'] : ['whip', 'slam', 'flurry', 'headbutt', 'clothesline', 'kneeLift', 'suplex'];
  const outsideAfter = allowOutside && timeline.length >= 4 ? Math.max(1, Math.floor(timeline.length / 3)) : -1;
  const excursion = (actorId: Id, targetId: Id, seed: number) => {
    const filler = (): PlaybackBeat => ({ kind: 'control', pose: 'control', text: '', significant: false, actorId, targetId, moveName: null });
    const add = (move: MoveId, zone: Zone) => {
      moments.push({ beat: filler(), actorId, targetId, staged: { ...stageMove(move, zone === 'floor' ? 1700 : 1900), zone, ...(move === 'chairShot' ? { prop: weaponAt(seed) } : {}) }, lines: [], holdMs: zone === 'floor' ? 1700 : 1900, filler: true });
      recent.push(move);
    };
    add('tossOutside', 'out');
    if (conduct.fallsAnywhere) {
      // Falls count anywhere: so somebody tries for one out here.
      const lead: MoveId = seed % 2 ? 'slam' : 'suplex';
      moments.push({ beat: filler(), actorId, targetId, staged: { move: lead, choreo: withCover(MOVES[lead], 0.48, 2), meta: META[lead] ?? {}, zone: 'floor', duration: 2200 }, lines: [], holdMs: 2200, filler: true });
      recent.push(lead);
    } else
    add(FLOOR_WORK.filter((id) => id !== 'chairShot')[seed % (FLOOR_WORK.length - (conduct.weapons ? 1 : 0))]!, 'floor');
    // Where chairs are legal, the floor is where one gets found.
    add(conduct.weapons ? 'chairShot' : FLOOR_WORK[(seed + 3) % FLOOR_WORK.length]!, 'floor');
    // Whatever the last one did, the target is put down for the trip back.
    add('rollInside', 'in');
    downId = targetId;
  };
  // DESIGN: the simulation decides who wins a two-out-of-three-falls or iron
  // man match, not the score. The picture still has to be that kind of match,
  // so the falls before the last are staged in the unspoken stretches, given
  // to whoever the simulation had on top at that point. The arithmetic is
  // kept honest against the result: the winner's side takes one before the
  // finish, the other side takes one only if there is a place for both —
  // so the decider is always 2-0 or 2-1 (and a draw is one fall each).
  const sideOf = (id: Id | null | undefined) => (id ? (options.teams ?? []).findIndex((team) => team.includes(id)) : -1);
  const sameSide = (a: Id | null, b: Id | null) => Boolean(a && b && (a === b || (sideOf(a) >= 0 && sideOf(a) === sideOf(b))));
  const fallAfter = new Map<number, string>();
  if (conduct.multiFall && timeline.length >= 4) {
    const closer = timeline[timeline.length - 1]!;
    const winner = conduct.finish === 'dq' ? closer.targetId : closer.actorId;
    const gaps = timeline.map((_, i) => i).filter((i) => i >= 1 && i < timeline.length - 2 && i !== outsideAfter && CARRIES_ON.includes(timeline[i]!.pose) && timeline[i]!.actorId && timeline[i]!.targetId && !sameSide(timeline[i]!.actorId, timeline[i]!.targetId));
    const theirs = gaps.find((i) => sameSide(timeline[i]!.actorId, winner));
    const other = gaps.find((i) => !sameSide(timeline[i]!.actorId, winner) && i !== theirs);
    const drawn = conduct.finish === 'draw' || conduct.finish === 'doubleKO';
    if (theirs !== undefined && (!drawn || other !== undefined)) {
      const order = [theirs, ...(other !== undefined ? [other] : [])].sort((a, b) => a - b);
      order.forEach((i, n) => fallAfter.set(i, n === 0 ? 'FIRST FALL!' : 'ONE FALL EACH!'));
    }
  }
  timeline.forEach((beat, index) => {
    stage(beat, index, synced ? commentary.filter((line) => line.beat === index) : [], false);
    const last = moments[moments.length - 1]!;
    const next = timeline[index + 1];
    if (!next || !last.actorId || !last.targetId || !CARRIES_ON.includes(beat.pose)) return;
    const fall = fallAfter.get(index);
    if (fall) {
      const lead: MoveId = (['slam', 'suplex', 'powerbomb', 'superkick'] as const)[index % 4]!;
      const choreo = downId === last.targetId ? coverOnly(3) : withCover(MOVES[lead], 0.5, 3);
      const move: MoveId = downId === last.targetId ? 'still' : lead;
      const duration = move === 'still' ? 2200 : 3000;
      moments.push({
        beat: { kind: 'control', pose: 'control', text: '', significant: false, actorId: last.actorId, targetId: last.targetId, moveName: null },
        actorId: last.actorId,
        targetId: last.targetId,
        staged: { move, choreo: { ...choreo, shouts: [{ at: 0.98, text: fall }] }, meta: META[move] ?? {}, duration },
        lines: [],
        // A fall is a full stop: the bell, a breath, and they go again.
        holdMs: duration + 900,
        filler: true,
      });
      recent.push(move);
      downId = last.targetId;
      return;
    }
    if (index === outsideAfter) {
      excursion(last.actorId, last.targetId, timeline.length + index);
      return;
    }
    // Do not spend the move the caller is about to shout on the build-up to it.
    const coming = moveSaid(commentary.find((line) => line.beat === index + 1 && line.speaker === 'play')?.text);
    // Enough unspoken work to cover the time it takes to read what was just
    // said — the call itself is read over its own move, the rest over these.
    const toRead = last.lines.reduce((ms, line) => ms + reading(line), 0) - last.staged.duration;
    const between = Math.max(Math.min(2, most), Math.min(most, Math.ceil(toRead / 1700)));
    // Only the side on top gets to tag: the one taking the beating is the
    // one who cannot reach their corner. Whoever the caller names next is
    // tagged back in for it.
    const corner = teams.find((team) => team.includes(last.actorId!)) ?? [];
    // A squash is one-way traffic: whatever the last recorded beat was, the
    // work between the beats is all the winner's.
    const closer = timeline[timeline.length - 1]!;
    const squashed = conduct.squash && closer.actorId && closer.targetId && closer.actorId !== closer.targetId;
    let working: Id = squashed ? closer.actorId! : last.actorId;
    const taking: Id = squashed ? closer.targetId! : last.targetId;
    for (let i = 0; i < between; i++) {
      if (corner.length > 1 && fillerIndex % 3 === 1) working = corner[(corner.indexOf(working) + 1) % corner.length]!;
      // 1000+ keeps a filler's "index" (which only rotates its choice of move) clear of the real beats'.
      stage({ kind: 'control', pose: 'control', text: '', significant: false, actorId: working, targetId: taking, moveName: null }, 1000 + fillerIndex++, [], true, coming ? [coming] : []);
    }
  });
  return { moments, before, after, synced };
}

/**
 * Where a tag partner waits, in their own frame: out past the corner post.
 * A wrestler tagging in starts from here.
 */
export const TAG_VAULT_HEIGHT = 13;
