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

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { maskOnly } from '../paperdoll/ComposedPortrait';
import { ArenaBack, ArenaFront, FEET_Y, ROPE_CROSS_X, SIDE_ROPE_POST, VIEW, type Corner, type SideRopeKey } from './Arena';
import { Prize, PrizeHung, prizeKind, type BeltLook } from './Belt';
import { bell, crowd, hit, hitFor } from './sound';
import { FIGURE_ASPECT, MatchFigure, heightScale } from './MatchFigure';
import { ArticulatedFigure, type Joints } from './ArticulatedFigure';
import { playPlan, settle } from './playback';
import { FieldBrawl } from './FieldBrawl';
import { DOWN, FLOOR, FRONT_FLOOR, GAP, type StagedBeat } from './choreography';
import { PyroBurst } from './Pyro';
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
/**
 * How long after it starts the bow is at its furthest (its easing front-loads
 * it). A rope hit starts the bow this much early, so the ropes are furthest
 * out at the instant the body is furthest into them, not after it.
 */
const ROPE_PEAK_MS = 50;
/** How far the side ropes bow out when a body hits them, in picture units at the wrestlers' line: as far as the body goes into them. */
const ROPE_GIVE = RING.ropeGive * (VIEW.w / 100);
/** How long after the last move the winners raise their arms: long enough for a mask to come off and land. */
const CELEBRATE_AFTER_MS = 3200;

const dirOf = (slot: 'left' | 'right'): 1 | -1 => (slot === 'left' ? 1 : -1);


/**
 * Where the cameras are: scattered through the stands (the band of the
 * picture the crowd is drawn in), placed by arithmetic rather than by dice so
 * they are in the same seats every time.
 */
const SPARKLES = Array.from({ length: 46 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12543.123;
  const c = Math.sin(i * 37.719) * 9631.77;
  const frac = (n: number) => n - Math.floor(n);
  return { x: 2 + frac(a) * 96, y: 27 + frac(b) * 29, size: 1.6 + frac(c) * 2.6, delay: frac(a + b) * 2.4, every: 1.1 + frac(b + c) * 1.7 };
});
const frame = (at: number, pose: WorldPose, stance?: WorldFrame['stance']): WorldFrame => ({ at, ...pose, sy: 1, stance });
const planOf = (tracks: Map<Id, WorldFrame[]>): Plan => ({
  tracks,
  lead: 0,
  centre: 0,
  impacts: [],
  ropeHits: [],
  end: new Map([...tracks].map(([id, frames]) => [id, { x: frames[frames.length - 1]!.x, y: frames[frames.length - 1]!.y, rot: frames[frames.length - 1]!.rot }])),
});

const MAT_SPLAT = 'M 0,-9 C 6,-10 10,-4 8,1 C 12,4 9,10 3,8 C 1,13 -6,11 -6,6 C -12,6 -11,-1 -7,-3 C -9,-8 -4,-10 0,-9 Z M 13,-6 a 2.5,2.5 0 1,0 0.1,0 Z M -12,9 a 2,2 0 1,0 0.1,0 Z M 11,11 a 1.5,1.5 0 1,0 0.1,0 Z';

