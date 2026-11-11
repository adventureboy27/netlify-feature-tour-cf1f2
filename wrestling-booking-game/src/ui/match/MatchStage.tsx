// The ring, and the people in it.
//
// The stage is always 2:1 and sized to fit whatever room it is given; every
// distance is in hundredths of its width, so a move plays the same on a
// laptop and a 4K monitor. Each beat, ringPhysics.ts turns the staged move
// into positions in the ring — starting from wherever the last beat left
// everybody — and playback.ts plays them.
//
// Besides the two a beat is about, this owns three other kinds of people:
// whoever is waiting (partners on the apron; a battle royal's field, which
// FieldBrawl keeps fighting), whoever has been eliminated (they get up and
// walk out of the building, and are not seen again), and, once the match
// is over, everybody: the winners with their arms up, the rest on the mat.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArenaBack, ArenaFront, FEET_Y, VIEW, type Corner } from './Arena';
import { FIGURE_ASPECT, MatchFigure, heightScale } from './MatchFigure';
import { ArticulatedFigure, type Joints } from './ArticulatedFigure';
import { playPlan, settle } from './playback';
import { FieldBrawl } from './FieldBrawl';
import { DOWN, FLOOR, FRONT_FLOOR, GAP, type StagedBeat } from './choreography';
import { RING, apronX, midBody, onFrontFloor, planBeat, type Plan, type PlanFighter, type WorldFrame, type WorldPose } from './ringPhysics';
import type { Conduct } from './conduct';
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
  /** A tag partner waits on the apron at their corner; everybody in an all-in match is in the ring. */
  place: 'apron' | 'ring';
}

