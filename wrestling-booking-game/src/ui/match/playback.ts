// Turns a plan (ringPhysics.ts) into motion: one Web Animation for each
// body, nine more for its joints. Shared by the two wrestlers a beat is
// about (MatchStage) and by everybody brawling behind them (FieldBrawl).

import { FRONT_FLOOR } from './choreography';
import { STANCES, autoStance, hipDrop, type Stance } from './rig';
import { onFrontFloor, type Plan, type PlanFighter, type WorldFrame } from './ringPhysics';
import type { Joints } from './ArticulatedFigure';
import type { Id } from '../../engine/types';

// A pose table is a handful of key poses. Played pose-to-pose with an ease
// on each step, every key pose is a dead stop — the puppet-show look. So
// each channel (position, lean, every joint) is run through a smooth curve
// and re-sampled finely, and the browser is given those.
const SAMPLE_MS = 34;

/**
 * A curve through the keys that never overshoots them (monotone cubic,
 * Fritsch-Carlson). The no-overshoot part matters: ringPhysics.ts has
 * already made every key pose legal, and a curve that swung wide between
 * two of them would put a head through the ropes after all.
 */
function curve(times: readonly number[], values: readonly number[]): (t: number) => number {
  const n = times.length;
  if (n === 1) return () => values[0]!;
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) slope.push((values[i + 1]! - values[i]!) / Math.max(1e-6, times[i + 1]! - times[i]!));
  const tangent: number[] = [slope[0]!];
  for (let i = 1; i < n - 1; i++) tangent.push(slope[i - 1]! * slope[i]! <= 0 ? 0 : (slope[i - 1]! + slope[i]!) / 2);
  tangent.push(slope[n - 2]!);
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i]! / slope[i]!;
    const b = tangent[i + 1]! / slope[i]!;
    const size = a * a + b * b;
    if (size > 9) {
      const k = 3 / Math.sqrt(size);
      tangent[i] = k * a * slope[i]!;
      tangent[i + 1] = k * b * slope[i]!;
    }
  }
  return (t) => {
    let i = 0;
    while (i < n - 2 && t > times[i + 1]!) i++;
    const h = Math.max(1e-6, times[i + 1]! - times[i]!);
    const p = Math.min(1, Math.max(0, (t - times[i]!) / h));
    const p2 = p * p;
    const p3 = p2 * p;
    return (2 * p3 - 3 * p2 + 1) * values[i]! + (p3 - 2 * p2 + p) * h * tangent[i]! + (-2 * p3 + 3 * p2) * values[i + 1]! + (p3 - p2) * h * tangent[i + 1]!;
  };
}

/** Where a body is at time `t`, between its key poses (straight-line, for adding keys). */
function poseAt(frames: readonly WorldFrame[], t: number): WorldFrame {
  let i = 0;
  while (i < frames.length - 2 && frames[i + 1]!.at <= t) i++;
  const a = frames[i]!;
  const b = frames[i + 1] ?? a;
  const k = b.at === a.at ? 0 : Math.min(1, Math.max(0, (t - a.at) / (b.at - a.at)));
  return { ...a, at: t, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, rot: a.rot + (b.rot - a.rot) * k, stance: k < 0.5 ? a.stance : b.stance };
}

/** Poses a body can fidget in without spoiling anything: not a hold, a climb, a pin. */
const RESTLESS: ReadonlySet<string | undefined> = new Set([undefined, 'stand', 'guard', 'stagger', 'flat', 'punch', 'bend']);

/**
 * The life a pose table does not have. Two things are added to every body's
 * keys, and nothing authored is moved:
 *
 * - Whoever is hit snaps back from it: at each impact, if they are on their
 *   feet and the move has not already got them reacting, a recoil — thrown
 *   back half a step, chest and head flung — and back to where the move had
 *   them.
 * - Nobody stands frozen: wherever a body is held still for a while, it
 *   moves in it. On their feet, the one on top resets a half step and the
 *   one taking it hunches over it, hand on the back; down, they stir.
 */
function enliven(frames: readonly WorldFrame[], f: PlanFighter, impacts: Plan['impacts']): WorldFrame[] {
  let out = [...frames];
  const ground = (fr: WorldFrame) => fr.y - (onFrontFloor(fr) ? FRONT_FLOOR : 0);
  const upright = (fr: WorldFrame) => Math.abs(fr.rot) < 25 && ground(fr) < 1.5;
  const lying = (fr: WorldFrame) => Math.abs(Math.abs(fr.rot) - 90) < 20 && ground(fr) < 4.5;
  if (f.role === 'target') {
    for (const hit of impacts) {
      const t = hit.at;
      if (t < 0.03 || t > 0.94) continue;
      const here = poseAt(out, t);
      if (!upright(here) || out.some((fr) => fr.at > t && fr.at <= t + 0.1)) continue;
      const back = poseAt(out, t + 0.12);
      out.push(
        { ...here, at: t + 0.035, x: here.x - f.dir * 0.8, rot: here.rot - f.dir * 10, stance: 'recoil' },
        { ...back, at: t + 0.12 },
      );
      out.sort((a, b) => a.at - b.at);
    }
  }
  const still: WorldFrame[] = [];
  for (let i = 0; i + 1 < out.length; i++) {
    const a = out[i]!;
    const b = out[i + 1]!;
    const held = Math.abs(a.x - b.x) < 0.05 && Math.abs(a.y - b.y) < 0.05 && Math.abs(a.rot - b.rot) < 1 && b.at - a.at >= 0.14;
    if (!held || !RESTLESS.has(a.stance) || !RESTLESS.has(b.stance)) continue;
    const mid = (a.at + b.at) / 2;
    if (upright(a)) {
      still.push(f.role === 'actor' ? { ...a, at: mid, x: a.x - f.dir * 1.8, rot: a.rot - f.dir * 4, stance: 'guard' } : { ...a, at: mid, x: a.x - f.dir * 1, stance: 'sellBack' });
    } else if (lying(a)) {
      // Rolling half onto a side and back, a knee coming up.
      still.push({ ...a, at: mid, y: a.y + 0.5, rot: a.rot + Math.sign(a.rot || 1) * -10, stance: 'kickout' });
    }
  }
  out = [...out, ...still].sort((a, b) => a.at - b.at);
  return out;
}