/** A splat of blood on the mat: where (ring x, and how far up or down the canvas), how big, which way. */
export interface Stain {
  x: number;
  depth: number;
  size: number;
  turn: number;
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
  burned,
  wear,
  stains = [],
  entrancePyro = false,
  corners,
  eventName,
  prize,
  hurt,
  shed,
  belt,
  champions,
  spoils,
}: {
  /** The title this match is for: what the belt looks like wherever one is drawn. */
  belt?: BeltLook;
  /** Every belt each of them walked in with, the one on the line first. Worn until the bell. */
  champions?: ReadonlyMap<Id, readonly BeltLook[]>;
  /** Every belt each winner leaves with, the one just won or kept first. */
  spoils?: ReadonlyMap<Id, readonly BeltLook[]>;
  /** What came off somebody when it was over: a mask, or their hair. */
  shed?: readonly { id: Id; kind: 'mask' | 'hair'; mask?: { url: string; color: string | null } | null }[];
  /** Really injured in this match, from the moment it happened: they carry it for the rest of it. */
  hurt?: ReadonlySet<Id>;
  /** What hangs over a ladder match: the belt if one is on the line, a briefcase if not. */
  prize?: 'belt' | 'case';
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
  /** Caught by the pyro earlier in the match. */
  burned?: ReadonlySet<Id>;
  /** How beaten up each of them is by now, 0-1: bruises, and slower. */
  wear?: ReadonlyMap<Id, number>;
  /** Blood already on the mat from earlier matches tonight. */
  stains?: readonly Stain[];
  /** The show had pyro: it goes off at the ring posts before the bell. */
  entrancePyro?: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const ropesRef = useRef<SVGGElement>(null);
  // The four runs of side rope: each half of each side, so a body into the
  // ropes on one side bows that side out and leaves the other alone.
  const sideRopes = useRef(new Map<SideRopeKey, SVGGElement>());
  const onSideRope = useCallback((key: SideRopeKey, el: SVGGElement | null) => {
    if (el) sideRopes.current.set(key, el);
    else sideRopes.current.delete(key);
  }, []);
  /**
   * A body into the side ropes: both halves of that side bow outward from
   * their posts, snap back past straight, and settle. Each half is stretched
   * about the post it is tied to, by just enough to carry the point where the
   * ropes meet the body out by `give`.
   */
  // What each run of rope is doing now: a smaller shake must not cut short a
  // bigger bow that is still going (a big landing just after a body hits the
  // ropes would otherwise snap them straight mid-bow).
  const bowing = useRef(new Map<SideRopeKey, { until: number; give: number }>());
  const stretchRopes = (side: 1 | -1, give: number = ROPE_GIVE) => {
    const cross = side === 1 ? ROPE_CROSS_X.r : ROPE_CROSS_X.l;
    const out = cross + side * give;
    for (const key of (side === 1 ? ['backR', 'frontR'] : ['backL', 'frontL']) as SideRopeKey[]) {
      const el = sideRopes.current.get(key);
      if (!el) continue;
      const now = performance.now();
      const busy = bowing.current.get(key);
      if (busy && now < busy.until && busy.give > give) continue;
      bowing.current.set(key, { until: now + 520, give });
      const post = SIDE_ROPE_POST[key];
      const k = (out - post) / (cross - post);
      const recoil = 1 - (k - 1) * 0.35;
      el.animate(
        [{ transform: 'scaleX(1)' }, { transform: `scaleX(${k})`, offset: 0.3 }, { transform: `scaleX(${recoil})`, offset: 0.62 }, { transform: 'scaleX(1)' }],
        { duration: 520, easing: 'ease-out' },
      );
    }
  };
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
  // Blood that has hit the mat in this match: wherever somebody who is
  // bleeding was when a beat began, and it stays for the rest of the night.
  const [dripped, setDripped] = useState<Stain[]>([]);

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
      wear: wear?.get(f.wrestler.id) ?? 0,
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
    const drops: Stain[] = [];
    for (const f of cast) {
      if (!bloody?.has(f.id) || !f.from || onFrontFloor(f.from) || Math.abs(f.from.x) > RING.half - 2) continue;
      // One splat a beat at most, and not from somebody just standing about.
      const lying = Math.abs(Math.abs(f.from.rot) - 90) < 30;
      const n = beatKey * 7 + f.id.length;
      if (!lying && n % 2 === 0) continue;
      const x = lying ? midBody(f.from).x : f.from.x;
      drops.push({ x, depth: ((n * 37) % 30) / 10 - 1.5, size: 0.8 + ((n * 13) % 7) / 10, turn: (n * 53) % 360 });
    }
    if (drops.length > 0) setDripped((d) => [...d, ...drops].slice(-14));
    const running = playPlan(next, cast, (id) => figureRefs.current.get(id), (id) => jointRefs.current.get(id), u, figureW, duration);

    const timers: number[] = [];
    // What it sounds like: every impact, the hand on the mat for a count, the
    // crowd for anything shouted. Scheduled on the audio clock, so it lands
    // on the frame it belongs to however busy the page is.
    for (const impact of next.impacts) hit(hitFor(staged.move, Boolean(impact.big), staged.prop, staged.scene), impact.at * duration);
    const counted = staged.choreo.cover;
    if (counted) for (let i = 0; i < counted.count; i++) hit('count', (next.lead + (counted.from + ((counted.to - counted.from) * (i + 0.35)) / counted.count) * (1 - next.lead)) * duration);
    for (const shout of staged.choreo.shouts ?? []) crowd('pop', (next.lead + shout.at * (1 - next.lead)) * duration);
    if (beatKey === 0) bell(1);
    for (const impact of next.impacts) {
      if (!impact.big) continue;
      timers.push(
        window.setTimeout(() => {
          shakeRef.current?.animate(SHAKE, { duration: 380, easing: 'ease-out' });
          ropesRef.current?.animate(ROPE_WOBBLE, { duration: 450, easing: 'ease-out' });
          // A big landing shakes the whole ring: a little give in the side ropes too.
          stretchRopes(1, ROPE_GIVE * 0.3);
          stretchRopes(-1, ROPE_GIVE * 0.3);
          setHype(true);
        }, impact.at * duration),
      );
    }
    // Out to the floor and back: in front of the ring is nearer the camera than
    // the ropes are, so a body there is drawn over them, and back under them
    // once it is on the apron or the mat again. Switched at the frame it
    // crosses, not for the whole move.
    if (staged.zone === 'out' || staged.zone === 'in') {
      for (const f of cast) {
        const el = figureRefs.current.get(f.id);
        const frames = next.tracks.get(f.id);
        if (!el || !frames || frames.length === 0) continue;
        const base = f.role === 'actor' ? 3 : 2;
        const layer = (floor: boolean) => String((floor ? 12 : 0) + base);
        let wasFloor = onFrontFloor(frames[0]!);
        el.style.zIndex = layer(wasFloor);
        for (const frame of frames) {
          const isFloor = onFrontFloor(frame);
          if (isFloor === wasFloor) continue;
          wasFloor = isFloor;
          timers.push(window.setTimeout(() => (el.style.zIndex = layer(isFloor)), frame.at * duration));
        }
      }
    }
    // Somebody into the ropes: the ropes on that side take the weight and give.
    for (const ropeHit of next.ropeHits) {
      timers.push(window.setTimeout(() => stretchRopes(ropeHit.side), Math.max(0, ropeHit.at * duration - ROPE_PEAK_MS)));
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
      el.style.zIndex = '14';
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
    // The winner who took the mask off throws the arm out to the side as it drops.
    const tossing = (shed ?? []).some((s) => s.kind === 'mask' && s.mask);
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
        if (hurt?.has(id)) {
          // Won it and got hurt doing it: on one knee, not on the ropes with both arms up.
          frames.push(frame(0.8, to, 'stagger'), frame(1, to, 'kneel'));
        } else {
          // Held on the guard for a beat: the mask comes off and drops before the arms go up.
          const hold = tossing && place === 0 ? 'showMask' : 'guard';
          frames.push(frame(0.8, to, hold), frame(1, to, hold));
          cheers.set(id, [frame(0, to, 'celebrate'), frame(0.5, { ...to, y: to.y + 0.7 }, 'lift'), frame(1, to, 'celebrate')]);
        }
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
    bell(3);
    crowd('roar', 250);
    const loop: Animation[] = [];
    const timer = window.setTimeout(() => {
      const cheering = cast.filter((f) => cheers.has(f.id));
      loop.push(...playPlan(planOf(cheers), cheering, (id) => figureRefs.current.get(id), (id) => jointRefs.current.get(id), u, figureW, 1100, { iterations: Infinity }));
    }, CELEBRATE_AFTER_MS);
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

  // The first mask off is thrown by the first winner, from their outstretched hand.
  const tossId = over ? (shed ?? []).find((s) => s.kind === 'mask' && s.mask)?.id : undefined;
  const tosser = tossId ? drawn.find((f) => aftermath?.winners.has(f.wrestler.id)) : undefined;
  const tossVars = (id: Id, headX: number, headY: number, at: WorldPose): Record<string, string> => {
    if (id !== tossId || !tosser) return {};
    const hand = leftAt.current.get(tosser.wrestler.id);
    if (!hand) return {};
    // The out-to-the-side arm is on the far side of the body from the opponent,
    // at about shoulder height, a little over half a figure's width out.
    const handX = sx(hand.x) - dirOf(tosser.slot) * figureW * 0.62;
    const handY = sy(hand.y) - figureH * 0.7;
    return {
      '--hx': `${handX - headX}px`,
      '--hy': `${handY - headY}px`,
      '--tx': `${Math.sign(at.x || 1) * figureW * 0.25}px`,
      '--ty': `${figureW * 0.6 * 3.4}px`,
    };
  };

  // Everything somebody is carrying. Belts take the waist and shoulders in
  // order; a crown, a medal or a cup has its own place and does not use one up.
  const carry = (looks: readonly BeltLook[], raised: boolean) => {
    let belts = 0;
    return looks.slice(0, 5).map((look, i) => {
      const isBelt = prizeKind(look) === 'belt';
      // Only the first thing is ever held up: the one this match was for.
      const node = <Prize key={look.id} look={look} n={isBelt ? belts : i === 0 ? 0 : 1} raised={raised} />;
      if (isBelt) belts += 1;
      else if (i === 0 && raised) belts += 1;
      return node;
    });
  };
  const target = fighters.find((f) => f.role === 'target');
  const actor = fighters.find((f) => f.role === 'actor');
  const cover = over ? undefined : staged?.choreo.cover;
  const targetEnd = target && plan?.end.get(target.wrestler.id);
  const when = (at: number) => ((plan?.lead ?? 0) + at * (1 - (plan?.lead ?? 0))) * duration;
  const scene = over ? undefined : staged?.scene;
  // The moment the table (or whatever it is) gets used.
  const sceneAt = plan?.impacts.find((i) => i.big)?.at ?? 0.7;
  const onFloor = !over && staged?.zone !== undefined && staged.zone !== 'ring';
  // Going out or coming back in, a body is in the ring for part of the move and
  // on the floor for the rest: the beat effect moves it between the layers as
  // it goes. Only a move done entirely on the floor starts above the ropes.
  const wholeBeatOnFloor = !over && staged?.zone === 'floor';

  return (
    <div ref={frameRef} className="relative flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden bg-black">
      {w > 0 && (
        <div ref={shakeRef} className="relative overflow-hidden" style={{ width: w, height: h }} data-move={staged?.move} data-beat={beatKey} data-over={over || undefined}>
          <ArenaBack accent={accent} name={promotionName} hype={hype} showName={!callout} cage={conduct?.cage} corners={corners} eventName={eventName} noRing={conduct?.noRing} onSideRope={onSideRope} />

          {/* The apron is the nearest thing this building has to a nameplate. */}
          {conduct?.noRing ? null : corners ? (
            corners.map((corner, n) => (
              <div
                key={n}
                className="mv-apron-name absolute flex items-center justify-center whitespace-nowrap text-center"
                style={{ left: ((n === 0 ? 200 : 610) / VIEW.w) * w, width: (390 / VIEW.w) * w, top: (468 / VIEW.h) * h, height: (70 / VIEW.h) * h, fontSize: Math.min(2.6, 34 / Math.max(8, corner.name.length)) * u }}
              >
                {corner.name}
              </div>
            ))
          ) : (
            <div
              className="mv-apron-name absolute flex items-center justify-center whitespace-nowrap text-center"
              style={{ left: (200 / VIEW.w) * w, width: (800 / VIEW.w) * w, top: (468 / VIEW.h) * h, height: (70 / VIEW.h) * h, fontSize: Math.min(3.4, 68 / Math.max(8, promotionName.length)) * u }}
            >
              {promotionName}
            </div>
          )}

          {/* A champion with the belt in the air: every camera in the building
              goes off. Flashes scattered through the crowd, behind the ring,
              each on its own beat so the stands glitter rather than blink. */}
          {aftermath?.belt && (
            <div className="pointer-events-none absolute inset-0" style={{ zIndex: 1 }} data-testid="camera-flashes" aria-hidden>
              {SPARKLES.map((s, i) => (
                <span key={i} className="mv-sparkle absolute" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size * u, height: s.size * u, animationDelay: `${s.delay}s`, animationDuration: `${s.every}s` }} />
              ))}
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
            <svg viewBox="0 0 60 150" className={`pointer-events-none absolute${staged?.move === 'ladderCollapse' ? ' mv-topple' : ''}`} style={{ left: sx(plan.centre) - 3.6 * u, top: sy(17.5), width: 7.2 * u, height: 18 * u, zIndex: 2, animationDelay: `${when(0.7)}ms` }} aria-hidden>
              <path d="M 14,4 L 6,148 M 46,4 L 54,148" stroke="#c9a23a" strokeWidth={5} strokeLinecap="round" />
              {Array.from({ length: 9 }, (_, i) => (
                <line key={i} x1={13 - i * 0.8} y1={16 + i * 15} x2={47 + i * 0.8} y2={16 + i * 15} stroke="#e2c15a" strokeWidth={4} />
              ))}
            </svg>
          )}
          {/* What the ladder is for: hanging over the middle of the ring from the
              bell, until somebody gets a hand on it. */}
          {(scene === 'ladder' || conduct?.furniture === 'ladder') && !over && (
            <div className={`${staged?.move === 'climbLadder' ? 'mv-until ' : ''}pointer-events-none absolute`} style={{ left: sx(0) - 4 * u, top: 0, width: 8 * u, height: sy(28.2), animationDelay: `${when(0.86)}ms`, zIndex: 9 }} aria-hidden>
              <div className="absolute left-1/2 top-0 w-px bg-neutral-400/70" style={{ height: `calc(100% - ${2.6 * u}px)` }} />
              <div className="absolute inset-x-0 bottom-0" style={{ height: 2.8 * u }}>
                {prize === 'case' ? <div className="absolute inset-x-[22%] inset-y-0 rounded-sm border border-neutral-900 bg-neutral-300" /> : <PrizeHung look={belt ?? undefined} />}
              </div>
            </div>
          )}
          {(scene === 'table' || scene === 'flamingTable') && targetEnd && (
            <div className="pointer-events-none absolute" style={{ left: sx(staged?.sceneIntact && plan && staged.move !== 'tablePowerbomb' ? plan.centre + 2.6 * (targetEnd.x - plan.centre) : midBody(targetEnd).x) - 9 * u, top: sy(4), width: 18 * u, height: 4.4 * u, zIndex: 2 }}>
              <svg viewBox="0 0 180 44" className={`${staged?.sceneIntact ? '' : 'mv-until '}absolute inset-0 h-full w-full`} style={{ animationDelay: `${sceneAt * duration}ms` }} aria-hidden>
                <rect x={4} y={2} width={172} height={9} rx={2} fill="#8a5a2c" stroke="#4d3015" strokeWidth={2} />
                <path d="M 24,11 L 20,42 M 156,11 L 160,42" stroke="#4b5260" strokeWidth={5} strokeLinecap="round" />
              </svg>
              {!staged?.sceneIntact && <svg viewBox="0 0 180 44" className="mv-from absolute inset-0 h-full w-full" style={{ animationDelay: `${sceneAt * duration}ms` }} aria-hidden>
                <path d="M 4,6 L 84,30 L 82,38 L 2,15 Z M 176,6 L 96,30 L 98,38 L 178,15 Z" fill="#8a5a2c" stroke="#4d3015" strokeWidth={2} />
                <path d="M 22,14 L 18,42 M 158,14 L 162,42" stroke="#4b5260" strokeWidth={5} strokeLinecap="round" />
              </svg>}
              {scene === 'flamingTable' && (
                <div
                  className="mv-flame absolute"
                  style={{ left: '4%', right: '4%', bottom: '70%', height: '170%', background: 'linear-gradient(to top, #fff3b0, #ff9d2e 35%, rgba(255,80,20,0.5) 70%, transparent)', borderRadius: '45% 55% 10% 10%', filter: 'blur(1px)' }}
                />
              )}
            </div>
          )}

          {/* Blood on the mat: tonight's earlier matches, and this one's. */}
          {[...stains, ...dripped].map((st, i) => (
            <svg
              key={`stain-${i}`}
              viewBox="-16 -16 32 32"
              className="pointer-events-none absolute"
              style={{ left: sx(st.x) - 2.2 * st.size * u, top: feetY + st.depth * u - 1 * st.size * u, width: 4.4 * st.size * u, height: 2 * st.size * u, zIndex: 1 }}
              preserveAspectRatio="none"
              aria-hidden
            >
              <path d={MAT_SPLAT} fill="#5e0a0a" opacity={0.85} transform={`rotate(${st.turn})`} />
            </svg>
          ))}

          {/* The first mask that came off is picked up by the first winner and
              held up with the belt; the copy on the mat is taken with it. */}
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
                  // In the ring and on the apron: under the near ropes (ArenaFront, 10).
                  // On the floor in front of the ring: over them, nearer the camera than the ring is.
                  zIndex: (wholeBeatOnFloor || leaving ? 12 : 0) + (fighter.role === 'actor' || won ? 3 : 2),
                  willChange: 'transform',
                }}
              >
                {/* Drawn to their own height; always breathing, so a body that
                    has finished its move is still a living one. */}
                <div style={{ transform: `scale(${tall})`, transformOrigin: '50% 100%' }}>
                  <div className={`mv-breathe ${hurt?.has(id) ? 'mv-hurt' : (wear?.get(id) ?? 0) >= 0.55 ? 'mv-winded' : ''}`}>
                    {hurt?.has(id) && (
                      <div data-testid="ring-hurt" className="mv-hurt-mark absolute left-1/2 flex items-center justify-center rounded-full bg-red-600 font-black leading-none text-white" style={{ top: '-9%', width: '22%', aspectRatio: '1', fontSize: 2.2 * u, zIndex: 3 }} aria-label="injured">
                        +
                      </div>
                    )}
                    <ArticulatedFigure
                      wrestler={fighter.wrestler}
                      held={!over && !leaving && staged?.prop && fighter === actor ? (dirOf(fighter.slot) === 1 ? 'right' : 'left') : undefined}
                      weapon={staged?.prop}
                      blindfold={conduct?.blindfold}
                      bloody={bloody?.has(id)}
                      burned={burned?.has(id)}
                      wear={wear?.get(id) ?? 0}
                      onJoints={(joints) => {
                        if (joints) jointRefs.current.set(id, joints);
                        else jointRefs.current.delete(id);
                      }}
                    />
                    {/* Up to four belts on one person: held up, round the waist, and over each shoulder. */}
                    {won && aftermath?.belt && carry(spoils?.get(id) ?? (belt ? [belt] : []), true)}
                    {/* A champion who wins a match the belt was not on the line in still leaves wearing it. */}
                    {won && aftermath && !aftermath.belt && carry(spoils?.get(id) ?? [], false)}
                    {!staged && !over && carry(champions?.get(id) ?? [], false)}
                  </div>
                </div>
              </div>
            );
          })}

          <ArenaFront ropesRef={ropesRef} cage={conduct?.cage} noRing={conduct?.noRing} accent={accent} corners={corners} onSideRope={onSideRope} />

          {/* A casket at ringside, shut on somebody — and its lid coming back up. */}
          {scene === 'casketOpen' && target && plan && (() => {
            const track = plan.tracks.get(target.wrestler.id) ?? [];
            const lying = track.filter((fr) => fr.at * duration >= when(0.5) && fr.at * duration <= when(0.78)).pop() ?? track[track.length - 1];
            if (!lying) return null;
            const mid = midBody(lying);
            const box = { left: sx(mid.x) - 13 * u, top: sy(lying.y + 3.6), width: 26 * u, height: 7 * u, zIndex: 17 };
            return (
              <>
                <div className="mv-from pointer-events-none absolute" style={{ ...box, animationDelay: `${when(0.5)}ms` }} aria-hidden>
                  <svg viewBox="0 0 260 70" className="mv-until h-full w-full" style={{ animationDelay: `${when(0.8)}ms` }}>
                    <path d="M 6,12 L 60,2 L 254,8 L 254,62 L 60,68 L 6,58 Z" fill="#2a1c12" stroke="#0e0906" strokeWidth={3} />
                    <path d="M 150,14 L 150,56 M 132,28 L 168,28" stroke="#c9a23a" strokeWidth={5} strokeLinecap="round" />
                  </svg>
                </div>
                <svg viewBox="0 0 260 70" className="mv-from pointer-events-none absolute" style={{ ...box, animationDelay: `${when(0.8)}ms` }} aria-hidden>
                  <path d="M 6,36 L 60,30 L 254,33 L 254,62 L 60,68 L 6,58 Z" fill="#2a1c12" stroke="#0e0906" strokeWidth={3} />
                  <path d="M 60,30 L 60,68" stroke="#0e0906" strokeWidth={2} />
                </svg>
                {/* The lid, thrown back and standing on its end beside it. */}
                <svg viewBox="0 0 70 200" className="mv-from pointer-events-none absolute" style={{ left: sx(mid.x) + 12 * u, top: sy(lying.y + 15), width: 6 * u, height: 17 * u, transform: 'rotate(14deg)', animationDelay: `${when(0.8)}ms`, zIndex: 11 }} aria-hidden>
                  <path d="M 10,4 L 60,14 L 64,196 L 6,190 Z" fill="#3a2716" stroke="#0e0906" strokeWidth={3} />
                  <path d="M 35,60 L 35,130 M 18,82 L 52,82" stroke="#c9a23a" strokeWidth={6} strokeLinecap="round" />
                </svg>
              </>
            );
          })()}

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
                  <svg viewBox="-50 -50 100 100" className="mv-burst pointer-events-none absolute" style={{ left: sx(impact.x), top: sy(impact.y), width: size, height: size, animationDelay: delay, zIndex: onFloor ? 16 : 11 }}>
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

          {/* The stakes, paid: the mask or the hair, dropped on the mat beside whoever lost it. */}
          {/* The winner who took the mask off throws it: it leaves their hand
              as the arm goes out to the side, then drops to the mat. */}
          {over &&
            (shed ?? []).map(({ id, kind, mask }) => {
              const at = leftAt.current.get(id);
              if (!at) return null;
              // Pulled off the head where it was worn, then it falls to the
              // mat. The head is roughly this far above the feet.
              // Where the head is: standing, it is high up; lying on the mat
              // (the usual state after a loss) it is down by the canvas, off
              // to whichever side the head is on.
              const lying = Math.abs(Math.abs(at.rot) - 90) < 30;
              const headX = lying ? sx(at.x + Math.sign(at.rot || 1) * 0) : sx(at.x);
              const headY = lying ? sy(at.y) - figureW * 0.12 : sy(at.y) - figureH * 0.86;
              if (kind === 'mask' && mask) {
                // The loser's own mask, in its own colour: the same art the
                // figure wore before the bell.
                return (
                  <div key={`shed-${id}`} className={`${id === tossId ? 'mv-toss' : 'mv-pull'} pointer-events-none absolute`} style={{ left: headX - figureW * 0.4, top: headY - figureW * 0.3, width: figureW * 0.8, height: figureW * 0.6, zIndex: 9, '--mv-pull-x': `${Math.sign(at.x || 1) * figureW * 0.18}px`, ...tossVars(id, headX, headY, at) } as React.CSSProperties}>
                    {/* Drawn as painted when the art has its own colours; otherwise tinted, as on the figure. */}
                    {mask.color ? (
                      <div className="absolute inset-0" style={{ backgroundColor: mask.color, ...maskOnly(mask.url) }} />
                    ) : (
                      <img src={mask.url} alt="" className="absolute inset-0 h-full w-full object-contain" />
                    )}
                  </div>
                );
              }
              return (
                <svg key={`shed-${id}`} viewBox="0 0 40 30" className="mv-shed pointer-events-none absolute" style={{ left: headX - 2.2 * u, top: headY, width: 4.4 * u, height: 3.3 * u, zIndex: 8 }} aria-hidden>
                  <path d="M 3,22 Q 6,8 12,18 Q 14,4 20,16 Q 24,2 28,17 Q 33,7 37,22 Q 20,30 3,22 Z" fill="#3a2a1c" stroke="#150e08" strokeWidth={1.5} />
                </svg>
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

          {/* The entrances: tonight's pyro, at both ring posts, before the bell. */}
          {entrancePyro && !staged && !over &&
            [-1, 1].map((side) => <PyroBurst key={`entrance-pyro-${side}`} left={sx(side * (RING.half + 1.2))} bottom={feetY + 0.5 * u} width={10 * u} height={30 * u} />)}

          {pyro &&
            // Where it went off: right behind whoever it caught, if anybody
            // was; otherwise both sides of the entrance.
            (actor && plan?.tracks.get(actor.wrestler.id)?.[0]
              ? [sx(plan.tracks.get(actor.wrestler.id)![0]!.x - dirOf(actor.slot) * 3)]
              : [w * 0.18, w * 0.82]
            ).map((x) => <PyroBurst key={`${beatKey}-pyro-${x}`} left={x} bottom={feetY + 0.5 * u} width={9 * u} height={26 * u} />)}

          {callout && (
            <div
              key={`callout-${beatKey}-${over}`}
              className="pointer-events-none absolute flex items-center justify-center px-2 text-center"
              style={{ left: (430 / VIEW.w) * w, width: (340 / VIEW.w) * w, top: (30 / VIEW.h) * h, height: (118 / VIEW.h) * h, zIndex: 20 }}
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
