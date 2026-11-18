// An all-in match's field: everybody who is in the match but not in the beat
// the camera is on, paired off and actually fighting, the whole time.
//
// Nothing here is in the simulation and nothing here is called by anybody.
// It is the "everyone else is brawling" a battle royal has behind whatever
// the commentator is talking about. Each pair runs default moves on a loop
// of its own — trading who is on top each time, so nobody is ever seen to
// win one of these — and when the caller names two of them, those two leave
// this layer and do the called move down at the front (MatchStage), then
// drift back.
//
// However many the match has, they are all here: the field stacks into
// rows from the back of the mat forward, getting smaller as there are more
// of them. The pairs live in the same ring physics as the featured two, in
// a space of their own. Wrestlers are paired in a stable order and each
// pair has a station; when somebody leaves (called to the front, or over
// the top rope) the rest re-pair and walk to their new stations rather than
// jumping to them.
//
// When the match is over the fighting stops: any winner among them puts
// their arms up, and everybody else goes down.

import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArticulatedFigure, type Joints } from './ArticulatedFigure';
import { FIGURE_ASPECT, MatchFigure, heightScale } from './MatchFigure';
import { FEET_Y, VIEW } from './Arena';
import { BRAWL, DOWN, FLOOR, FRONT_FLOOR, GAP, stageMove, type MoveId, type Zone } from './choreography';
import { RING, planBeat, type PlanFighter, type WorldFrame, type WorldPose } from './ringPhysics';
import { playPlan, settle } from './playback';
import type { Id, Wrestler } from '../../engine/types';

const hash = (text: string) => {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
};

/**
 * What the field does to each other. The standing brawl, plus the ring work
 * that makes it look like a ring full of fights rather than a queue: whips
 * into the ropes and the corner, suplexes, body drops, a spear. Nothing that
 * climbs — a top-rope move back there would be lost, and in the way.
 */
const FIELD_MOVES: readonly MoveId[] = [...BRAWL, 'whip', 'suplex', 'cornerWhip', 'backBodyDrop', 'shoulderBlock', 'spear', 'clothesline', 'backbreaker'];

/** What a pair does out on the floor: fists, the barricade (a whip, out there), a slam on the concrete. */
const FLOOR_FIGHT: readonly MoveId[] = ['flurry', 'whip', 'headbutt', 'slam', 'strike', 'kneeLift', 'clothesline'];

// Jointed figures cost five copies of a portrait each. Up to this many the
// field gets them; past it, plain figures that are thrown about whole.
const JOINTED_UP_TO = 10;
/**
 * How big somebody standing with their feet at this height of the picture
 * is, against somebody on the front line (Arena.tsx's perspective: the
 * ring's sides run to a point 172 units down the picture).
 */
const VANISH = 172;
const depthScale = (feet: number) => (feet - VANISH) / (FEET_Y - VANISH);

interface Shared {
  figures: Map<Id, HTMLDivElement>;
  joints: Map<Id, Joints>;
  /** Where each wrestler was last left, in their row's units. */
  leftAt: Map<Id, WorldPose>;
}

/** The featured exchange, as the field sees it: where its two are, and whether the one taking it is down. */
export interface Focus {
  actorX: number;
  targetX: number;
  down: boolean;
  /** The one taking it is out on the floor. */
  floor: boolean;
}
/** A big bump in the featured exchange: where it lands, and when (ms into the beat). */
export interface Bump {
  key: number;
  x: number;
  at: number;
}

interface Station {
  /** This row's size against a front-row figure: x here times this is ring x. */
  scale: number;
  x: number;
  /** Pixels per unit for this row, and how wide its figures are. */
  unit: number;
  width: number;
  half: number;
}

