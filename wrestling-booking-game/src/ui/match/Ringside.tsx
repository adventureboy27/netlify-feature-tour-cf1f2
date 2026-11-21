// The people at the ring who are not wrestling: the referee, a guest in the
// striped shirt, the managers on the floor.
//
// Drawn rather than built from portrait art — an official has no paper-doll
// look of his own — but in the same ink as the wrestlers, and with a real
// face where there is one: a guest referee is a wrestler, and wears his own
// head on the shirt; a manager who is one of the roster does the same.
//
// The figure only has the joints its job needs: standing or down on one
// knee, and one working arm (the counting hand, the pointing hand, the hand
// that waves for the bell). MatchStage moves it.

import { memo, useMemo } from 'react';
import { assignLook, lookSubjectOf } from '../paperdoll/assignLook';
import { ComposedPortrait } from '../paperdoll/ComposedPortrait';
import { BODY_RIG } from './rig';
import type { Wrestler } from '../../engine/types';

/** What a person at ringside is wearing. */
export type Outfit = 'stripes' | 'suit' | 'security' | 'medic';

/** The parts MatchStage animates. */
export interface PersonParts {
  /** Where they are: translate, and a turn onto their back when flattened. */
  root: HTMLDivElement;
  standing: SVGGElement;
  kneeling: SVGGElement;
  /** The working arm, standing and kneeling. Turns about the shoulder. */
  arm: SVGGElement;
  kneelArm: SVGGElement;
  /** The back of the head, over the face: his back is to us (and to the ring). */
  back: SVGGElement;
}

/** The drawing's own box. Feet on the bottom edge. */
export const PERSON_VIEW = { w: 60, h: 150 };
/** Shoulder of the working arm, standing and kneeling, in the drawing's units. */
const SHOULDER = { x: 41, y: 41 };
const KNEEL_DROP = 46;

const SKIN = '#c98e64';
const INK = '#14110f';

/** A face for the head: the wrestler's own, a photo, or plain. */
export interface Face {
  wrestler?: Wrestler;
  photoDataUrl?: string;
  initials?: string;
}

/** The head, at (cx, cy) with radius r: a wrestler's own head cut from their art, a photo, or drawn. */
function Head({ face, cx, cy, r }: { face: Face; cx: number; cy: number; r: number }) {
  const subject = face.wrestler ? lookSubjectOf(face.wrestler) : undefined;
  const look = subject ? assignLook(subject) : null;
  if (look && face.wrestler) {
    // The head region of the 512 portrait, scaled so its width fills the circle.
    const rig = BODY_RIG[face.wrestler.gender];
    const SCALE = 0.86;
    const px = (x: number) => 50 + ((x / 512) * 100 - 50) * SCALE;
    const py = (y: number) => 100 - (100 - (y / 512) * 100) * SCALE;
    const boxW = (2 * r * 512) / (2 * rig.head.halfWidth * 1.25 * SCALE);
    const left = cx - (px(rig.cx) / 100) * boxW;
    const top = cy - (py(rig.head.top + rig.head.tall * 0.5) / 100) * boxW;
    return (
      <foreignObject x={cx - r * 1.3} y={cy - r * 1.45} width={r * 2.6} height={r * 2.7}>
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: left - (cx - r * 1.3), top: top - (cy - r * 1.45), width: boxW, height: boxW }}>
            <ComposedPortrait look={look} alt="" inked />
          </div>
        </div>
      </foreignObject>
    );
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={SKIN} stroke={INK} strokeWidth={1.6} />
      {face.photoDataUrl ? (
        <>
          <clipPath id={`face-${cx}-${cy}`}>
            <circle cx={cx} cy={cy} r={r - 0.8} />
          </clipPath>
          <image href={face.photoDataUrl} x={cx - r} y={cy - r} width={r * 2} height={r * 2} preserveAspectRatio="xMidYMid slice" clipPath={`url(#face-${cx}-${cy})`} />
        </>
      ) : (
        <>
          {/* Short dark hair, two eyes and a set mouth: an official, not a character. */}
          <path d={`M ${cx - r},${cy - 1} Q ${cx - r},${cy - r - 2} ${cx},${cy - r - 1.5} Q ${cx + r},${cy - r - 2} ${cx + r},${cy - 1} Q ${cx + r * 0.5},${cy - r * 0.55} ${cx - r},${cy - 1} Z`} fill="#2a1d14" />
          <circle cx={cx - r * 0.35} cy={cy + 0.5} r={0.95} fill={INK} />
          <circle cx={cx + r * 0.35} cy={cy + 0.5} r={0.95} fill={INK} />
          <path d={`M ${cx - r * 0.3},${cy + r * 0.45} L ${cx + r * 0.3},${cy + r * 0.45}`} stroke={INK} strokeWidth={1.1} strokeLinecap="round" />
          {face.initials && (
            <text x={cx} y={cy + r + 7} textAnchor="middle" fontSize={5.5} fontWeight={800} fill="#fff" stroke={INK} strokeWidth={0.4}>
              {face.initials}
            </text>
          )}
        </>
      )}
    </g>
  );
}

