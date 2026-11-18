// The building the match happens in: a dark arena, a crowd, a lighting rig,
// and a ring seen from the hard-camera side. Drawn in two layers so the
// wrestlers stand inside the ring rather than in front of a picture of one:
// everything further from the camera than the line they stand on goes
// behind them (the far ropes, the far half of each side rope, the platform),
// and everything nearer goes over them (the near half of each side rope, the
// front ropes, the front posts). The front layer sits above every wrestler
// in the ring and below anybody fighting on the floor in front of it.
//
// The ring is a platform bigger than its ropes: an apron about a foot and a
// half wide runs round the outside, at the height of the mat. That is where
// a tag partner stands, with the ropes between them and the ring.
//
// All coordinates are in one 1200x600 space shared with MatchStage.tsx; the
// stage is always exactly 2:1, so a point here maps to the same point there.

import { memo, useMemo } from 'react';
import { RING } from './ringPhysics';
import './match.css';

export const VIEW = { w: 1200, h: 600 } as const;
/** The line the wrestlers' feet stand on, mid-depth on the mat. */
export const FEET_Y = 418;
const MAT = { backY: 372, frontY: 452, backL: 350, backR: 850, frontL: 250, frontR: 950 } as const;
const ROPES_BACK = [244, 284, 324] as const;
const ROPES_FRONT = [297, 342, 387] as const;
const ROPE = '#e9e9ec';

// ---- where the ring is, in the picture ------------------------------------
/** Stage units to picture units, at the line the wrestlers stand on. */
const UNIT = VIEW.w / 100;
/** How far from the back of the mat to the front the wrestlers' line runs. */
const PLANE = (FEET_Y - MAT.backY) / (MAT.frontY - MAT.backY);
/** Where the side ropes cross that line: the ropes a body actually meets. */
const CROSS_X = { l: MAT.backL + (MAT.frontL - MAT.backL) * PLANE, r: MAT.backR + (MAT.frontR - MAT.backR) * PLANE } as const;
const CROSS_Y = ROPES_BACK.map((y, i) => y + (ROPES_FRONT[i]! - y) * PLANE);
/** The point the ring's sides run toward: everything on the floor scales about it. */
const VANISH_Y = MAT.backY + ((VIEW.w / 2 - MAT.backL) * (MAT.frontY - MAT.backY)) / (MAT.frontL - MAT.backL);
const scaleAt = (y: number) => (y - VANISH_Y) / (FEET_Y - VANISH_Y);
/** The apron's depth past the back and front ropes, in picture units: the same width as at the sides. */
const APRON_DEPTH = (RING.apron * (MAT.frontY - MAT.backY)) / (RING.half * 2);
const platformX = (side: -1 | 1, y: number) => VIEW.w / 2 + side * (RING.half + RING.apron) * UNIT * scaleAt(y);
/** The whole platform: canvas inside the ropes, and the apron round it. */
const PLATFORM = (() => {
  const backY = MAT.backY - APRON_DEPTH;
  const frontY = MAT.frontY + APRON_DEPTH;
  return { backY, frontY, backL: platformX(-1, backY), backR: platformX(1, backY), frontL: platformX(-1, frontY), frontR: platformX(1, frontY) };
})();
/** The bottom of the skirt hanging off the front of the platform. */
const SKIRT_BOTTOM = PLATFORM.frontY + 86;
/** Where the ring steps stand on the floor in front of the near left corner, in stage units. */
export const STEPS_X = (PLATFORM.frontL - 40 - VIEW.w / 2) / UNIT;

/** The four runs of side rope that give when somebody hits them: far and near half, left and right. */
export type SideRopeKey = 'backL' | 'backR' | 'frontL' | 'frontR';
/** Where each run is tied to its post: it stretches away from there. */
export const SIDE_ROPE_POST: Record<SideRopeKey, number> = { backL: MAT.backL, backR: MAT.backR, frontL: MAT.frontL, frontR: MAT.frontR };
/** Where the side ropes cross the wrestlers' line, left and right. */
export const ROPE_CROSS_X = CROSS_X;

