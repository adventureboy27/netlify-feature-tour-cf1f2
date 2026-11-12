// A championship belt, drawn for the title it is.
//
// The game stores a strap and a plate colour for every title and a tier and
// a division, and for a long time the only belt ever drawn was one gold
// rectangle on a brown strap. This draws each title its own: the colours it
// was given, a main plate shaped by what kind of title it is, and an emblem,
// jewels and side plates seeded from the title itself — so two secondary
// titles in the same company are still two different belts, and the same
// belt is the same belt every time it is seen.

import type { Title } from '../../engine/types';

export type BeltLook = Pick<Title, 'id' | 'tier' | 'division' | 'colorway'>;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const JEWELS = ['#d1202f', '#1f6fd1', '#17a05a', '#7a3fd1', '#f2f2f2'] as const;
const DEFAULT: BeltLook = { id: 'belt', tier: 'world', division: 'open', colorway: { strap: '#3a2214', plate: '#f1c40f' } };

/** The main plate's outline, by the kind of title. All centred on (60,20). */
function plate(tier: Title['tier']): string {
  switch (tier) {
    case 'world':
      // The big one: a tall shield with a crowned top and a pointed foot.
      return 'M 38,6 L 46,2 L 53,5 L 60,0 L 67,5 L 74,2 L 82,6 L 84,22 Q 80,34 60,40 Q 40,34 36,22 Z';
    case 'tag':
    case 'trios':
      // Two round plates joined: a belt made in pairs.
      return 'M 60,9 A 13,13 0 1 0 60,31 A 13,13 0 1 0 60,9 Z';
    case 'hardcore':
      // Cut from scrap: an eight-sided slab.
      return 'M 44,4 L 76,4 L 84,12 L 84,28 L 76,36 L 44,36 L 36,28 L 36,12 Z';
    case 'television':
      // A screen.
      return 'M 40,6 Q 60,2 80,6 Q 84,20 80,34 Q 60,38 40,34 Q 36,20 40,6 Z';
    case 'cruiserweight':
      // Winged: wide and swept.
      return 'M 32,14 L 46,8 L 60,3 L 74,8 L 88,14 L 80,22 L 86,28 L 72,30 L 60,37 L 48,30 L 34,28 L 40,22 Z';
    case 'secondary':
      return 'M 60,3 Q 84,3 84,20 Q 84,37 60,37 Q 36,37 36,20 Q 36,3 60,3 Z';
    default:
      return 'M 44,5 L 76,5 Q 82,5 82,11 L 82,29 Q 82,35 76,35 L 44,35 Q 38,35 38,29 L 38,11 Q 38,5 44,5 Z';
  }
}

function Emblem({ kind, ink }: { kind: number; ink: string }) {
  switch (kind % 5) {
    case 0:
      // A star.
      return <path d="M 60,11 L 62.6,17.2 L 69.4,17.8 L 64.2,22.2 L 65.8,28.8 L 60,25.2 L 54.2,28.8 L 55.8,22.2 L 50.6,17.8 L 57.4,17.2 Z" fill={ink} />;
    case 1:
      // A globe.
      return (
        <g fill="none" stroke={ink} strokeWidth={1.3}>
          <circle cx={60} cy={20} r={8.5} />
          <ellipse cx={60} cy={20} rx={3.6} ry={8.5} />
          <path d="M 51.5,20 L 68.5,20 M 53,15 L 67,15 M 53,25 L 67,25" />
        </g>
      );
    case 2:
      // A crown.
      return <path d="M 51,26 L 50,15 L 55,20 L 60,12 L 65,20 L 70,15 L 69,26 Z M 51,27.5 L 69,27.5 L 69,29.5 L 51,29.5 Z" fill={ink} />;
    case 3:
      // An eagle, wings out.
      return <path d="M 60,13 L 62,17 L 72,14 L 67,20 L 71,22 L 64,23 L 62,29 L 60,25 L 58,29 L 56,23 L 49,22 L 53,20 L 48,14 L 58,17 Z" fill={ink} />;
    default:
      // A cut diamond.
      return <path d="M 60,11 L 68,20 L 60,29 L 52,20 Z M 56,20 L 60,15.5 L 64,20 L 60,24.5 Z" fill={ink} fillRule="evenodd" />;
  }
}

/** Where on a figure a belt goes. One round the waist; a second and third go over the shoulders. */
export type BeltPlace = 'overhead' | 'waist' | 'shoulder' | 'otherShoulder';
const PLACES: Record<BeltPlace, React.CSSProperties> = {
  overhead: { left: '12%', top: '-3%', width: '76%' },
  waist: { left: '22%', top: '51.5%', width: '56%' },
  shoulder: { left: '8%', top: '21%', width: '46%', transform: 'rotate(62deg)' },
  otherShoulder: { left: '46%', top: '21%', width: '46%', transform: 'rotate(-62deg)' },
};
/** Where the n-th belt somebody is carrying goes, given whether the first is being held up. */
export const placeOf = (n: number, raised: boolean): BeltPlace => (raised ? (['overhead', 'waist', 'shoulder', 'otherShoulder'] as const) : (['waist', 'shoulder', 'otherShoulder'] as const))[n] ?? 'otherShoulder';

