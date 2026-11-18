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
  /**
   * The apron: the ledge of ring outside the ropes, at the height of the mat.
   * About a foot and a half — room to stand on with your back to the ropes,
   * which is where a tag partner waits and where anybody climbing out lands first.
   */
  apron: 4.5,
  /**
   * How far the side ropes give when a body hits them. The body is carried
   * this far past the rope line at the moment it lands in them, and the
   * ropes are drawn bowed out by the same amount (MatchStage's stretchRopes),
   * so the body is in the ropes rather than stopped by an invisible wall.
   */
  ropeGive: 1.6,
} as const;

// The space a battle royal's field brawls in (FieldBrawl.tsx): drawn
// smaller than the two at the front, with their feet toward the back edge
// of the mat. `half` is half the mat's width back there in the field's own,
// smaller, units.
export const FIELD = { scale: 0.6, feetY: 388, half: 33 } as const;

/** Where a tag partner stands: on the apron, outside the ropes, feet on the ledge. */
export const apronX = (side: 1 | -1) => -side * (RING.half + 2.4);

/** A body taking the ropes: when, and which side of the ring (1 the right, -1 the left). */
export interface RopeHit {
  at: number;
  side: 1 | -1;
}

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
  /** Not in the match at all: runs in from the floor, onto the apron and over the top. */
  runIn?: boolean;
  /** How beaten up they are, 0-1: somebody battered is slower off the mat. */
  wear?: number;
}

export interface Plan {
  tracks: Map<Id, WorldFrame[]>;
  /** Fraction of the beat spent getting to the start of the move. */
  lead: number;
  centre: number;
  impacts: { at: number; x: number; y: number; big: boolean }[];
  /** Moments the ropes take somebody's weight, and which ropes. */
  ropeHits: RopeHit[];
  end: Map<Id, WorldPose>;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
/** Screen x of the head, given the feet and a screen lean. */
const headX = (x: number, rot: number) => x + Math.sin(rad(rot)) * RING.tall;
const headY = (y: number, rot: number) => y + Math.cos(rad(rot)) * RING.tall;
const inRing = (pose: WorldPose, half: number = RING.half) => Math.abs(pose.x) <= half + 0.5 && pose.y > FLOOR / 2;
/** On the floor in front of the ring. */
// Told apart from the side floor an eliminated wrestler lands on by height:
// standing there is FLOOR, lying here is FRONT_FLOOR + DOWN, and the line
// sits between the two with a little room either side.
export const onFrontFloor = (pose: WorldPose) => pose.y < FLOOR - 0.2;
const lying = (pose: WorldPose) => isDown([0, pose.y - (onFrontFloor(pose) ? FRONT_FLOOR : 0), pose.rot]);

/** Where a track has a body at time `t`: between its two frames either side, straight-line. */
export function poseAt(frames: readonly WorldFrame[], t: number): WorldFrame | undefined {
  if (frames.length === 0) return undefined;
  if (t <= frames[0]!.at) return frames[0];
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i]!;
    const b = frames[i + 1]!;
    if (t > b.at) continue;
    const k = b.at === a.at ? 0 : (t - a.at) / (b.at - a.at);
    return { at: t, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, rot: a.rot + (b.rot - a.rot) * k, sy: a.sy, stance: a.stance };
  }
  return frames[frames.length - 1];
}

/** Put a body at `pose` at time `t`: moves the frame already there, or adds one between its neighbours. */
function setPoseAt(frames: WorldFrame[], t: number, pose: WorldFrame) {
  const near = frames.findIndex((frame) => Math.abs(frame.at - t) < 0.02);
  if (near >= 0) {
    frames[near] = { ...frames[near]!, x: pose.x, stance: pose.stance };
    return;
  }
  const after = frames.findIndex((frame) => frame.at > t);
  frames.splice(after < 0 ? frames.length : after, 0, { ...pose, at: t });
}

/** The span of the ring a pose occupies, left to right. */
function span(x: number, rot: number): [number, number] {
  const hx = headX(x, rot);
  const pad = RING.body * Math.abs(Math.cos(rad(rot)));
  return [Math.min(x, hx) - pad, Math.max(x, hx) + pad];
}

export interface PlanOptions {
  /** Half-width of the space to keep everybody inside, if not the ring's own. */
  half?: number;
  /**
   * Stage the exchange here rather than wherever the pair ended up. Used by
   * the brawls in a battle royal's field, where each pair has its own patch
   * of the ring and must not wander into the next one's.
   */
  near?: number;
}