/** One side's run of three ropes, from its post to where they cross the wrestlers' line. */
function SideRun({ run, onRef }: { run: SideRopeKey; onRef?: (key: SideRopeKey, el: SVGGElement | null) => void }) {
  const back = run === 'backL' || run === 'backR';
  const left = run === 'backL' || run === 'frontL';
  const postX = SIDE_ROPE_POST[run];
  const crossX = left ? CROSS_X.l : CROSS_X.r;
  return (
    <g
      ref={(el) => onRef?.(run, el)}
      stroke={ROPE}
      strokeWidth={back ? 3 : 3.6}
      strokeLinecap="round"
      opacity={back ? 0.8 : 0.95}
      style={{ transformOrigin: `${postX}px 0px`, transformBox: 'view-box' }}
    >
      {ROPES_BACK.map((y, i) => (
        <line key={y} x1={postX} y1={back ? y : ROPES_FRONT[i]} x2={crossX} y2={CROSS_Y[i]} />
      ))}
    </g>
  );
}

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

function Crowd() {
  const rows = useMemo(() => {
    const rnd = seeded(11);
    const spec = [
      { y: 222, r: 7.5, gap: 20, light: 8 },
      { y: 252, r: 9, gap: 24, light: 10 },
      { y: 285, r: 10.5, gap: 28, light: 12 },
      { y: 320, r: 12.5, gap: 33, light: 15 },
    ];
    return spec.map((row, k) => {
      const people = [];
      for (let x = -10 + rnd() * row.gap; x < VIEW.w + 10; x += row.gap * (0.85 + rnd() * 0.3)) {
        const y = row.y + (rnd() - 0.5) * 6;
        people.push({ x, y, l: row.light + rnd() * 5, hue: 215 + rnd() * 30, armsUp: rnd() < 0.14, sign: rnd() < 0.035 });
      }
      return { ...row, k, people };
    });
  }, []);
  return (
    <>
      {rows.map((row) => (
        <g key={row.k} className={`mv-crowd mv-crowd-${row.k}`}>
          {row.people.map((p, i) => {
            const fill = `hsl(${p.hue}, 12%, ${p.l}%)`;
            return (
              <g key={i} fill={fill} stroke={fill}>
                <ellipse cx={p.x} cy={p.y + row.r * 2.3} rx={row.r * 1.5} ry={row.r * 1.5} stroke="none" />
                <circle cx={p.x} cy={p.y} r={row.r} stroke="none" />
                {p.armsUp && (
                  <path
                    d={`M ${p.x - row.r * 1.2},${p.y + row.r * 1.4} L ${p.x - row.r * 1.9},${p.y - row.r * 1.6} M ${p.x + row.r * 1.2},${p.y + row.r * 1.4} L ${p.x + row.r * 1.9},${p.y - row.r * 1.6}`}
                    strokeWidth={row.r * 0.55}
                    strokeLinecap="round"
                    fill="none"
                  />
                )}
                {p.sign && (
                  <rect x={p.x - row.r * 2} y={p.y - row.r * 3.6} width={row.r * 4} height={row.r * 2.4} rx={1.5} fill={`hsl(${p.hue}, 14%, ${p.l + 14}%)`} stroke="none" />
                )}
              </g>
            );
          })}
        </g>
      ))}
    </>
  );
}

function Flashes() {
  const dots = useMemo(() => {
    const rnd = seeded(5);
    return Array.from({ length: 22 }, () => ({ x: 20 + rnd() * 1160, y: 210 + rnd() * 120, delay: -rnd() * 6, r: 2 + rnd() * 2.5 }));
  }, []);
  return (
    <>
      {dots.map((d, i) => (
        <circle key={i} className="mv-flash" cx={d.x} cy={d.y} r={d.r} fill="#ffffff" style={{ animationDelay: `${d.delay}s` }} />
      ))}
    </>
  );
}

const GOLD = '#f2c94c';

/** The company in a corner, on a night with more than one company in the building. */
export interface Corner {
  name: string;
  accent: string;
}

/** A name broken over up to three lines, for a banner that is taller than it is wide. */
function wrapName(name: string): string[] {
  const words = name.split(/\s+/);
  if (words.length <= 3) return words;
  const per = Math.ceil(words.length / 3);
  return [words.slice(0, per).join(' '), words.slice(per, per * 2).join(' '), words.slice(per * 2).join(' ')].filter(Boolean);
}

const LAMPS = [150, 380, 600, 820, 1050] as const;

