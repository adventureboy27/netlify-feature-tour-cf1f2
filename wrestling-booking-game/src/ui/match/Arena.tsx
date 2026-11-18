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
import { Entrance, HouseLights, NoScreen, Room, SoundStacks } from './Venue';
import { FULL_PRODUCTION, type Setting } from './setting';
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

/**
 * The crowd. Everybody sways; a big moment has them on their feet. Most of
 * them also react to what the room thinks (`mood`, MatchStage): arms up for
 * somebody they are behind, thumbs down at somebody they are not, hands on
 * heads at a two-count — and, split, some of each. A few in the front row
 * hold signs about the people in this match.
 */
/** How many rows, and how far back they go, for each kind of room. */
const CROWD_ROWS: Record<Setting['family'], readonly { y: number; r: number; gap: number; light: number; signs: number }[]> = {
  arena: [
    { y: 222, r: 7.5, gap: 20, light: 8, signs: 0.035 },
    { y: 252, r: 9, gap: 24, light: 10, signs: 0.035 },
    { y: 285, r: 10.5, gap: 28, light: 12, signs: 0.035 },
    { y: 320, r: 12.5, gap: 33, light: 15, signs: 0.13 },
  ],
  stadium: [
    { y: 168, r: 5, gap: 13, light: 6, signs: 0 },
    { y: 194, r: 6.2, gap: 16, light: 7, signs: 0.02 },
    { y: 222, r: 7.5, gap: 20, light: 8, signs: 0.035 },
    { y: 252, r: 9, gap: 24, light: 10, signs: 0.035 },
    { y: 285, r: 10.5, gap: 28, light: 12, signs: 0.035 },
    { y: 320, r: 12.5, gap: 33, light: 15, signs: 0.13 },
  ],
  theatre: [
    { y: 252, r: 9, gap: 24, light: 10, signs: 0.02 },
    { y: 285, r: 10.5, gap: 28, light: 12, signs: 0.03 },
    { y: 320, r: 12.5, gap: 33, light: 15, signs: 0.13 },
  ],
  club: [
    { y: 270, r: 10, gap: 30, light: 10, signs: 0.03 },
    { y: 315, r: 12.5, gap: 36, light: 14, signs: 0.13 },
  ],
  hall: [
    { y: 270, r: 10, gap: 30, light: 32, signs: 0.03 },
    { y: 315, r: 12.5, gap: 36, light: 36, signs: 0.13 },
  ],
  gym: [
    { y: 234, r: 8.5, gap: 24, light: 36, signs: 0.03 },
    { y: 262, r: 9.5, gap: 27, light: 38, signs: 0.03 },
    { y: 292, r: 10.5, gap: 30, light: 40, signs: 0.04 },
    { y: 322, r: 12, gap: 34, light: 42, signs: 0.13 },
  ],
  openAir: [
    { y: 230, r: 8, gap: 22, light: 14, signs: 0.03 },
    { y: 258, r: 9, gap: 25, light: 16, signs: 0.03 },
    { y: 288, r: 10.5, gap: 29, light: 18, signs: 0.04 },
    { y: 318, r: 12, gap: 33, light: 20, signs: 0.13 },
  ],
  backyard: [{ y: 318, r: 12.5, gap: 42, light: 22, signs: 0.13 }],
};

