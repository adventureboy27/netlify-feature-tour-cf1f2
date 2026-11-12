// Turns a plan (ringPhysics.ts) into motion: one Web Animation for each
// body, nine more for its joints. Shared by the two wrestlers a beat is
// about (MatchStage) and by everybody brawling behind them (FieldBrawl).

import { FRONT_FLOOR } from './choreography';
import { STANCES, autoStance, hipDrop, type Stance } from './rig';
import { onFrontFloor, type Plan, type PlanFighter } from './ringPhysics';
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
    const frames = plan.tracks.get(f.id);
    if (!el || !frames) continue;
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
    turn(joints.waist, (st) => d * st.w);
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