/** Everything behind the wrestlers. */
export const ArenaBack = memo(function ArenaBack({
  accent,
  name,
  hype,
  showName,
  cage = false,
  corners,
  eventName,
  noRing = false,
  stepsGone = false,
  onSideRope,
}: {
  /** Somebody has taken the steel steps off the corner: they are not there any more. */
  stepsGone?: boolean;
  /** Hands over the far halves of the side ropes, so a body hitting them can make them give. */
  onSideRope?: (key: SideRopeKey, el: SVGGElement | null) => void;
  /** An arena-floor match: no ring is drawn at all. */
  noRing?: boolean;
  /** More than one company in the building: each has a corner, and half the ring. */
  corners?: readonly [Corner, Corner];
  /** What the night is called, for the big screen, when it is not an ordinary show. */
  eventName?: string;
  /** A steel cage match: walls round the ring. This draws the far ones. */
  cage?: boolean;
  accent: string;
  name: string;
  /** The crowd is on its feet — a big move just landed. */
  hype: boolean;
  /** Put the promotion's name on the big screen (off while a callout is using it). */
  showName: boolean;
}) {
  return (
    <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className={`absolute inset-0 h-full w-full ${hype ? 'mv-hype' : ''}`} aria-hidden>
      <defs>
        <radialGradient id="mv-bg" cx="50%" cy="62%" r="75%">
          <stop offset="0%" stopColor="#1b2030" />
          <stop offset="55%" stopColor="#0c0e16" />
          <stop offset="100%" stopColor="#040507" />
        </radialGradient>
        <linearGradient id="mv-cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mv-mat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b9bec9" />
          <stop offset="100%" stopColor="#dfe2e8" />
        </linearGradient>
        <linearGradient id="mv-apron" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} />
          <stop offset="100%" stopColor="#0a0a0d" />
        </linearGradient>
        <linearGradient id="mv-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#171a21" />
          <stop offset="100%" stopColor="#06070a" />
        </linearGradient>
        <linearGradient id="mv-banner" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
        </linearGradient>
        {corners?.map((corner, n) => (
          <linearGradient key={n} id={`mv-apron-${n}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={corner.accent} />
            <stop offset="100%" stopColor="#0a0a0d" />
          </linearGradient>
        ))}
        <pattern id="mv-mesh" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M 0,0 L 16,16 M 16,0 L 0,16" stroke="#aeb6c4" strokeWidth={1.1} opacity={0.55} />
        </pattern>
        <radialGradient id="mv-pool" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={VIEW.w} height={VIEW.h} fill="url(#mv-bg)" />

      {/* The big screen over the entrance. */}
      <rect x={430} y={30} width={340} height={118} rx={6} fill="#07080c" stroke={accent} strokeOpacity={0.7} strokeWidth={2} />
      <rect x={438} y={38} width={324} height={102} rx={3} fill={accent} opacity={0.14} />
      {showName && !corners && (
        <text x={600} y={97} textAnchor="middle" fontSize={24} fontWeight={800} letterSpacing={2} fill={accent} opacity={0.75} style={{ textTransform: 'uppercase' }}>
          {name.length > 22 ? name.split(/\s+/).map((w) => w[0]).join('') : name}
        </text>
      )}
      {corners && (
        <g>
          {/* Both companies' colours on the screen, and a banner each side of it. */}
          <polygon points="438,38 620,38 580,140 438,140" fill={corners[0].accent} opacity={0.3} />
          <polygon points="620,38 762,38 762,140 580,140" fill={corners[1].accent} opacity={0.3} />
          <rect x={430} y={30} width={340} height={118} rx={6} fill="none" stroke={GOLD} strokeWidth={3} />
          {showName && (
            <text x={600} y={99} textAnchor="middle" fontSize={eventName && eventName.length > 16 ? 22 : 30} fontWeight={900} fontStyle="italic" letterSpacing={2} fill={GOLD} style={{ textTransform: 'uppercase' }}>
              {eventName ?? 'Supershow'}
            </text>
          )}
          {corners.map((corner, n) => {
            const x = n === 0 ? 300 : 900;
            return (
              <g key={n}>
                <rect x={x - 62} y={27} width={124} height={4} fill="#3a3f4a" />
                <polygon points={`${x - 56},31 ${x + 56},31 ${x + 56},176 ${x},196 ${x - 56},176`} fill={corner.accent} />
                <polygon points={`${x - 56},31 ${x + 56},31 ${x + 56},176 ${x},196 ${x - 56},176`} fill="url(#mv-banner)" />
                <polygon points={`${x - 48},39 ${x + 48},39 ${x + 48},170 ${x},187 ${x - 48},170`} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={2} />
                {wrapName(corner.name).map((line, i, all) => (
                  <text key={i} x={x} y={108 + (i - (all.length - 1) / 2) * 22} textAnchor="middle" fontSize={Math.min(20, 150 / Math.max(6, line.length))} fontWeight={900} fill="#fff" style={{ textTransform: 'uppercase' }}>
                    {line}
                  </text>
                ))}
              </g>
            );
          })}
        </g>
      )}

      {/* Lighting rig, and the beams off it. */}
      <rect x={0} y={14} width={VIEW.w} height={5} fill="#1d2027" />
      <rect x={0} y={24} width={VIEW.w} height={3} fill="#15171d" />
      {LAMPS.map((x, i) => (
        <g key={x}>
          <polygon
            className="mv-cone"
            points={`${x - 9},26 ${x + 9},26 ${x + 150},600 ${x - 150},600`}
            fill="url(#mv-cone)"
            style={{ transformOrigin: `${x}px 26px`, animationDelay: `${-i * 1.7}s`, animationDuration: `${6 + i}s` }}
          />
          <rect x={x - 11} y={18} width={22} height={11} rx={2} fill="#2a2e38" />
          <circle cx={x} cy={29} r={5} fill="#fff7dc" />
        </g>
      ))}

      <Crowd />
      <Flashes />

      {/* Barricade. */}
      <rect x={0} y={336} width={VIEW.w} height={46} fill="#0b0c10" />
      <rect x={0} y={336} width={VIEW.w} height={4} fill={accent} opacity={0.55} />
      {Array.from({ length: 13 }, (_, i) => (
        <rect key={i} x={i * 100 - 2} y={336} width={4} height={46} fill="#16181e" />
      ))}

      {/* Floor, and the pool of light the ring sits in. */}
      <rect x={0} y={380} width={VIEW.w} height={220} fill="url(#mv-floor)" />
      <ellipse cx={600} cy={500} rx={520} ry={95} fill="url(#mv-pool)" opacity={0.16} />
      <ellipse cx={600} cy={546} rx={400} ry={20} fill="#000" opacity={0.55} />

      {noRing ? (
        <g>
          {/* No ring: bare concrete, a painted mark where one would stand, and the barricade pulled in close on both sides. */}
          <ellipse cx={600} cy={408} rx={372} ry={62} fill="#2a2d35" />
          <ellipse cx={600} cy={408} rx={372} ry={62} fill="none" stroke={accent} strokeOpacity={0.45} strokeWidth={4} strokeDasharray="18 14" />
          <path d="M 380,392 L 470,408 M 700,432 L 800,414 M 540,448 L 600,436" stroke="#15171c" strokeWidth={3} strokeLinecap="round" />
          {[218, 982].map((x) => (
            <g key={x}>
              <rect x={x - 26} y={318} width={52} height={104} rx={3} fill="#0e0f13" stroke="#2b2f38" strokeWidth={2} />
              <rect x={x - 26} y={318} width={52} height={6} fill={accent} opacity={0.6} />
              <path d={`M ${x - 14},332 L ${x - 14},416 M ${x},332 L ${x},416 M ${x + 14},332 L ${x + 14},416`} stroke="#23262e" strokeWidth={3} />
            </g>
          ))}
        </g>
      ) : (
        <g>
      {/* Ring steps, up to the apron at the near left corner. */}
      {!stepsGone && <>
      <polygon points={`${PLATFORM.frontL - 80},${SKIRT_BOTTOM - 4} ${PLATFORM.frontL + 2},${SKIRT_BOTTOM - 4} ${PLATFORM.frontL + 2},${PLATFORM.frontY + 10} ${PLATFORM.frontL - 34},${PLATFORM.frontY + 10} ${PLATFORM.frontL - 34},${PLATFORM.frontY + 40} ${PLATFORM.frontL - 80},${PLATFORM.frontY + 40}`} fill="#3a3f4a" />
      <polygon points={`${PLATFORM.frontL - 80},${PLATFORM.frontY + 40} ${PLATFORM.frontL - 34},${PLATFORM.frontY + 40} ${PLATFORM.frontL - 34},${PLATFORM.frontY + 10} ${PLATFORM.frontL + 2},${PLATFORM.frontY + 10} ${PLATFORM.frontL + 2},${PLATFORM.frontY + 16} ${PLATFORM.frontL - 28},${PLATFORM.frontY + 16} ${PLATFORM.frontL - 28},${PLATFORM.frontY + 46} ${PLATFORM.frontL - 80},${PLATFORM.frontY + 46}`} fill="#565c69" />
      </>}

      {/* The platform: the apron all round, then the canvas inside the ropes. */}
      <polygon points={`${PLATFORM.backL},${PLATFORM.backY} ${PLATFORM.backR},${PLATFORM.backY} ${PLATFORM.frontR},${PLATFORM.frontY} ${PLATFORM.frontL},${PLATFORM.frontY}`} fill="#8e95a3" />
      <polygon points={`${PLATFORM.backL},${PLATFORM.backY} ${PLATFORM.backR},${PLATFORM.backY} ${PLATFORM.frontR},${PLATFORM.frontY} ${PLATFORM.frontL},${PLATFORM.frontY}`} fill="none" stroke={corners ? GOLD : accent} strokeOpacity={0.55} strokeWidth={2.5} />
      <polygon points={`${MAT.backL},${MAT.backY} ${MAT.backR},${MAT.backY} ${MAT.frontR},${MAT.frontY} ${MAT.frontL},${MAT.frontY}`} fill="url(#mv-mat)" />
      {/* Where the canvas turns down under the ropes to the apron: a crease, not a wall. */}
      <polygon points={`${MAT.backL},${MAT.backY} ${MAT.backR},${MAT.backY} ${MAT.frontR},${MAT.frontY} ${MAT.frontL},${MAT.frontY}`} fill="none" stroke="#000" strokeOpacity={0.22} strokeWidth={2} />
      <ellipse cx={600} cy={412} rx={92} ry={20} fill="none" stroke={corners ? GOLD : accent} strokeWidth={5} opacity={corners ? 0.6 : 0.35} />
      <ellipse cx={600} cy={412} rx={58} ry={12} fill={corners ? GOLD : accent} opacity={0.22} />
      {corners ? (
        <g>
          {/* The skirt is split down a slant: one company's half, and the other's. */}
          <polygon points={`${PLATFORM.frontL},${PLATFORM.frontY} 624,${PLATFORM.frontY} 576,${SKIRT_BOTTOM} ${PLATFORM.frontL},${SKIRT_BOTTOM}`} fill="url(#mv-apron-0)" />
          <polygon points={`624,${PLATFORM.frontY} ${PLATFORM.frontR},${PLATFORM.frontY} ${PLATFORM.frontR},${SKIRT_BOTTOM} 576,${SKIRT_BOTTOM}`} fill="url(#mv-apron-1)" />
          <polygon points={`616,${PLATFORM.frontY} 632,${PLATFORM.frontY} 584,${SKIRT_BOTTOM} 568,${SKIRT_BOTTOM}`} fill={GOLD} />
        </g>
      ) : (
        <polygon points={`${PLATFORM.frontL},${PLATFORM.frontY} ${PLATFORM.frontR},${PLATFORM.frontY} ${PLATFORM.frontR},${SKIRT_BOTTOM} ${PLATFORM.frontL},${SKIRT_BOTTOM}`} fill="url(#mv-apron)" />
      )}
      <rect x={PLATFORM.frontL} y={PLATFORM.frontY} width={PLATFORM.frontR - PLATFORM.frontL} height={5} fill="#ffffff" opacity={0.35} />

      {/* Back posts, back ropes, and the far half of each side run: all of it further from the camera than anybody in the ring. */}
      {[MAT.backL, MAT.backR].map((x) => (
        <rect key={x} x={x - 6} y={232} width={12} height={MAT.backY - 232} fill="#2b2f38" />
      ))}
      {ROPES_BACK.map((y) => (
        <line key={y} x1={MAT.backL} y1={y} x2={MAT.backR} y2={y} stroke={ROPE} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
      ))}
      <SideRun run="backL" onRef={onSideRope} />
      <SideRun run="backR" onRef={onSideRope} />
      {[MAT.backL, MAT.backR].map((x) =>
        ROPES_BACK.map((y) => <rect key={`${x}-${y}`} x={x - 9} y={y - 7} width={18} height={14} rx={4} fill={corners ? corners[x === MAT.backL ? 0 : 1].accent : accent} />),
      )}

      {cage && (
        <g>
          <polygon points={`${MAT.backL},150 ${MAT.backR},150 ${MAT.backR},${MAT.backY} ${MAT.backL},${MAT.backY}`} fill="url(#mv-mesh)" />
          <polygon points={`${MAT.backL},150 ${MAT.frontL},176 ${MAT.frontL},${MAT.frontY} ${MAT.backL},${MAT.backY}`} fill="url(#mv-mesh)" />
          <polygon points={`${MAT.backR},150 ${MAT.frontR},176 ${MAT.frontR},${MAT.frontY} ${MAT.backR},${MAT.backY}`} fill="url(#mv-mesh)" />
          <path d={`M ${MAT.backL},150 L ${MAT.backR},150 M ${MAT.backL},150 L ${MAT.backL},${MAT.backY} M ${MAT.backR},150 L ${MAT.backR},${MAT.backY} M ${MAT.backL},150 L ${MAT.frontL},176 M ${MAT.backR},150 L ${MAT.frontR},176`} stroke="#6f7888" strokeWidth={4} fill="none" />
        </g>
      )}
        </g>
      )}
    </svg>
  );
});

/** The front ropes and posts — drawn over the wrestlers, who stand behind them. */
/**
 * Everything nearer the camera than the wrestlers' line: the near half of each
 * side rope, the front ropes, the front posts, and a cage's near wall. Drawn
 * over everybody in the ring and on the apron, and under anybody fighting on
 * the floor in front of the ring (MatchStage puts those higher still).
 */
export const ArenaFront = memo(function ArenaFront({
  ropesRef,
  cage = false,
  noRing = false,
  accent,
  corners,
  onSideRope,
}: {
  noRing?: boolean;
  ropesRef: React.Ref<SVGGElement>;
  /** The near wall of a cage, between the camera and the wrestlers. */
  cage?: boolean;
  accent: string;
  corners?: readonly [Corner, Corner];
  onSideRope?: (key: SideRopeKey, el: SVGGElement | null) => void;
}) {
  return (
    <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 10 }} aria-hidden>
      {!noRing && (
        <g>
          <SideRun run="frontL" onRef={onSideRope} />
          <SideRun run="frontR" onRef={onSideRope} />
          <g ref={ropesRef}>
            {ROPES_FRONT.map((y) => (
              <g key={y} strokeLinecap="round">
                <line x1={MAT.frontL} y1={y + 1.5} x2={MAT.frontR} y2={y + 1.5} stroke="#000" strokeWidth={6} opacity={0.3} />
                <line x1={MAT.frontL} y1={y} x2={MAT.frontR} y2={y} stroke={ROPE} strokeWidth={4} />
              </g>
            ))}
          </g>
          {[MAT.frontL, MAT.frontR].map((x) => (
            <g key={x}>
              <rect x={x - 7} y={286} width={14} height={MAT.frontY - 286 + 6} fill="#343944" />
              <rect x={x - 7} y={286} width={5} height={MAT.frontY - 286 + 6} fill="#4c5260" />
              {ROPES_FRONT.map((y) => (
                <rect key={y} x={x - 11} y={y - 9} width={22} height={18} rx={5} fill={corners ? corners[x === MAT.frontL ? 0 : 1].accent : accent} stroke="#000" strokeOpacity={0.35} />
              ))}
            </g>
          ))}
        </g>
      )}
      {cage && (
        <g>
          <defs>
            <pattern id="mv-mesh-front" width="18" height="18" patternUnits="userSpaceOnUse">
              <path d="M 0,0 L 18,18 M 18,0 L 0,18" stroke="#c3cad6" strokeWidth={1.2} opacity={0.5} />
            </pattern>
          </defs>
          <rect x={MAT.frontL} y={176} width={MAT.frontR - MAT.frontL} height={MAT.frontY - 176} fill="url(#mv-mesh-front)" />
          <rect x={MAT.frontL} y={176} width={MAT.frontR - MAT.frontL} height={MAT.frontY - 176} fill="none" stroke="#7b8494" strokeWidth={5} />
        </g>
      )}
    </svg>
  );
});
