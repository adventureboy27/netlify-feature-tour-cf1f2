// The ring, and the people in it for the current beat.
//
// The stage is always 2:1 and sized to fit whatever room it is given; every
// distance is in hundredths of its width, so a move plays the same on a
// laptop and a 4K monitor. Each beat, ringPhysics.ts turns the staged move
// into positions in the ring — starting from wherever the last beat left
// everybody — and this plays those with the Web Animations API: one track
// for each body, nine more for its joints.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArenaBack, ArenaFront, FEET_Y, VIEW } from './Arena';
import { FIGURE_ASPECT, MatchFigure } from './MatchFigure';
import { ArticulatedFigure, type Joints } from './ArticulatedFigure';
import { STANCES, autoStance, hipDrop, type Stance } from './rig';
import { FLOOR, FRONT_FLOOR, GAP, type StagedBeat } from './choreography';
import { RING, apronX, midBody, onFrontFloor, planBeat, type Plan, type PlanFighter, type WorldPose } from './ringPhysics';
import type { Id, Wrestler } from '../../engine/types';

/** Figure width in stage units (hundredths of the stage's width). */
const FIGURE_W = 12.8;

/** The largest 2:1 box that fits the element, re-measured when it resizes. */
function useStageSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = Math.min(el.clientWidth, el.clientHeight * 2);
      setSize((prev) => (Math.abs(prev.w - w) < 1 ? prev : { w, h: w / 2 }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

export interface StageFighter {
  wrestler: Wrestler;
  role: 'actor' | 'target';
  /** Which half of the ring they work from. */
  slot: 'left' | 'right';
  /** They were just tagged in: start on the apron and come over the top rope. */
  taggedIn?: boolean;
}

/** Somebody in the match but not in this beat. */
export interface Bystander {
  wrestler: Wrestler;
  slot: 'left' | 'right';
  /** A tag partner waits on the apron at their corner; a battle royal field stands in the ring. */
  place: 'apron' | 'ring';
}

const SHAKE: Keyframe[] = [
  { transform: 'translate(0,0)' },
  { transform: 'translate(-7px,3px)' },
  { transform: 'translate(6px,-3px)' },
  { transform: 'translate(-4px,3px)' },
  { transform: 'translate(3px,-2px)' },
  { transform: 'translate(0,0)' },
];
const ROPE_WOBBLE: Keyframe[] = [
  { transform: 'translateY(0)' },
  { transform: 'translateY(5px)' },
  { transform: 'translateY(-4px)' },
  { transform: 'translateY(3px)' },
  { transform: 'translateY(-1px)' },
  { transform: 'translateY(0)' },
];
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
const dirOf = (slot: 'left' | 'right'): 1 | -1 => (slot === 'left' ? 1 : -1);

export function MatchStage({
  beatKey,
  fighters,
  staged,
  accent,
  promotionName,
  callout,
  pyro,
  bystanders = [],
}: {
  /** Changes every beat; restarts the choreography. */
  beatKey: number;
  fighters: readonly StageFighter[];
  /** Null while nothing is happening yet — the two stand at their marks. */
  staged: StagedBeat | null;
  accent: string;
  promotionName: string;
  callout: string | null;
  /** The production gear is the story of this beat, not a wrestler. */
  pyro: boolean;
  bystanders?: readonly Bystander[];
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const ropesRef = useRef<SVGGElement>(null);
  const figureRefs = useRef(new Map<Id, HTMLDivElement>());
  const jointRefs = useRef(new Map<Id, Joints>());
  // Where the last beat left everybody, and where it was centred — the next
  // one picks up from there.
  const leftAt = useRef(new Map<Id, WorldPose>());
  const centre = useRef(0);
  const { w, h } = useStageSize(frameRef);
  const u = w / 100;
  const [hype, setHype] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);

  const feetY = (FEET_Y / VIEW.h) * h;
  const sx = (x: number) => w / 2 + x * u;
  const sy = (y: number) => feetY - y * u;
  const figureW = FIGURE_W * u;
  const figureH = figureW * FIGURE_ASPECT;
  const duration = staged?.duration ?? 0;

  useLayoutEffect(() => {
    if (u === 0) return;
    const cast: PlanFighter[] = fighters.map((f) => ({
      id: f.wrestler.id,
      role: f.role,
      dir: dirOf(f.slot),
      from: leftAt.current.get(f.wrestler.id),
      taggedIn: Boolean(f.taggedIn),
    }));

    if (!staged) {
      // Before the bell: at their marks, facing each other.
      const standing = new Map<Id, WorldPose>();
      for (const f of cast) {
        const pose = { x: centre.current - (f.dir * GAP) / 2, y: 0, rot: 0 };
        standing.set(f.id, pose);
        const el = figureRefs.current.get(f.id);
        if (el) el.style.transform = `translate(${pose.x * u}px, 0px)`;
      }
      leftAt.current = standing;
      setPlan(null);
      return;
    }

    const next = planBeat(staged, cast, centre.current);
    centre.current = next.centre;
    leftAt.current = next.end;
    setPlan(next);

    const running: Animation[] = [];
    const legUnit = figureW / 100;
    for (const f of cast) {
      const el = figureRefs.current.get(f.id);
      const frames = next.tracks.get(f.id);
      if (!el || !frames) continue;
      // The stance guess reads a lean relative to the way they face.
      const facing = frames.map((fr) => [fr.at, f.dir * fr.x, fr.y, f.dir * fr.rot, fr.sy, fr.stance] as const);
      const stances: Stance[] = frames.map((fr, i) => STANCES[fr.stance ?? autoStance(facing, i)]);
      const times = frames.map((fr) => fr.at);
      const steps = Math.max(2, Math.round(duration / SAMPLE_MS));
      const offsets = Array.from({ length: steps + 1 }, (_, i) => i / steps);
      const channel = (values: number[]) => {
        const at = curve(times, values);
        return offsets.map(at);
      };
      const play = (part: Element, transforms: string[]) =>
        running.push(part.animate(transforms.map((transform, i) => ({ offset: offsets[i]!, transform })), { duration, fill: 'both' }));

      // Bent knees bring the hips down — but only for somebody standing on
      // the mat or the floor; a body in the air or lying down has nothing
      // to sink toward.
      const sink = frames.map((fr, i) => {
        const height = fr.y - (onFrontFloor(fr) ? FRONT_FLOOR : 0);
        return height < 1 && Math.abs(fr.rot) < 45 ? hipDrop(stances[i]!) * legUnit : 0;
      });
      const [xs, ys, rots, squash] = [
        channel(frames.map((fr) => fr.x * u)),
        channel(frames.map((fr, i) => -fr.y * u + sink[i]!)),
        channel(frames.map((fr) => fr.rot)),
        channel(frames.map((fr) => fr.sy)),
      ];
      el.style.transform = '';
      play(el, offsets.map((_, i) => `translate(${xs[i]!.toFixed(2)}px, ${ys[i]!.toFixed(2)}px) rotate(${rots[i]!.toFixed(2)}deg) scaleY(${squash[i]!.toFixed(3)})`));

      // The limbs. The lead arm and leg are the ones on the opponent's
      // side of the picture: screen-right for whoever works from the left.
      const joints = jointRefs.current.get(f.id);
      if (!joints) continue;
      const d = f.dir;
      const lead = d === 1 ? joints.right : joints.left;
      const rear = d === 1 ? joints.left : joints.right;
      const turn = (part: Element, angle: (st: Stance) => number) =>
        play(part, channel(stances.map(angle)).map((deg) => `rotate(${deg.toFixed(2)}deg)`));
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

    const timers: number[] = [];
    for (const impact of next.impacts) {
      if (!impact.big) continue;
      timers.push(
        window.setTimeout(() => {
          shakeRef.current?.animate(SHAKE, { duration: 380, easing: 'ease-out' });
          ropesRef.current?.animate(ROPE_WOBBLE, { duration: 450, easing: 'ease-out' });
          setHype(true);
        }, impact.at * duration),
      );
    }
    for (const at of next.ropeHits) {
      timers.push(window.setTimeout(() => ropesRef.current?.animate(ROPE_WOBBLE, { duration: 500, easing: 'ease-out' }), at * duration));
    }
    timers.push(window.setTimeout(() => setHype(false), duration + 500));
    return () => {
      // Leave each body where its animation had got to; cancelling outright
      // would blink everyone back to the centre for a frame.
      for (const animation of running) {
        try {
          animation.commitStyles();
        } catch {
          // Not rendered (the figure has gone); nothing to keep.
        }
        animation.cancel();
      }
      timers.forEach((t) => window.clearTimeout(t));
    };
    // `fighters`/`staged` are rebuilt every render; the beat key and stage
    // size are what actually mean "play this again".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatKey, u]);

  useEffect(() => {
    if (pyro) setHype(true);
  }, [pyro, beatKey]);

  const target = fighters.find((f) => f.role === 'target');
  const cover = staged?.choreo.cover;
  const coverAt = cover && target && plan?.end.get(target.wrestler.id);
  const when = (at: number) => ((plan?.lead ?? 0) + at * (1 - (plan?.lead ?? 0))) * duration;

  return (
    <div ref={frameRef} className="relative flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden bg-black">
      {w > 0 && (
        <div ref={shakeRef} className="relative overflow-hidden" style={{ width: w, height: h }} data-move={staged?.move} data-beat={beatKey}>
          <ArenaBack accent={accent} name={promotionName} hype={hype} showName={!callout} />

          {/* The apron is the nearest thing this building has to a nameplate. */}
          <div className="absolute inset-x-0 flex justify-center text-center font-black uppercase tracking-[0.2em] text-white/85" style={{ top: (474 / VIEW.h) * h, fontSize: 2.6 * u }}>
            {promotionName.length > 26 ? promotionName.split(/\s+/).map((part) => part[0]).join('') : promotionName}
          </div>

          {/* Everyone in the match who is not in this beat. A battle royal's
              field stands along the back of the ring, smaller for the
              distance; a tag partner waits on the apron at their corner,
              and any more of the team on the floor beside it. */}
          {(() => {
            const field = bystanders.filter((b) => b.place === 'ring');
            return bystanders.map((b) => {
              const side = dirOf(b.slot);
              const k = b.place === 'ring' ? 0.62 : 0.86;
              const width = figureW * k;
              const order = (b.place === 'ring' ? field : bystanders.filter((o) => o.place === 'apron' && o.slot === b.slot)).indexOf(b);
              const x = b.place === 'ring' ? sx(field.length === 1 ? 0 : ((order / (field.length - 1)) * 2 - 1) * (RING.half - 4)) : sx(apronX(side) - side * order * 5.5);
              const feet = b.place === 'ring' ? (384 / VIEW.h) * h : sy(order === 0 ? 0 : FLOOR);
              return (
                <div
                  key={b.wrestler.id}
                  data-testid={`bystander-${b.place}`}
                  className="absolute"
                  style={{ left: x - width / 2, top: feet - width * FIGURE_ASPECT, width, zIndex: b.place === 'ring' ? 1 : 4, opacity: b.place === 'ring' ? 0.92 : 1 }}
                >
                  <MatchFigure wrestler={b.wrestler} />
                </div>
              );
            });
          })()}

          {fighters.map((fighter) => (
            <div
              key={fighter.wrestler.id}
              ref={(el) => {
                if (el) figureRefs.current.set(fighter.wrestler.id, el);
                else figureRefs.current.delete(fighter.wrestler.id);
              }}
              data-testid={`ring-${fighter.role}`}
              className="absolute"
              style={{
                // Parked on the centre of the ring; the animation's own
                // translate is the position in it.
                left: w / 2 - figureW / 2,
                top: feetY - figureH,
                width: figureW,
                transformOrigin: '50% 100%',
                // Whoever is doing the move is nearer the camera — and anybody
                // on the floor in front of the ring is in front of its ropes
                // and posts too, not behind them.
                zIndex: (staged?.zone && staged.zone !== 'ring' ? 5 : 0) + (fighter.role === 'actor' ? 3 : 2),
                willChange: 'transform',
              }}
            >
              {/* Always breathing, so a body that has finished its move is
                  still a living one. */}
              <div className="mv-breathe">
                <ArticulatedFigure
                  wrestler={fighter.wrestler}
                  onJoints={(joints) => {
                    if (joints) jointRefs.current.set(fighter.wrestler.id, joints);
                    else jointRefs.current.delete(fighter.wrestler.id);
                  }}
                />
              </div>
            </div>
          ))}

          <ArenaFront accent={accent} ropesRef={ropesRef} />

          {/* Impacts: a burst where it landed, and a ring of dust for the big ones. */}
          {(plan?.impacts ?? []).map((impact, i) => {
            const size = (impact.big ? 11 : 7.5) * u;
            const delay = `${impact.at * duration}ms`;
            return (
              <div key={`${beatKey}-${i}`}>
                <svg viewBox="-50 -50 100 100" className="mv-burst pointer-events-none absolute" style={{ left: sx(impact.x), top: sy(impact.y), width: size, height: size, animationDelay: delay, zIndex: 6 }}>
                  <polygon points="0,-48 9,-17 38,-34 20,-7 48,2 19,11 31,40 6,20 -8,48 -12,17 -42,28 -22,3 -48,-12 -18,-13 -24,-42" fill="#ffe27a" stroke="#fff" strokeWidth={3} />
                </svg>
                {impact.big && (
                  <div className="mv-shock pointer-events-none absolute rounded-[50%] border-2 border-white/70" style={{ left: sx(impact.x), top: feetY, width: 30 * u, height: 6 * u, animationDelay: delay, zIndex: 1 }} />
                )}
              </div>
            );
          })}

          {/* The slap of a tag, at the corner it happened in. */}
          {staged &&
            fighters
              .filter((f) => f.taggedIn)
              .map((f) => (
                <svg
                  key={`${beatKey}-tag-${f.wrestler.id}`}
                  viewBox="-50 -50 100 100"
                  className="mv-burst pointer-events-none absolute"
                  style={{ left: sx(apronX(dirOf(f.slot)) + dirOf(f.slot) * 2.5), top: sy(13), width: 9 * u, height: 9 * u, zIndex: 6 }}
                >
                  <polygon points="0,-48 9,-17 38,-34 20,-7 48,2 19,11 31,40 6,20 -8,48 -12,17 -42,28 -22,3 -48,-12 -18,-13 -24,-42" fill="#ffffff" stroke="#ffe27a" strokeWidth={3} />
                </svg>
              ))}

          {/* The count, over the cover. */}
          {cover &&
            coverAt &&
            Array.from({ length: cover.count }, (_, i) => {
              const at = cover.from + ((cover.to - cover.from) * (i + 0.35)) / cover.count;
              return (
                <span
                  key={`${beatKey}-count-${i}`}
                  className="mv-count pointer-events-none absolute font-black text-white"
                  style={{ left: sx(midBody(coverAt).x), top: sy(13), fontSize: 5.2 * u, textShadow: '0 3px 0 rgba(0,0,0,0.7)', animationDelay: `${when(at)}ms`, zIndex: 7 }}
                >
                  {i + 1}!
                </span>
              );
            })}

          {pyro &&
            [18, 82].map((x) => (
              <div
                key={`${beatKey}-pyro-${x}`}
                className="mv-pyro pointer-events-none absolute"
                style={{
                  left: `${x}%`,
                  bottom: '12%',
                  width: 7 * u,
                  height: 26 * u,
                  marginLeft: -3.5 * u,
                  background: 'linear-gradient(to top, #fff3b0, #ff9d2e 35%, rgba(255,80,20,0.5) 70%, transparent)',
                  filter: 'blur(1.5px)',
                  borderRadius: '50% 50% 20% 20%',
                  zIndex: 6,
                }}
              />
            ))}

          {callout && (
            <div
              key={`callout-${beatKey}`}
              className="pointer-events-none absolute flex items-center justify-center px-2 text-center"
              style={{ left: (430 / VIEW.w) * w, width: (340 / VIEW.w) * w, top: (30 / VIEW.h) * h, height: (118 / VIEW.h) * h, zIndex: 8 }}
            >
              <span
                className="animate-callout-pop select-none font-black uppercase leading-none tracking-wide text-amber-300"
                style={{ fontSize: Math.max(2.1, Math.min(4.2, 46 / callout.length)) * u, textShadow: '0.2em 0.2em 0 rgba(0,0,0,0.65)' }}
              >
                {callout}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
