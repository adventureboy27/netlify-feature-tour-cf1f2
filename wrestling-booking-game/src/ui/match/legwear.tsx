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

/** Hip to knee: turns about the hip. */
export function Thigh({ m, skin, gear }: { m: Mirror; skin: string; gear: Legwear }) {
  const long = gear.bottom === 'tights' || gear.bottom === 'pants';
  const loose = gear.bottom === 'pants';
  const leg = closed(m, loose ? [[28.8, 14], [49.8, 20], [48.2, 47], [31.2, 47]] : [[30, 14], [49.6, 20], [47, 47], [32.5, 47]]);
  const kneeColor = gear.kneepads ?? (long ? gear.color : skin);
  return (
    <>
      <path d={leg} fill={long ? gear.color : skin} />
      {gear.bottom === 'shorts' && <path d={closed(m, [[30, 14], [49.6, 20], [48.3, 35], [31.3, 35]])} fill={gear.color} />}
      {gear.stripe && long && <path d={closed(m, [[30, 14], [33.2, 15], [35.2, 47], [32.5, 47]])} fill={gear.stripe} />}
      {gear.stripe && gear.bottom === 'shorts' && <path d={closed(m, [[30, 14], [33.2, 15], [34.4, 35], [31.3, 35]])} fill={gear.stripe} />}
      {gear.bottom === 'shorts' && <path d={closed(m, [[31.2, 33.4], [48.4, 33.4], [48.3, 35], [31.3, 35]])} fill="#000" opacity={0.22} />}
      <path d={closed(m, [[44, 20], [49.6, 20], [47, 47], [44.5, 47]])} fill="#000" opacity={0.18} />
      {/* The knee rides on the thigh and covers the joint: a pad, or just a knee. */}
      <ellipse cx={m(39.8)} cy={47} rx={gear.kneepads ? 8.6 : loose ? 8.4 : 7.4} ry={gear.kneepads ? 7 : 6} fill={kneeColor} />
      {gear.kneepads && <ellipse cx={m(39.8)} cy={46} rx={5.2} ry={3.6} fill="#fff" opacity={0.1} />}
    </>
  );
}

