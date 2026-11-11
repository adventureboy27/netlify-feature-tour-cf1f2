// The ring, and the two people in it for the current beat.
//
// The stage is always 2:1 and sized to fit whatever room it is given; every
// distance in the choreography is in hundredths of its width, so a move
// plays the same on a laptop and a 4K monitor. Wrestlers are animated with
// the Web Animations API straight from choreography.ts's pose tables — the
// screen that owns this component only says who is in the ring and what the
// beat is.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArenaBack, ArenaFront, FEET_Y, VIEW } from './Arena';
import { FIGURE_ASPECT, MatchFigure } from './MatchFigure';
import { GAP, LEAD_IN, endPose, fromPose, isHome, type Frame, type Pose, type StagedBeat } from './choreography';
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

export function MatchStage({
  beatKey,
  fighters,
  staged,
  accent,
  promotionName,
  callout,
  pyro,
}: {
  /** Changes every beat; restarts the choreography. */
  beatKey: number;
  fighters: readonly StageFighter[];
  staged: StagedBeat | null;
  accent: string;
  promotionName: string;
  callout: string | null;
  /** The production gear is the story of this beat, not a wrestler. */
  pyro: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const ropesRef = useRef<SVGGElement>(null);
  const figureRefs = useRef(new Map<Id, HTMLDivElement>());
  // Where the previous beat left each wrestler, so the next one can start
  // from there instead of blinking them back to their marks.
  const leftAt = useRef(new Map<Id, Pose>());
  const { w, h } = useStageSize(frameRef);
  const u = w / 100;
  const [hype, setHype] = useState(false);

  const feetY = (FEET_Y / VIEW.h) * h;
  const homeX = (slot: 'left' | 'right') => w / 2 + (slot === 'left' ? -1 : 1) * (GAP / 2) * u;
  const dir = (slot: 'left' | 'right') => (slot === 'left' ? 1 : -1);

  const choreo = staged?.choreo ?? null;
  const target = fighters.find((f) => f.role === 'target');
  const anyoneDisplaced = fighters.some((f) => {
    const pose = leftAt.current.get(f.wrestler.id);
    return pose !== undefined && !isHome(pose);
  });
  const lead = anyoneDisplaced ? LEAD_IN : 0;
  const duration = staged?.duration ?? 0;
  const when = (at: number) => (lead + at * (1 - lead)) * duration;

  useLayoutEffect(() => {
    if (!choreo || u === 0) return;
    const running: Animation[] = [];
    const next = new Map<Id, Pose>();
    for (const fighter of fighters) {
      const el = figureRefs.current.get(fighter.wrestler.id);
      if (!el) continue;
      const base: readonly Frame[] = fighter.role === 'actor' ? choreo.actor : choreo.target;
      const frames = fromPose(base, leftAt.current.get(fighter.wrestler.id), lead);
      const d = dir(fighter.slot);
      running.push(
        el.animate(
          frames.map(([at, x, y, rot, sy = 1]) => ({
            offset: at,
            transform: `translate(${d * x * u}px, ${-y * u}px) rotate(${d * rot}deg) scaleY(${sy})`,
            easing: 'cubic-bezier(0.33, 0.1, 0.4, 1)',
          })),
          { duration, fill: 'both' },
        ),
      );
      next.set(fighter.wrestler.id, endPose(base));
    }
    leftAt.current = next;

    const timers: number[] = [];
    for (const [at, , , big] of choreo.impacts ?? []) {
      if (!big) continue;
      timers.push(
        window.setTimeout(() => {
          shakeRef.current?.animate(SHAKE, { duration: 380, easing: 'ease-out' });
          ropesRef.current?.animate(ROPE_WOBBLE, { duration: 450, easing: 'ease-out' });
          setHype(true);
        }, when(at)),
      );
    }
    if (choreo.ropes !== undefined) {
      timers.push(window.setTimeout(() => ropesRef.current?.animate(ROPE_WOBBLE, { duration: 500, easing: 'ease-out' }), when(choreo.ropes)));
    }
    timers.push(window.setTimeout(() => setHype(false), duration + 500));
    return () => {
      running.forEach((a) => a.cancel());
      timers.forEach((t) => window.clearTimeout(t));
    };
    // `fighters`/`choreo` are rebuilt every render; the beat key and stage
    // size are what actually mean "play this again".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatKey, u]);

  useEffect(() => {
    if (pyro) setHype(true);
  }, [pyro, beatKey]);

  const figureW = FIGURE_W * u;
  const figureH = figureW * FIGURE_ASPECT;
  const targetX = target ? homeX(target.slot) : w / 2;
  const targetDir = target ? dir(target.slot) : 1;
  const cover = choreo?.cover;

  return (
    <div ref={frameRef} className="relative flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden bg-black">
      {w > 0 && (
        <div ref={shakeRef} className="relative overflow-hidden" style={{ width: w, height: h }} data-move={staged?.move} data-beat={beatKey}>
          <ArenaBack accent={accent} name={promotionName} hype={hype} showName={!callout} />

          {/* The apron is the nearest thing this building has to a nameplate. */}
          <div className="absolute inset-x-0 flex justify-center text-center font-black uppercase tracking-[0.2em] text-white/85" style={{ top: (474 / VIEW.h) * h, fontSize: 2.6 * u }}>
            {promotionName.length > 26 ? promotionName.split(/\s+/).map((part) => part[0]).join('') : promotionName}
          </div>

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
                left: homeX(fighter.slot) - figureW / 2,
                top: feetY - figureH,
                width: figureW,
                transformOrigin: '50% 100%',
                // Whoever is doing the move is nearer the camera.
                zIndex: fighter.role === 'actor' ? 3 : 2,
                willChange: 'transform',
              }}
            >
              <MatchFigure wrestler={fighter.wrestler} />
            </div>
          ))}

          <ArenaFront accent={accent} ropesRef={ropesRef} />

          {/* Impacts: a burst where it landed, and a ring of dust for the big ones. */}
          {(choreo?.impacts ?? []).map(([at, x, y, big], i) => {
            const left = targetX + targetDir * x * u;
            const top = feetY - y * u;
            const size = (big ? 15 : 9) * u;
            return (
              <div key={`${beatKey}-${i}`}>
                <svg
                  viewBox="-50 -50 100 100"
                  className="mv-burst pointer-events-none absolute"
                  style={{ left, top, width: size, height: size, animationDelay: `${when(at)}ms`, zIndex: 6 }}
                >
                  <polygon
                    points="0,-48 9,-17 38,-34 20,-7 48,2 19,11 31,40 6,20 -8,48 -12,17 -42,28 -22,3 -48,-12 -18,-13 -24,-42"
                    fill="#ffe27a"
                    stroke="#fff"
                    strokeWidth={3}
                  />
                </svg>
                {big && (
                  <div
                    className="mv-shock pointer-events-none absolute rounded-[50%] border-2 border-white/70"
                    style={{ left, top: feetY, width: 30 * u, height: 6 * u, animationDelay: `${when(at)}ms`, zIndex: 1 }}
                  />
                )}
              </div>
            );
          })}

          {/* The count, over the cover. */}
          {cover &&
            target &&
            Array.from({ length: cover.count }, (_, i) => {
              const at = cover.from + ((cover.to - cover.from) * (i + 0.35)) / cover.count;
              return (
                <span
                  key={`${beatKey}-count-${i}`}
                  className="mv-count pointer-events-none absolute font-black text-white"
                  style={{
                    left: targetX - targetDir * (10 - cover.at) * u,
                    top: feetY - 13 * u,
                    fontSize: 5.2 * u,
                    textShadow: '0 3px 0 rgba(0,0,0,0.7)',
                    animationDelay: `${when(at)}ms`,
                    zIndex: 7,
                  }}
                >
                  {i + 1}!
                </span>
              );
            })}

          {pyro && (
            <>
              {[18, 82].map((x) => (
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
            </>
          )}

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
