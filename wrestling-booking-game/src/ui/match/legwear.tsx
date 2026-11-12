// What a wrestler wears from the waist down.
//
// The portrait art stops at the waist, so the legs are drawn. They used to
// be drawn one way for everybody — bare thighs, black kneepads, black boots.
// This gives each wrestler their own: trunks or tights or trousers, kneepads
// or none, and something on their feet that suits the act.
//
// Like the rest of the outfit it is seeded from the wrestler and their
// gimmick, so it never changes between two looks at the same person and a
// repackage is a new set of gear. It takes its colours from the top half
// (the waistband, the top) so the two halves read as one outfit, and it
// follows the costume: somebody in a gi is in gi trousers and bare feet.
//
// One set of shapes serves both figures: the jointed one turns the thigh
// and the shin about the hip and knee, the plain one just stands on them.

import type { ComposedLook, LookSubject } from '../paperdoll/assignLook';

export type Bottom = 'trunks' | 'shorts' | 'tights' | 'pants' | 'skirt';
export type Footwear = 'boots' | 'shortBoots' | 'kickpads' | 'sneakers' | 'cowboy' | 'barefoot';

export interface Legwear {
  bottom: Bottom;
  color: string;
  /** A stripe down the outside of the leg, on anything long enough to carry one. */
  stripe: string | null;
  /** Null: bare knees (or the tights' own). */
  kneepads: string | null;
  footwear: Footwear;
  bootColor: string;
  /** The band round the top of a boot, or the face of a kickpad. */
  trim: string;
}

