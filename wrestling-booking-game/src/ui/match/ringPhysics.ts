// Where things are in the ring, and what a body is not allowed to pass
// through.
//
// choreography.ts writes a move as two wrestlers relative to each other.
// This turns that into positions in the ring itself, and is where three
// promises are kept:
//
//   THE MATCH FLOWS. A move starts from wherever the last one left the two
//   of them — the exchange re-forms around where they ended up rather than
//   walking back to two marks in the centre. Somebody left lying on the mat
//   either gets up where they lie or, if the next move is one you do to a
//   downed opponent, stays down and has it done to them there.
//
//   THE RING IS SOLID. Nobody's head goes through the ropes: an exchange
//   that would not fit where it started is slid along until it does, and
//   any single pose still poking through is pushed back in. Nobody sinks
//   into the mat. The only way out is over the top rope, and whoever goes
//   out lands on the arena floor — which is a long way below the mat.
//
//   OUTSIDE IS A PLACE TOO. Where a match's rules allow it (and only then —
//   choreography.ts's stageMatch decides), a fight can go to the floor in
//   front of the ring. Down there the floor is the ground and the
//   barricades are the walls; the ring's ropes mean nothing until somebody
//   is rolled back under them.
//
//   THE FURNITURE IS WHERE IT LOOKS. A whip ends on the actual ropes and a
//   dive starts on the actual corner post, because the move is moved to
//   them (choreography.ts's META.anchor).
//
// Everything here is in stage units from the centre of the ring, +x to the
// right, +y up from the mat. A lean is stored as it appears on screen
// (clockwise positive), not relative to which way the wrestler is facing.

import { DOWN, FLOOR, FRONT_FLOOR, GAP, TAG_VAULT_HEIGHT, isDown, normalizeRot, type Frame, type Impact, type StagedBeat } from './choreography';
import type { StanceId } from './rig';
import type { Id } from '../../engine/types';

export const RING = {
  /** Half the mat's width at the depth the wrestlers stand at. */
  half: 25.6,
  /** Top rope, above the mat. Below this, the ropes stop a body. */
  topRope: 12,
  /** Half a standing body's width. */
  body: 2.6,
  /** Feet to crown. */
  tall: 20,
  /** How far either side of centre the floor in front of the ring runs: barricade to barricade. */
  floorHalf: 45,
} as const;

/** Where a tag partner stands: on the apron, just outside their corner. */
export const apronX = (side: 1 | -1) => -side * (RING.half + 3.2);

export interface WorldPose {
  x: number;
  y: number;
  /** Lean as drawn: clockwise positive. */
  rot: number;
}

export interface WorldFrame extends WorldPose {
  at: number;
  sy: number;
  stance: StanceId | undefined;
}

export interface PlanFighter {
  id: Id;
  role: 'actor' | 'target';
  /** 1 for whoever works from the left (facing right), -1 from the right. */
  dir: 1 | -1;
  /** Where the last beat left them, if they were in it. */
  from: WorldPose | undefined;
  taggedIn: boolean;
}

