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
    shoulder: `${px(mx(rig.shoulder[0])).toFixed(2)}% ${py(rig.shoulder[1]).toFixed(2)}%`,
    elbow: `${px(mx(rig.elbow[0])).toFixed(2)}% ${py(rig.elbow[1]).toFixed(2)}%`,
  };
}

const FILL = "absolute inset-0";

function Arm({
  look,
  cut,
  register,
}: {
  look: ComposedLook;
  cut: ReturnType<typeof cuts>;
  register: (part: "shoulder" | "elbow", el: JointEl | null) => void;
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
      </div>
    </div>
  );
}

function Leg({
  side,
  skin,
  trunks,
  register,
}: {
  side: "left" | "right";
  skin: string;
  trunks: string;
  register: (part: "hip" | "knee", el: JointEl | null) => void;
}) {
  // Written for the screen-left leg; `m` mirrors every x for the right one
  // (mirroring the coordinates, not the group, so a rotation still turns
  // the same way on both legs).
  const m = (x: number) => (side === "left" ? x : 100 - x);
  const d = (points: readonly (readonly [number, number])[]) =>
    `M ${points.map(([x, y]) => `${m(x)},${y}`).join(" L ")} Z`;
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
        <path
          d={d([
            [33, 50],
            [46.6, 50],
            [46, 58],
            [33.6, 58],
          ])}
          fill={skin}
        />
        <path
          d={`M ${m(33)},56 L ${m(46.8)},56 L ${m(46)},78 L ${m(46.5)},84 L ${m(26.5)},84 C ${m(26)},80 ${m(29.5)},78.5 ${m(33.8)},78 Z`}
          fill="#15151a"
        />
        <path
          d={d([
            [33, 56],
            [46.8, 56],
            [46.6, 60],
            [33.2, 60],
          ])}
          fill={trunks}
        />
      </g>
      <path
        d={d([
          [30, 14],
          [49.6, 20],
          [47, 47],
          [32.5, 47],
        ])}
        fill={skin}
      />
      <path
        d={d([
          [44, 20],
          [49.6, 20],
          [47, 47],
          [44.5, 47],
        ])}
        fill="#000"
        opacity={0.18}
      />
      {/* The kneepad rides on the thigh and covers the joint. */}
      <ellipse cx={m(39.8)} cy={47} rx={8.6} ry={7} fill="#1c1c22" />
    </g>
  );
}

export const ArticulatedFigure = memo(function ArticulatedFigure({
  wrestler,
  onJoints,
}: {
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
  const trunks = look.waistband?.color ?? look.top?.color ?? "#1d1d24";
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
            trunks={trunks}
            register={(part, el) => register(`l.${part}`)(el)}
          />
          <Leg
            side="right"
            skin={look.skinColor}
            trunks={trunks}
            register={(part, el) => register(`r.${part}`)(el)}
          />
          <path
            d={
              female
                ? "M 32.5,0 L 67.5,0 L 70.5,14 L 54,23 L 50,18 L 46,23 L 29.5,14 Z"
                : "M 31.5,0 L 68.5,0 L 70.5,16 L 52.5,24 L 50,20 L 47.5,24 L 29.5,16 Z"
            }
            fill={trunks}
          />
          <path
            d="M 32,0 L 68,0 L 68.4,4 L 31.6,4 Z"
            fill="#000"
            opacity={0.25}
          />
        </svg>
      </div>

      <div
        ref={register("waist")}
        className="relative aspect-square w-full"
        style={{ transformOrigin: "50% 98%", willChange: "transform" }}
      >
        <div className={FILL} style={{ clipPath: geometry.torso }}>
          <ComposedPortrait look={look} alt={wrestler.name} />
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
        />
        <Arm
          look={look}
          cut={geometry.right}
          register={(part, el) => register(`r.${part}`)(el)}
        />
      </div>
      {/* Reserve the legs' height in the layout: they are absolutely placed. */}
      <div style={{ paddingTop: "81%" }} />
    </div>
  );
});
