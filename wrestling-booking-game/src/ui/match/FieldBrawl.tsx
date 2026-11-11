// A battle royal's field: everybody who is in the match but not in the beat
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
// The pairs live in the same ring physics as the featured two, in a space
// of their own: smaller figures, along the back of the mat. Wrestlers are
// paired in a stable order and each pair has a station; when somebody
// leaves (called to the front, or over the top rope) the rest re-pair and
// walk to their new stations rather than jumping to them.

import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArticulatedFigure, type Joints } from './ArticulatedFigure';
import { FIGURE_ASPECT } from './MatchFigure';
import { VIEW } from './Arena';
import { BRAWL, GAP, stageMove } from './choreography';
import { FIELD, planBeat, type PlanFighter, type WorldPose } from './ringPhysics';
import { playPlan, settle } from './playback';
import type { Id, Wrestler } from '../../engine/types';

const { scale: SCALE, feetY: FEET_Y, half: HALF } = FIELD;

const hash = (text: string) => {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
};

interface Shared {
  figures: Map<Id, HTMLDivElement>;
  joints: Map<Id, Joints>;
  /** Where each wrestler was last left, in field units. */
  leftAt: Map<Id, WorldPose>;
}

/** One pair (or one wrestler with nobody to fight yet), looping. Draws nothing. */
function Pair({ a, b, station, unit, figureWidth, shared }: { a: Wrestler; b: Wrestler | undefined; station: number; unit: number; figureWidth: number; shared: Shared }) {
  const [round, setRound] = useState(0);
  const seed = hash(a.id + (b?.id ?? ''));
  useEffect(() => {
    if (unit === 0) return;
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
    const plan = planBeat({ ...stageMove(move), duration }, cast, station, { half: HALF, near: b ? station : station + GAP / 2 + (round % 2 ? 5 : -5) });
    for (const [id, pose] of plan.end) shared.leftAt.set(id, pose);
    for (const f of cast) {
      const el = shared.figures.get(f.id);
      if (el) el.style.transform = '';
    }
    const running = playPlan(plan, cast, (id) => shared.figures.get(id), (id) => shared.joints.get(id), unit, figureWidth, duration);
    const timer = window.setTimeout(() => setRound((n) => n + 1), duration);
    return () => {
      settle(running);
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id, b?.id, station, unit, round]);
  return null;
}

export const FieldBrawl = memo(function FieldBrawl({
  wrestlers,
  stageWidth,
  stageHeight,
  figureWidth,
}: {
  /** The field, in an order that does not change as people come and go. */
  wrestlers: readonly Wrestler[];
  stageWidth: number;
  stageHeight: number;
  /** Width of a front-row figure; the field is drawn smaller than this. */
  figureWidth: number;
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
  const unit = (stageWidth / 100) * SCALE;
  const width = figureWidth * SCALE;
  const feet = (FEET_Y / VIEW.h) * stageHeight;
  const pairs = Math.ceil(wrestlers.length / 2);
  // Stations spread across the back of the ring, with room at each end for
  // a pair to work in.
  const stationOf = (k: number) => (pairs === 1 ? 0 : ((k + 0.5) / pairs) * 2 - 1) * (HALF - 3);

  return (
    <>
      {wrestlers.map((wrestler) => (
        <div
          key={wrestler.id}
          ref={(el) => {
            if (el) shared.figures.set(wrestler.id, el);
            else shared.figures.delete(wrestler.id);
          }}
          data-testid="bystander-ring"
          className="absolute"
          style={{ left: stageWidth / 2 - width / 2, top: feet - width * FIGURE_ASPECT, width, transformOrigin: '50% 100%', zIndex: 1, willChange: 'transform' }}
        >
          <ArticulatedFigure
            wrestler={wrestler}
            onJoints={(joints) => {
              if (joints) shared.joints.set(wrestler.id, joints);
              else shared.joints.delete(wrestler.id);
            }}
          />
        </div>
      ))}
      {ready &&
        Array.from({ length: pairs }, (_, k) => (
          <Pair key={k} a={wrestlers[k * 2]!} b={wrestlers[k * 2 + 1]} station={stationOf(k)} unit={unit} figureWidth={width} shared={shared} />
        ))}
    </>
  );
});