export function planBeat(staged: StagedBeat, fighters: readonly PlanFighter[], lastCentre: number, options: PlanOptions = {}): Plan {
  const { choreo, meta } = staged;
  const target = fighters.find((f) => f.role === 'target');
  const zone = staged.zone ?? 'ring';
  // Where the ground is and where the walls are, for this beat.
  const ground = zone === 'floor' ? FRONT_FLOOR : 0;
  const ringHalf = options.half ?? RING.half;
  // The apron, in whatever units this ring is measured in (a battle royal's field is drawn smaller).
  const apronWidth = (ringHalf * RING.apron) / RING.half;
  const ringEdge = ringHalf - 0.4;
  const edge = zone === 'ring' ? ringEdge : RING.floorHalf;
  // On the way out or back in, a pose is held by whichever it is in at that
  // height: the ropes while it is up on the mat, the barricades once it is
  // down on the floor.
  const edgeAt = (y: number) => (zone === 'ring' ? ringEdge : zone === 'floor' ? RING.floorHalf : y > FLOOR / 2 ? ringEdge : RING.floorHalf);
  // Somebody is "here" for this beat if the last one left them in the place it starts.
  const here = (pose: WorldPose) => (zone === 'floor' || zone === 'in' ? onFrontFloor(pose) : inRing(pose, ringHalf));

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
    const rope = -anchored.dir * ((zone === 'floor' ? RING.floorHalf : ringHalf) - RING.body);
    centre = rope - anchored.dir * meta.anchor.at + (anchored.dir * GAP) / 2;
  } else if (meta.atCentre) {
    // Under the prize: the middle of the ring, wherever they were. Somebody
    // already lying down stays where they lie while it goes up.
    centre = 0;
    if (staysDown && target?.from) {
      const lieX = (target.from.x - home(target, centre)) * target.dir;
      targetFrames = targetFrames.map((fr) => (isDown([0, fr[2], fr[3]]) ? ([fr[0], lieX, ...fr.slice(2)] as unknown as Frame) : fr));
    }
  } else if (staysDown && target?.from) {
    // Go to them: the move happens where they are lying.
    const lieAt = targetFrames[0]![1];
    centre = target.from.x - target.dir * lieAt + (target.dir * GAP) / 2;
  } else {
    const known = fighters.filter((f) => f.from && here(f.from) && !f.taggedIn && !f.runIn);
    if (options.near !== undefined) centre = options.near;
    else if (known.length === 2) centre = (known[0]!.from!.x + known[1]!.from!.x) / 2;
    else if (known.length === 1) centre = known[0]!.from!.x + (known[0]!.dir * GAP) / 2;
    else centre = lastCentre;

    // Slide the whole exchange until every pose of it is inside the ropes.
    let needRight = -Infinity; // how far right it must move to clear the left ropes
    let roomRight = Infinity; // how far right it may move before hitting the right ropes
    for (const f of fighters) {
      for (const [at, x, y, rot] of local(f)) {
        if (f.role === 'target' && meta.exits !== undefined && at >= meta.exits) continue;
        if (f.role === 'actor' && meta.actorExits !== undefined && at >= meta.actorExits) continue;
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
      // Time to make the tag — hands touch at TAG_TOUCH of this — then come in.
      lead = Math.max(lead, 0.5);
      continue;
    }
    if (f.runIn) {
      lead = Math.max(lead, 0.42);
      continue;
    }
    if (!f.from) continue;
    if (f === target && staysDown) continue;
    const first = local(f)[0]!;
    const distance = Math.abs(f.from.x - (home(f, centre) + f.dir * first[1]));
    const settled = distance < 0.3 && Math.abs(f.from.rot - f.dir * first[3]) < 2 && Math.abs(f.from.y - first[2]) < 0.2;
    if (settled) continue;
    lead = Math.max(lead, clamp(0.09 + distance / 85 + (lying(f.from) ? 0.1 + 0.18 * (f.wear ?? 0) : 0), 0.1, 0.5));
  }

  // ---- the frames, in the ring ---------------------------------------------
  const tracks = new Map<Id, WorldFrame[]>();
  const end = new Map<Id, WorldPose>();
  const ropeHits: RopeHit[] = [];
  for (const f of fighters) {
    const h = home(f, centre);
    const frames: WorldFrame[] = [];
    const table = local(f);
    const holds = f === target && staysDown;
    if (lead > 0 && !holds) {
      const first = table[0]!;
      const to = { x: h + f.dir * first[1], y: first[2] + ground, rot: f.dir * first[3] };
      if (f.runIn) {
        // Down the aisle, up onto the apron, over the top rope.
        const floorX = -f.dir * (RING.half + 16);
        frames.push({ at: 0, x: floorX, y: FLOOR, rot: 0, sy: 1, stance: 'run' });
        frames.push({ at: lead * 0.45, x: apronX(f.dir) - f.dir * 3, y: FLOOR, rot: f.dir * 8, sy: 1, stance: 'run' });
        frames.push({ at: lead * 0.62, x: apronX(f.dir), y: 0, rot: 0, sy: 1, stance: 'climb' });
        frames.push({ at: lead * 0.8, x: -f.dir * (RING.half - 1), y: TAG_VAULT_HEIGHT, rot: f.dir * 16, sy: 1, stance: 'tuck' });
        frames.push({ at: lead * 0.96, x: to.x, y: 0.4, rot: 0, sy: 1, stance: 'crouch' });
      } else if (f.taggedIn) {
        const from = apronX(f.dir);
        // On the apron, reaching in over the top rope for the hand — and
        // only once it has been touched, over the rope and in.
        frames.push({ at: 0, x: from, y: 0, rot: 0, sy: 1, stance: 'stand' });
        frames.push({ at: lead * 0.3, x: from, y: 0, rot: 0, sy: 1, stance: 'tagIn' });
        frames.push({ at: lead * TAG_TOUCH, x: from, y: 0, rot: 0, sy: 1, stance: 'tagIn' });
        frames.push({ at: lead * 0.8, x: -f.dir * (RING.half - 1), y: TAG_VAULT_HEIGHT, rot: f.dir * 16, sy: 1, stance: 'tuck' });
        frames.push({ at: lead * 0.96, x: to.x, y: 0.4, rot: 0, sy: 1, stance: 'crouch' });
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
      const leaving = (f.role === 'target' && meta.exits !== undefined && at >= meta.exits) || (f.role === 'actor' && meta.actorExits !== undefined && at >= meta.actorExits);
      let wx = holds && f.from ? f.from.x + f.dir * (x - table[0]![1]) : h + f.dir * x;
      let wy = y + ground;
      const wrot = f.dir * rot;
      // Carried into the ropes on this frame: drawn leaning back into them.
      let inRopes = false;

      if (leaving) {
        // Out is over the top: clear the rope while crossing it. Past the
        // ropes is the apron, which is ring — the same height as the mat —
        // so a body over it lands on it, not through it. Only past the
        // apron's edge is there nothing under them but the floor.
        const out = Math.abs(wx);
        const apronEdge = ringHalf + apronWidth;
        const lean = Math.max(0, -Math.cos(rad(wrot)) * RING.tall);
        if (out > ringHalf - 3 && out <= ringHalf + 1.5) wy = Math.max(wy, RING.topRope + 1);
        else if (out > ringHalf + 1.5 && out <= apronEdge) wy = Math.max(wy, lean);
        else if (out > apronEdge) wy = Math.max(wy, FLOOR + lean);
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
          wx += push;
          // Pushed back left means they were into the right-hand ropes, and the
          // other way about. A real hit: the ropes take the weight and the body
          // goes into them, past the line, by as much as they give. Only a body
          // more up than down hits the ropes; one lying on the mat is under the
          // bottom rope and is simply kept in.
          const upright = Math.abs(normalizeRot(wrot)) < 45;
          if (Math.abs(push) > 0.35 && upright) {
            const side = push < 0 ? 1 : -1;
            ropeHits.push({ at: t, side });
            wx += side * RING.ropeGive;
            inRopes = true;
          }
        }
        // The mat: neither feet nor head go below it.
        wy = Math.max(wy, 0, -Math.cos(rad(wrot)) * RING.tall);
      }
      frames.push({ at: t, x: wx, y: wy, rot: wrot, sy, stance: inRopes ? 'ropes' : stance });
    }
    // The walk back to the mark is held to the same walls as the move is.
    if (lead > 0 && !holds && !f.taggedIn && !f.runIn) {
      for (const frame of frames) {
        if (frame.at >= lead || frame.at === 0) continue;
        const wall = edgeAt(frame.y);
        const [lo, hi] = span(frame.x, frame.rot);
        frame.x += hi > wall ? wall - hi : lo < -wall ? -wall - lo : 0;
      }
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
  // A cover is a cover. Whatever the move did with the one going down — threw
  // them behind the attacker, into the ropes and back — the one pinning them
  // lies across where they actually are, chest over chest, for every count,
  // and gets up from there. The referee never counts over empty mat.
  const actorFighter = fighters.find((f) => f.role === 'actor');
  const actorFrames = actorFighter ? tracks.get(actorFighter.id) : undefined;
  const targetFrames2 = target ? tracks.get(target.id) : undefined;
  if (choreo.cover && choreo.cover.count <= 3 && actorFrames && targetFrames2) {
    let shift = 0;
    let pinned = false;
    for (const frame of actorFrames) {
      if (frame.stance === 'pin') {
        const under = poseAt(targetFrames2, frame.at) ?? targetFrames2[targetFrames2.length - 1]!;
        const body = midBody(under);
        // Lying the same way they are, centred on them, a body's thickness up.
        const x = body.x - (Math.sin(rad(under.rot)) * RING.tall) / 2;
        shift = x - frame.x;
        frame.x = x;
        frame.rot = under.rot;
        frame.y = under.y + PIN_ON_TOP;
        pinned = true;
      } else if (pinned) {
        // Thrown off at a kickout, or getting up after the three: from where they were.
        frame.x += shift;
      }
    }
  }

  // A move that says it uses the ropes (a whip, a run off them, a corner):
  // whoever is up against the rope line at that moment goes into the ropes by
  // as much as they give — the same as a body that collides with them above —
  // and it is their side that bows. Nobody at the line (up on the corner,
  // climbing the cage) and the ropes still take the weight, on the side the
  // move is anchored to, or else the nearer one.
  if (choreo.ropes !== undefined) {
    const t = when(choreo.ropes);
    let side: 1 | -1 = anchored ? (-anchored.dir as 1 | -1) : centre >= 0 ? 1 : -1;
    if (zone === 'ring') {
      for (const f of fighters) {
        const frames = tracks.get(f.id);
        const pose = frames ? poseAt(frames, t) : undefined;
        if (!frames || !pose || pose.y >= RING.topRope || Math.abs(normalizeRot(pose.rot)) >= 45) continue;
        const [lo, hi] = span(pose.x, pose.rot);
        const at = hi > edge - 1 ? 1 : lo < -edge + 1 ? -1 : 0;
        if (at === 0) continue;
        side = at;
        const press = at === 1 ? edge + RING.ropeGive - hi : -edge - RING.ropeGive - lo;
        setPoseAt(frames, t, { ...pose, x: pose.x + press, stance: 'ropes' });
        break;
      }
    }
    ropeHits.push({ at: t, side });
  }
  // One body into the ropes is one hit, however many frames of the move touch
  // them: the same side again within a moment is the same hit, not another bow.
  ropeHits.sort((x, y) => x.at - y.at);
  const hits = ropeHits.filter((hit, i) => !ropeHits.slice(0, i).some((earlier) => earlier.side === hit.side && hit.at - earlier.at < 0.15));
  const targetHome = target ? home(target, centre) : centre;
  const held = staysDown && target?.from ? target.from.x - targetHome - (target?.dir ?? 1) * targetFrames[0]![1] : 0;
  return {
    tracks,
    lead,
    centre,
    ropeHits: hits,
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
/** When, through a tag's lead-in, the two hands meet (both sides use it). */
export const TAG_TOUCH = 0.55;

/** How far above the one pinned the one pinning lies: a body's thickness. */
const PIN_ON_TOP = 2.6;

export const midBody = (pose: WorldPose) => ({ x: (pose.x + headX(pose.x, pose.rot)) / 2, y: (pose.y + headY(pose.y, pose.rot)) / 2 });

/**
 * Whether a cover is a real pin at every count: the one being pinned flat on
 * their back, the one pinning lying across them, chest over chest. The
 * referee does not count anything else.
 */
export function pinHeld(plan: Plan, cover: { from: number; to: number; count: number }, actorId: Id, targetId: Id): boolean {
  const a = plan.tracks.get(actorId);
  const b = plan.tracks.get(targetId);
  if (!a || !b) return false;
  const flat = (rot: number) => Math.abs(Math.abs(normalizeRot(rot)) - 90) < 15;
  for (let i = 0; i < cover.count; i++) {
    const at = cover.from + ((cover.to - cover.from) * (i + 0.35)) / cover.count;
    const t = plan.lead + at * (1 - plan.lead);
    const top = poseAt(a, t);
    const under = poseAt(b, t);
    if (!top || !under || !flat(top.rot) || !flat(under.rot)) return false;
    if (Math.abs(midBody(top).x - midBody(under).x) > 4 || top.y - under.y < 0.5 || top.y - under.y > 5) return false;
  }
  return true;
}
