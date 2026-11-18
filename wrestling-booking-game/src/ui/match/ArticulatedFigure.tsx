// A match figure with joints: waist, shoulders, elbows, hips, knees.
//
// The portrait art is one flat picture with the arms hanging at its sides,
// so an arm is made by showing the same picture again through a cut-out the
// shape of that arm, and turning the cut-out about the shoulder. Five copies
// of the portrait in all — torso and head, two upper arms, two forearms —
// which is why only the two wrestlers a beat is about are drawn this way
// and everyone waiting gets the plain MatchFigure.
//
// The torso's cut-out keeps a little of each shoulder, so when an arm
// swings away there is a shoulder left behind it rather than a hole.
//
// This component only builds the puppet and hands back its joints;
// MatchStage does the moving.

import { memo, useMemo } from "react";
import {
  assignLook,
  lookSubjectOf,
  type ComposedLook,
} from "../paperdoll/assignLook";
import { ComposedPortrait, InkFilter } from "../paperdoll/ComposedPortrait";
import { BODY_RIG, LEG_RIG, type BodyRig } from "./rig";
import { MatchFigure } from "./MatchFigure";
import { Pelvis, Shin, Thigh, legwearOf, type Legwear } from "./legwear";
import type { Prop } from "./choreography";
import type { Wrestler } from "../../engine/types";

type JointEl = HTMLElement | SVGGElement;
/** A figure's joints, by SCREEN side — MatchStage knows which side is the lead. */
export interface Joints {
  waist: JointEl;
  left: { shoulder: JointEl; elbow: JointEl; hip: JointEl; knee: JointEl };
  right: { shoulder: JointEl; elbow: JointEl; hip: JointEl; knee: JointEl };
}

// ComposedPortrait draws the figure at 86%, sat on the bottom edge (see its
// FRAMING.waist). A point on the 512 canvas lands here in the portrait box:
const SCALE = 0.86;
const px = (x: number) => 50 + ((x / 512) * 100 - 50) * SCALE;
const py = (y: number) => 100 - (100 - (y / 512) * 100) * SCALE;
const poly = (points: readonly (readonly [number, number])[]) =>
  `polygon(${points.map(([x, y]) => `${px(x).toFixed(2)}% ${py(y).toFixed(2)}%`).join(", ")})`;

function cuts(rig: BodyRig, side: "left" | "right") {
  const mx = (x: number) => (side === "left" ? x : 2 * rig.cx - x);
  const far = side === "left" ? -400 : 912;
  const [pitY, pitX] = rig.gap[0]!;
  const elbowY = rig.elbow[1];
  const gapX = (y: number) => {
    for (let i = 1; i < rig.gap.length; i++) {
      const [y1, x1] = rig.gap[i]!;
      const [y0, x0] = rig.gap[i - 1]!;
      if (y <= y1) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
    }
    return rig.gap[rig.gap.length - 1]![1];
  };
  const above = rig.gap
    .filter(([y]) => y < elbowY + 5)
    .map(([y, x]) => [mx(x), y] as const);
  const below = rig.gap
    .filter(([y]) => y > elbowY - 3)
    .map(([y, x]) => [mx(x), y] as const);
  return {
    upper: poly([
      [far, rig.shoulderTop],
      [mx(pitX - 1), rig.shoulderTop],
      [mx(pitX), pitY],
      ...above,
      [mx(gapX(elbowY + 5)), elbowY + 5],
      [far, elbowY + 5],
    ]),
    fore: poly([
      [far, elbowY - 3],
      [mx(gapX(elbowY - 3)), elbowY - 3],
      ...below,
      [far, 620],
    ]),
    // The torso's own edge on this side: a little inside the arm cut above
    // the armpit (the shoulder that is left behind), the slit below it.
    torsoEdge: [
      [mx(pitX - 13), -400],
      [mx(pitX - 13), pitY - 16],
      [mx(pitX), pitY],
      ...rig.gap.map(([y, x]) => [mx(x), y] as const),
    ] as (readonly [number, number])[],
    // Where the fist is, with the arm hanging: the bottom of the forearm.
    hand: { left: `${px(mx(rig.elbow[0] - 14)).toFixed(2)}%`, top: `${py(492).toFixed(2)}%` },
    shoulder: `${px(mx(rig.shoulder[0])).toFixed(2)}% ${py(rig.shoulder[1]).toFixed(2)}%`,
    elbow: `${px(mx(rig.elbow[0])).toFixed(2)}% ${py(rig.elbow[1]).toFixed(2)}%`,
  };
}

