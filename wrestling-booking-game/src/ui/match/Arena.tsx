// The building the match happens in: a dark arena, a crowd, a lighting rig,
// and a ring seen from the hard-camera side. Drawn in two layers so the
// wrestlers can stand between them — everything behind the ring's front
// ropes, then the front ropes and posts over the top.
//
// All coordinates are in one 1200x600 space shared with MatchStage.tsx; the
// stage is always exactly 2:1, so a point here maps to the same point there.

import { memo, useMemo } from 'react';
import './match.css';

export const VIEW = { w: 1200, h: 600 } as const;
/** The line the wrestlers' feet stand on, mid-depth on the mat. */
export const FEET_Y = 418;
const MAT = { backY: 372, frontY: 452, backL: 350, backR: 850, frontL: 250, frontR: 950 } as const;
const ROPES_BACK = [244, 284, 324] as const;
const ROPES_FRONT = [297, 342, 387] as const;
const ROPE = '#e9e9ec';

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

const LAMPS = [150, 380, 600, 820, 1050] as const;

/** Everything behind the wrestlers. */
export const ArenaBack = memo(function ArenaBack({
  accent,
  name,
  hype,
  showName,
  cage = false,
}: {
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
      {showName && (
        <text x={600} y={97} textAnchor="middle" fontSize={24} fontWeight={800} letterSpacing={2} fill={accent} opacity={0.75} style={{ textTransform: 'uppercase' }}>
          {name.length > 22 ? name.split(/\s+/).map((w) => w[0]).join('') : name}
        </text>
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

      {/* Ring steps. */}
      <polygon points="170,536 250,536 250,470 214,470 214,500 170,500" fill="#3a3f4a" />
      <polygon points="170,500 214,500 214,470 250,470 250,476 220,476 220,506 170,506" fill="#565c69" />

      {/* Back posts, back ropes, and the two side runs. */}
      {[MAT.backL, MAT.backR].map((x) => (
        <rect key={x} x={x - 6} y={232} width={12} height={MAT.backY - 232} fill="#2b2f38" />
      ))}
      {ROPES_BACK.map((y, i) => (
        <g key={y} stroke={ROPE} strokeWidth={3} strokeLinecap="round" opacity={0.8}>
          <line x1={MAT.backL} y1={y} x2={MAT.backR} y2={y} />
          <line x1={MAT.backL} y1={y} x2={MAT.frontL} y2={ROPES_FRONT[i]} />
          <line x1={MAT.backR} y1={y} x2={MAT.frontR} y2={ROPES_FRONT[i]} />
        </g>
      ))}
      {[MAT.backL, MAT.backR].map((x) =>
        ROPES_BACK.map((y) => <rect key={`${x}-${y}`} x={x - 9} y={y - 7} width={18} height={14} rx={4} fill={accent} />),
      )}

      {cage && (
        <g>
          <polygon points={`${MAT.backL},150 ${MAT.backR},150 ${MAT.backR},${MAT.backY} ${MAT.backL},${MAT.backY}`} fill="url(#mv-mesh)" />
          <polygon points={`${MAT.backL},150 ${MAT.frontL},176 ${MAT.frontL},${MAT.frontY} ${MAT.backL},${MAT.backY}`} fill="url(#mv-mesh)" />
          <polygon points={`${MAT.backR},150 ${MAT.frontR},176 ${MAT.frontR},${MAT.frontY} ${MAT.backR},${MAT.backY}`} fill="url(#mv-mesh)" />
          <path d={`M ${MAT.backL},150 L ${MAT.backR},150 M ${MAT.backL},150 L ${MAT.backL},${MAT.backY} M ${MAT.backR},150 L ${MAT.backR},${MAT.backY} M ${MAT.backL},150 L ${MAT.frontL},176 M ${MAT.backR},150 L ${MAT.frontR},176`} stroke="#6f7888" strokeWidth={4} fill="none" />
        </g>
      )}

      {/* Canvas and apron. */}
      <polygon points={`${MAT.backL},${MAT.backY} ${MAT.backR},${MAT.backY} ${MAT.frontR},${MAT.frontY} ${MAT.frontL},${MAT.frontY}`} fill="url(#mv-mat)" />
      <ellipse cx={600} cy={412} rx={92} ry={20} fill="none" stroke={accent} strokeWidth={5} opacity={0.35} />
      <ellipse cx={600} cy={412} rx={58} ry={12} fill={accent} opacity={0.22} />
      <polygon points={`${MAT.frontL},${MAT.frontY} ${MAT.frontR},${MAT.frontY} ${MAT.frontR},538 ${MAT.frontL},538`} fill="url(#mv-apron)" />
      <rect x={MAT.frontL} y={MAT.frontY} width={MAT.frontR - MAT.frontL} height={5} fill="#ffffff" opacity={0.35} />
    </svg>
  );
});

/** The front ropes and posts — drawn over the wrestlers, who stand behind them. */
export const ArenaFront = memo(function ArenaFront({ accent, ropesRef, cage = false }: { accent: string; ropesRef: React.Ref<SVGGElement>; /** The near wall of a cage, between the camera and the wrestlers. */ cage?: boolean }) {
  return (
    <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <g ref={ropesRef}>
        {ROPES_FRONT.map((y) => (
          <g key={y} strokeLinecap="round">
            <line x1={MAT.frontL} y1={y + 1.5} x2={MAT.frontR} y2={y + 1.5} stroke="#000" strokeWidth={6} opacity={0.3} />
            <line x1={MAT.frontL} y1={y} x2={MAT.frontR} y2={y} stroke={ROPE} strokeWidth={4} />
          </g>
        ))}
      </g>
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
      {[MAT.frontL, MAT.frontR].map((x) => (
        <g key={x}>
          <rect x={x - 7} y={286} width={14} height={MAT.frontY - 286 + 6} fill="#343944" />
          <rect x={x - 7} y={286} width={5} height={MAT.frontY - 286 + 6} fill="#4c5260" />
          {ROPES_FRONT.map((y) => (
            <rect key={y} x={x - 11} y={y - 9} width={22} height={18} rx={5} fill={accent} stroke="#000" strokeOpacity={0.35} />
          ))}
        </g>
      ))}
    </svg>
  );
});