const BLACK = '#15151a';
const WHITE = '#e9e9ee';
const BROWN = '#5b3a1f';
const DENIM = '#2f4a73';

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function stream(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** What the top half is dressed as, read off the pieces it was given. */
function costumeOf(look: ComposedLook): string {
  const ids = [look.top, look.outer, look.prop, look.acc, look.neck].map((w) => w?.asset.id ?? '').join(' ').toLowerCase();
  if (/karate|gi\b|-gi-|judo|martial/.test(ids)) return 'karate';
  if (/ninja/.test(ids)) return 'ninja';
  if (/pirate|corsair|tricorn/.test(ids)) return 'pirate';
  if (/cowboy|western|stetson/.test(ids)) return 'cowboy';
  if (/luchador|lucha/.test(ids)) return 'lucha';
  if (/chef/.test(ids)) return 'chef';
  if (/hockey/.test(ids)) return 'hockey';
  if (/robe/.test(ids)) return 'robe';
  return '';
}

export function legwearOf(subject: LookSubject, look: ComposedLook): Legwear {
  const rng = stream(hashString(`${subject.id}:legs:${subject.gimmickId ?? ''}`));
  const pick = <T,>(options: readonly T[]): T => options[Math.floor(rng() * options.length)]!;
  const main = look.waistband?.color ?? look.top?.color ?? look.outer?.color ?? pick([BLACK, '#7a1420', '#1f3f8a', '#1c6b3a', '#5a2a82', '#b8860b', WHITE]);
  // A second colour off the outfit, for stripes and trim; white or black if it has none.
  const second = [look.pattern?.color, look.logo?.color, look.outer?.color, look.top?.color].find((c) => c && c !== main) ?? (main === WHITE ? BLACK : WHITE);
  const female = subject.gender === 'f';

  switch (costumeOf(look)) {
    case 'karate':
      return { bottom: 'pants', color: look.top?.color ?? WHITE, stripe: null, kneepads: null, footwear: 'barefoot', bootColor: BLACK, trim: BLACK };
    case 'ninja':
      return { bottom: 'pants', color: BLACK, stripe: null, kneepads: null, footwear: 'shortBoots', bootColor: BLACK, trim: '#7a1420' };
    case 'pirate':
      return { bottom: 'pants', color: pick([BLACK, '#3b2a1c', '#5a1a1a']), stripe: null, kneepads: null, footwear: 'boots', bootColor: BROWN, trim: '#c9a23a' };
    case 'cowboy':
      return { bottom: 'pants', color: DENIM, stripe: null, kneepads: null, footwear: 'cowboy', bootColor: BROWN, trim: '#c9a23a' };
    case 'chef':
      return { bottom: 'pants', color: pick([WHITE, '#2a2a30']), stripe: null, kneepads: null, footwear: 'sneakers', bootColor: BLACK, trim: WHITE };
    case 'hockey':
      return { bottom: 'shorts', color: main, stripe: second, kneepads: BLACK, footwear: 'boots', bootColor: BLACK, trim: second };
    case 'lucha':
      return { bottom: 'tights', color: main, stripe: second, kneepads: null, footwear: 'kickpads', bootColor: pick([BLACK, WHITE]), trim: second };
    default:
      break;
  }

  const roll = rng();
  const bottom: Bottom = female
    ? roll < 0.34 ? 'trunks' : roll < 0.62 ? 'shorts' : roll < 0.88 ? 'tights' : roll < 0.95 ? 'skirt' : 'pants'
    : roll < 0.46 ? 'trunks' : roll < 0.62 ? 'shorts' : roll < 0.9 ? 'tights' : 'pants';
  const long = bottom === 'tights' || bottom === 'pants';
  const stripe = bottom !== 'trunks' && bottom !== 'skirt' && rng() < 0.45 ? second : null;
  const kneeRoll = rng();
  // Kneepads go with bare legs and with tights; nobody wears them over trousers.
  const kneepads = bottom === 'pants' ? null : kneeRoll < (long ? 0.35 : 0.7) ? pick([BLACK, BLACK, WHITE, main === BLACK ? WHITE : main]) : null;
  const footRoll = rng();
  const footwear: Footwear =
    bottom === 'pants'
      ? footRoll < 0.5 ? 'shortBoots' : footRoll < 0.85 ? 'sneakers' : 'boots'
      : footRoll < 0.56 ? 'boots' : footRoll < 0.76 ? 'kickpads' : footRoll < 0.9 ? 'shortBoots' : footRoll < 0.97 ? 'sneakers' : 'barefoot';
  const bootColor = pick([BLACK, BLACK, BLACK, WHITE, main === BLACK ? WHITE : main, BROWN]);
  return { bottom, color: main, stripe, kneepads, footwear, bootColor, trim: bootColor === second ? main : second };
}

// ---- the shapes ---------------------------------------------------------------
// Written for the screen-left leg in a 100-wide box; `m` mirrors every x for
// the right one. Hip at (40,15), knee at (40,47), sole at 84.

type Mirror = (x: number) => number;
const closed = (m: Mirror, points: readonly (readonly [number, number])[]) => `M ${points.map(([x, y]) => `${m(x)},${y}`).join(' L ')} Z`;

// The upper body is painted art: rounded muscle, a dark outline, light from
// one side. Straight-sided blocks under it read as a different drawing, so
// the legs are built the same way — a curved thigh and calf, an outline, a
// highlight down the front and a shadow down the inside.
const LINE = { stroke: '#0b0b0e', strokeOpacity: 0.5, strokeWidth: 0.7, strokeLinejoin: 'round' as const };

// Parts of a leg — the shorts' length of a thigh, a boot from its top down —
// are cut from the leg's own curves by arithmetic, not by a clip. A clip
// band does not turn with a leg that is swung round by its joint: a boot on
// a dropkick came out as no boot and a sole floating beside it.
type Pt = readonly [number, number];
type Curve = readonly [Pt, Pt, Pt];
/** Where a quadratic edge that runs down the leg crosses height `y`. */
function at([p0, c, p1]: Curve, y: number): Pt {
  const a = p0[1] - 2 * c[1] + p1[1];
  const b = 2 * (c[1] - p0[1]);
  const k = p0[1] - y;
  const t = Math.min(1, Math.max(0, Math.abs(a) < 1e-6 ? -k / b : (-b + Math.sqrt(Math.max(0, b * b - 4 * a * k))) / (2 * a)));
  return [(1 - t) * (1 - t) * p0[0] + 2 * t * (1 - t) * c[0] + t * t * p1[0], y];
}
/** The stretch of that edge between two heights, as points. */
const run = (edge: Curve, from: number, to: number, steps = 6): Pt[] => Array.from({ length: steps + 1 }, (_, i) => at(edge, from + ((to - from) * i) / steps));
const through = (m: Mirror, points: readonly Pt[]) => points.map(([x, y]) => `${m(x).toFixed(2)},${y.toFixed(2)}`).join(' L ');

const thighEdges = (female: boolean, loose: boolean): { outer: Curve; inner: Curve; seam: Curve } => {
  const bulge = (female ? 28.6 : 26.4) - (loose ? 1.4 : 0);
  const [outer, inner] = loose ? [31.2, 48.2] : [32.5, 47];
  return { outer: [[30, 14], [bulge, 30], [outer, 47]], inner: [[49.6, 20], [50, 33], [inner, 47]], seam: [[32.2, 15], [bulge + 2.6, 30], [34.4, 47]] };
};
const shinEdges = (female: boolean): { outer: Curve; inner: Curve; seam: Curve } => ({
  outer: [[33, 50], [female ? 31.4 : 30, 61], [33.8, 78]],
  inner: [[46.6, 50], [female ? 47.6 : 48.4, 62], [46, 78]],
  seam: [[34.6, 50], [32.6, 61], [35.6, 77]],
});
/** The thigh from the hip down to `y`. */
const thighDownTo = (m: Mirror, female: boolean, y: number) => {
  const e = thighEdges(female, false);
  return `M ${through(m, [...run(e.outer, 14, y), ...run(e.inner, Math.max(20, y), 20).slice(y < 20 ? 6 : 0)])} Z`;
};
/** A band of the shin between two heights. */
const shinBand = (m: Mirror, female: boolean, from: number, to: number) => {
  const e = shinEdges(female);
  return `M ${through(m, [...run(e.outer, from, to, 4), ...run(e.inner, to, from, 4)])} Z`;
};
/** The shin from `y` down, foot included. */
const shinFrom = (m: Mirror, female: boolean, y: number) => {
  const e = shinEdges(female);
  return `M ${through(m, run(e.outer, y, 78, 5))} C ${m(29.5)},78.5 ${m(26)},80 ${m(26.5)},84 L ${m(46.5)},84 L ${through(m, run(e.inner, 78, y, 5))} Z`;
};
const seamLine = (m: Mirror, seam: Curve, from: number, to: number) => `M ${through(m, run(seam, from, to, 5))}`;

const thighPath = (m: Mirror, female: boolean, loose: boolean) => {
  const bulge = (female ? 28.6 : 26.4) - (loose ? 1.4 : 0);
  const [outer, inner] = loose ? [31.2, 48.2] : [32.5, 47];
  return `M ${m(30)},14 Q ${m(bulge)},30 ${m(outer)},47 L ${m(inner)},47 Q ${m(50)},33 ${m(49.6)},20 Z`;
};
const shinPath = (m: Mirror, female: boolean) => {
  const calf = female ? 31.4 : 30;
  return `M ${m(33)},50 Q ${m(calf)},61 ${m(33.8)},78 C ${m(29.5)},78.5 ${m(26)},80 ${m(26.5)},84 L ${m(46.5)},84 L ${m(46)},78 Q ${m(female ? 47.6 : 48.4)},62 ${m(46.6)},50 Z`;
};

/** Hip to knee: turns about the hip. */
export function Thigh({ m, skin, gear, female = false }: { m: Mirror; skin: string; gear: Legwear; female?: boolean }) {
  const long = gear.bottom === 'tights' || gear.bottom === 'pants';
  const loose = gear.bottom === 'pants';
  const leg = thighPath(m, female, loose);
  const kneeColor = gear.kneepads ?? (long ? gear.color : skin);
  const bulge = (female ? 28.6 : 26.4) - (loose ? 1.4 : 0);
  // The outside seam, a little in from the edge: where a stripe runs.
  const seam = `M ${m(32.2)},15 Q ${m(bulge + 2.6)},30 ${m(34.4)},47`;
  return (
    <>
      <path d={leg} fill={long ? gear.color : skin} {...LINE} />
      {gear.bottom === 'shorts' && <path d={thighDownTo(m, female, 35.5)} fill={gear.color} {...LINE} />}
      {gear.stripe && long && <path d={seam} stroke={gear.stripe} strokeWidth={2.6} fill="none" />}
      {gear.stripe && gear.bottom === 'shorts' && <path d={seamLine(m, thighEdges(female, false).seam, 15, 34.6)} stroke={gear.stripe} strokeWidth={2.6} fill="none" />}
      {gear.bottom === 'shorts' && <path d={`M ${through(m, [at(thighEdges(female, false).outer, 33.8), at(thighEdges(female, false).inner, 33.8), at(thighEdges(female, false).inner, 35.5), at(thighEdges(female, false).outer, 35.5)])} Z`} fill="#000" opacity={0.25} />}
      {/* Light down the front of the thigh, shadow down the inside, and the line of the muscle on a bare leg. */}
      <path d={`M ${m(33.6)},19 Q ${m(bulge + 4.4)},31 ${m(35.6)},44`} stroke="#fff" strokeOpacity={0.13} strokeWidth={2.4} strokeLinecap="round" fill="none" />
      <path d={`M ${m(44.2)},20 L ${m(49.6)},20 Q ${m(50)},33 ${m(47)},47 L ${m(44.6)},47 Q ${m(46.4)},33 ${m(44.2)},20 Z`} fill="#000" opacity={0.2} />
      {!long && gear.bottom !== 'shorts' && <path d={`M ${m(39.4)},22 Q ${m(37.6)},34 ${m(39.6)},43`} stroke="#000" strokeOpacity={0.16} strokeWidth={0.8} fill="none" />}
      {/* The knee rides on the thigh and covers the joint: a pad, or just a knee. */}
      <ellipse cx={m(39.8)} cy={47} rx={gear.kneepads ? 8.6 : loose ? 8.4 : 7.4} ry={gear.kneepads ? 7 : 6} fill={kneeColor} {...(gear.kneepads ? LINE : {})} />
      {gear.kneepads && <ellipse cx={m(38.6)} cy={45.6} rx={4.6} ry={3} fill="#fff" opacity={0.14} />}
      {/* The stripe carries on over a bare knee, so it is one line from hip to boot however the leg bends. */}
      {gear.stripe && long && !gear.kneepads && <ellipse cx={m(34.4)} cy={47.6} rx={1.3} ry={4.2} fill={gear.stripe} />}
    </>
  );
}

/** Knee to sole: turns about the knee. */
export function Shin({ m, skin, gear, female = false }: { m: Mirror; skin: string; gear: Legwear; female?: boolean }) {
  const long = gear.bottom === 'tights' || gear.bottom === 'pants';
  const loose = gear.bottom === 'pants';
  const calf = long ? gear.color : skin;
  const leg = shinPath(m, female);
  const from = gear.footwear === 'boots' || gear.footwear === 'kickpads' || gear.footwear === 'cowboy' ? 56 : gear.footwear === 'shortBoots' ? 70 : gear.footwear === 'sneakers' ? 73 : null;
  return (
    <>
      {/* The whole lower leg and foot, in skin or in tights; whatever is on the foot goes over it. */}
      <path d={leg} fill={calf} {...LINE} />
      {gear.footwear === 'barefoot' && long && <path d={shinFrom(m, female, 73)} fill={skin} {...LINE} />}
      {gear.stripe && long && !loose && <path d={`M ${m(34.6)},50 Q ${m(32.6)},61 ${m(35.6)},77`} stroke={gear.stripe} strokeWidth={2.2} fill="none" />}

      {/* Black leather against a dark crowd is a hole in the picture: dark footwear gets a pale edge so a raised boot still reads as one. */}
      {from !== null && <path d={shinFrom(m, female, from)} fill={gear.bootColor} {...(gear.bootColor === BLACK ? { stroke: '#8a93a3', strokeOpacity: 0.85, strokeWidth: 0.7, strokeLinejoin: 'round' as const } : LINE)} />}
      {/* The band round the top of the boot: the leg's own shape, a few units of it. */}
      {from !== null && gear.footwear !== 'kickpads' && gear.footwear !== 'cowboy' && <path d={shinBand(m, female, from, from + (gear.footwear === 'boots' ? 3.6 : 2.2))} fill={gear.trim} />}
      {gear.footwear === 'boots' && <path d={`M ${m(39.9)},62 L ${m(39.9)},76`} stroke="#fff" strokeOpacity={0.25} strokeWidth={1.1} strokeDasharray="1.6 1.8" />}
      {gear.footwear === 'cowboy' && (
        <>
          {/* The scalloped top of a western boot, and the stitching on its shaft. */}
          <path d={closed(m, [[31, 55.5], [39.9, 60.5], [48.5, 55.5]])} fill={calf} />
          <path d={`M ${m(35.5)},63 Q ${m(39.9)},69 ${m(44.3)},63 M ${m(35.5)},68 Q ${m(39.9)},74 ${m(44.3)},68`} stroke={gear.trim} strokeWidth={1} fill="none" />
        </>
      )}
      {gear.footwear === 'kickpads' && (
        <>
          <path d={shinBand(m, female, 55, 77)} fill={gear.color} {...LINE} />
          <path d={closed(m, [[38.2, 55], [41.6, 55], [41.4, 77], [38.4, 77]])} fill={gear.trim} />
        </>
      )}
      {gear.footwear === 'sneakers' && <path d={closed(m, [[26.6, 82.4], [46.4, 82.4], [46.5, 84], [26.5, 84]])} fill="#f2f2f4" />}

      {/* Light down the shin, shadow down the inside of the calf. */}
      <path d={`M ${m(35.4)},53 Q ${m(33.8)},62 ${m(36)},74`} stroke="#fff" strokeOpacity={0.12} strokeWidth={2} strokeLinecap="round" fill="none" />
      <path d={`M ${m(44.4)},50 L ${m(46.6)},50 Q ${m(48.4)},62 ${m(46)},78 L ${m(44)},78 Q ${m(45.6)},62 ${m(44.4)},50 Z`} fill="#000" opacity={0.2} />

      {/* Trousers hang over whatever is on the foot. */}
      {loose && <path d={`M ${m(31.4)},47 L ${m(48.4)},47 Q ${m(49.4)},62 ${m(48)},${gear.footwear === 'barefoot' ? 75 : 77} L ${m(32)},${gear.footwear === 'barefoot' ? 75 : 77} Q ${m(30)},62 ${m(31.4)},47 Z`} fill={gear.color} {...LINE} />}
      {loose && gear.stripe && <path d={`M ${m(33.2)},47 Q ${m(31.8)},62 ${m(33.8)},76`} stroke={gear.stripe} strokeWidth={2.4} fill="none" />}
      {loose && <path d={`M ${m(45)},47 L ${m(48.4)},47 Q ${m(49.4)},62 ${m(48)},76 L ${m(45)},76 Z`} fill="#000" opacity={0.18} />}
    </>
  );
}

/** The seat: drawn over the tops of both legs. */
export function Pelvis({ female, gear }: { female: boolean; gear: Legwear }) {
  return (
    <>
      {gear.bottom === 'skirt' ? (
        <path d="M 31.5,0 L 68.5,0 L 76,30 L 62,33 L 50,31 L 38,33 L 24,30 Z" fill={gear.color} {...LINE} />
      ) : (
        <path d={female ? 'M 32.5,0 L 67.5,0 L 70.5,14 L 54,23 L 50,18 L 46,23 L 29.5,14 Z' : 'M 31.5,0 L 68.5,0 L 70.5,16 L 52.5,24 L 50,20 L 47.5,24 L 29.5,16 Z'} fill={gear.color} {...LINE} />
      )}
      {gear.bottom === 'skirt' && <path d="M 24,30 L 38,33 L 50,31 L 62,33 L 76,30 L 75.4,27.6 L 62,30.6 L 50,28.6 L 38,30.6 L 24.6,27.6 Z" fill="#000" opacity={0.2} />}
      <path d="M 32,0 L 68,0 L 68.4,4 L 31.6,4 Z" fill="#000" opacity={0.25} />
    </>
  );
}