export interface Plan {
  tracks: Map<Id, WorldFrame[]>;
  /** Fraction of the beat spent getting to the start of the move. */
  lead: number;
  centre: number;
  impacts: { at: number; x: number; y: number; big: boolean }[];
  /** Moments the ropes take somebody's weight. */
  ropeHits: number[];
  end: Map<Id, WorldPose>;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
/** Screen x of the head, given the feet and a screen lean. */
const headX = (x: number, rot: number) => x + Math.sin(rad(rot)) * RING.tall;
const headY = (y: number, rot: number) => y + Math.cos(rad(rot)) * RING.tall;
const inRing = (pose: WorldPose) => Math.abs(pose.x) <= RING.half + 0.5 && pose.y > FLOOR / 2;
/** On the floor in front of the ring. */
// (Lower than the side floor an eliminated wrestler lands on, with room for a body lying on it.)
export const onFrontFloor = (pose: WorldPose) => pose.y < FLOOR - 0.5;
const lying = (pose: WorldPose) => isDown([0, pose.y - (onFrontFloor(pose) ? FRONT_FLOOR : 0), pose.rot]);

/** The span of the ring a pose occupies, left to right. */
function span(x: number, rot: number): [number, number] {
  const hx = headX(x, rot);
  const pad = RING.body * Math.abs(Math.cos(rad(rot)));
  return [Math.min(x, hx) - pad, Math.max(x, hx) + pad];
}

export function planBeat(staged: StagedBeat, fighters: readonly PlanFighter[], lastCentre: number): Plan {
  const { choreo, meta } = staged;
  const target = fighters.find((f) => f.role === 'target');
  const zone = staged.zone ?? 'ring';
  // Where the ground is and where the walls are, for this beat.
  const ground = zone === 'floor' ? FRONT_FLOOR : 0;
  const ringEdge = RING.half - 0.4;
  const edge = zone === 'ring' ? ringEdge : RING.floorHalf;
  // On the way out or back in, a pose is held by whichever it is in at that
  // height: the ropes while it is up on the mat, the barricades once it is
  // down on the floor.
  const edgeAt = (y: number) => (zone === 'ring' ? ringEdge : zone === 'floor' ? RING.floorHalf : y > FLOOR / 2 ? ringEdge : RING.floorHalf);
  // Somebody is "here" for this beat if the last one left them in the place it starts.
  const here = (pose: WorldPose) => (zone === 'floor' || zone === 'in' ? onFrontFloor(pose) : inRing(pose));

  // ---- the target is already down ----------------------------------------
  const targetWasDown = Boolean(target?.from && here(target.from) && lying(target.from));
  const staysDown = targetWasDown && (meta.needsDown || meta.knockdownBy !== undefined);
  let targetFrames: readonly Frame[] = choreo.target;
  let impacts: readonly Impact[] = choreo.impacts ?? [];
  if (staysDown && meta.knockdownBy !== undefined) {
    // Skip the part where they get knocked down; they are down.
    const cut = meta.knockdownBy;
    const rest = choreo.target.filter(([at]) => at >= cut);
    const first = rest[0] ?? choreo.target[choreo.target.length - 1]!;
    targetFrames = [[0, first[1], DOWN, -90, 1, 'flat'], ...rest];
    impacts = impacts.filter(([at]) => at >= cut);
  }
  const local = (f: PlanFighter) => (f.role === 'actor' ? choreo.actor : targetFrames);
  const home = (f: PlanFighter, centre: number) => centre - (f.dir * GAP) / 2;

  // ---- where it happens ---------------------------------------------------
  let centre: number;
  const anchored = meta.anchor ? fighters.find((f) => f.role === meta.anchor!.who) : undefined;
  if (meta.anchor && anchored) {
    // Put that wrestler's `at` on the ropes behind them.
    // (On the floor, the thing behind them is a barricade.)
    const rope = -anchored.dir * ((zone === 'floor' ? RING.floorHalf : RING.half) - RING.body);
    centre = rope - anchored.dir * meta.anchor.at + (anchored.dir * GAP) / 2;
  } else if (staysDown && target?.from) {
    // Go to them: the move happens where they are lying.
    const lieAt = targetFrames[0]![1];
    centre = target.from.x - target.dir * lieAt + (target.dir * GAP) / 2;
  } else {
    const known = fighters.filter((f) => f.from && here(f.from) && !f.taggedIn);
    if (known.length === 2) centre = (known[0]!.from!.x + known[1]!.from!.x) / 2;
    else if (known.length === 1) centre = known[0]!.from!.x + (known[0]!.dir * GAP) / 2;
    else centre = lastCentre;

    // Slide the whole exchange until every pose of it is inside the ropes.
    let needRight = -Infinity; // how far right it must move to clear the left ropes
    let roomRight = Infinity; // how far right it may move before hitting the right ropes
    for (const f of fighters) {
      for (const [at, x, y, rot] of local(f)) {
        if (f.role === 'target' && meta.exits !== undefined && at >= meta.exits) continue;
        if (zone === 'ring' && y >= RING.topRope) continue;
        const [lo, hi] = span(home(f, centre) + f.dir * x, f.dir * rot);
        const wall = edgeAt(y + ground);
        needRight = Math.max(needRight, -wall - lo);
        roomRight = Math.min(roomRight, wall - hi);
      }
    }
    if (needRight > roomRight) centre += (needRight + roomRight) / 2;
    else centre += clamp(0, needRight, roomRight);
  }

  // ---- getting there --------------------------------------------------------
  let lead = 0;
  for (const f of fighters) {
    if (f.taggedIn) {
      lead = Math.max(lead, 0.3);
      continue;
    }
    if (!f.from) continue;
    if (f === target && staysDown) continue;
    const first = local(f)[0]!;
    const distance = Math.abs(f.from.x - (home(f, centre) + f.dir * first[1]));
    const settled = distance < 0.3 && Math.abs(f.from.rot - f.dir * first[3]) < 2 && Math.abs(f.from.y - first[2]) < 0.2;
    if (settled) continue;
    lead = Math.max(lead, clamp(0.09 + distance / 85 + (lying(f.from) ? 0.1 : 0), 0.1, 0.4));
  }

  // ---- the frames, in the ring ---------------------------------------------
  const tracks = new Map<Id, WorldFrame[]>();
  const end = new Map<Id, WorldPose>();
  const ropeHits: number[] = [];
  for (const f of fighters) {
    const h = home(f, centre);
    const frames: WorldFrame[] = [];
    const table = local(f);
    const holds = f === target && staysDown;
    if (lead > 0 && !holds) {
      const first = table[0]!;
      const to = { x: h + f.dir * first[1], y: first[2] + ground, rot: f.dir * first[3] };
      if (f.taggedIn) {
        const from = apronX(f.dir);
        frames.push({ at: 0, x: from, y: 0, rot: 0, sy: 1, stance: 'stand' });
        // Over the top rope, not through it.
        frames.push({ at: lead * 0.5, x: -f.dir * (RING.half - 1), y: TAG_VAULT_HEIGHT, rot: f.dir * 16, sy: 1, stance: 'tuck' });
        frames.push({ at: lead * 0.92, x: to.x, y: 0.4, rot: 0, sy: 1, stance: 'crouch' });
      } else if (f.from) {
        frames.push({ at: 0, ...f.from, sy: 1, stance: lying(f.from) ? 'flat' : undefined });
        if (lying(f.from)) {
          // Up through a knee, where they fell.
          frames.push({ at: lead * 0.55, x: f.from.x + (to.x - f.from.x) * 0.35, y: to.y, rot: f.from.rot * 0.25, sy: 1, stance: 'kneel' });
        } else if (Math.abs(to.x - f.from.x) > 4) {
          frames.push({ at: lead * 0.5, x: (f.from.x + to.x) / 2, y: to.y, rot: Math.sign(to.x - f.from.x) * 8, sy: 1, stance: 'run' });
        }
      } else {
        frames.push({ at: 0, ...to, sy: 1, stance: first[5] });
      }
    }
    for (const [at, x, y, rot, sy = 1, stance] of table) {
      const t = holds || lead === 0 ? at : lead + at * (1 - lead);
      const leaving = f.role === 'target' && meta.exits !== undefined && at >= meta.exits;
      let wx = holds && f.from ? f.from.x + f.dir * (x - table[0]![1]) : h + f.dir * x;
      let wy = y + ground;
      const wrot = f.dir * rot;

      if (leaving) {
        // Out is over the top: clear the rope while crossing it, then the
        // floor is the floor.
        const outside = Math.abs(wx) > RING.half + 1.5;
        if (!outside && Math.abs(wx) > RING.half - 3) wy = Math.max(wy, RING.topRope + 1);
        if (outside) wy = Math.max(wy, FLOOR + Math.max(0, -Math.cos(rad(wrot)) * RING.tall));
      } else if (zone !== 'ring') {
        // Outside: barricades either side, and the floor underneath. (On the
        // way out or back in, the table's own heights say where the floor
        // and the mat are; nothing goes lower than the floor.)
        const [lo, hi] = span(wx, wrot);
        const wall = edgeAt(wy);
        wx += hi > wall ? wall - hi : lo < -wall ? -wall - lo : 0;
        wy = Math.max(wy, FRONT_FLOOR + Math.max(0, -Math.cos(rad(wrot)) * RING.tall));
      } else {
        // The ropes: below the top one, no part of a body gets past them.
        if (wy < RING.topRope) {
          const [lo, hi] = span(wx, wrot);
          const push = hi > edge ? edge - hi : lo < -edge ? -edge - lo : 0;
          if (Math.abs(push) > 0.35) ropeHits.push(t);
          wx += push;
        }
        // The mat: neither feet nor head go below it.
        wy = Math.max(wy, 0, -Math.cos(rad(wrot)) * RING.tall);
      }
      frames.push({ at: t, x: wx, y: wy, rot: wrot, sy, stance });
    }
    // Two poses at the same instant would be a jump cut; keep the later.
    const tidy = frames.filter((frame, i) => i === frames.length - 1 || frames[i + 1]!.at > frame.at + 1e-4);
    tracks.set(f.id, tidy);
    const last = tidy[tidy.length - 1]!;
    // Stored as the shortest way round: a body that went over through 270
    // degrees is lying at -90, and should get up from there, not unwind.
    end.set(f.id, { x: last.x, y: last.y, rot: normalizeRot(last.rot) });
  }

  const when = (at: number) => (lead === 0 ? at : lead + at * (1 - lead));
  if (choreo.ropes !== undefined) ropeHits.push(when(choreo.ropes));
  const targetHome = target ? home(target, centre) : centre;
  const held = staysDown && target?.from ? target.from.x - targetHome - (target?.dir ?? 1) * targetFrames[0]![1] : 0;
  return {
    tracks,
    lead,
    centre,
    ropeHits,
    end,
    impacts: impacts.map(([at, x, y, big]) => ({
      at: staysDown ? at : when(at),
      x: clamp(targetHome + held + (target?.dir ?? 1) * x, -edge, edge),
      y: Math.max(0.5, y) + (zone === 'floor' ? FRONT_FLOOR : 0),
      big: Boolean(big),
    })),
  };
}

/** Where a pose's head ends up — used to put the referee's count over a cover. */
export const midBody = (pose: WorldPose) => ({ x: (pose.x + headX(pose.x, pose.rot)) / 2, y: (pose.y + headY(pose.y, pose.rot)) / 2 });