export function Belt({ look = DEFAULT, at = 'overhead' }: { look?: BeltLook; at?: BeltPlace }) {
  const seed = hash(look.id);
  const { strap, plate: metal } = look.colorway;
  const ink = 'rgba(0,0,0,0.55)';
  const world = look.tier === 'world';
  const paired = look.tier === 'tag' || look.tier === 'trios';
  // A light strap takes dark stitching, a dark one light.
  const lightStrap = parseInt(strap.slice(1, 3), 16) + parseInt(strap.slice(3, 5), 16) + parseInt(strap.slice(5, 7), 16) > 420;
  const stitch = lightStrap ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.3)';
  const jewel = JEWELS[seed % JEWELS.length]!;
  const sides = world ? [16, 27, 93, 104] : [22, 98];
  const sideKind = (seed >>> 5) % 3;
  return (
    <svg
      viewBox="0 0 120 40"
      className="pointer-events-none absolute"
      style={PLACES[at]}
      data-belt={look.tier}
      aria-hidden
    >
      {/* The strap: leather, stitched along both edges, snaps at the ends. */}
      <path d="M 2,14 Q 20,10 40,10 L 80,10 Q 100,10 118,14 L 118,26 Q 100,30 80,30 L 40,30 Q 20,30 2,26 Z" fill={strap} stroke="#0b0806" strokeWidth={1.2} />
      <path d="M 4,15.5 Q 20,12 40,12 L 80,12 Q 100,12 116,15.5 M 4,24.5 Q 20,28 40,28 L 80,28 Q 100,28 116,24.5" stroke={stitch} strokeWidth={0.7} strokeDasharray="1.6 1.4" fill="none" />
      {[5.5, 9, 111, 114.5].map((x) => (
        <circle key={x} cx={x} cy={20} r={1.1} fill={metal} stroke="#000" strokeOpacity={0.4} strokeWidth={0.4} />
      ))}
      {/* Women's titles carry a thin coloured edge to the strap. */}
      {look.division === 'womens' && <path d="M 2,14 Q 20,10 40,10 L 80,10 Q 100,10 118,14" stroke={jewel} strokeWidth={1.4} fill="none" />}

      {/* Side plates. */}
      {sides.map((x) =>
        sideKind === 0 ? (
          <circle key={x} cx={x} cy={20} r={world ? 4.6 : 5.6} fill={metal} stroke={ink} strokeWidth={1} />
        ) : sideKind === 1 ? (
          <rect key={x} x={x - (world ? 4 : 5)} y={world ? 15 : 14} width={world ? 8 : 10} height={world ? 10 : 12} rx={2} fill={metal} stroke={ink} strokeWidth={1} />
        ) : (
          <path key={x} d={`M ${x},${world ? 14 : 13} L ${x + (world ? 4.6 : 5.6)},20 L ${x},${world ? 26 : 27} L ${x - (world ? 4.6 : 5.6)},20 Z`} fill={metal} stroke={ink} strokeWidth={1} />
        ),
      )}
      {sides.map((x) => (
        <circle key={`j${x}`} cx={x} cy={20} r={1.3} fill={jewel} />
      ))}

      {/* The main plate, its raised border, and what is on it. */}
      {paired ? (
        <>
          <circle cx={50} cy={20} r={13} fill={metal} stroke={ink} strokeWidth={1.4} />
          <circle cx={70} cy={20} r={13} fill={metal} stroke={ink} strokeWidth={1.4} />
          <circle cx={50} cy={20} r={9.4} fill="none" stroke={ink} strokeWidth={0.8} />
          <circle cx={70} cy={20} r={9.4} fill="none" stroke={ink} strokeWidth={0.8} />
          <g transform="translate(-10 0) scale(0.82) translate(13.2 4.4)">
            <Emblem kind={seed >>> 9} ink={ink} />
          </g>
          <g transform="translate(10 0) scale(0.82) translate(13.2 4.4)">
            <Emblem kind={seed >>> 9} ink={ink} />
          </g>
        </>
      ) : (
        <>
          <path d={plate(look.tier)} fill={metal} stroke={ink} strokeWidth={1.4} strokeLinejoin="round" />
          <g transform="translate(60 20) scale(0.8) translate(-60 -20)">
            <path d={plate(look.tier)} fill="none" stroke={ink} strokeWidth={0.9} strokeLinejoin="round" />
          </g>
          <Emblem kind={seed >>> 9} ink={ink} />
          {/* Jewels round the plate: more of them the bigger the title. */}
          {(world ? [[44, 12], [76, 12], [42, 24], [78, 24], [60, 34.5]] : [[43, 20], [77, 20]]).map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={1.5} fill={jewel} stroke="#000" strokeOpacity={0.45} strokeWidth={0.4} />
          ))}
        </>
      )}
      {/* The light catching it. */}
      <path d="M 44,6 L 54,6 L 46,34 L 40,30 Z" fill="#fff" opacity={0.2} />
    </svg>
  );
}