/** One pair (or one wrestler with nobody to fight yet), looping. Draws nothing. */
function Pair({ a, b, station, shared, focus, bump, floorOnly = false, spills = false }: {
  a: Wrestler;
  b: Wrestler | undefined;
  station: Station;
  shared: Shared;
  focus?: Focus;
  bump?: Bump;
  /** Fighting on the floor at ringside the whole time (tag partners in a no-DQ tag match). */
  floorOnly?: boolean;
  /** The rules allow the fight outside: now and then this pair goes out there and back. */
  spills?: boolean;
}) {
  const [round, setRound] = useState(0);
  const seed = hash(a.id + (b?.id ?? ''));
  // A big bump from the featured exchange landing on top of this pair
  // knocks them both down: the key of the bump that did, once it has landed.
  const [knocked, setKnocked] = useState<number | null>(null);
  const played = useRef<number | null>(null);
  useEffect(() => {
    if (!bump || !b || station.unit === 0) return;
    const here = (shared.leftAt.get(a.id)?.x ?? station.x) * station.scale;
    if (Math.abs(here - bump.x) > 9) return;
    const timer = window.setTimeout(() => setKnocked(bump.key), bump.at);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bump?.key]);
  useEffect(() => {
    if (station.unit === 0) return;
    const hit = knocked !== null && played.current !== knocked;
    if (hit) played.current = knocked;
    // In front of the ring when they are on the floor, behind its ropes when
    // they are in it; going out or coming in, they change over as they pass
    // the ropes.
    const timers: number[] = [];
    const layer = (zone: Zone, duration: number) => {
      const set = (z: string) => {
        for (const id of [a.id, b?.id]) {
          const el = id ? shared.figures.get(id) : undefined;
          if (el) el.style.zIndex = z;
        }
      };
      if (zone === 'floor') set('12');
      else if (zone === 'ring') set('1');
      else timers.push(window.setTimeout(() => set(zone === 'out' ? '12' : '1'), duration * (zone === 'out' ? 0.55 : 0.6)));
    };
    const onFloor = (id: Id) => (shared.leftAt.get(id)?.y ?? 0) < FLOOR / 2;
    // Nobody left to pair with: they pile in on whoever is taking the move up
    // front — from the far side of them, so they never stand in the attacker.
    if (!b && focus) {
      const dir: 1 | -1 = focus.targetX >= focus.actorX ? -1 : 1;
      // Back in the ring after it, the way anybody gets back in — under the
      // bottom rope — before piling in again.
      const comingBack = !focus.floor && onFloor(a.id);
      const move: MoveId = comingBack ? 'rollInside' : focus.down ? 'stomp' : (['strike', 'kneeLift', 'clothesline'] as const)[round % 3]!;
      const duration = 1500;
      const cast: PlanFighter[] = [{ id: a.id, role: 'actor', dir, from: shared.leftAt.get(a.id), taggedIn: false }];
      const tx = focus.targetX / station.scale;
      // Out on the floor after them, if that is where it has gone.
      const zone: Zone = comingBack ? 'in' : focus.floor ? 'floor' : 'ring';
      layer(zone, duration);
      const plan = planBeat({ ...stageMove(move), duration, zone }, cast, tx - (dir * GAP) / 2, { half: station.half, near: tx - (dir * GAP) / 2 });
      for (const [id, pose] of plan.end) shared.leftAt.set(id, pose);
      const el = shared.figures.get(a.id);
      if (el) el.style.transform = '';
      const running = playPlan(plan, cast, (id) => shared.figures.get(id), (id) => shared.joints.get(id), station.unit, station.width, duration);
      const timer = window.setTimeout(() => setRound((n) => n + 1), duration);
      return () => {
        settle(running);
        window.clearTimeout(timer);
        timers.forEach((t) => window.clearTimeout(t));
      };
    }
    const cast: PlanFighter[] = b
      ? [
          // They take turns: whoever threw the last one takes the next.
          { id: a.id, role: round % 2 === 0 ? 'actor' : 'target', dir: 1, from: shared.leftAt.get(a.id), taggedIn: false },
          { id: b.id, role: round % 2 === 0 ? 'target' : 'actor', dir: -1, from: shared.leftAt.get(b.id), taggedIn: false },
        ]
      : [{ id: a.id, role: 'actor', dir: 1, from: shared.leftAt.get(a.id), taggedIn: false }];
    // An odd one out has nobody to hit yet, so they prowl their patch
    // looking for somebody: a few steps one way, a few the other.
    let move: MoveId = hit ? 'doubleDown' : b ? FIELD_MOVES[(seed + round * 5) % FIELD_MOVES.length]! : (['taunt', 'strike', 'fireUp'] as const)[round % 3]!;
    // Where the rules allow it, the fight goes outside: some pairs, now and
    // then, tossed out, a couple of exchanges on the floor and into the
    // barricade, and rolled back in. Tag partners in a no-DQ tag match are
    // out there the whole time.
    let zone: Zone = 'ring';
    if (b && !hit) {
      const wantOut = floorOnly || (spills && seed % 2 === 0 && (round + seed) % 10 < 3);
      const outThere = onFloor(a.id) && onFloor(b.id);
      if (wantOut && !outThere) [zone, move] = ['out', 'tossOutside'];
      else if (wantOut) [zone, move] = ['floor', FLOOR_FIGHT[(seed + round * 3) % FLOOR_FIGHT.length]!];
      else if (outThere) [zone, move] = ['in', 'rollInside'];
    }
    // And they do not stand still: each exchange happens a few steps from
    // the last, wandering their part of the ring (a whip takes them to its
    // edge and back on its own).
    const drift = b ? ((((seed >> 3) + round * 7) % 11) - 5) * 1.2 : 0;
    // Each pair keeps its own time, so the field never moves in step.
    const duration = b ? 1500 + (seed % 6) * 110 : 1400;
    layer(zone, duration);
    const plan = planBeat({ ...stageMove(move), duration, zone }, cast, station.x, { half: station.half, near: b ? station.x + drift : station.x + GAP / 2 + (round % 2 ? 5 : -5) });
    for (const [id, pose] of plan.end) shared.leftAt.set(id, pose);
    for (const f of cast) {
      const el = shared.figures.get(f.id);
      if (el) el.style.transform = '';
    }
    const running = playPlan(plan, cast, (id) => shared.figures.get(id), (id) => shared.joints.get(id), station.unit, station.width, duration);
    const timer = window.setTimeout(() => setRound((n) => n + 1), duration);
    return () => {
      settle(running);
      window.clearTimeout(timer);
      timers.forEach((t) => window.clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id, b?.id, station.x, station.unit, round, knocked, floorOnly]);
  return null;
}

/** The match is over: this one either celebrates or goes down, where they are. */
function Ending({ wrestler, won, station, shared }: { wrestler: Wrestler; won: boolean; station: Station; shared: Shared }) {
  useEffect(() => {
    const el = shared.figures.get(wrestler.id);
    if (!el || station.unit === 0) return;
    const from = shared.leftAt.get(wrestler.id) ?? { x: station.x, y: 0, rot: 0 };
    const at = (t: number, pose: WorldPose, stance: WorldFrame['stance']): WorldFrame => ({ at: t, ...pose, sy: 1, stance });
    const wasDown = Math.abs(Math.abs(from.rot) - 90) < 30;
    const up = { x: from.x, y: 0, rot: 0 };
    const fall = from.x - 20 >= -station.half ? -90 : 90;
    const frames = won
      ? [at(0, from, wasDown ? 'flat' : undefined), at(0.5, { ...up, rot: from.rot * 0.25 }, wasDown ? 'kneel' : 'guard'), at(1, up, 'celebrate')]
      : wasDown
        ? [at(0, from, 'flat'), at(1, from, 'flat')]
        : [at(0, from, undefined), at(0.5, { x: from.x, y: 2.5, rot: fall * 0.55 }, 'fall'), at(1, { x: from.x, y: DOWN, rot: fall }, 'flat')];
    const cast: PlanFighter[] = [{ id: wrestler.id, role: 'actor', dir: 1, from: undefined, taggedIn: false }];
    const tracks = (list: WorldFrame[]) => ({ tracks: new Map([[wrestler.id, list]]), lead: 0, centre: 0, impacts: [], ropeHits: [], end: new Map<Id, WorldPose>() });
    el.style.transform = '';
    const running = playPlan(tracks(frames), cast, (id) => shared.figures.get(id), (id) => shared.joints.get(id), station.unit, station.width, 1400);
    const loop: Animation[] = [];
    const timer = window.setTimeout(() => {
      if (!won) return;
      const cheer = [at(0, up, 'celebrate'), at(0.5, { ...up, y: 0.7 }, 'lift'), at(1, up, 'celebrate')];
      loop.push(...playPlan(tracks(cheer), cast, (id) => shared.figures.get(id), (id) => shared.joints.get(id), station.unit, station.width, 1100, { iterations: Infinity }));
    }, 1400);
    return () => {
      settle(running);
      loop.forEach((a) => a.cancel());
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrestler.id, won, station.unit]);
  return null;
}

export const FieldBrawl = memo(function FieldBrawl({
  wrestlers,
  stageWidth,
  stageHeight,
  figureWidth,
  winners,
  belt,
  sides,
  focus,
  bump,
  floorIds,
  spills = false,
}: {
  /** Who is fighting on the floor at ringside instead (tag partners, in a match where that is legal). */
  floorIds?: ReadonlySet<Id>;
  /** The rules allow fighting outside: pairs in the ring sometimes take it out there. */
  spills?: boolean;
  /** The two the camera is on, so the field keeps clear of them and a spare one can pile in. */
  focus?: Focus;
  /** The featured exchange's big bump this beat, if any: a pair it lands on goes down. */
  bump?: Bump;
  /** The field, in an order that does not change as people come and go. */
  wrestlers: readonly Wrestler[];
  /** Which side each of them works from; somebody new arrives from there, through the ropes. */
  sides?: ReadonlyMap<Id, 1 | -1>;
  stageWidth: number;
  stageHeight: number;
  /** Width of a front-row figure; the field is drawn smaller than this. */
  figureWidth: number;
  /** Set once the match is over. */
  winners?: ReadonlySet<Id>;
  belt: boolean;
}) {
  const shared = useRef<Shared>({ figures: new Map(), joints: new Map(), leftAt: new Map() }).current;
  // The Pairs start animating in an effect; they need the figures mounted first.
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => setReady(true), []);
  // Forget anybody who has left, so that if they come back they do not walk
  // in from where they were standing three eliminations ago.
  const present = new Set(wrestlers.map((w) => w.id));
  for (const id of shared.leftAt.keys()) if (!present.has(id)) shared.leftAt.delete(id);

  if (wrestlers.length === 0 || stageWidth === 0) return null;
  // Somebody arriving (a tag partner off the apron) starts at the ropes on
  // their own side, so they come in rather than appear.
  for (const w of wrestlers) {
    const side = sides?.get(w.id);
    // Off the apron to the floor, for a fight out there: down at ringside on their own side.
    if (side && floorIds?.has(w.id) && !shared.leftAt.has(w.id)) shared.leftAt.set(w.id, { x: -side * (RING.half + 6), y: FRONT_FLOOR, rot: 0 });
    if (side && !shared.leftAt.has(w.id)) shared.leftAt.set(w.id, { x: -side * (RING.half + 2), y: 0, rot: 0 });
  }
  const pairs = Math.ceil(wrestlers.length / 2);
  // DESIGN: everybody in an all-in match is legal and fighting, so the field
  // is the same people on the same mat, not a crowd of little figures behind
  // it. A row stands just behind the two up front, drawn at the true
  // perspective size for that depth; only a field too big for one row goes
  // further back (and so smaller), as it would standing there.
  const perRow = pairs <= 3 ? 3 : 4;
  const rows = Math.ceil(pairs / perRow);
  const feetOf = (row: number) => FEET_Y - 16 - (rows === 1 ? 0 : (row * 30) / (rows - 1));
  const jointed = wrestlers.length <= JOINTED_UP_TO;
  // Keep clear of the two up front: a pair whose spot would stand right on
  // them moves out to the side.
  const clear = (x: number, scale: number) => {
    if (!focus) return x;
    const fx = (focus.actorX + focus.targetX) / 2 / scale;
    const gap = 13 / scale;
    return Math.abs(x - fx) >= gap ? x : fx + (x >= fx ? gap : -gap);
  };
  const stationOf = (k: number): Station & { feet: number; row: number } => {
    const row = Math.floor(k / perRow);
    const inRow = Math.min(perRow, pairs - row * perRow);
    const slot = k - row * perRow;
    const feet = feetOf(row);
    const scale = depthScale(feet);
    const half = (RING.half - 1) / scale;
    // Alternate rows are offset, so nobody stands directly behind anybody.
    const spread = inRow === 1 ? 0 : ((slot + 0.5) / inRow) * 2 - 1;
    const x = spread * (half - 8) + (row % 2 ? 4 : 0);
    return {
      scale,
      x: Math.max(-half + 8, Math.min(half - 8, row === 0 ? clear(x, scale) : x)),
      unit: (stageWidth / 100) * scale,
      width: figureWidth * scale,
      half,
      feet: (feet / VIEW.h) * stageHeight,
      row,
    };
  };

  return (
    <>
      {wrestlers.map((wrestler, i) => {
        const station = stationOf(Math.floor(i / 2));
        const won = Boolean(winners?.has(wrestler.id));
        return (
          <div
            key={wrestler.id}
            ref={(el) => {
              if (el) shared.figures.set(wrestler.id, el);
              else shared.figures.delete(wrestler.id);
            }}
            data-testid="bystander-ring"
            className="absolute"
            style={{ left: stageWidth / 2 - station.width / 2, top: station.feet - station.width * FIGURE_ASPECT, width: station.width, transformOrigin: '50% 100%', zIndex: 1, willChange: 'transform' }}
          >
            <div style={{ transform: `scale(${heightScale(wrestler)})`, transformOrigin: '50% 100%' }}>
              {jointed ? (
                <ArticulatedFigure
                  wrestler={wrestler}
                  onJoints={(joints) => {
                    if (joints) shared.joints.set(wrestler.id, joints);
                    else shared.joints.delete(wrestler.id);
                  }}
                />
              ) : (
                <MatchFigure wrestler={wrestler} />
              )}
              {won && belt && (
                <svg viewBox="0 0 120 40" className="pointer-events-none absolute" style={{ left: '14%', top: '-2%', width: '72%' }} aria-hidden>
                  <path d="M 2,14 L 40,10 L 80,10 L 118,14 L 118,26 L 80,30 L 40,30 L 2,26 Z" fill="#2a2018" />
                  <rect x={40} y={3} width={40} height={34} rx={8} fill="#e2b33c" stroke="#8a6412" strokeWidth={2} />
                </svg>
              )}
            </div>
          </div>
        );
      })}
      {ready &&
        (winners
          ? wrestlers.map((wrestler, i) => <Ending key={wrestler.id} wrestler={wrestler} won={winners.has(wrestler.id)} station={stationOf(Math.floor(i / 2))} shared={shared} />)
          : Array.from({ length: pairs }, (_, k) => <Pair key={k} a={wrestlers[k * 2]!} b={wrestlers[k * 2 + 1]} station={stationOf(k)} shared={shared} focus={focus} bump={bump} floorOnly={Boolean(floorIds?.has(wrestlers[k * 2]!.id))} spills={spills} />))}
    </>
  );
});