const Crowd = memo(function Crowd({ signs = [], family = 'arena', fill = 0.9 }: { signs?: readonly string[]; family?: Setting['family']; fill?: number }) {
  // In a room with the house lights on the crowd are people in shirts, not
  // silhouettes in the dark.
  const lit = family === 'gym' || family === 'hall';
  const rows = useMemo(() => {
    const rnd = seeded(11);
    const who = seeded(23);
    const spec = CROWD_ROWS[family];
    return spec.map((row, k) => {
      const people = [];
      const empty: { x: number; y: number; r: number }[] = [];
      for (let x = -10 + rnd() * row.gap; x < VIEW.w + 10; x += row.gap * (0.85 + rnd() * 0.3)) {
        const y = row.y + (rnd() - 0.5) * 6;
        const hueSeed = rnd();
        const person = { x, y, l: row.light + rnd() * 5, hue: lit ? hueSeed * 360 : 215 + hueSeed * 30, armsUp: rnd() < 0.14, sign: rnd() < row.signs, reacts: rnd() < 0.72, fan: rnd() < 0.55, thumbs: rnd() < 0.6 };
        // As full as the night was: an empty seat where nobody bought one.
        // (The front row fills first.)
        const here = who() < Math.min(1, fill * (k === spec.length - 1 ? 1.4 : 1));
        if (here) people.push(person);
        else if (lit || family === 'theatre' || family === 'club') empty.push({ x, y, r: row.r });
      }
      return { ...row, k, people, empty };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family, Math.round(fill * 20)]);
  let signAt = 0;
  let signClear = -Infinity;
  return (
    <>
      {rows.map((row) => {
        signClear = -Infinity;
        return (
        <g key={row.k} className={`mv-crowd mv-crowd-${row.k}`}>
          {/* Seats nobody sat in. */}
          {row.empty.map((e, i) => (
            <path key={`e${i}`} d={`M ${e.x - e.r},${e.y + e.r * 0.6} L ${e.x + e.r},${e.y + e.r * 0.6} L ${e.x + e.r * 0.9},${e.y + e.r * 2} M ${e.x - e.r},${e.y + e.r * 0.6} L ${e.x - e.r},${e.y - e.r * 0.6} L ${e.x + e.r},${e.y - e.r * 0.6} L ${e.x + e.r},${e.y + e.r * 0.6} M ${e.x - e.r * 0.9},${e.y + e.r * 0.6} L ${e.x - e.r},${e.y + e.r * 3}`} stroke={lit ? '#5c626c' : '#2a2c33'} strokeWidth={e.r * 0.25} fill="none" />
          ))}
          {row.people.map((p, i) => {
            const colour = `hsl(${p.hue}, ${lit ? 34 : 12}%, ${p.l}%)`;
            const r = row.r;
            const sx = p.x;
            const sy = p.y;
            const arm = { strokeWidth: r * 0.55, strokeLinecap: 'round' as const, fill: 'none' };
            // Arms thrown up (or out) catch the light: a shade lighter and
            // thicker than the body, so a reacting crowd reads from the back.
            const litArm = { ...arm, strokeWidth: r * 0.7, stroke: `hsl(${p.hue}, 16%, ${p.l + 16}%)` };
            const up = `M ${sx - r * 1.2},${sy + r * 1.4} L ${sx - r * 1.9},${sy - r * 1.6} M ${sx + r * 1.2},${sy + r * 1.4} L ${sx + r * 1.9},${sy - r * 1.6}`;
            // An arm thrust up and out at the ring, thumb turned down — one side or the other.
            const side = p.thumbs ? 1 : -1;
            const down = `M ${sx + side * r * 1.2},${sy + r * 1.4} L ${sx + side * r * 2.4},${sy - r * 0.9} M ${sx + side * r * 2.4},${sy - r * 0.9} L ${sx + side * r * 2.5},${sy + r * 0.1}`;
            const head = `M ${sx - r * 1.2},${sy + r * 1.4} L ${sx - r * 1.4},${sy - r * 0.4} L ${sx - r * 0.5},${sy - r * 1.05} M ${sx + r * 1.2},${sy + r * 1.4} L ${sx + r * 1.4},${sy - r * 0.4} L ${sx + r * 0.5},${sy - r * 1.05}`;
            let text = p.sign && row.k === 3 && signs.length > 0 ? signs[signAt % signs.length]! : null;
            const signW = text ? Math.max(r * 4, text.length * r * 0.62) : r * 4;
            // Nobody holds a sign up over the one next to theirs.
            const showSign = p.sign && sx - signW / 2 > signClear;
            if (showSign) signClear = sx + signW / 2 + r;
            else text = null;
            if (text) signAt++;
            return (
              <g key={i} fill={colour} stroke={colour} className={`${p.reacts ? 'mv-r' : ''}${p.fan ? ' mv-fan' : ''}`}>
                <ellipse cx={sx} cy={sy + r * 2.3} rx={r * 1.5} ry={r * 1.5} stroke="none" />
                <circle cx={sx} cy={sy} r={r} stroke="none" />
                {p.armsUp && <path className="mv-p-idle" d={up} {...arm} />}
                {p.reacts && (
                  <>
                    <path className="mv-p mv-p-cheer" d={up} {...litArm} />
                    <path className="mv-p mv-p-boo" d={down} {...litArm} />
                    {/* Fists, for when it is really going: both up and pumping, or one shaking at the ring. */}
                    <g className="mv-p mv-p-fist-cheer" fill={litArm.stroke} stroke="none">
                      <circle cx={sx - r * 1.95} cy={sy - r * 1.75} r={r * 0.55} />
                      <circle cx={sx + r * 1.95} cy={sy - r * 1.75} r={r * 0.55} />
                    </g>
                    <circle className="mv-p mv-p-fist-boo" cx={sx + side * r * 2.4} cy={sy - r * 0.95} r={r * 0.55} fill={litArm.stroke} stroke="none" />
                    <path className="mv-p mv-p-ooh" d={head} {...litArm} />
                  </>
                )}
                {showSign && (
                  <g className={text ? 'mv-sign' : undefined}>
                    <rect x={sx - signW / 2} y={sy - r * 3.6} width={signW} height={r * 2.4} rx={1.5} fill={text ? '#e9e4d6' : `hsl(${p.hue}, 14%, ${p.l + 14}%)`} stroke="none" />
                    {text && (
                      <text x={sx} y={sy - r * 2.05} textAnchor="middle" fontSize={r * 0.95} fontWeight={900} fill="#1d1a16" stroke="none" style={{ fontFamily: 'Impact, Arial Black, sans-serif' }}>
                        {text}
                      </text>
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </g>
        );
      })}
    </>
  );
});

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


/** What the ring is made of, as drawn: the canvas, the apron and its skirt, the ropes, the pads. */
export const RING_LOOK = {
  pro: { platform: '#8e95a3', mat: ['#b9bec9', '#dfe2e8'], skirt: null as string | null, rope: '#e9e9ec', pad: null as string | null },
  // Real mat and ropes, no frills: a plain black skirt, black pads, no logo.
  basic: { platform: '#7f838d', mat: ['#a9adb5', '#cdd0d6'], skirt: '#141519', rope: '#e2e2e2', pad: '#18191d' },
  // Off the trailer: plywood under a tarp, hemp rope, tape for pads.
  plywood: { platform: '#8b6a43', mat: ['#6f7e8f', '#8a99a9'], skirt: '#6e5233', rope: '#b99c6b', pad: '#7b7f87' },
};

const LAMPS = [150, 380, 600, 820, 1050] as const;
/**
 * How each lamp moves and what colour it is: its own sweep (how far, how
 * fast, which way first) and its own run through the colours, so the rig
 * never moves or changes together. Fixed by arithmetic, the same every time.
 */
const LAMP_MOTION = LAMPS.map((_, i) => {
  const frac = (n: number) => n - Math.floor(n);
  const a = frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
  const b = frac(Math.sin(i * 78.233 + 1.7) * 12543.123);
  const c = frac(Math.sin(i * 37.719 + 9.3) * 9631.77);
  return {
    sweep: 7 + a * 11,
    every: 2.8 + b * 4.4,
    delay: -c * 8,
    reverse: a > 0.5,
    hueEvery: 7 + c * 9,
    hueDelay: -b * 16,
  };
});

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
  mood = null,
  moodBig = false,
  starColor,
  signs,
  setting = FULL_PRODUCTION,
  onSideRope,
}: {
  /** The room and what was in it (ui/match/setting.ts). */
  setting?: Setting;
  /** How the room feels right now (see ui/match/crowd.ts). */
  mood?: 'cheer' | 'boo' | 'ooh' | 'mixed' | null;
  /** ...and it is the full building, not a pop. */
  moodBig?: boolean;
  /** A star's moment: every lamp in their colour. */
  starColor?: string;
  /** What the signs in the front row say. */
  signs?: readonly string[];
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
    <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className={`absolute inset-0 h-full w-full ${hype ? 'mv-hype' : ''}${mood ? ` mv-mood mv-mood-${mood}${moodBig ? ' mv-mood-big' : ''}` : ''}${starColor ? ' mv-starlit' : ''}`} aria-hidden>
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
        {/* The lights for the room's big moments: full white when it is
            roaring for somebody, red when it is angry. */}
        <linearGradient id="mv-cone-bright" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff6d8" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#fff6d8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mv-cone-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff2a2a" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ff2a2a" stopOpacity="0" />
        </linearGradient>
        {/* Each lamp's own colour, running through the rig's gels at its own pace. */}
        {LAMP_MOTION.map((m, i) => (
          <linearGradient key={i} id={`mv-cone-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="mv-gel" stopColor="#ffffff" stopOpacity="0.26" style={{ animationDuration: `${m.hueEvery}s`, animationDelay: `${m.hueDelay}s` }} />
            <stop offset="100%" className="mv-gel" stopColor="#ffffff" stopOpacity="0" style={{ animationDuration: `${m.hueEvery}s`, animationDelay: `${m.hueDelay}s` }} />
          </linearGradient>
        ))}
        {starColor && (
          <linearGradient id="mv-cone-star" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={starColor} stopOpacity="0.6" />
            <stop offset="100%" stopColor={starColor} stopOpacity="0" />
          </linearGradient>
        )}
        <linearGradient id="mv-mat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={RING_LOOK[setting.ring].mat[0]} />
          <stop offset="100%" stopColor={RING_LOOK[setting.ring].mat[1]} />
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

      <Room setting={setting} />
      <Entrance setting={setting} accent={accent} />
      <SoundStacks setting={setting} />

      {/* The big screen over the entrance — or, with none, whatever hangs there instead. */}
      {!setting.screen && !corners && <NoScreen setting={setting} name={name} accent={accent} />}
      {(setting.screen || corners) && <rect x={430} y={30} width={340} height={118} rx={6} fill="#07080c" stroke={accent} strokeOpacity={0.7} strokeWidth={2} />}
      {(setting.screen || corners) && <rect x={438} y={38} width={324} height={102} rx={3} fill={accent} opacity={0.14} />}
      {showName && !corners && setting.screen && (
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

      {/* Lighting rig, and the beams off it — or the house lights, with no rig. */}
      <HouseLights setting={setting} />
      {setting.lights && <rect x={0} y={14} width={VIEW.w} height={5} fill="#1d2027" />}
      {setting.lights && <rect x={0} y={24} width={VIEW.w} height={3} fill="#15171d" />}
      {setting.lights && LAMPS.map((x, i) => {
        const m = LAMP_MOTION[i]!;
        // Every beam off one lamp sweeps together: the lamp is what moves.
        const beam = { transformOrigin: `${x}px 26px`, animationDuration: `${m.every}s`, animationDelay: `${m.delay}s`, animationDirection: m.reverse ? 'alternate-reverse' : 'alternate', '--sweep': `${m.sweep}deg` } as React.CSSProperties;
        return (
        <g key={x}>
          <polygon className="mv-cone" points={`${x - 9},26 ${x + 9},26 ${x + 150},600 ${x - 150},600`} fill={`url(#mv-cone-${i})`} style={beam} />
          <polygon className="mv-cone mv-cone-bright" points={`${x - 9},26 ${x + 9},26 ${x + 170},600 ${x - 170},600`} fill="url(#mv-cone-bright)" style={beam} />
          <polygon className="mv-cone mv-cone-red" points={`${x - 9},26 ${x + 9},26 ${x + 170},600 ${x - 170},600`} fill="url(#mv-cone-red)" style={beam} />
          {starColor && <polygon className="mv-cone mv-cone-star" points={`${x - 9},26 ${x + 9},26 ${x + 170},600 ${x - 170},600`} fill="url(#mv-cone-star)" style={beam} />}
          <rect x={x - 11} y={18} width={22} height={11} rx={2} fill="#2a2e38" />
          <circle cx={x} cy={29} r={5} fill="#fff7dc" className="mv-lens" style={{ animationDuration: `${m.hueEvery}s`, animationDelay: `${m.hueDelay}s` }} />
        </g>
        );
      })}

      <Crowd signs={signs} family={setting.family} fill={setting.fill} />
      {(setting.family === 'arena' || setting.family === 'stadium') && <Flashes />}

      {/* Steel barricades — or, with none, a rope on posts in a big room and nothing at all in a small one. */}
      {setting.barricades ? (
        <g>
          <rect x={0} y={336} width={VIEW.w} height={46} fill="#0b0c10" />
          <rect x={0} y={336} width={VIEW.w} height={4} fill={accent} opacity={0.55} />
          {Array.from({ length: 13 }, (_, i) => (
            <rect key={i} x={i * 100 - 2} y={336} width={4} height={46} fill="#16181e" />
          ))}
        </g>
      ) : (setting.family === 'arena' || setting.family === 'stadium' || setting.family === 'theatre') && (
        <g>
          {Array.from({ length: 9 }, (_, i) => (
            <rect key={i} x={i * 150 - 2} y={346} width={5} height={30} fill="#555b66" />
          ))}
          <path d="M 0,350 Q 75,362 150,350 Q 225,362 300,350 Q 375,362 450,350 Q 525,362 600,350 Q 675,362 750,350 Q 825,362 900,350 Q 975,362 1050,350 Q 1125,362 1200,350" fill="none" stroke="#a2242c" strokeWidth={3} />
        </g>
      )}

      {/* The pool of light the ring sits in — a lit rig's, not the house lights'. */}
      {setting.lights && <ellipse cx={600} cy={500} rx={520} ry={95} fill="url(#mv-pool)" opacity={0.16} />}
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
      <polygon points={`${PLATFORM.backL},${PLATFORM.backY} ${PLATFORM.backR},${PLATFORM.backY} ${PLATFORM.frontR},${PLATFORM.frontY} ${PLATFORM.frontL},${PLATFORM.frontY}`} fill={RING_LOOK[setting.ring].platform} />
      <polygon points={`${PLATFORM.backL},${PLATFORM.backY} ${PLATFORM.backR},${PLATFORM.backY} ${PLATFORM.frontR},${PLATFORM.frontY} ${PLATFORM.frontL},${PLATFORM.frontY}`} fill="none" stroke={corners ? GOLD : accent} strokeOpacity={0.55} strokeWidth={2.5} />
      <polygon points={`${MAT.backL},${MAT.backY} ${MAT.backR},${MAT.backY} ${MAT.frontR},${MAT.frontY} ${MAT.frontL},${MAT.frontY}`} fill="url(#mv-mat)" />
      {/* Where the canvas turns down under the ropes to the apron: a crease, not a wall. */}
      <polygon points={`${MAT.backL},${MAT.backY} ${MAT.backR},${MAT.backY} ${MAT.frontR},${MAT.frontY} ${MAT.frontL},${MAT.frontY}`} fill="none" stroke="#000" strokeOpacity={0.22} strokeWidth={2} />
      {setting.ring === 'pro' && <ellipse cx={600} cy={412} rx={92} ry={20} fill="none" stroke={corners ? GOLD : accent} strokeWidth={5} opacity={corners ? 0.6 : 0.35} />}
      {setting.ring === 'pro' && <ellipse cx={600} cy={412} rx={58} ry={12} fill={corners ? GOLD : accent} opacity={0.22} />}
      {setting.ring === 'plywood' && (
        // A tarp over plywood: creased, patched with tape.
        <path d="M 420,396 L 470,436 M 690,384 L 760,404 M 330,440 L 420,446 M 560,380 L 590,392" stroke="#4c5866" strokeWidth={2} opacity={0.7} />
      )}
      {corners ? (
        <g>
          {/* The skirt is split down a slant: one company's half, and the other's. */}
          <polygon points={`${PLATFORM.frontL},${PLATFORM.frontY} 624,${PLATFORM.frontY} 576,${SKIRT_BOTTOM} ${PLATFORM.frontL},${SKIRT_BOTTOM}`} fill="url(#mv-apron-0)" />
          <polygon points={`624,${PLATFORM.frontY} ${PLATFORM.frontR},${PLATFORM.frontY} ${PLATFORM.frontR},${SKIRT_BOTTOM} 576,${SKIRT_BOTTOM}`} fill="url(#mv-apron-1)" />
          <polygon points={`616,${PLATFORM.frontY} 632,${PLATFORM.frontY} 584,${SKIRT_BOTTOM} 568,${SKIRT_BOTTOM}`} fill={GOLD} />
        </g>
      ) : RING_LOOK[setting.ring].skirt ? (
        <g>
          <polygon points={`${PLATFORM.frontL},${PLATFORM.frontY} ${PLATFORM.frontR},${PLATFORM.frontY} ${PLATFORM.frontR},${SKIRT_BOTTOM} ${PLATFORM.frontL},${SKIRT_BOTTOM}`} fill={RING_LOOK[setting.ring].skirt!} />
          {setting.ring === 'plywood' &&
            // Bare plywood sheets, and cinder blocks under the corners.
            Array.from({ length: 8 }, (_, i) => {
              const x = PLATFORM.frontL + ((PLATFORM.frontR - PLATFORM.frontL) * (i + 1)) / 8;
              return <line key={i} x1={x} y1={PLATFORM.frontY} x2={x} y2={SKIRT_BOTTOM - 26} stroke="#4f3a24" strokeWidth={2} />;
            })}
          {setting.ring === 'plywood' &&
            [PLATFORM.frontL + 10, (PLATFORM.frontL + PLATFORM.frontR) / 2 - 30, PLATFORM.frontR - 70].map((x) => (
              <rect key={x} x={x} y={SKIRT_BOTTOM - 26} width={60} height={26} fill="#8d8f93" stroke="#5c5e62" strokeWidth={2} />
            ))}
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
        <line key={y} x1={MAT.backL} y1={y} x2={MAT.backR} y2={y} stroke={RING_LOOK[setting.ring].rope} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
      ))}
      <SideRun run="backL" onRef={onSideRope} />
      <SideRun run="backR" onRef={onSideRope} />
      {[MAT.backL, MAT.backR].map((x) =>
        ROPES_BACK.map((y) => <rect key={`${x}-${y}`} x={x - 9} y={y - 7} width={18} height={14} rx={4} fill={RING_LOOK[setting.ring].pad ?? (corners ? corners[x === MAT.backL ? 0 : 1].accent : accent)} />),
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
  ring = 'pro',
}: {
  /** What the ring is made of (RING_LOOK). */
  ring?: Setting['ring'];
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
                <line x1={MAT.frontL} y1={y} x2={MAT.frontR} y2={y} stroke={RING_LOOK[ring].rope} strokeWidth={ring === 'plywood' ? 3 : 4} />
              </g>
            ))}
          </g>
          {[MAT.frontL, MAT.frontR].map((x) => (
            <g key={x}>
              <rect x={x - 7} y={286} width={14} height={MAT.frontY - 286 + 6} fill="#343944" />
              <rect x={x - 7} y={286} width={5} height={MAT.frontY - 286 + 6} fill="#4c5260" />
              {ROPES_FRONT.map((y) => (
                <rect key={y} x={x - 11} y={y - 9} width={22} height={18} rx={5} fill={RING_LOOK[ring].pad ?? (corners ? corners[x === MAT.frontL ? 0 : 1].accent : accent)} stroke="#000" strokeOpacity={0.35} />
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