/**
 * Plays `plan` on the given figures and returns the running animations.
 * `unit` is pixels per stage unit for these figures; `figureWidth` their
 * width in pixels. A figure with no joints registered (a plain MatchFigure)
 * just has its body moved.
 */
export function playPlan(
  plan: Plan,
  cast: readonly PlanFighter[],
  figure: (id: Id) => Element | undefined,
  jointsOf: (id: Id) => Joints | undefined,
  unit: number,
  figureWidth: number,
  duration: number,
  /** Extra timing, e.g. to loop. */
  timing: KeyframeAnimationOptions = {},
): Animation[] {
  const running: Animation[] = [];
  const legUnit = figureWidth / 100;
  for (const f of cast) {
    const el = figure(f.id);
    const authored = plan.tracks.get(f.id);
    if (!el || !authored) continue;
    const frames = enliven(authored, f, plan.impacts);
    // The stance guess reads a lean relative to the way they face.
    const facing = frames.map((fr) => [fr.at, f.dir * fr.x, fr.y, f.dir * fr.rot, fr.sy, fr.stance] as const);
    const stances: Stance[] = frames.map((fr, i) => STANCES[fr.stance ?? autoStance(facing, i)]);
    const times = frames.map((fr) => fr.at);
    const steps = Math.max(2, Math.round(duration / SAMPLE_MS));
    const offsets = Array.from({ length: steps + 1 }, (_, i) => i / steps);
    const channel = (values: number[]) => offsets.map(curve(times, values));
    const play = (part: Element, transforms: string[]) =>
      running.push(part.animate(transforms.map((transform, i) => ({ offset: offsets[i]!, transform })), { duration, fill: 'both', ...timing }));

    // Bent knees bring the hips down — but only for somebody standing on
    // the mat or the floor; a body in the air or lying down has nothing to
    // sink toward.
    const sink = frames.map((fr, i) => {
      const height = fr.y - (onFrontFloor(fr) ? FRONT_FLOOR : 0);
      return height < 1 && Math.abs(fr.rot) < 45 ? hipDrop(stances[i]!) * legUnit : 0;
    });
    const xs = channel(frames.map((fr) => fr.x * unit));
    const ys = channel(frames.map((fr, i) => -fr.y * unit + sink[i]!));
    const rots = channel(frames.map((fr) => fr.rot));
    const squash = channel(frames.map((fr) => fr.sy));
    play(el, offsets.map((_, i) => `translate(${xs[i]!.toFixed(2)}px, ${ys[i]!.toFixed(2)}px) rotate(${rots[i]!.toFixed(2)}deg) scaleY(${squash[i]!.toFixed(3)})`));

    // The limbs. The lead arm and leg are the ones on the opponent's side
    // of the picture: screen-right for whoever works from the left.
    const joints = jointsOf(f.id);
    if (!joints) continue;
    const d = f.dir;
    const lead = d === 1 ? joints.right : joints.left;
    const rear = d === 1 ? joints.left : joints.right;
    const turn = (part: Element, angle: (st: Stance) => number) => play(part, channel(stances.map(angle)).map((deg) => `rotate(${deg.toFixed(2)}deg)`));
    // The bend of the upper body, shared between the waist and the middle
    // of the back where the figure has both — a curve, not a hinge — plus
    // whatever extra curl the pose puts in the back alone.
    if (joints.chest) {
      turn(joints.waist, (st) => d * st.w * 0.72);
      turn(joints.chest, (st) => d * (st.w * 0.28 + (st.c ?? 0)));
    } else {
      turn(joints.waist, (st) => d * (st.w + (st.c ?? 0)));
    }
    turn(lead.shoulder, (st) => -d * st.la[0]);
    turn(lead.elbow, (st) => -d * st.la[1]);
    turn(rear.shoulder, (st) => -d * st.ra[0]);
    turn(rear.elbow, (st) => -d * st.ra[1]);
    turn(lead.hip, (st) => -d * st.ll[0]);
    turn(lead.knee, (st) => d * st.ll[1]);
    turn(rear.hip, (st) => -d * st.rl[0]);
    turn(rear.knee, (st) => d * st.rl[1]);
  }
  return running;
}

/** Stops animations where they have got to, without snapping anything back. */
export function settle(running: readonly Animation[]) {
  for (const animation of running) {
    try {
      animation.commitStyles();
    } catch {
      // Not rendered (the figure has gone); nothing to keep.
    }
    animation.cancel();
  }
}
