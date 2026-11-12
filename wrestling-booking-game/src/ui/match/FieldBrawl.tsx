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
import { VIEW } from './Arena';
import { BRAWL, DOWN, GAP, stageMove } from './choreography';
import { FIELD, planBeat, type PlanFighter, type WorldFrame, type WorldPose } from './ringPhysics';
import { playPlan, settle } from './playback';
import type { Id, Wrestler } from '../../engine/types';

const hash = (text: string) => {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
};

// Jointed figures cost five copies of a portrait each. Up to this many the
// field gets them; past it, plain figures that are thrown about whole.
const JOINTED_UP_TO = 10;
/** Pairs to a row before starting another. */
const PAIRS_PER_ROW = 4;

interface Shared {
  figures: Map<Id, HTMLDivElement>;
  joints: Map<Id, Joints>;
  /** Where each wrestler was last left, in their row's units. */
  leftAt: Map<Id, WorldPose>;
}

interface Station {
  x: number;
  /** Pixels per unit for this row, and how wide its figures are. */
  unit: number;
  width: number;
  half: number;
}

/** One pair (or one wrestler with nobody to fight yet), looping. Draws nothing. */
function Pair({ a, b, station, shared }: { a: Wrestler; b: Wrestler | undefined; station: Station; shared: Shared }) {
  const [round, setRound] = useState(0);
  const seed = hash(a.id + (b?.id ?? ''));
  useEffect(() => {
    if (station.unit === 0) return;
    const cast: PlanFighter[] = b
      ? [
          // They take turns: whoever threw the last one takes the next.
          { id: a.id, role: round % 2 === 0 ? 'actor' : 'target', dir: 1, from: shared.leftAt.get(a.id), taggedIn: false },
          { id: b.id, role: round % 2 === 0 ? 'target' : 'actor', dir: -1, from: shared.leftAt.get(b.id), taggedIn: false },
        ]
      : [{ id: a.id, role: 'actor', dir: 1, from: shared.leftAt.get(a.id), taggedIn: false }];
    // An odd one out has nobody to hit yet, so they prowl their patch
    // looking for somebody: a few steps one way, a few the other.
    const move = b ? BRAWL[(seed + round * 5) % BRAWL.length]! : (['taunt', 'strike', 'fireUp'] as const)[round % 3]!;
    // Each pair keeps its own time, so the field never moves in step.
    const duration = b ? 1500 + (seed % 6) * 110 : 1400;
    const plan = planBeat({ ...stageMove(move), duration }, cast, station.x, { half: station.half, near: b ? station.x : station.x + GAP / 2 + (round % 2 ? 5 : -5) });
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id, b?.id, station.x, station.unit, round]);
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
}: {
  /** The field, in an order that does not change as people come and go. */
  wrestlers: readonly Wrestler[];
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
  const pairs = Math.ceil(wrestlers.length / 2);
  const rows = Math.ceil(pairs / PAIRS_PER_ROW);
  // More rows, smaller people: three rows of a thirty-man battle royal have
  // to fit between the back ropes and the two at the front.
  const scale = FIELD.scale * (rows === 1 ? 1 : rows === 2 ? 0.9 : rows === 3 ? 0.8 : 0.7);
  const jointed = wrestlers.length <= JOINTED_UP_TO;
  /** Row 0 is the back of the ring; each row after it stands a little nearer. */
  const stationOf = (k: number): Station & { feet: number; row: number } => {
    const row = Math.floor(k / PAIRS_PER_ROW);
    const inRow = Math.min(PAIRS_PER_ROW, pairs - row * PAIRS_PER_ROW);
    const slot = k - row * PAIRS_PER_ROW;
    const half = (FIELD.half * FIELD.scale) / scale + row * 2.5;
    // Alternate rows are offset, so nobody stands directly behind anybody.
    const spread = inRow === 1 ? 0 : ((slot + 0.5) / inRow) * 2 - 1;
    return {
      x: spread * (half - 3) + (row % 2 ? 3 : 0),
      unit: (stageWidth / 100) * scale,
      width: figureWidth * scale,
      half,
      feet: ((FIELD.feetY - 8 + row * 13) / VIEW.h) * stageHeight,
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
          : Array.from({ length: pairs }, (_, k) => <Pair key={k} a={wrestlers[k * 2]!} b={wrestlers[k * 2 + 1]} station={stationOf(k)} shared={shared} />))}
    </>
  );
});
