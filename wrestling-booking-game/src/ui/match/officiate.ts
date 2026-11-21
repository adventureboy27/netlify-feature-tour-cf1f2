// Moving the people at the ring who are not wrestling. See Ringside.tsx for
// the figure, MatchStage for when each of them does what.
//
// A person here is a list of moments — where they are, standing or down on
// a knee or flat on the mat, back to the ring or not, where the working arm
// is — and this turns that into animations on the figure's parts.

import type { PersonParts } from './Ringside';

export interface PersonMoment {
  /** Milliseconds into the beat. */
  t: number;
  /** Ring units, as everywhere else on the stage. */
  x: number;
  y: number;
  pose: 'stand' | 'kneel' | 'down';
  /** Which way he went down, when he is down. */
  fall?: 1 | -1;
  /** Back to the ring (and to us). */
  back?: boolean;
  /** The working arm, degrees about the shoulder: 0 hangs, -90 points out, -165 straight up. */
  arm?: number;
}

/** Where a person was left: the last moment, at time zero of the next beat. */
export const restingAt = (m: PersonMoment): PersonMoment => ({ ...m, t: 0 });

/** One hand down on the mat per count, at each of these times (ms). */
export function slaps(at: readonly number[], x: number, y: number): PersonMoment[] {
  const out: PersonMoment[] = [];
  for (const t of at) {
    out.push({ t: Math.max(0, t - 170), x, y, pose: 'kneel', arm: -150 });
    out.push({ t, x, y, pose: 'kneel', arm: -15 });
  }
  return out;
}

/** Waving for the bell, from `from` to `to` ms. */
export function waving(from: number, to: number, x: number, y: number, back = false): PersonMoment[] {
  const out: PersonMoment[] = [];
  for (let t = from, n = 0; t <= to; t += 210, n++) out.push({ t, x, y, pose: 'stand', back, arm: n % 2 ? -110 : -170 });
  return out;
}

/**
 * Play the moments over `duration` ms. Sorted, tidied (two moments at one
 * instant keep the later), and held at the last one.
 */
export function playPerson(parts: PersonParts, moments: readonly PersonMoment[], duration: number, u: number, iterations = 1): Animation[] {
  const sorted = [...moments].sort((a, b) => a.t - b.t).filter((m, i, all) => i === all.length - 1 || all[i + 1]!.t > m.t + 1);
  if (sorted.length === 0 || duration <= 0) return [];
  const span = Math.max(duration, sorted[sorted.length - 1]!.t + 1);
  const offset = (t: number) => Math.min(1, Math.max(0, t / span));
  const place = (m: PersonMoment) => {
    const turn = m.pose === 'down' ? `rotate(${(m.fall ?? 1) * 86}deg)` : 'rotate(0deg)';
    return `translate(${m.x * u}px, ${-m.y * u}px) ${turn}`;
  };
  // Opacity flips are discrete: each change is two keyframes a hair apart.
  const flips = (on: (m: PersonMoment) => boolean): Keyframe[] => {
    const out: Keyframe[] = [];
    sorted.forEach((m, i) => {
      const value = on(m) ? 1 : 0;
      const prev = i > 0 ? (on(sorted[i - 1]!) ? 1 : 0) : value;
      if (i > 0 && prev !== value) out.push({ offset: Math.max(0, offset(m.t) - 0.0005), opacity: prev });
      out.push({ offset: offset(m.t), opacity: value });
    });
    if (out[0]!.offset !== 0) out.unshift({ ...out[0]!, offset: 0 });
    if (out[out.length - 1]!.offset !== 1) out.push({ ...out[out.length - 1]!, offset: 1 });
    return out;
  };
  const edges = <K extends Keyframe>(frames: K[]): K[] => {
    if (frames[0]!.offset !== 0) frames.unshift({ ...frames[0]!, offset: 0 });
    if (frames[frames.length - 1]!.offset !== 1) frames.push({ ...frames[frames.length - 1]!, offset: 1 });
    return frames;
  };
  const timing: KeyframeAnimationOptions = { duration: span, fill: 'forwards', easing: 'linear', iterations };
  const armAt = (m: PersonMoment) => `rotate(${m.arm ?? 0}deg)`;
  return [
    parts.root.animate(edges(sorted.map((m) => ({ offset: offset(m.t), transform: place(m), easing: 'ease-in-out' }))), timing),
    parts.standing.animate(flips((m) => m.pose !== 'kneel'), timing),
    parts.kneeling.animate(flips((m) => m.pose === 'kneel'), timing),
    parts.back.animate(flips((m) => Boolean(m.back) && m.pose === 'stand'), timing),
    parts.arm.animate(edges(sorted.map((m) => ({ offset: offset(m.t), transform: m.pose === 'kneel' ? 'rotate(0deg)' : armAt(m) }))), timing),
    parts.kneelArm.animate(edges(sorted.map((m) => ({ offset: offset(m.t), transform: m.pose === 'kneel' ? armAt(m) : 'rotate(0deg)' }))), timing),
  ];
}