/** Shirt and trousers. `dy` lowers the upper body (kneeling). */
function Torso({ outfit, dy, stripes }: { outfit: Outfit; dy: number; stripes: string }) {
  const shirt = outfit === 'stripes' ? `url(#${stripes})` : outfit === 'security' ? '#f2c230' : outfit === 'medic' ? '#f4f3ef' : '#262a36';
  return (
    <g transform={`translate(0 ${dy})`}>
      {/* The far arm, hanging. */}
      <path d="M 19,40 C 15,52 15,62 16,74" stroke={outfit === 'stripes' || outfit === 'medic' ? '#e9e6df' : outfit === 'security' ? '#f2c230' : '#262a36'} strokeWidth={7} strokeLinecap="round" fill="none" />
      <path d="M 16,66 L 16,76" stroke={SKIN} strokeWidth={6} strokeLinecap="round" />
      <path d="M 19,34 Q 30,30 41,34 L 43,58 L 41,86 L 19,86 L 17,58 Z" fill={shirt} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      {outfit === 'security' && (
        <text x={30} y={60} textAnchor="middle" fontSize={5.6} fontWeight={900} fill="#111" letterSpacing={0.2}>SECURITY</text>
      )}
      {outfit === 'medic' && <path d="M 27,48 L 33,48 L 33,54 L 39,54 L 39,60 L 33,60 L 33,66 L 27,66 L 27,60 L 21,60 L 21,54 L 27,54 Z" fill="#d22" />}
      {outfit === 'suit' ? (
        <>
          <path d="M 26,33 L 30,50 L 34,33 Z" fill="#f1efe8" stroke={INK} strokeWidth={0.8} />
          <path d="M 29.3,36 L 30.7,36 L 31.4,48 L 30,51 L 28.6,48 Z" fill="#9b1c1c" />
        </>
      ) : (
        <path d="M 25,33 Q 30,38 35,33" fill="none" stroke={INK} strokeWidth={1.4} />
      )}
      <path d="M 19,82 L 41,82" stroke={INK} strokeWidth={2.4} />
    </g>
  );
}

/** Something in the working hand: drawn hanging from the fist, turning with the arm. */
export type PersonHeld = 'chair' | 'can' | 'kendo';

function HeldThing({ held }: { held: PersonHeld }) {
  const hx = SHOULDER.x + 1.5;
  const hy = SHOULDER.y + 35;
  if (held === 'kendo') return <path d={`M ${hx},${hy - 4} L ${hx + 1},${hy + 40}`} stroke="#c9a873" strokeWidth={3} strokeLinecap="round" />;
  if (held === 'can')
    return <path d={`M ${hx - 9},${hy + 2} L ${hx + 9},${hy + 2} L ${hx + 7},${hy + 26} L ${hx - 7},${hy + 26} Z`} fill="#9aa3b2" stroke="#4b5260" strokeWidth={1.5} />;
  return (
    <g stroke="#4b5260" strokeWidth={1.5}>
      <path d={`M ${hx - 8},${hy + 2} L ${hx + 8},${hy + 2} L ${hx + 9},${hy + 16} L ${hx - 9},${hy + 16} Z`} fill="#9aa3b2" />
      <path d={`M ${hx - 9},${hy + 17} L ${hx + 9},${hy + 17} L ${hx + 10},${hy + 20} L ${hx - 10},${hy + 20} Z`} fill="#7b8494" />
      <path d={`M ${hx - 8},${hy + 20} L ${hx - 10},${hy + 34} M ${hx + 8},${hy + 20} L ${hx + 10},${hy + 34}`} fill="none" strokeWidth={2} />
    </g>
  );
}

