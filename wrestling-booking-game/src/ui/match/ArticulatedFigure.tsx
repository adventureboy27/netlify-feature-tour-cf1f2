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
import { ComposedPortrait } from "../paperdoll/ComposedPortrait";
import { BODY_RIG, LEG_RIG, type BodyRig } from "./rig";
import { MatchFigure } from "./MatchFigure";
import { Pelvis, Shin, Thigh, legwearOf, type Legwear } from "./legwear";
import type { Weapon } from "./choreography";
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
  held?: Weapon | false;
}) {
  return (
    <div
      ref={(el) => register("shoulder", el)}
      className={FILL}
      style={{ transformOrigin: cut.shoulder, willChange: "transform" }}
    >
      <div className={FILL} style={{ clipPath: cut.upper }}>
        <ComposedPortrait look={look} alt="" />
      </div>
      <div
        ref={(el) => register("elbow", el)}
        className={FILL}
        style={{ transformOrigin: cut.elbow, willChange: "transform" }}
      >
        <div className={FILL} style={{ clipPath: cut.fore }}>
          <ComposedPortrait look={look} alt="" />
        </div>
        {held === "chair" && <Chair at={cut.hand} />}
        {held === "kendo" && <Kendo at={cut.hand} />}
        {held === "can" && <TrashCan at={cut.hand} />}
      </div>
    </div>
  );
}

function Leg({
  side,
  skin,
  gear,
  register,
}: {
  side: "left" | "right";
  skin: string;
  gear: Legwear;
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
        <Shin m={m} skin={skin} gear={gear} />
      </g>
      <Thigh m={m} skin={skin} gear={gear} />
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
}: {
  /** Which SCREEN-side hand has something in it, if either. */
  held?: 'left' | 'right';
  /** What that something is. */
  weapon?: Weapon;
  /** A blindfold match: both of them wear one. */
  blindfold?: boolean;
  /** Busted open. */
  bloody?: boolean;
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
            register={(part, el) => register(`l.${part}`)(el)}
          />
          <Leg
            side="right"
            skin={look.skinColor}
            gear={gear}
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
          <ComposedPortrait look={look} alt={wrestler.name} />
          {blindfold && (
            <div
              className="absolute rounded-sm bg-neutral-950"
              style={{ left: `${px(rig.cx - rig.head.halfWidth * 1.1)}%`, width: `${px(rig.cx + rig.head.halfWidth * 1.1) - px(rig.cx - rig.head.halfWidth * 1.1)}%`, top: `${py(rig.head.top + rig.head.tall * 0.4)}%`, height: `${py(rig.head.top + rig.head.tall * 0.62) - py(rig.head.top + rig.head.tall * 0.4)}%` }}
            />
          )}
          {bloody && (
            <div
              className="absolute"
              style={{
                left: `${px(rig.cx + rig.head.halfWidth * 0.05)}%`,
                width: `${px(rig.cx + rig.head.halfWidth * 0.75) - px(rig.cx + rig.head.halfWidth * 0.05)}%`,
                top: `${py(rig.head.top + rig.head.tall * 0.16)}%`,
                height: `${py(rig.head.top + rig.head.tall * 0.86) - py(rig.head.top + rig.head.tall * 0.16)}%`,
                background: 'linear-gradient(to bottom, #a30d0d, #c01515 55%, rgba(170,15,15,0.55))',
                clipPath: 'polygon(20% 0, 70% 4%, 60% 30%, 90% 48%, 62% 62%, 80% 100%, 46% 82%, 30% 100%, 34% 56%, 6% 40%, 34% 26%)',
              }}
            />
          )}
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