/** How the match came out, for the picture it ends on. */
export interface Aftermath {
  winners: ReadonlySet<Id>;
  /** The winners leave with (or keep) a championship. */
  belt: boolean;
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
const dirOf = (slot: 'left' | 'right'): 1 | -1 => (slot === 'left' ? 1 : -1);
const frame = (at: number, pose: WorldPose, stance?: WorldFrame['stance']): WorldFrame => ({ at, ...pose, sy: 1, stance });
const planOf = (tracks: Map<Id, WorldFrame[]>): Plan => ({
  tracks,
  lead: 0,
  centre: 0,
  impacts: [],
  ropeHits: [],
  end: new Map([...tracks].map(([id, frames]) => [id, { x: frames[frames.length - 1]!.x, y: frames[frames.length - 1]!.y, rot: frames[frames.length - 1]!.rot }])),
});

/** A championship belt, held up. */
function Belt() {
  return (
    <svg viewBox="0 0 120 40" className="pointer-events-none absolute" style={{ left: '14%', top: '-2%', width: '72%' }} aria-hidden>
      <path d="M 2,14 L 40,10 L 80,10 L 118,14 L 118,26 L 80,30 L 40,30 L 2,26 Z" fill="#2a2018" stroke="#0e0a06" strokeWidth={1.5} />
      <rect x={40} y={3} width={40} height={34} rx={8} fill="#e2b33c" stroke="#8a6412" strokeWidth={2} />
      <circle cx={60} cy={20} r={9} fill="#f6dc8a" stroke="#8a6412" strokeWidth={1.5} />
      <rect x={14} y={12} width={16} height={16} rx={4} fill="#e2b33c" stroke="#8a6412" strokeWidth={1.5} />
      <rect x={90} y={12} width={16} height={16} rx={4} fill="#e2b33c" stroke="#8a6412" strokeWidth={1.5} />
    </svg>
  );
}

export function MatchStage({
  beatKey,
  fighters,
  staged,
  accent,
  promotionName,
  callout,
  pyro,
  bystanders = [],
  conduct,
  departed,
  aftermath,
  bloody,
  corners,
  eventName,
}: {
  /** An interpromotional night: the company in the left corner and the one in the right. */
  corners?: readonly [Corner, Corner];
  eventName?: string;
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
  /** The rules of the match: what furniture the ring has, what people wear. */
  conduct?: Conduct;
  /** Everybody eliminated so far. They leave, and are not drawn again. */
  departed?: ReadonlySet<Id>;
  /** Set once the last beat has played: the match is over and this is how. */
  aftermath?: Aftermath;
  bloody?: ReadonlySet<Id>;
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
  // Everybody who has been one of the two in the ring, so that somebody
  // eliminated can still be drawn — walking out — after they stop being one.
  const seen = useRef(new Map<Id, StageFighter>());
  const walkedOut = useRef(new Set<Id>());
  const walking = useRef(new Set<Id>());
  const [, redraw] = useState(0);
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
  const over = Boolean(aftermath);

  for (const f of fighters) seen.current.set(f.wrestler.id, f);
  const inBeat = new Set(fighters.map((f) => f.wrestler.id));
  // Eliminated, no longer in the beat, and not yet out of the building.
  const leavers = [...seen.current.values()].filter((f) => departed?.has(f.wrestler.id) && !inBeat.has(f.wrestler.id) && !walkedOut.current.has(f.wrestler.id));
  // Once it is over, the partners come off the apron to be part of the ending.
  const ending: StageFighter[] = over
    ? bystanders.filter((b) => b.place === 'apron' && !inBeat.has(b.wrestler.id)).map((b) => ({ wrestler: b.wrestler, role: 'target' as const, slot: b.slot }))
    : [];
  const drawn = [...fighters, ...ending, ...leavers];

  // ---- the beat ---------------------------------------------------------
  useLayoutEffect(() => {
    if (u === 0 || over) return;
    const cast: PlanFighter[] = fighters.map((f) => ({
      id: f.wrestler.id,
      role: f.role,
      dir: dirOf(f.slot),
      from: leftAt.current.get(f.wrestler.id),
      taggedIn: Boolean(f.taggedIn),
    }));

    if (!staged) {
      // Before the bell: at their marks, facing each other.
      for (const f of cast) {
        const pose = { x: centre.current - (f.dir * GAP) / 2, y: 0, rot: 0 };
        leftAt.current.set(f.id, pose);
        const el = figureRefs.current.get(f.id);
        if (el) el.style.transform = `translate(${pose.x * u}px, 0px)`;
      }
      setPlan(null);
      return;
    }

    const next = planBeat(staged, cast, centre.current);
    centre.current = next.centre;
    for (const [id, pose] of next.end) leftAt.current.set(id, pose);
    setPlan(next);
    for (const f of cast) {
      const el = figureRefs.current.get(f.id);
      if (el) el.style.transform = '';
    }
    const running = playPlan(next, cast, (id) => figureRefs.current.get(id), (id) => jointRefs.current.get(id), u, figureW, duration);

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
      settle(running);
      timers.forEach((t) => window.clearTimeout(t));
    };
    // `fighters`/`staged` are rebuilt every render; the beat key and stage
    // size are what actually mean "play this again".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatKey, u, over]);

  // ---- the eliminated walk out --------------------------------------------
  // Up off the floor and away to the nearest side of the building. Somebody
  // beaten inside the ring rolls out under the bottom rope first — nobody
  // walks through the ropes, even on the way home.
  useEffect(() => {
    if (u === 0) return;
    for (const leaver of leavers) {
      const id = leaver.wrestler.id;
      if (walking.current.has(id)) continue;
      const from = leftAt.current.get(id);
      const el = figureRefs.current.get(id);
      if (!from || !el) {
        walkedOut.current.add(id);
        continue;
      }
      walking.current.add(id);
      const side = from.x >= 0 ? 1 : -1;
      const floor = Math.abs(from.x) > RING.half + 1 ? (onFrontFloor(from) ? FRONT_FLOOR : FLOOR) : FRONT_FLOOR;
      const exit = { x: side * 64, y: floor, rot: 0 };
      const frames: WorldFrame[] = [frame(0, from, 'flat')];
      if (Math.abs(from.x) <= RING.half + 1 && from.y > FLOOR / 2) frames.push(frame(0.22, { x: from.x, y: floor + DOWN, rot: from.rot }, 'flat'));
      frames.push(frame(0.4, { x: from.x + side * 2, y: floor, rot: from.rot * 0.2 }, 'kneel'), frame(0.5, { x: from.x + side * 5, y: floor, rot: side * 6 }, 'stagger'));
      for (let i = 1; i <= 4; i++) frames.push(frame(0.5 + i * 0.125, { x: from.x + side * 5 + ((exit.x - from.x - side * 5) * i) / 4, y: floor, rot: side * 7 }, i % 2 ? 'run' : 'stagger'));
      el.style.transform = '';
      el.style.zIndex = '9';
      const cast: PlanFighter[] = [{ id, role: 'actor', dir: side, from, taggedIn: false }];
      const running = playPlan(planOf(new Map([[id, frames]])), cast, (key) => figureRefs.current.get(key), (key) => jointRefs.current.get(key), u, figureW, 3600);
      running[0]?.finished
        .then(() => {
          walkedOut.current.add(id);
          leftAt.current.delete(id);
          redraw((n) => n + 1);
        })
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leavers.map((l) => l.wrestler.id).join(','), u]);

  // ---- the ending -----------------------------------------------------------
  // The winners get up, gather, and put their arms in the air. Everybody
  // else stays down, or goes down where they stand.
  useLayoutEffect(() => {
    if (u === 0 || !aftermath) return;
    const edge = RING.half - 1;
    const people = [...fighters, ...ending];
    const winners = people.filter((f) => aftermath.winners.has(f.wrestler.id));
    const tracks = new Map<Id, WorldFrame[]>();
    const cheers = new Map<Id, WorldFrame[]>();
    const middle = Math.max(-8, Math.min(8, centre.current));
    people.forEach((f) => {
      const id = f.wrestler.id;
      const side = dirOf(f.slot);
      const from = leftAt.current.get(id) ?? { x: apronX(side), y: 0, rot: 0 };
      const outside = Math.abs(from.x) > RING.half + 1 || from.y < FLOOR / 2;
      const wasDown = Math.abs(Math.abs(from.rot) - 90) < 30;
      const place = winners.indexOf(f);
      const frames: WorldFrame[] = [frame(0, from, wasDown ? 'flat' : undefined)];
      if (place >= 0) {
        // Whoever won from outside (over a cage wall) celebrates out there.
        const to: WorldPose = outside && leftAt.current.has(id) ? { x: from.x, y: from.y, rot: 0 } : { x: Math.max(-edge + 3, Math.min(edge - 3, middle + (place - (winners.length - 1) / 2) * 9)), y: 0, rot: 0 };
        if (!leftAt.current.has(id)) frames.push(frame(0.4, { x: -side * (RING.half - 1), y: 13, rot: side * 16 }, 'tuck'));
        else if (wasDown) frames.push(frame(0.45, { x: from.x + (to.x - from.x) * 0.3, y: to.y, rot: from.rot * 0.25 }, 'kneel'));
        frames.push(frame(0.8, to, 'guard'), frame(1, to, 'celebrate'));
        cheers.set(id, [frame(0, to, 'celebrate'), frame(0.5, { ...to, y: to.y + 0.7 }, 'lift'), frame(1, to, 'celebrate')]);
      } else if (!leftAt.current.has(id)) {
        // A beaten partner, still at their corner: down off the apron.
        frames.push(frame(0.5, { x: apronX(side) - side * 2, y: FLOOR + 3, rot: side * 50 }, 'fall'), frame(1, { x: apronX(side) - side * 9, y: FLOOR + DOWN, rot: side * 90 }, 'flat'));
      } else if (wasDown || outside) {
        frames.push(frame(1, from, 'flat'));
      } else {
        // Still on their feet when it ended: down they go, where there is room to fall.
        const fall = from.x - 20 >= -edge ? -90 : 90;
        frames.push(frame(0.45, { x: from.x, y: 2.5, rot: fall * 0.55 }, 'fall'), frame(0.75, { x: from.x, y: DOWN, rot: fall }, 'flat'), frame(1, { x: from.x, y: DOWN, rot: fall }, 'flat'));
      }
      tracks.set(id, frames);
    });
    const cast: PlanFighter[] = people.map((f) => ({ id: f.wrestler.id, role: 'actor', dir: dirOf(f.slot), from: undefined, taggedIn: false }));
    const arrive = planOf(tracks);
    for (const [id, pose] of arrive.end) leftAt.current.set(id, pose);
    for (const f of cast) {
      const el = figureRefs.current.get(f.id);
      if (el) el.style.transform = '';
    }
    const running = playPlan(arrive, cast, (id) => figureRefs.current.get(id), (id) => jointRefs.current.get(id), u, figureW, 1500);
    setHype(true);
    const loop: Animation[] = [];
    const timer = window.setTimeout(() => {
      const cheering = cast.filter((f) => cheers.has(f.id));
      loop.push(...playPlan(planOf(cheers), cheering, (id) => figureRefs.current.get(id), (id) => jointRefs.current.get(id), u, figureW, 1100, { iterations: Infinity }));
    }, 1500);
    return () => {
      settle(running);
      loop.forEach((a) => a.cancel());
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over, u]);

  useEffect(() => {
    if (pyro) setHype(true);
  }, [pyro, beatKey]);

  const target = fighters.find((f) => f.role === 'target');
  const actor = fighters.find((f) => f.role === 'actor');
  const cover = over ? undefined : staged?.choreo.cover;
  const targetEnd = target && plan?.end.get(target.wrestler.id);
  const when = (at: number) => ((plan?.lead ?? 0) + at * (1 - (plan?.lead ?? 0))) * duration;
  const scene = over ? undefined : staged?.scene;
  // The moment the table (or whatever it is) gets used.
  const sceneAt = plan?.impacts.find((i) => i.big)?.at ?? 0.7;
  const onFloor = !over && staged?.zone !== undefined && staged.zone !== 'ring';

  return (
    <div ref={frameRef} className="relative flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden bg-black">
      {w > 0 && (
        <div ref={shakeRef} className="relative overflow-hidden" style={{ width: w, height: h }} data-move={staged?.move} data-beat={beatKey} data-over={over || undefined}>
          <ArenaBack accent={accent} name={promotionName} hype={hype} showName={!callout} cage={conduct?.cage} corners={corners} eventName={eventName} />

          {/* The apron is the nearest thing this building has to a nameplate. */}
          {corners ? (
            corners.map((corner, n) => (
              <div
                key={n}
                className="mv-apron-name absolute flex items-center justify-center whitespace-nowrap text-center"
                style={{ left: ((n === 0 ? 262 : 624) / VIEW.w) * w, width: (314 / VIEW.w) * w, top: (462 / VIEW.h) * h, height: (70 / VIEW.h) * h, fontSize: Math.min(2.6, 34 / Math.max(8, corner.name.length)) * u }}
              >
                {corner.name}
              </div>
            ))
          ) : (
            <div
              className="mv-apron-name absolute flex items-center justify-center whitespace-nowrap text-center"
              style={{ left: (262 / VIEW.w) * w, width: (676 / VIEW.w) * w, top: (462 / VIEW.h) * h, height: (70 / VIEW.h) * h, fontSize: Math.min(3.4, 68 / Math.max(8, promotionName.length)) * u }}
            >
              {promotionName}
            </div>
          )}

          {/* Everyone in the match who is not in this beat. An all-in match's
              field is paired off and fighting along the back of the ring the
              whole time (FieldBrawl); a tag partner waits on the apron at
              their corner, and any more of the team on the floor beside it. */}
          <FieldBrawl
            wrestlers={bystanders.filter((b) => b.place === 'ring').map((b) => b.wrestler)}
            stageWidth={w}
            stageHeight={h}
            figureWidth={figureW}
            winners={aftermath?.winners}
            belt={aftermath?.belt ?? false}
          />
          {!over &&
            bystanders
              .filter((b) => b.place === 'apron')
              .map((b) => {
                const side = dirOf(b.slot);
                const width = figureW * 0.86 * heightScale(b.wrestler);
                const order = bystanders.filter((o) => o.place === 'apron' && o.slot === b.slot).indexOf(b);
                return (
                  <div
                    key={b.wrestler.id}
                    data-testid="bystander-apron"
                    className="mv-cheer absolute"
                    style={{ left: sx(apronX(side) - side * order * 5.5) - width / 2, top: sy(order === 0 ? 0 : FLOOR) - width * FIGURE_ASPECT, width, zIndex: 4, animationDelay: `${-order * 0.4 - (side === 1 ? 0 : 0.6)}s` }}
                  >
                    <MatchFigure wrestler={b.wrestler} />
                  </div>
                );
              })}

          {/* Furniture a beat calls for: a ladder to climb, a table to go through. */}
          {scene === 'ladder' && plan && (
            <svg viewBox="0 0 60 150" className="pointer-events-none absolute" style={{ left: sx(plan.centre) - 3.6 * u, top: sy(17.5), width: 7.2 * u, height: 18 * u, zIndex: 2 }} aria-hidden>
              <path d="M 14,4 L 6,148 M 46,4 L 54,148" stroke="#c9a23a" strokeWidth={5} strokeLinecap="round" />
              {Array.from({ length: 9 }, (_, i) => (
                <line key={i} x1={13 - i * 0.8} y1={16 + i * 15} x2={47 + i * 0.8} y2={16 + i * 15} stroke="#e2c15a" strokeWidth={4} />
              ))}
            </svg>
          )}
          {(scene === 'table' || scene === 'flamingTable') && targetEnd && (
            <div className="pointer-events-none absolute" style={{ left: sx(midBody(targetEnd).x) - 9 * u, top: sy(4), width: 18 * u, height: 4.4 * u, zIndex: 2 }}>
              <svg viewBox="0 0 180 44" className="mv-until absolute inset-0 h-full w-full" style={{ animationDelay: `${sceneAt * duration}ms` }} aria-hidden>
                <rect x={4} y={2} width={172} height={9} rx={2} fill="#8a5a2c" stroke="#4d3015" strokeWidth={2} />
                <path d="M 24,11 L 20,42 M 156,11 L 160,42" stroke="#4b5260" strokeWidth={5} strokeLinecap="round" />
              </svg>
              <svg viewBox="0 0 180 44" className="mv-from absolute inset-0 h-full w-full" style={{ animationDelay: `${sceneAt * duration}ms` }} aria-hidden>
                <path d="M 4,6 L 84,30 L 82,38 L 2,15 Z M 176,6 L 96,30 L 98,38 L 178,15 Z" fill="#8a5a2c" stroke="#4d3015" strokeWidth={2} />
                <path d="M 22,14 L 18,42 M 158,14 L 162,42" stroke="#4b5260" strokeWidth={5} strokeLinecap="round" />
              </svg>
              {scene === 'flamingTable' && (
                <div
                  className="mv-flame absolute"
                  style={{ left: '4%', right: '4%', bottom: '70%', height: '170%', background: 'linear-gradient(to top, #fff3b0, #ff9d2e 35%, rgba(255,80,20,0.5) 70%, transparent)', borderRadius: '45% 55% 10% 10%', filter: 'blur(1px)' }}
                />
              )}
            </div>
          )}

          {drawn.map((fighter) => {
            const id = fighter.wrestler.id;
            const leaving = leavers.includes(fighter);
            const won = Boolean(aftermath?.winners.has(id));
            const tall = heightScale(fighter.wrestler);
            return (
              <div
                key={id}
                ref={(el) => {
                  if (el) figureRefs.current.set(id, el);
                  else figureRefs.current.delete(id);
                }}
                data-testid={leaving ? 'ring-leaving' : over ? (won ? 'ring-winner' : 'ring-loser') : `ring-${fighter.role}`}
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
                  zIndex: (onFloor || leaving ? 5 : 0) + (fighter.role === 'actor' || won ? 3 : 2),
                  willChange: 'transform',
                }}
              >
                {/* Drawn to their own height; always breathing, so a body that
                    has finished its move is still a living one. */}
                <div style={{ transform: `scale(${tall})`, transformOrigin: '50% 100%' }}>
                  <div className="mv-breathe">
                    <ArticulatedFigure
                      wrestler={fighter.wrestler}
                      held={!over && !leaving && staged?.prop === 'chair' && fighter === actor ? (dirOf(fighter.slot) === 1 ? 'right' : 'left') : undefined}
                      blindfold={conduct?.blindfold}
                      bloody={bloody?.has(id)}
                      onJoints={(joints) => {
                        if (joints) jointRefs.current.set(id, joints);
                        else jointRefs.current.delete(id);
                      }}
                    />
                    {won && aftermath?.belt && <Belt />}
                  </div>
                </div>
              </div>
            );
          })}

          <ArenaFront accent={accent} ropesRef={ropesRef} cage={conduct?.cage} corners={corners} />

          {/* A casket, at ringside, with somebody in it. */}
          {scene === 'casket' && targetEnd && (
            <svg
              viewBox="0 0 260 70"
              className="mv-from pointer-events-none absolute"
              style={{ left: sx(midBody(targetEnd).x) - 13 * u, top: sy(targetEnd.y + 3.6), width: 26 * u, height: 7 * u, zIndex: 9, animationDelay: `${0.86 * duration}ms` }}
              aria-hidden
            >
              <path d="M 6,12 L 60,2 L 254,8 L 254,62 L 60,68 L 6,58 Z" fill="#2a1c12" stroke="#0e0906" strokeWidth={3} />
              <path d="M 150,14 L 150,56 M 132,28 L 168,28" stroke="#c9a23a" strokeWidth={5} strokeLinecap="round" />
            </svg>
          )}

          {/* Impacts: a burst where it landed, and a ring of dust for the big ones. */}
          {!over &&
            (plan?.impacts ?? []).map((impact, i) => {
              const size = (impact.big ? 11 : 7.5) * u;
              const delay = `${impact.at * duration}ms`;
              return (
                <div key={`${beatKey}-${i}`}>
                  <svg viewBox="-50 -50 100 100" className="mv-burst pointer-events-none absolute" style={{ left: sx(impact.x), top: sy(impact.y), width: size, height: size, animationDelay: delay, zIndex: 9 }}>
                    <polygon points="0,-48 9,-17 38,-34 20,-7 48,2 19,11 31,40 6,20 -8,48 -12,17 -42,28 -22,3 -48,-12 -18,-13 -24,-42" fill="#ffe27a" stroke="#fff" strokeWidth={3} />
                  </svg>
                  {impact.big && (
                    <div className="mv-shock pointer-events-none absolute rounded-[50%] border-2 border-white/70" style={{ left: sx(impact.x), top: sy(onFloor ? FRONT_FLOOR : 0), width: 30 * u, height: 6 * u, animationDelay: delay, zIndex: 1 }} />
                  )}
                </div>
              );
            })}

          {/* The slap of a tag, at the corner it happened in. */}
          {staged &&
            !over &&
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

          {/* The referee's count: to three over a cover, to ten over somebody
              who is down and has to get up. */}
          {cover &&
            targetEnd &&
            Array.from({ length: cover.count }, (_, i) => {
              const at = cover.from + ((cover.to - cover.from) * (i + 0.35)) / cover.count;
              return (
                <span
                  key={`${beatKey}-count-${i}`}
                  className="mv-count mv-action pointer-events-none absolute whitespace-nowrap"
                  style={{ left: sx(midBody(targetEnd).x), top: sy(targetEnd.y + 17), fontSize: (cover.count > 3 ? 6.5 : 8.5) * u, animationDelay: `${when(at)}ms`, animationDuration: `${i === cover.count - 1 ? 900 : Math.round(((cover.to - cover.from) / cover.count) * duration * 0.96)}ms`, zIndex: 11 }}
                >
                  {/* Called the way it is counted: "1...", "...2...", "...3!" — the bang only on a count that finishes. */}
                  {i === 0 ? `${i + 1}...` : i === cover.count - 1 && (cover.count === 3 || cover.count === 10) ? `...${i + 1}!` : `...${i + 1}...`}
                </span>
              );
            })}

          {/* What a referee would shout, with no referee: big words over the ring. */}
          {!over &&
            (staged?.choreo.shouts ?? []).map((shout, i) => (
              <span
                key={`${beatKey}-shout-${i}`}
                className="mv-shout mv-action pointer-events-none absolute whitespace-nowrap"
                style={{ left: sx(Math.max(-12, Math.min(12, plan?.centre ?? 0))), top: sy(20), fontSize: Math.max(4.5, Math.min(9, 88 / shout.text.length)) * u, animationDelay: `${when(shout.at)}ms`, zIndex: 12 }}
              >
                {shout.text}
              </span>
            ))}

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
              key={`callout-${beatKey}-${over}`}
              className="pointer-events-none absolute flex items-center justify-center px-2 text-center"
              style={{ left: (430 / VIEW.w) * w, width: (340 / VIEW.w) * w, top: (30 / VIEW.h) * h, height: (118 / VIEW.h) * h, zIndex: 10 }}
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