const FILL = "absolute inset-0";

/** A folding chair, held by a leg: drawn where the hand is, swinging with the forearm. */
function Chair({ at }: { at: { left: string; top: string } }) {
  return (
    <svg
      viewBox="0 0 60 80"
      className="absolute"
      style={{ left: at.left, top: at.top, width: "30%", transform: "translate(-50%, -78%)" }}
      aria-hidden
    >
      <path d="M 12,4 L 48,4 L 50,34 L 10,34 Z" fill="#9aa3b2" stroke="#4b5260" strokeWidth={2} />
      <path d="M 8,36 L 52,36 L 54,44 L 6,44 Z" fill="#7b8494" stroke="#4b5260" strokeWidth={2} />
      <path
        d="M 12,44 L 8,78 M 48,44 L 52,78 M 12,34 L 12,4 M 48,34 L 48,4"
        stroke="#4b5260"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Arm({
  look,
  cut,
  register,
  held = false,
}: {
  look: ComposedLook;
  cut: ReturnType<typeof cuts>;
  register: (part: "shoulder" | "elbow", el: JointEl | null) => void;
  /** This hand has something in it. */
  held?: Prop | false;
}) {
  return (
    <div
      ref={(el) => register("shoulder", el)}
      className={FILL}
      style={{ transformOrigin: cut.shoulder, willChange: "transform" }}
    >
      <div className={FILL} style={{ clipPath: cut.upper }}>
        <ComposedPortrait look={look} alt="" inked />
      </div>
      <div
        ref={(el) => register("elbow", el)}
        className={FILL}
        style={{ transformOrigin: cut.elbow, willChange: "transform" }}
      >
        <div className={FILL} style={{ clipPath: cut.fore }}>
          <ComposedPortrait look={look} alt="" inked />
        </div>
        {held === "chair" && <Chair at={cut.hand} />}
        {held === "kendo" && <Kendo at={cut.hand} />}
        {held === "can" && <TrashCan at={cut.hand} />}
        {held === "ladder" && <Ladder at={cut.hand} />}
        {held === "steps" && <Steps at={cut.hand} />}
      </div>
    </div>
  );
}

function Leg({
  side,
  skin,
  gear,
  female,
  register,
}: {
  side: "left" | "right";
  skin: string;
  gear: Legwear;
  female: boolean;
  register: (part: "hip" | "knee", el: JointEl | null) => void;
}) {
  // Written for the screen-left leg; `m` mirrors every x for the right one
  // (mirroring the coordinates, not the group, so a rotation still turns
  // the same way on both legs).
  const m = (x: number) => (side === "left" ? x : 100 - x);
  const origin = ([x, y]: readonly [number, number]) => `${m(x)}px ${y}px`;
  return (
    <g
      ref={(el) => register("hip", el)}
      style={{
        transformBox: "view-box",
        transformOrigin: origin(LEG_RIG.hip),
        willChange: "transform",
      }}
    >
      <g
        ref={(el) => register("knee", el)}
        style={{
          transformBox: "view-box",
          transformOrigin: origin(LEG_RIG.knee),
          willChange: "transform",
        }}
      >
        <Shin m={m} skin={skin} gear={gear} female={female} />
      </g>
      <Thigh m={m} skin={skin} gear={gear} female={female} />
    </g>
  );
}

/** A kendo stick: long, thin, and held at one end. */
function Kendo({ at }: { at: { left: string; top: string } }) {
  return (
    <svg viewBox="0 0 12 110" className="absolute" style={{ left: at.left, top: at.top, width: "9%", transform: "translate(-50%, -88%)" }} aria-hidden>
      <rect x={3} y={2} width={6} height={106} rx={3} fill="#d8b46a" stroke="#6b4a1c" strokeWidth={1.2} />
      <path d="M 3,24 L 9,24 M 3,48 L 9,48 M 3,72 L 9,72" stroke="#6b4a1c" strokeWidth={1.4} />
      <rect x={2.4} y={88} width={7.2} height={20} rx={3} fill="#2a2a30" />
    </svg>
  );
}

/** A ladder, gripped by a rung near one end: taller than the man swinging it. */
function Ladder({ at }: { at: { left: string; top: string } }) {
  return (
    <svg viewBox="0 0 40 170" className="absolute" style={{ left: at.left, top: at.top, width: "32%", transform: "translate(-50%, -90%)" }} aria-hidden>
      <path d="M 8,3 L 8,167 M 32,3 L 32,167" stroke="#c9a23a" strokeWidth={5} strokeLinecap="round" />
      {Array.from({ length: 9 }, (_, i) => (
        <line key={i} x1={8} y1={12 + i * 19} x2={32} y2={12 + i * 19} stroke="#e2c15a" strokeWidth={4} />
      ))}
      <path d="M 8,3 L 8,167 M 32,3 L 32,167" stroke="#6b5212" strokeWidth={1.2} fill="none" />
    </svg>
  );
}

/** The steel ring steps: a heavy stepped block, held up by its lip. */
function Steps({ at }: { at: { left: string; top: string } }) {
  return (
    <svg viewBox="0 0 90 70" className="absolute" style={{ left: at.left, top: at.top, width: "62%", transform: "translate(-50%, -84%)" }} aria-hidden>
      <path d="M 4,66 L 4,46 L 30,46 L 30,26 L 58,26 L 58,6 L 86,6 L 86,66 Z" fill="#8c95a4" stroke="#3f4552" strokeWidth={3} strokeLinejoin="round" />
      <path d="M 4,46 L 30,46 M 30,26 L 58,26 M 58,6 L 86,6" stroke="#c7ced9" strokeWidth={3} />
      <path d="M 14,56 L 76,56 M 40,36 L 76,36 M 66,16 L 76,16" stroke="#6b7482" strokeWidth={2} />
    </svg>
  );
}

/**
 * What the match has done to them, kept plain: dark bruises that come up as
 * the beating does (ribs first, then an eye, then the rest), a few splats of
 * blood when they have been busted open, and soot where the pyro caught
 * them. Drawn on the torso art in its own 512 canvas. Bruises only on bare
 * skin and a face that is showing.
 */
const SPLAT = 'M 0,-10 C 6,-11 9,-5 8,0 C 12,2 11,8 5,8 C 3,13 -4,12 -5,7 C -11,8 -12,1 -7,-2 C -10,-7 -5,-11 0,-10 Z M 14,-9 a 3,3 0 1,0 0.1,0 Z M -13,10 a 2.4,2.4 0 1,0 0.1,0 Z M 12,12 a 1.8,1.8 0 1,0 0.1,0 Z';
function Damage({ rig, wear, burned, bloody, bare, face }: { rig: BodyRig; wear: number; burned: boolean; bloody: boolean; bare: boolean; face: boolean }) {
  const { cx, head } = rig;
  const hw = head.halfWidth;
  const at = (y: number) => head.top + head.tall * y;
  const shade = (from: number) => Math.min(0.9, 0.55 + (wear - from) * 0.8);
  const bruises: [x: number, y: number, rx: number, ry: number, from: number, where: 'body' | 'face'][] = [
    [cx - 58, 345, 36, 24, 0.2, 'body'],
    [cx + hw * 0.4, at(0.48), hw * 0.36, head.tall * 0.13, 0.3, 'face'],
    [cx + 50, 262, 30, 20, 0.45, 'body'],
    [cx - hw * 0.42, at(0.7), hw * 0.28, head.tall * 0.1, 0.6, 'face'],
    [cx + 14, 425, 38, 22, 0.75, 'body'],
  ];
  const shows = (where: 'body' | 'face') => (where === 'body' ? bare : face);
  // Where the blood landed: the brow, the cheek, and down the chest.
  const splats: [x: number, y: number, size: number][] = [
    [cx + hw * 0.25, at(0.2), 1.3],
    [cx + hw * 0.55, at(0.62), 1],
    [cx + 26, 240, 1.6],
    [cx - 18, 292, 1.2],
  ];
  return (
    <svg
      viewBox="0 0 512 512"
      className="pointer-events-none absolute"
      style={{ left: `${px(0)}%`, width: `${px(512) - px(0)}%`, top: `${py(0)}%`, height: `${py(512) - py(0)}%` }}
      aria-hidden
    >
      <defs>
        <filter id="mv-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <radialGradient id="mv-bruise">
          <stop offset="0%" stopColor="#1c0c22" />
          <stop offset="60%" stopColor="#2e1433" />
          <stop offset="100%" stopColor="#2e1433" stopOpacity="0" />
        </radialGradient>
      </defs>
      {bruises.filter(([, , , , from, where]) => wear >= from && shows(where)).map(([x, y, rx, ry, from], i) => (
        <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill="url(#mv-bruise)" opacity={shade(from)} filter="url(#mv-soft)" transform={`rotate(${(i % 2 ? 1 : -1) * 15} ${x} ${y})`} />
      ))}
      {burned && (
        <g fill="#1e1a18" filter="url(#mv-soft)">
          <ellipse cx={cx + 70} cy={262} rx={40} ry={56} opacity={0.5} />
          {face && <ellipse cx={cx + hw * 0.45} cy={at(0.74)} rx={hw * 0.34} ry={head.tall * 0.11} opacity={0.5} />}
        </g>
      )}
      {bloody &&
        splats.filter(([, y]) => face || y > at(1)).map(([x, y, size], i) => (
          <path key={i} d={SPLAT} fill="#6e0b0b" opacity={0.92} transform={`translate(${x} ${y}) rotate(${i * 70}) scale(${size})`} />
        ))}
    </svg>
  );
}

/** A dented steel trash can, swung by the rim. */
function TrashCan({ at }: { at: { left: string; top: string } }) {
  return (
    <svg viewBox="0 0 60 80" className="absolute" style={{ left: at.left, top: at.top, width: "28%", transform: "translate(-50%, -80%)" }} aria-hidden>
      <path d="M 8,8 L 52,8 L 47,76 L 13,76 Z" fill="#9aa3b2" stroke="#4b5260" strokeWidth={2} />
      <path d="M 16,10 L 19,74 M 26,10 L 27,74 M 34,10 L 33,74 M 44,10 L 41,74" stroke="#6b7482" strokeWidth={2} />
      <ellipse cx={30} cy={8} rx={23} ry={5} fill="#c3cad6" stroke="#4b5260" strokeWidth={2} />
      <path d="M 12,40 L 22,46 L 14,54" stroke="#4b5260" strokeWidth={2} fill="none" />
    </svg>
  );
}

export const ArticulatedFigure = memo(function ArticulatedFigure({
  wrestler,
  onJoints,
  held,
  weapon = "chair",
  blindfold = false,
  bloody = false,
  burned = false,
  wear = 0,
}: {
  /** Which SCREEN-side hand has something in it, if either. */
  held?: 'left' | 'right';
  /** What that something is. */
  weapon?: Prop;
  /** A blindfold match: both of them wear one. */
  blindfold?: boolean;
  /** Busted open. */
  bloody?: boolean;
  /** Caught by the pyro. */
  burned?: boolean;
  /** How beaten up, 0-1: the bruises come up as it rises. */
  wear?: number;
  wrestler: Wrestler;
  /** Called with the figure's joints once they exist, and with null when it goes away. */
  onJoints: (joints: Joints | null) => void;
}) {
  const subject = lookSubjectOf(wrestler);
  const look = subject ? assignLook(subject) : null;
  const rig = BODY_RIG[wrestler.gender];
  const geometry = useMemo(() => {
    const left = cuts(rig, "left");
    const right = cuts(rig, "right");
    return {
      left,
      right,
      torso: poly([...left.torsoEdge, ...[...right.torsoEdge].reverse()]),
    };
  }, [rig]);

  // Collected as the refs fire, handed over once the set is complete.
  const parts = useMemo(
    () => ({ current: {} as Record<string, JointEl | null> }),
    [],
  );
  const register = (key: string) => (el: JointEl | null) => {
    parts.current[key] = el;
    const p = parts.current;
    const keys = [
      "waist",
      "l.shoulder",
      "l.elbow",
      "l.hip",
      "l.knee",
      "r.shoulder",
      "r.elbow",
      "r.hip",
      "r.knee",
    ];
    if (keys.every((k) => p[k])) {
      onJoints({
        waist: p.waist!,
        left: {
          shoulder: p["l.shoulder"]!,
          elbow: p["l.elbow"]!,
          hip: p["l.hip"]!,
          knee: p["l.knee"]!,
        },
        right: {
          shoulder: p["r.shoulder"]!,
          elbow: p["r.elbow"]!,
          hip: p["r.hip"]!,
          knee: p["r.knee"]!,
        },
      });
    } else if (el === null && key === "waist") {
      onJoints(null);
    }
  };

  // No base art for this person: nothing to cut joints into.
  if (!look) return <MatchFigure wrestler={wrestler} />;
  const gear = legwearOf(subject!, look);
  const female = wrestler.gender === "f";

  return (
    <div
      className="relative w-full select-none"
      style={{ filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.55))" }}
    >
      <InkFilter />
      {/* Legs first, so the upper body's waist overlaps their top edge. */}
      {/* (A square box the width of the figure, so the legs can be hung at
          a percentage of the WIDTH — `top` on its own would be a percentage
          of the whole figure's height.) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 aspect-square">
        <svg
          viewBox="0 0 100 84"
          className="absolute left-0 w-full overflow-visible"
          style={{ top: "96.5%" }}
          aria-hidden
        >
          <Leg
            side="left"
            skin={look.skinColor}
            gear={gear}
            female={female}
            register={(part, el) => register(`l.${part}`)(el)}
          />
          <Leg
            side="right"
            skin={look.skinColor}
            gear={gear}
            female={female}
            register={(part, el) => register(`r.${part}`)(el)}
          />
          <Pelvis female={female} gear={gear} />
        </svg>
      </div>

      <div
        ref={register("waist")}
        className="relative aspect-square w-full"
        style={{ transformOrigin: "50% 98%", willChange: "transform" }}
      >
        <div className={FILL} style={{ clipPath: geometry.torso }}>
          <ComposedPortrait look={look} alt={wrestler.name} inked />
          {blindfold && (
            <div
              className="absolute rounded-sm bg-neutral-950"
              style={{ left: `${px(rig.cx - rig.head.halfWidth * 1.1)}%`, width: `${px(rig.cx + rig.head.halfWidth * 1.1) - px(rig.cx - rig.head.halfWidth * 1.1)}%`, top: `${py(rig.head.top + rig.head.tall * 0.4)}%`, height: `${py(rig.head.top + rig.head.tall * 0.62) - py(rig.head.top + rig.head.tall * 0.4)}%` }}
            />
          )}
          {(wear >= 0.2 || burned || bloody) && <Damage rig={rig} wear={wear} burned={burned} bloody={bloody} bare={!look.top && !look.outer} face={!wrestler.masked} />}
          {wrestler.photoDataUrl && (
            <img
              src={wrestler.photoDataUrl}
              alt=""
              className="absolute rounded-full border border-black/60 object-cover"
              style={{ left: "38%", top: "13.5%", width: "24%", height: "24%" }}
            />
          )}
        </div>
        <Arm
          look={look}
          cut={geometry.left}
          register={(part, el) => register(`l.${part}`)(el)}
          held={held === "left" && weapon}
        />
        <Arm
          look={look}
          cut={geometry.right}
          register={(part, el) => register(`r.${part}`)(el)}
          held={held === "right" && weapon}
        />
      </div>
      {/* Reserve the legs' height in the layout: they are absolutely placed. */}
      <div style={{ paddingTop: "81%" }} />
    </div>
  );
});