/** Knee to sole: turns about the knee. */
export function Shin({ m, skin, gear }: { m: Mirror; skin: string; gear: Legwear }) {
  const long = gear.bottom === 'tights' || gear.bottom === 'pants';
  const loose = gear.bottom === 'pants';
  const calf = long ? gear.color : skin;
  const foot = `M ${m(33.8)},78 L ${m(46)},78 L ${m(46.5)},84 L ${m(26.5)},84 C ${m(26)},80 ${m(29.5)},78.5 ${m(33.8)},78 Z`;
  const tall = `M ${m(33)},56 L ${m(46.8)},56 L ${m(46)},78 L ${m(46.5)},84 L ${m(26.5)},84 C ${m(26)},80 ${m(29.5)},78.5 ${m(33.8)},78 Z`;
  const low = `M ${m(33.5)},70 L ${m(46.4)},70 L ${m(46)},78 L ${m(46.5)},84 L ${m(26.5)},84 C ${m(26)},80 ${m(29.5)},78.5 ${m(33.8)},78 Z`;
  const sole = closed(m, [[26.6, 82.4], [46.4, 82.4], [46.5, 84], [26.5, 84]]);
  const high = gear.footwear === 'boots' || gear.footwear === 'kickpads' || gear.footwear === 'cowboy';
  return (
    <>
      {/* The calf, down to wherever the footwear starts. */}
      <path d={closed(m, [[33, 50], [46.6, 50], [46.1, high ? 58 : 79], [33.7, high ? 58 : 79]])} fill={calf} />
      {gear.stripe && long && !high && <path d={closed(m, [[33, 50], [35.4, 50], [35.8, 79], [33.7, 79]])} fill={gear.stripe} />}

      {gear.footwear === 'boots' && (
        <>
          <path d={tall} fill={gear.bootColor} />
          <path d={closed(m, [[33, 56], [46.8, 56], [46.6, 60], [33.2, 60]])} fill={gear.trim} />
          <path d={`M ${m(39.9)},62 L ${m(39.9)},76`} stroke="#fff" strokeOpacity={0.22} strokeWidth={1.1} strokeDasharray="1.6 1.8" />
        </>
      )}
      {gear.footwear === 'cowboy' && (
        <>
          <path d={tall} fill={gear.bootColor} />
          {/* The scalloped top of a western boot, and the stitching on its shaft. */}
          <path d={closed(m, [[33, 55.5], [39.9, 60.5], [46.8, 55.5]])} fill={calf} />
          <path d={`M ${m(35.5)},63 Q ${m(39.9)},69 ${m(44.3)},63 M ${m(35.5)},68 Q ${m(39.9)},74 ${m(44.3)},68`} stroke={gear.trim} strokeWidth={1} fill="none" />
        </>
      )}
      {gear.footwear === 'kickpads' && (
        <>
          <path d={tall} fill={gear.bootColor} />
          <path d={closed(m, [[31.8, 55], [48, 55], [47.2, 77], [32.8, 77]])} fill={gear.color} />
          <path d={closed(m, [[38.2, 55], [41.6, 55], [41.4, 77], [38.4, 77]])} fill={gear.trim} />
        </>
      )}
      {gear.footwear === 'shortBoots' && (
        <>
          <path d={low} fill={gear.bootColor} />
          <path d={closed(m, [[33.5, 70], [46.4, 70], [46.3, 72.4], [33.6, 72.4]])} fill={gear.trim} />
        </>
      )}
      {gear.footwear === 'sneakers' && (
        <>
          <path d={`M ${m(33.6)},73 L ${m(46.3)},73 L ${m(46)},78 L ${m(46.5)},84 L ${m(26.5)},84 C ${m(26)},80 ${m(29.5)},78.5 ${m(33.8)},78 Z`} fill={gear.bootColor} />
          <path d={sole} fill="#f2f2f4" />
          <path d={closed(m, [[33.6, 73], [46.3, 73], [46.2, 74.6], [33.7, 74.6]])} fill={gear.trim} />
        </>
      )}
      {gear.footwear === 'barefoot' && <path d={foot} fill={skin} />}

      {/* Trousers hang over whatever is on the foot. */}
      {loose && <path d={closed(m, [[31.6, 47], [48.2, 47], [47.8, gear.footwear === 'barefoot' ? 75 : 77], [32.2, gear.footwear === 'barefoot' ? 75 : 77]])} fill={gear.color} />}
      {loose && gear.stripe && <path d={closed(m, [[31.6, 47], [34.4, 47], [35, 76], [32.2, 76]])} fill={gear.stripe} />}
    </>
  );
}

/** The seat: drawn over the tops of both legs. */
export function Pelvis({ female, gear }: { female: boolean; gear: Legwear }) {
  return (
    <>
      {gear.bottom === 'skirt' ? (
        <path d="M 31.5,0 L 68.5,0 L 76,30 L 62,33 L 50,31 L 38,33 L 24,30 Z" fill={gear.color} />
      ) : (
        <path d={female ? 'M 32.5,0 L 67.5,0 L 70.5,14 L 54,23 L 50,18 L 46,23 L 29.5,14 Z' : 'M 31.5,0 L 68.5,0 L 70.5,16 L 52.5,24 L 50,20 L 47.5,24 L 29.5,16 Z'} fill={gear.color} />
      )}
      {gear.bottom === 'skirt' && <path d="M 24,30 L 38,33 L 50,31 L 62,33 L 76,30 L 75.4,27.6 L 62,30.6 L 50,28.6 L 38,30.6 L 24.6,27.6 Z" fill="#000" opacity={0.2} />}
      <path d="M 32,0 L 68,0 L 68.4,4 L 31.6,4 Z" fill="#000" opacity={0.25} />
    </>
  );
}
