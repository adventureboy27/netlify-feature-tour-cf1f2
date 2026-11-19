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
import { ArenaBack, ArenaFront, FEET_Y, ROPE_CROSS_X, SIDE_ROPE_POST, STEPS_X, VIEW, type Corner, type SideRopeKey } from './Arena';
import { Prize, PrizeHung, prizeKind, type BeltLook } from './Belt';
import { bell, boo, cheer, crowd, hit, hitFor, mixed, ooh } from './sound';
import type { Mood, Reaction } from './crowd';
import { Confetti, StarMoment, starColorOf } from './StarMoment';
import { FULL_PRODUCTION, type Setting } from './setting';
import { FIGURE_ASPECT, MatchFigure, heightScale } from './MatchFigure';
import { ArticulatedFigure, type Joints } from './ArticulatedFigure';
import { playPlan, settle } from './playback';
import { FieldBrawl } from './FieldBrawl';
import { DOWN, FLOOR, FRONT_FLOOR, GAP, TAG_VAULT_HEIGHT, type StagedBeat } from './choreography';
import { PyroBurst } from './Pyro';
import { PERSON_VIEW, Person, type Face, type PersonHeld, type PersonParts } from './Ringside';
import { playPerson, restingAt, slaps, waving, type PersonMoment } from './officiate';
import { RING, TAG_TOUCH, apronX, midBody, onFrontFloor, pinHeld, planBeat, type Plan, type PlanFighter, type WorldFrame, type WorldPose } from './ringPhysics';
import type { Conduct } from './conduct';
import { LedApron, type Marquee } from './LedApron';
import { ApronScreen, type Broadcast, type ScreenAction } from './ApronScreen';
import type { Id, RingItem, Wrestler } from '../../engine/types';

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
  /** Not in the match: they run in from the floor, and leave again after. */
  runIn?: boolean;
}

/** Somebody at ringside for the whole match: a manager, on the floor by their client's corner. */
export interface RingsidePerson {
  id: Id;
  slot: 'left' | 'right';
  face: Face;
}

/** What somebody outside the ropes does this beat: up on the apron at the referee, or into the victim on the floor. */
export interface CornerCue {
  id: Id;
  act: 'apron' | 'mug';
  /** With something in the hand. */
  weapon?: PersonHeld;
}