function ArmShape({ outfit, held }: { outfit: Outfit; held?: PersonHeld }) {
  // Hanging straight down from the shoulder; turned about it to point or count.
  return (
    <>
      {held && <HeldThing held={held} />}
      <path d={`M ${SHOULDER.x},${SHOULDER.y} L ${SHOULDER.x + 1},${SHOULDER.y + 20}`} stroke={outfit === 'stripes' || outfit === 'medic' ? '#e9e6df' : outfit === 'security' ? '#f2c230' : '#262a36'} strokeWidth={7} strokeLinecap="round" />
      <path d={`M ${SHOULDER.x},${SHOULDER.y} L ${SHOULDER.x + 1},${SHOULDER.y + 20}`} stroke={INK} strokeWidth={8.6} strokeLinecap="round" opacity={0.25} />
      <path d={`M ${SHOULDER.x + 1},${SHOULDER.y + 18} L ${SHOULDER.x + 1.5},${SHOULDER.y + 34}`} stroke={SKIN} strokeWidth={6} strokeLinecap="round" />
      <circle cx={SHOULDER.x + 1.5} cy={SHOULDER.y + 35} r={3.4} fill={SKIN} stroke={INK} strokeWidth={1} />
    </>
  );
}

export const Person = memo(function Person({
  outfit,
  face,
  id,
  held,
  onParts,
}: {
  outfit: Outfit;
  face: Face;
  /** What is in the working hand, if anything. */
  held?: PersonHeld;
  /** Unique on the page: names the stripe pattern. */
  id: string;
  onParts: (parts: PersonParts | null) => void;
}) {
  // Collected as the refs fire, handed over once the set is complete. The
  // callbacks are made once, so a re-render does not hand them over again.
  const register = useMemo(() => {
    const parts: Partial<PersonParts> = {};
    const made = new Map<keyof PersonParts, (el: Element | null) => void>();
    return <K extends keyof PersonParts>(key: K) => {
      if (!made.has(key)) {
        made.set(key, (el) => {
          if (el) parts[key] = el as PersonParts[K];
          else delete parts[key];
          if (parts.root && parts.standing && parts.kneeling && parts.arm && parts.kneelArm && parts.back) onParts({ ...(parts as PersonParts) });
          else if (key === 'root' && !el) onParts(null);
        });
      }
      return made.get(key)! as (el: PersonParts[K] | null) => void;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const stripes = `stripes-${id.replace(/[^a-z0-9]/gi, '')}`;
  const origin = (dy: number) => ({ transformBox: 'view-box' as const, transformOrigin: `${SHOULDER.x}px ${SHOULDER.y + dy}px` });
  return (
    <div ref={register('root')} className="relative w-full" style={{ transformOrigin: '50% 100%', willChange: 'transform', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.55))' }}>
      <svg viewBox={`0 0 ${PERSON_VIEW.w} ${PERSON_VIEW.h}`} className="block w-full overflow-visible" aria-hidden>
        <defs>
          <pattern id={stripes} width={6} height={10} patternUnits="userSpaceOnUse">
            <rect width={6} height={10} fill="#f4f1ea" />
            <rect width={3} height={10} fill="#16161a" />
          </pattern>
        </defs>
        {/* On his feet. */}
        <g ref={register('standing')}>
          <path d="M 24,84 L 23,144 M 36,84 L 37,144" stroke="#1b1c22" strokeWidth={9} strokeLinecap="round" />
          <path d="M 18,146 L 27,146 M 33,146 L 43,146" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
          <Torso outfit={outfit} dy={0} stripes={stripes} />
          <Head face={face} cx={30} cy={19} r={10} />
          <g ref={register('arm')} style={origin(0)}>
            <ArmShape outfit={outfit} held={held} />
          </g>
        </g>
        {/* Down on one knee, beside a cover. */}
        <g ref={register('kneeling')} style={{ opacity: 0 }}>
          {/* One knee on the mat behind, the other foot planted in front. */}
          <path d="M 25,128 L 17,144 L 3,145 M 36,128 L 49,126 L 50,144" stroke="#1b1c22" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M 46,146 L 56,146" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
          <Torso outfit={outfit} dy={KNEEL_DROP} stripes={stripes} />
          <Head face={face} cx={30} cy={19 + KNEEL_DROP} r={10} />
          <g ref={register('kneelArm')} style={origin(KNEEL_DROP)}>
            <g transform={`translate(0 ${KNEEL_DROP})`}>
              <ArmShape outfit={outfit} />
            </g>
          </g>
        </g>
        {/* His back to the ring: the back of his head over his face. */}
        <g ref={register('back')} style={{ opacity: 0 }}>
          <circle cx={30} cy={18.5} r={10.6} fill="#2a1d14" stroke={INK} strokeWidth={1.6} />
          <path d="M 23,24 Q 30,28 37,24" stroke="#3b2a1d" strokeWidth={1.4} fill="none" />
        </g>
      </svg>
    </div>
  );
});

/** Initials for somebody with no art at all. */
export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase())
    .slice(0, 2)
    .join('');