/** Somebody in the match but not in this beat. */
export interface Bystander {
  wrestler: Wrestler;
  slot: 'left' | 'right';
  /**
   * A tag partner waits on the apron at their corner; everybody in an all-in
   * match is in the ring; tag partners in a match where the floor is legal
   * end up fighting each other out there.
   */
  place: 'apron' | 'ring' | 'floor';
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
/**
 * What an angry crowd throws: cups, balled-up programmes, a can — up out of
 * the stands behind the ring and down onto the apron and the mat. Placed by
 * arithmetic, like the cameras, so it is the same every time.
 */
const THROWN = Array.from({ length: 11 }, (_, i) => {
  const frac = (n: number) => n - Math.floor(n);
  const a = frac(Math.sin(i * 91.7) * 4375.85);
  const b = frac(Math.sin(i * 17.3) * 2531.2);
  const x = 12 + a * 76;
  // From the stands (a third of the way down) to the ring (two thirds), drifting toward the middle.
  return { x, y: 30 + b * 8, dx: (50 - x) * 0.35 + (b - 0.5) * 8, dy: 26 + a * 8, up: 6 + b * 6, size: 1.6 + a * 1.2, delay: i * 0.13 + b * 0.3, kind: i % 3 };
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

/**
 * Where the tag is made: in the team's own corner, the one going out with
 * their back against the ropes right by the post, the one coming in on the
 * apron just the other side of them. Nowhere else is a legal tag. Both reach
 * straight up and the two hands meet over the top rope, above the post.
 */
const tagCorner = (side: 1 | -1) => -side * (RING.half - 1.4);

/** A splat of blood on the mat: where (ring x, and how far up or down the canvas), how big, which way. */
export interface Stain {
  x: number;
  depth: number;
  size: number;
  turn: number;
}

/** Something lying in the ring (or by it): dropped after use, or left in pieces. */
interface Litter {
  key: number;
  item: RingItem | 'tableBroken' | 'ladderBroken';
  x: number;
  y: number;
}

/** When, through a fetch, the thing comes out from under the ring — and, for a table, when it is slid in. */
const FETCH_GRAB = 0.58;
const FETCH_SLIDE = 0.72;

/**
 * Going to get something (StagedBeat.fetch): down and out under the bottom
 * rope to the floor in front of the ring, onto a knee at the apron, up with
 * it, and back in — or along the floor to the steps at the near corner for
 * those. Whoever is waiting stays where they are.
 */
function fetchPlan(staged: StagedBeat, cast: readonly PlanFighter[], centre: number): Plan {
  const fetch = staged.fetch!;
  const tracks = new Map<Id, WorldFrame[]>();
  const edge = RING.half - 4;
  const inside = (x: number) => Math.max(-edge, Math.min(edge, x));
  for (const f of cast) {
    const from = f.from ?? { x: centre - (f.dir * GAP) / 2, y: 0, rot: 0 };
    const lying = Math.abs(Math.abs(from.rot) - 90) < 30;
    if (f.role !== 'actor') {
      tracks.set(f.id, [frame(0, from, lying ? 'flat' : undefined), frame(1, from, lying ? 'flat' : 'stagger')]);
      continue;
    }
    const out = !onFrontFloor(from) && Math.abs(from.x) <= RING.half + 1;
    const x0 = out ? inside(from.x) : from.x;
    const corner = fetch.from === 'corner';
    const at = corner ? STEPS_X + 5 : x0;
    const back = corner ? -(RING.half - 6) : inside(at);
    const frames: WorldFrame[] = [frame(0, from, lying ? 'flat' : undefined)];
    if (lying) frames.push(frame(0.07, { x: from.x, y: 0, rot: from.rot * 0.2 }, 'kneel'));
    if (out) {
      frames.push(
        frame(0.14, { x: x0, y: 0, rot: 0 }, 'crouch'),
        frame(0.22, { x: x0, y: FRONT_FLOOR * 0.45, rot: f.dir * 90 }, 'tuck'),
        frame(0.3, { x: x0, y: FRONT_FLOOR, rot: 0 }, 'crouch'),
      );
    }
    if (Math.abs(at - x0) > 2) frames.push(frame(0.4, { x: (x0 + at) / 2, y: FRONT_FLOOR, rot: Math.sign(at - x0) * 8 }, 'run'));
    frames.push(
      frame(0.46, { x: at, y: FRONT_FLOOR, rot: 0 }, 'kneel'),
      frame(FETCH_GRAB - 0.04, { x: at, y: FRONT_FLOOR, rot: 0 }, 'kneel'),
      frame(FETCH_GRAB + 0.04, { x: at, y: FRONT_FLOOR, rot: 0 }, 'lift'),
    );
    // A table goes in ahead of them, slid under the bottom rope.
    if (fetch.item === 'table') frames.push(frame(FETCH_SLIDE, { x: at, y: FRONT_FLOOR, rot: 0 }, 'punch'));
    frames.push(
      frame(0.8, { x: at, y: FRONT_FLOOR, rot: 0 }, 'guard'),
      frame(0.88, { x: (at + back) / 2, y: TAG_VAULT_HEIGHT * 0.5, rot: 0 }, 'climb'),
      frame(0.95, { x: back, y: 0.4, rot: 0 }, 'crouch'),
      frame(1, { x: back, y: 0, rot: 0 }, 'guard'),
    );
    tracks.set(f.id, frames);
  }
  const plan = planOf(tracks);
  return { ...plan, centre };
}

/**
 * What the referee does over one beat: follows the action from a step back,
 * gets down and counts any cover, and does whatever the beat says he did —
 * turns his back, goes down, calls for the bell, raises a hand.
 */
function refereeMoments(
  from: PersonMoment,
  plan: Plan,
  staged: StagedBeat,
  target: WorldPose | undefined,
  side: 1 | -1,
  T: (at: number) => number,
  duration: number,
): PersonMoment[] {
  const edge = RING.half - 4;
  const inside = (x: number) => Math.max(-edge, Math.min(edge, x));
  const home = inside(plan.centre + (plan.centre >= 0 ? -11 : 11));
  const out: PersonMoment[] = [{ ...from, t: 0, back: false, arm: 0 }];
  let ready = 0;
  if (from.pose === 'down') {
    // Up off the mat first, slowly.
    ready = Math.min(duration * 0.45, 900);
    out.push({ t: ready * 0.55, x: from.x, y: 0, pose: 'kneel', arm: -30 }, { t: ready, x: from.x, y: 0, pose: 'stand' });
  }
  const after = (t: number) => Math.max(ready, t);
  const at = (t: number, x: number, extra: Partial<PersonMoment> = {}): PersonMoment => ({ t: after(t), x, y: 0, pose: 'stand', ...extra });
  const cue = staged.referee;
  const cover = staged.choreo.cover;
  const walkIn = plan.lead * duration;

  if (cue?.act === 'turned') {
    // At the ropes with his back to the ring, arm out at whoever has him there.
    const x = side * (RING.half - 3);
    out.push(at(walkIn * 0.85 + 120, x), at(walkIn + 260, x, { back: true, arm: side === 1 ? -95 : 95 }));
    return [...out, { ...out[out.length - 1]!, t: duration }];
  }
  if (cue?.act === 'bumped') {
    const hit = plan.impacts[0];
    const x = inside((hit?.x ?? plan.centre) + 2);
    const when = T(cue.at ?? 0.5);
    const fall: 1 | -1 = x >= plan.centre ? 1 : -1;
    out.push(at(Math.max(walkIn, when - 380), x), at(when, x, { arm: -40 }), { t: after(when + 240), x: inside(x + fall * 2), y: 0, pose: 'down', fall });
    return [...out, { ...out[out.length - 1]!, t: duration }];
  }
  let last = home;
  if (cover && target) {
    const times = Array.from({ length: cover.count }, (_, i) => T(cover.from + ((cover.to - cover.from) * (i + 0.35)) / cover.count));
    const inRing = Math.abs(target.x) <= RING.half && target.y > FLOOR / 2;
    const start = T(cover.from);
    if (inRing && cover.count <= 3) {
      // Down beside them, a hand on the mat for every count.
      const x = inside(midBody(target).x + 3);
      out.push(at(walkIn, home), at(start - 320, x), { t: after(start - 60), x, y: 0, pose: 'kneel', arm: -60 }, ...slaps(times, x, 0).map((m) => ({ ...m, t: after(m.t) })));
      const done = times[times.length - 1]! + 260;
      out.push({ t: after(done), x, y: 0, pose: 'kneel', arm: -40 });
      if (!staged.referee) out.push(at(done + 380, x));
      last = x;
    } else {
      // On his feet over somebody down, or at the ropes over somebody on the floor: the arm counts.
      const x = inRing ? inside(target.x + 5) : Math.sign(target.x || 1) * (RING.half - 3);
      out.push(at(walkIn, home), at(start - 300, x));
      for (const t of times) out.push(at(t - 160, x, { arm: -130 }), at(t, x, { arm: -45 }));
      last = x;
    }
  } else {
    out.push(at(walkIn, home));
  }
  if (cue?.act === 'bell') {
    const kneeling = out[out.length - 1]!.pose === 'kneel';
    const from = T(cue.at ?? 0.85);
    if (kneeling) out.push(at(from - 200, last));
    out.push(...waving(after(from), duration, last, 0));
  }
  if (cue?.act === 'wrongHand') out.push(at(T(cue.at ?? 0.9), last, { arm: -168 }));
  return [...out, { ...out.reduce((a, b) => (b.t >= a.t ? b : a)), t: duration }];
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
  tagOuts = [],
  referee,
  ringside = [],
  corner = [],
  reaction = null,
  entrance = [],
  finale,
  signs,
  nameCards,
  setting = FULL_PRODUCTION,
  corners,
  eventName,
  prize,
  hurt,
  shed,
  belt,
  champions,
  spoils,
  marquee,
  broadcast,
  logo,
}: {
  /** The company's uploaded logo, for the middle of the canvas. */
  logo?: string;
  /** What the broadcast ring's apron screen shows: the night and the cast, the move landing this beat, who won. */
  broadcast?: { show: Broadcast; action: ScreenAction | null; winners: readonly Wrestler[]; caption: string | null };
  /** What the premium ring's LED apron has to say: the night, the names, the match. */
  marquee?: Marquee;
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
  /**
   * Whoever is being tagged out this beat: they go to their corner, touch
   * the hand of the partner coming in, and climb out to the apron.
   */
  tagOuts?: readonly StageFighter[];
  /** Who is in the shirt: the house official, or a wrestler as guest referee. Absent: nobody is drawn. */
  referee?: { guest: Wrestler | null };
  /** Managers at ringside, there the whole match. */
  ringside?: readonly RingsidePerson[];
  /** This beat: what the people outside the ropes are doing. */
  corner?: readonly CornerCue[];
  /** How the room takes this beat (ui/match/crowd.ts), if it takes it any way at all. */
  reaction?: Reaction | null;
  /** Before the bell: the room for each of them as they stand there, in turn. */
  entrance?: readonly Reaction[];
  /** When it is over: the room for whoever won. */
  finale?: Reaction;
  /** What the signs in the front row say. */
  signs?: readonly string[];
  /** Each side's names, for the cardboard signs against a plywood ring. */
  nameCards?: { left: readonly { id: string; name: string }[]; right: readonly { id: string; name: string }[]; active?: string | null };
  /** The room, and what was in it that night (ui/match/setting.ts). */
  setting?: Setting;
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
  // The referee and the people on the floor: their parts, and where each
  // beat left them.
  const refParts = useRef<PersonParts | null>(null);
  const refAt = useRef<PersonMoment>({ t: 0, x: 11, y: 0, pose: 'stand' });
  const personParts = useRef(new Map<Id, PersonParts>());
  const personBox = useRef(new Map<Id, HTMLDivElement>());
  const personAt = useRef(new Map<Id, PersonMoment>());
  // What has been left lying about this match, and whether the steps are
  // still on the corner.
  const [litter, setLitter] = useState<Litter[]>([]);
  const litterKey = useRef(0);
  const [stepsGone, setStepsGone] = useState(false);
  // How the room feels right now: shown in the crowd for a moment, then gone.
  const [mood, setMood] = useState<{ mood: Mood; big: boolean; key: number; star?: Wrestler; victory?: boolean } | null>(null);
  const moodKey = useRef(0);
  const moodTimers = useRef<number[]>([]);
  /** The crowd reacting, `delay` ms from now: heard, and seen in the stands. */
  const react = useCallback((r: Reaction, delay: number, victory = false) => {
    const play = { cheer, boo, mixed, ooh: (_size: 'pop' | 'roar', ms: number) => ooh(ms) }[r.mood];
    play(r.size, delay);
    moodTimers.current.push(
      window.setTimeout(() => {
        const key = ++moodKey.current;
        setMood({ mood: r.mood, big: r.size === 'roar', key, ...(r.star ? { star: r.star, victory } : {}) });
        if (r.mood === 'cheer' && r.size === 'roar') setHype(true);
        // A star's win is held: the building is still theirs while they celebrate.
        if (!(victory && r.star)) moodTimers.current.push(window.setTimeout(() => setMood((m) => (m?.key === key ? null : m)), r.star ? 2700 : r.size === 'roar' ? 2600 : 1700));
      }, delay),
    );
  }, []);
  useEffect(() => () => moodTimers.current.forEach((t) => window.clearTimeout(t)), []);
  const onRefParts = useCallback((parts: PersonParts | null) => {
    refParts.current = parts;
  }, []);
  const personHandlers = useRef(new Map<Id, { parts: (p: PersonParts | null) => void; box: (el: HTMLDivElement | null) => void }>());
  const handlersFor = (id: Id) => {
    let made = personHandlers.current.get(id);
    if (!made) {
      made = {
        parts: (p) => (p ? personParts.current.set(id, p) : personParts.current.delete(id)),
        box: (el) => (el ? personBox.current.set(id, el) : personBox.current.delete(id)),
      };
      personHandlers.current.set(id, made);
    }
    return made;
  };

  const feetY = (FEET_Y / VIEW.h) * h;
  const sx = (x: number) => w / 2 + x * u;
  const sy = (y: number) => feetY - y * u;
  const figureW = FIGURE_W * u;
  const figureH = figureW * FIGURE_ASPECT;
  // The people at the ring are drawn a little smaller than the wrestlers, and
  // the referee a step upstage of them, so he is behind the two he watches.
  const personH = figureH * 0.84;
  const personW = (personH * PERSON_VIEW.w) / PERSON_VIEW.h;
  const REF_UPSTAGE = 2.2;
  const ringsideBase = (person: RingsidePerson): PersonMoment => {
    const dir = dirOf(person.slot);
    const order = ringside.filter((o) => o.slot === person.slot).indexOf(person);
    return { t: 0, x: -dir * (RING.half + 9 + order * 5), y: FLOOR, pose: 'stand' };
  };
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
  const tagging = over ? [] : tagOuts.filter((t) => !inBeat.has(t.wrestler.id));
  const drawn = [...fighters, ...ending, ...leavers, ...tagging];

  /**
   * The cover the referee counts, if it is one. A count to three is only
   * made over a real pin (ringPhysics.ts pinHeld); a count to ten is over
   * somebody down, standing over them, and needs no pin.
   */
  const countable = (p: Plan | null) => {
    const c = staged?.choreo.cover;
    if (!c || !p) return undefined;
    if (c.count > 3) return c;
    const a = fighters.find((f) => f.role === 'actor');
    const t = fighters.find((f) => f.role === 'target');
    return a && t && pinHeld(p, c, a.wrestler.id, t.wrestler.id) ? c : undefined;
  };

  // ---- the beat ---------------------------------------------------------
  useLayoutEffect(() => {
    if (u === 0 || over) return;
    const cast: PlanFighter[] = fighters.map((f) => ({
      id: f.wrestler.id,
      role: f.role,
      dir: dirOf(f.slot),
      from: leftAt.current.get(f.wrestler.id),
      taggedIn: Boolean(f.taggedIn),
      runIn: Boolean(f.runIn),
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
      // The referee between them, a step back; the managers on the floor.
      const people: Animation[] = [];
      if (refParts.current) people.push(...playPerson(refParts.current, [refAt.current], 10, u));
      for (const person of ringside) {
        const parts = personParts.current.get(person.id);
        const at = personAt.current.get(person.id) ?? ringsideBase(person);
        personAt.current.set(person.id, at);
        if (parts) people.push(...playPerson(parts, [at], 10, u));
      }
      setPlan(null);
      // The introductions: the room for each of them in turn.
      entrance.forEach((r, i) => react(r, 150 + i * 750));
      return () => settle(people);
    }

    const next = staged.fetch ? fetchPlan(staged, cast, centre.current) : planBeat(staged, cast, centre.current);
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
    // A tag: the one going out walks to their corner, reaches back for the
    // hand, and once it is touched climbs out to the apron, while the one
    // coming in (ringPhysics.ts) reaches in for it and then comes over.
    for (const t of tagging) {
      const id = t.wrestler.id;
      const side = dirOf(t.slot);
      const from = leftAt.current.get(id) ?? { x: -side * (RING.half - 4), y: 0, rot: 0 };
      const corner = { x: tagCorner(side), y: 0, rot: 0 };
      const lead = Math.max(next.lead, 0.3);
      const down = Math.abs(Math.abs(from.rot) - 90) < 30;
      const frames: WorldFrame[] = [frame(0, from, down ? 'flat' : undefined)];
      if (down) frames.push(frame(lead * 0.15, { x: from.x, y: 0, rot: from.rot * 0.2 }, 'kneel'));
      frames.push(
        frame(lead * 0.35, corner, 'tagOut'),
        frame(lead * TAG_TOUCH, corner, 'tagOut'),
        frame(lead * 0.8, { x: -side * (RING.half + 0.5), y: TAG_VAULT_HEIGHT * 0.75, rot: 0 }, 'climb'),
        frame(Math.min(1, lead * 1.05), { x: apronX(side), y: 0, rot: 0 }, 'stand'),
        frame(1, { x: apronX(side), y: 0, rot: 0 }, 'guard'),
      );
      leftAt.current.set(id, { x: apronX(side), y: 0, rot: 0 });
      const el = figureRefs.current.get(id);
      if (el) el.style.transform = '';
      running.push(...playPlan(planOf(new Map([[id, frames]])), [{ id, role: 'actor', dir: side, from, taggedIn: false }], (key) => figureRefs.current.get(key), (key) => jointRefs.current.get(key), u, figureW, duration));
    }

    // ---- the referee, and the people on the floor --------------------------
    const T = (at: number) => (next.lead + at * (1 - next.lead)) * duration;
    const targetCast = cast.find((f) => f.role === 'target');
    const actorCast = cast.find((f) => f.role === 'actor');
    const targetLast = targetCast ? next.end.get(targetCast.id) : undefined;
    const runner = fighters.find((f) => f.runIn);
    // Which ropes he goes to with his back to the ring: the manager up on the
    // apron if there is one; away from whoever is running in; otherwise away
    // from the two of them.
    const onApron = corner.find((c) => c.act === 'apron');
    const apronPerson = onApron ? ringside.find((p) => p.id === onApron.id) : undefined;
    const refSide: 1 | -1 = apronPerson ? (-dirOf(apronPerson.slot) as 1 | -1) : runner ? dirOf(runner.slot) : next.centre >= 0 ? -1 : 1;
    if (refParts.current) {
      const counting = countable(next);
      const moments = refereeMoments(refAt.current, next, counting === staged.choreo.cover ? staged : { ...staged, choreo: { ...staged.choreo, cover: counting } }, targetLast, refSide, T, duration);
      refAt.current = restingAt(moments.reduce((a, b) => (b.t >= a.t ? b : a)));
      running.push(...playPerson(refParts.current, moments, duration, u));
    }
    for (const person of ringside) {
      const parts = personParts.current.get(person.id);
      const box = personBox.current.get(person.id);
      const base = ringsideBase(person);
      const from = personAt.current.get(person.id) ?? base;
      const dir = dirOf(person.slot);
      const cue = corner.find((c) => c.id === person.id);
      const moments: PersonMoment[] = [{ ...from, t: 0, back: false, arm: 0 }];
      let front = false;
      if (cue?.act === 'apron') {
        // Up on the apron, at the official: shouting, pointing, keeping him there.
        const apron = apronX(dir);
        moments.push({ t: next.lead * duration * 0.55, x: apron + dir * 2.5, y: FLOOR, pose: 'stand' }, { t: next.lead * duration, x: apron, y: 0, pose: 'stand', arm: -120 });
        moments.push(...waving(next.lead * duration + 150, duration, apron, 0).map((m) => ({ ...m, arm: (m.arm ?? 0) * 0.85 })));
      } else if (cue?.act === 'mug' && targetLast) {
        // Waiting where the victim lands, and into him while the official is held.
        front = onFrontFloor(targetLast);
        const y = front ? FRONT_FLOOR : FLOOR;
        const x = midBody(targetLast).x + dir * 4;
        moments.push({ t: T(0.5), x, y, pose: 'stand', arm: -40 });
        for (let at = T(0.66), n = 0; at < duration; at += 260, n++) moments.push({ t: at, x, y, pose: 'stand', arm: n % 2 ? -10 : -150 });
      } else if (Math.abs(from.x - base.x) > 0.5 || Math.abs(from.y - base.y) > 0.5) {
        // Back to their spot on the floor.
        moments.push({ t: Math.min(duration * 0.35, 700), x: from.x + (base.x - from.x) * 0.3, y: base.y, pose: 'stand' }, { ...base, t: Math.min(duration * 0.8, 1500) });
      }
      moments.push({ ...moments[moments.length - 1]!, t: duration });
      personAt.current.set(person.id, restingAt(moments[moments.length - 1]!));
      if (box) box.style.zIndex = front ? '15' : '4';
      if (parts) running.push(...playPerson(parts, moments, duration, u));
    }

    const timers: number[] = [];
    // ---- what is lying about ----------------------------------------------
    // Picked up again when this beat uses it (the thing in the hand, the
    // table or ladder the move needs) — and left where it fell after.
    const actorEnd = actorCast ? next.end.get(actorCast.id) : undefined;
    const handProp = !staged.fetch && staged.prop ? staged.prop : undefined;
    const uses = new Set<Litter['item']>([
      ...(handProp ? [handProp] : []),
      ...(staged.scene === 'table' || staged.scene === 'flamingTable' ? (['table'] as const) : []),
      ...(staged.scene === 'ladder' ? (['ladder'] as const) : []),
    ]);
    if (uses.size > 0) {
      setLitter((all) => {
        const left = [...all];
        for (const item of uses) {
          const i = left.findIndex((l) => l.item === item);
          if (i >= 0) left.splice(i, 1);
        }
        return left;
      });
    }
    const left: Omit<Litter, 'key'>[] = [];
    const floorOf = (pose: WorldPose | undefined) => (pose && onFrontFloor(pose) ? FRONT_FLOOR : pose && pose.y < FLOOR / 2 ? FLOOR : 0);
    if (staged.fetch) {
      const fetchedAt = actorEnd ?? { x: 0, y: 0, rot: 0 };
      if (staged.fetch.item === 'table') left.push({ item: 'table', x: fetchedAt.x + 4, y: 0 });
      if (staged.fetch.item === 'ladder') left.push({ item: 'ladder', x: fetchedAt.x + (fetchedAt.x > 0 ? -5 : 5), y: 0 });
      if (staged.fetch.from === 'corner') timers.push(window.setTimeout(() => setStepsGone(true), FETCH_GRAB * duration));
    } else if (handProp && handProp !== 'ladder' && actorEnd && actorCast) {
      left.push({ item: handProp, x: actorEnd.x + actorCast.dir * 4, y: floorOf(actorEnd) });
    } else if (handProp === 'ladder' && actorEnd && actorCast) {
      left.push({ item: 'ladder', x: actorEnd.x + actorCast.dir * 5, y: floorOf(actorEnd) });
    }
    if ((staged.scene === 'table' || staged.scene === 'flamingTable') && targetLast) {
      const x = staged.sceneIntact && staged.move !== 'tablePowerbomb' ? next.centre + 2.6 * (targetLast.x - next.centre) : midBody(targetLast).x;
      left.push({ item: staged.sceneIntact ? 'table' : 'tableBroken', x, y: 0 });
    }
    if (staged.scene === 'ladder') left.push({ item: staged.move === 'ladderCollapse' ? 'ladderBroken' : 'ladder', x: next.centre, y: 0 });
    // Left lying once the beat is over — when the next one takes over (a
    // timer at the end of the move would be cancelled by the next beat
    // starting on the same instant).
    const leave = () => {
      if (left.length > 0) setLitter((all) => [...all, ...left.map((d) => ({ ...d, key: litterKey.current++ }))].slice(-12));
    };
    // What it sounds like: every impact, the hand on the mat for a count, the
    // crowd for anything shouted. Scheduled on the audio clock, so it lands
    // on the frame it belongs to however busy the page is.
    for (const impact of next.impacts) hit(hitFor(staged.move, Boolean(impact.big), staged.prop, staged.scene), impact.at * duration);
    const counted = countable(next);
    if (counted) for (let i = 0; i < counted.count; i++) hit('count', (next.lead + (counted.from + ((counted.to - counted.from) * (i + 0.35)) / counted.count) * (1 - next.lead)) * duration);
    if (reaction) {
      // At the moment it lands: the biggest impact, or where the beat says.
      const big = next.impacts.find((i) => i.big) ?? next.impacts[0];
      const at = reaction.at !== undefined ? T(reaction.at) : big ? big.at * duration : T(0.75);
      react(reaction, Math.max(0, at));
    } else {
      for (const shout of staged.choreo.shouts ?? []) crowd('pop', (next.lead + shout.at * (1 - next.lead)) * duration);
    }
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
      leave();
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
      // Somebody still on their feet (whoever ran in, job done) just goes,
      // out under the bottom rope; somebody beaten gets up off the mat first.
      const standing = Math.abs(Math.abs(from.rot) - 90) >= 30;
      const frames: WorldFrame[] = [frame(0, from, standing ? 'guard' : 'flat')];
      if (Math.abs(from.x) <= RING.half + 1 && from.y > FLOOR / 2) frames.push(frame(0.22, { x: standing ? side * (RING.half + 0.5) : from.x, y: standing ? 2 : floor + DOWN, rot: standing ? side * 70 : from.rot }, standing ? 'tuck' : 'flat'));
      const off = standing && Math.abs(from.x) <= RING.half + 1 ? side * (RING.half + 3) - side * 5 : from.x;
      frames.push(frame(0.4, { x: off + side * 2, y: floor, rot: standing ? 0 : from.rot * 0.2 }, standing ? 'run' : 'kneel'), frame(0.5, { x: off + side * 5, y: floor, rot: side * 6 }, standing ? 'run' : 'stagger'));
      for (let i = 1; i <= 4; i++) frames.push(frame(0.5 + i * 0.125, { x: off + side * 5 + ((exit.x - off - side * 5) * i) / 4, y: floor, rot: side * 7 }, i % 2 || standing ? 'run' : 'stagger'));
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
    // The referee raises the winner's hand — or, with nobody to raise, waves it off.
    if (refParts.current) {
      const from = refAt.current;
      const first = winners[0] ? arrive.end.get(winners[0].wrestler.id) : undefined;
      const inRing = first && Math.abs(first.x) <= RING.half;
      const x = first && inRing ? Math.max(-edge + 2, Math.min(edge - 2, first.x + (first.x > 0 ? -5 : 5))) : from.x;
      const moments: PersonMoment[] = [{ ...from, t: 0, back: false, arm: 0 }];
      if (from.pose !== 'stand') moments.push({ t: 450, x: from.x, y: 0, pose: 'kneel' });
      moments.push({ t: 900, x, y: 0, pose: 'stand' });
      if (first && inRing) moments.push({ t: 1250, x, y: 0, pose: 'stand', arm: -168 }, { t: 1500, x, y: 0, pose: 'stand', arm: -168 });
      else moments.push(...waving(950, 1500, x, 0));
      refAt.current = restingAt(moments[moments.length - 1]!);
      running.push(...playPerson(refParts.current, moments, 1500, u));
    }
    setHype(true);
    bell(3);
    // For whoever won it — or not.
    react(finale ?? { mood: 'cheer', size: 'roar' }, 250, true);
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
  const cover = over ? undefined : countable(plan);
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
          <ArenaBack accent={accent} name={promotionName} logo={logo} hype={hype} showName={!callout} cage={conduct?.cage} corners={corners} eventName={eventName} noRing={conduct?.noRing} stepsGone={stepsGone} mood={mood?.mood ?? null} moodBig={mood?.big ?? false} starColor={mood?.star ? (mood.mood === 'boo' ? '#ff3a30' : starColorOf(mood.star)) : undefined} signs={signs} nameCards={nameCards} setting={setting} onSideRope={onSideRope} />

          {/* The premium ring: the whole front of the apron is a bulb sign. */}
          {setting.ring === 'premium' && !conduct?.noRing && !corners && marquee && (
            <LedApron
              w={w}
              h={h}
              marquee={marquee}
              mood={mood?.mood ?? null}
              big={mood?.big ?? false}
              star={mood?.star?.name.trim().split(/\s+/).pop()}
              winners={over ? marquee.winners : undefined}
              belt={aftermath?.belt}
            />
          )}
          {/* The broadcast ring: the apron is a television. */}
          {setting.ring === 'broadcast' && !conduct?.noRing && !corners && broadcast && (
            <ApronScreen
              w={w}
              h={h}
              show={broadcast.show}
              accent={accent}
              holders={new Set([...(champions ?? new Map()).entries()].filter(([, belts]) => belts.length > 0).map(([id]) => id))}
              action={over ? null : broadcast.action}
              mood={mood?.mood ?? null}
              big={mood?.big ?? false}
              star={mood?.star}
              winners={over ? broadcast.winners : undefined}
              caption={over ? broadcast.caption : null}
            />
          )}
          {/* The apron is the nearest thing this building has to a nameplate. */}
          {conduct?.noRing || (setting.ring !== 'pro' && !corners) ? null : corners ? (
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

          {/* A big spot: a burst of camera flashes through the crowd, the
              instant it lands. */}
          {!over && plan && plan.impacts.some((i) => i.big) && (
            <div key={`flashes-${beatKey}`} className="pointer-events-none absolute inset-0" style={{ zIndex: 1 }} aria-hidden>
              {plan.impacts
                .filter((i) => i.big)
                .flatMap((impact, k) =>
                  SPARKLES.filter((_, i) => (i + k * 3 + beatKey) % 3 === 0).map((sp, i) => (
                    <span
                      key={`${k}-${i}`}
                      className="mv-flashpop absolute"
                      style={{ left: `${sp.x}%`, top: `${sp.y}%`, width: sp.size * u * 1.2, height: sp.size * u * 1.2, animationDelay: `${Math.round(impact.at * duration + (i % 5) * 45)}ms` }}
                    />
                  )),
                )}
            </div>
          )}

          {/* A star's moment: the building is theirs. */}
          {mood?.star && (
            <div key={`star-${mood.key}`} className="pointer-events-none absolute inset-0" style={{ zIndex: 1 }}>
              <StarMoment star={mood.star} mood={mood.mood} victory={Boolean(mood.victory)} color={starColorOf(mood.star)} u={u} caption={callout} screen={setting.screen} banners={setting.lights} />
            </div>
          )}
          {mood?.star && mood.victory && mood.mood !== 'boo' && (
            <div key={`confetti-${mood.key}`} className="pointer-events-none absolute inset-0" style={{ zIndex: 19 }}>
              <Confetti color={starColorOf(mood.star)} u={u} />
            </div>
          )}

          {/* The building roaring for somebody: every camera going off, and the
              light flooding up. Angry at somebody: the room goes red, and
              cups and rubbish come over the barricade at the ring. */}
          {mood?.big && (mood.mood === 'cheer' || mood.mood === 'mixed') && (
            <div key={`roar-${mood.key}`} className="pointer-events-none absolute inset-0" style={{ zIndex: 1 }} aria-hidden>
              <div className="mv-glow absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 35%, rgba(255,240,200,0.55), rgba(255,220,160,0.18) 55%, transparent 80%)' }} />
              {SPARKLES.map((sp, i) => (
                <span key={i} className="mv-sparkle absolute" style={{ left: `${sp.x}%`, top: `${sp.y}%`, width: sp.size * u, height: sp.size * u, animationDelay: `${sp.delay * 0.4}s`, animationDuration: `${sp.every * 0.7}s` }} />
              ))}
            </div>
          )}
          {mood?.big && mood.mood === 'boo' && (
            <div key={`angry-${mood.key}`} className="pointer-events-none absolute inset-0" style={{ zIndex: 1 }} aria-hidden>
              <div className="mv-redwash absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(255,70,60,0.8) 0%, rgba(230,50,45,0.6) 40%, rgba(220,60,50,0.22) 68%, transparent 88%)' }} />
              {THROWN.map((t, i) => (
                <svg
                  key={i}
                  viewBox="0 0 20 24"
                  className="mv-thrown"
                  style={{ left: `${t.x}%`, top: `${t.y}%`, width: t.size * u, height: t.size * 1.2 * u, animationDelay: `${t.delay}s`, '--dx': `${t.dx * u}px`, '--dy': `${t.dy * u}px`, '--up': `${t.up * u}px` } as React.CSSProperties}
                >
                  {t.kind === 0 ? (
                    <path d="M 3,3 L 17,3 L 14,22 L 6,22 Z" fill="#f2efe6" stroke="#8a8478" strokeWidth={1.2} />
                  ) : t.kind === 1 ? (
                    <path d="M 4,6 C 2,2 9,1 10,4 C 13,0 19,4 15,8 C 19,12 13,18 10,14 C 6,19 0,13 4,6 Z" fill="#d9d2bf" stroke="#8a8478" strokeWidth={1} />
                  ) : (
                    <rect x={4} y={2} width={11} height={20} rx={3} fill="#b8322a" stroke="#5e1611" strokeWidth={1.2} />
                  )}
                </svg>
              ))}
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
            wrestlers={bystanders.filter((b) => b.place === 'ring' || b.place === 'floor').map((b) => b.wrestler)}
            // Anybody coming in from an apron (a tag match breaking down) comes in from their own side.
            sides={conduct?.tags ? new Map(bystanders.filter((b) => b.place === 'ring' || b.place === 'floor').map((b) => [b.wrestler.id, dirOf(b.slot)])) : undefined}
            floorIds={new Set(bystanders.filter((b) => b.place === 'floor').map((b) => b.wrestler.id))}
            spills={Boolean(conduct?.outside && conduct.allIn)}
            focus={
              plan && actor && target && !over
                ? {
                    actorX: plan.tracks.get(actor.wrestler.id)?.[0]?.x ?? 0,
                    targetX: plan.tracks.get(target.wrestler.id)?.[0]?.x ?? 0,
                    down: Boolean(targetEnd && Math.abs(Math.abs(targetEnd.rot) - 90) < 30 && targetEnd.y < 5),
                    floor: Boolean(targetEnd && onFrontFloor(targetEnd)),
                  }
                : undefined
            }
            bump={(() => {
              const big = !over && plan?.impacts.find((i) => i.big);
              return big ? { key: beatKey, x: big.x, at: big.at * duration } : undefined;
            })()}
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

          {/* The referee: a step upstage of the two he is watching, in the
              stripes — or a wrestler in them, as guest referee. */}
          {referee && (
            <div className="pointer-events-none absolute" data-testid={referee.guest ? 'guest-referee' : 'referee'} style={{ left: w / 2 - personW / 2, top: feetY - REF_UPSTAGE * u - personH, width: personW, zIndex: 1 }}>
              <Person id={referee.guest ? `guest-${referee.guest.id}` : 'referee'} outfit="stripes" face={referee.guest ? { wrestler: referee.guest } : {}} onParts={onRefParts} />
            </div>
          )}
          {/* The managers, on the floor by their man's corner. */}
          {ringside.map((person) => (
            <div key={person.id} ref={handlersFor(person.id).box} data-testid="ringside-person" className="pointer-events-none absolute" style={{ left: w / 2 - personW / 2, top: feetY - personH, width: personW, zIndex: 4 }}>
              <Person id={`rs-${person.id}`} outfit="suit" face={person.face} held={over ? undefined : corner.find((c) => c.id === person.id)?.weapon} onParts={handlersFor(person.id).parts} />
            </div>
          ))}

          {/* What was bought for the night, standing where it stands: security
              at either end of the ringside floor, the medical team by the
              steps, the hard camera on its tripod at the near corner. */}
          {setting.security &&
            [-1, 1].map((side) => (
              <div key={`security-${side}`} data-testid="security" className="pointer-events-none absolute" style={{ left: w / 2 + side * (RING.half + 20) * u - personW / 2, top: feetY - FLOOR * u - personH, width: personW, zIndex: 4 }}>
                <Person id={`security-${side}`} outfit="security" face={{}} onParts={() => undefined} />
              </div>
            ))}
          {setting.medical && (
            <div data-testid="medic" className="pointer-events-none absolute" style={{ left: w / 2 - (RING.half + 13) * u - personW / 2, top: feetY - FLOOR * u - personH, width: personW, zIndex: 4 }}>
              <Person id="medic" outfit="medic" face={{}} onParts={() => undefined} />
            </div>
          )}
          {setting.cameras && !conduct?.noRing && (
            <svg viewBox="0 0 60 90" data-testid="hard-camera" className="pointer-events-none absolute" style={{ left: w / 2 + (RING.half + 14) * u, top: feetY - FRONT_FLOOR * u - 13 * u, width: 8.5 * u, height: 13 * u, zIndex: 13 }} aria-hidden>
              <path d="M 22,40 L 10,88 M 30,40 L 30,88 M 38,40 L 50,88" stroke="#22252b" strokeWidth={3} />
              <rect x={12} y={20} width={34} height={20} rx={3} fill="#1a1c21" stroke="#3a3e48" strokeWidth={2} />
              <rect x={2} y={24} width={12} height={12} rx={2} fill="#2a2d34" />
              <circle cx={5} cy={30} r={3.5} fill="#5b7bbf" />
              <circle cx={44} cy={24} r={2} fill="#e33" />
            </svg>
          )}

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

          {/* Whatever has been left lying about: a chair dropped after it was
              used, a table in pieces, a ladder standing in the corner or
              lying wrecked — until somebody picks it up again. */}
          {litter.map((l) => (
            <div key={l.key} data-testid="litter" data-item={l.item} data-x={Math.round(l.x)}>
              <LitterArt item={l.item} left={sx(l.x)} feet={sy(l.y)} u={u} zIndex={l.y <= FRONT_FLOOR + 0.5 ? 12 : 1} />
            </div>
          ))}
          {/* A table coming out from under the ring, slid in under the bottom rope. */}
          {!over && staged?.fetch?.item === 'table' && plan && actor && (() => {
            const track = plan.tracks.get(actor.wrestler.id) ?? [];
            const at = track[track.length - 1];
            if (!at) return null;
            return <div key={`fetched-table-${beatKey}`} className="mv-from pointer-events-none absolute" style={{ animationDelay: `${Math.round(FETCH_SLIDE * duration)}ms`, left: 0, top: 0, zIndex: 1 }}><LitterArt item="table" left={sx(at.x + 4)} feet={sy(0)} u={u} zIndex={1} /></div>;
          })()}

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
                      heldFrom={staged?.fetch && fighter === actor ? Math.round(FETCH_GRAB * duration) : undefined}
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

          <ArenaFront ropesRef={ropesRef} cage={conduct?.cage} noRing={conduct?.noRing} accent={accent} corners={corners} onSideRope={onSideRope} ring={setting.ring} led={mood?.star ? (mood.mood === 'boo' ? '#ff3a30' : starColorOf(mood.star)) : mood?.mood === 'boo' && mood.big ? '#ff2b25' : undefined} />

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
                  style={{ left: sx((apronX(dirOf(f.slot)) + tagCorner(dirOf(f.slot))) / 2 + dirOf(f.slot) * 1.5) - 3.5 * u, top: sy(23.5), width: 7 * u, height: 7 * u, zIndex: 11, animationDelay: `${Math.max(0, (plan?.lead ?? 0.5) * TAG_TOUCH * duration - 100)}ms` }}
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

          {callout && !(mood?.star && setting.screen) && (
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

/** Something left lying in or by the ring, drawn where it is. */
function LitterArt({ item, left, feet, u, zIndex }: { item: Litter['item']; left: number; feet: number; u: number; zIndex: number }) {
  const box = (w: number, h: number) => ({ left: left - (w * u) / 2, top: feet - h * u, width: w * u, height: h * u, zIndex });
  switch (item) {
    case 'chair':
      // Folded flat and kicked aside.
      return (
        <svg viewBox="0 0 80 24" className="pointer-events-none absolute" style={box(6.4, 1.9)} aria-hidden>
          <path d="M 4,18 L 70,8 L 76,14 L 10,22 Z" fill="#9aa3b2" stroke="#4b5260" strokeWidth={2} />
          <path d="M 14,20 L 66,12" stroke="#4b5260" strokeWidth={2} />
        </svg>
      );
    case 'can':
      return (
        <svg viewBox="0 0 60 36" className="pointer-events-none absolute" style={box(4.6, 2.8)} aria-hidden>
          <path d="M 6,8 L 52,4 L 54,30 L 8,32 Z" fill="#9aa3b2" stroke="#4b5260" strokeWidth={2} />
          <ellipse cx={53} cy={17} rx={5} ry={13} fill="#c3cad6" stroke="#4b5260" strokeWidth={2} />
          <path d="M 20,8 L 24,20 L 18,30" stroke="#4b5260" strokeWidth={2} fill="none" />
        </svg>
      );
    case 'kendo':
      return (
        <svg viewBox="0 0 100 10" className="pointer-events-none absolute" style={box(7.5, 0.75)} aria-hidden>
          <path d="M 4,7 L 96,3" stroke="#c9a873" strokeWidth={4} strokeLinecap="round" />
          <path d="M 4,7 L 26,6" stroke="#3a2a1c" strokeWidth={5} strokeLinecap="round" />
        </svg>
      );
    case 'steps':
      return (
        <svg viewBox="0 0 80 40" className="pointer-events-none absolute" style={box(6, 3)} aria-hidden>
          <path d="M 2,38 L 2,18 L 30,18 L 30,4 L 78,4 L 78,38 Z" fill="#3a3f4a" stroke="#22252c" strokeWidth={2} />
          <path d="M 2,18 L 30,18 L 30,4 L 78,4" fill="none" stroke="#565c69" strokeWidth={3} />
        </svg>
      );
    case 'table':
      // Standing, legs out, waiting for somebody.
      return (
        <svg viewBox="0 0 180 44" className="pointer-events-none absolute" style={box(18, 4.4)} aria-hidden>
          <rect x={4} y={2} width={172} height={9} rx={2} fill="#8a5a2c" stroke="#4d3015" strokeWidth={2} />
          <path d="M 24,11 L 20,42 M 156,11 L 160,42" stroke="#4b5260" strokeWidth={5} strokeLinecap="round" />
        </svg>
      );
    case 'tableBroken':
      return (
        <svg viewBox="0 0 180 44" className="pointer-events-none absolute" style={box(18, 4.4)} aria-hidden>
          <path d="M 4,30 L 80,38 L 78,44 L 2,38 Z M 98,40 L 176,28 L 178,36 L 100,44 Z" fill="#8a5a2c" stroke="#4d3015" strokeWidth={2} />
          <path d="M 84,40 L 92,36 L 96,42 M 60,26 L 66,22" stroke="#6b4320" strokeWidth={3} />
          <path d="M 18,38 L 28,22 M 162,36 L 150,20" stroke="#4b5260" strokeWidth={5} strokeLinecap="round" />
        </svg>
      );
    case 'ladder':
      return (
        <svg viewBox="0 0 60 150" className="pointer-events-none absolute" style={box(7.2, 18)} aria-hidden>
          <path d="M 14,4 L 6,148 M 46,4 L 54,148" stroke="#c9a23a" strokeWidth={5} strokeLinecap="round" />
          {Array.from({ length: 9 }, (_, i) => (
            <line key={i} x1={13 - i * 0.8} y1={16 + i * 15} x2={47 + i * 0.8} y2={16 + i * 15} stroke="#e2c15a" strokeWidth={4} />
          ))}
        </svg>
      );
    case 'ladderBroken':
      // On its side, bent in the middle, rungs gone.
      return (
        <svg viewBox="0 0 150 30" className="pointer-events-none absolute" style={box(18, 3.6)} aria-hidden>
          <path d="M 4,24 L 70,18 L 146,26 M 6,10 L 72,6 L 144,14" stroke="#c9a23a" strokeWidth={5} strokeLinecap="round" fill="none" />
          {[18, 34, 50, 96, 112, 128].map((x, i) => (
            <line key={i} x1={x} y1={9 - (x > 72 ? -2 : 0)} x2={x + 1} y2={22 + (x > 72 ? 3 : 0)} stroke="#e2c15a" strokeWidth={4} />
          ))}
        </svg>
      );
  }
}
