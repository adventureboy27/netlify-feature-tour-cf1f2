// The stars, after the match: big, gold and bevelled, counting up a quarter
// at a time to exactly what the simulation gave the match, then a line that
// sums it up (starQuote.ts) — the verdict, and the real reason for it.
//
// The count-up is only the reveal. The rating was decided once, at the end
// (sim/matchRating.ts): the stars land on it and nothing in the climb says
// anything the result does not.

import { useEffect, useMemo, useState } from 'react';

/** Milliseconds between quarter stars as they count up. */
const QUARTER_MS = 150;
/** A breath after the last quarter before the line comes in. */
const QUOTE_AFTER_MS = 450;

const R_OUT = 48;
const R_IN = 20;

type Pt = [number, number];
/** The star's ten points, outer then inner alternating, the first straight up. */
const POINTS: Pt[] = Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  const r = i % 2 === 0 ? R_OUT : R_IN;
  return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
});
const OUTLINE = POINTS.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

/**
 * The bevel: ten triangles from the centre, each lit by how squarely it faces
 * a light up and to the left. Lighter faces toward it, darker away.
 */
const FACETS = POINTS.map((p, i) => {
  const q = POINTS[(i + 1) % 10]!;
  const mx = (p[0] + q[0]) / 2 - 50;
  const my = (p[1] + q[1]) / 2 - 50;
  const facing = Math.atan2(my, mx);
  const light = Math.atan2(-1, -1);
  const lit = 0.5 + 0.5 * Math.cos(facing - light);
  return { points: `50,50 ${p[0].toFixed(2)},${p[1].toFixed(2)} ${q[0].toFixed(2)},${q[1].toFixed(2)}`, lit };
});

/** Gold from shadow (0) to highlight (1). */
function gold(t: number): string {
  const stops: [number, [number, number, number]][] = [
    [0, [150, 92, 6]],
    [0.45, [236, 170, 20]],
    [0.75, [255, 214, 64]],
    [1, [255, 246, 180]],
  ];
  for (let i = 1; i < stops.length; i++) {
    const [b, cb] = stops[i]!;
    const [a, ca] = stops[i - 1]!;
    if (t <= b) {
      const k = (t - a) / (b - a);
      const c = ca.map((v, j) => Math.round(v + (cb[j]! - v) * k));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return 'rgb(255,246,180)';
}

/** One star, filled `fill` of the way across (0-1). */
function Star({ fill, index, popped }: { fill: number; index: number; popped: boolean }) {
  const clip = `sr-clip-${index}`;
  return (
    <svg viewBox="0 0 100 100" className={`mv-star h-full w-full overflow-visible ${popped ? 'mv-star-pop' : ''}`} aria-hidden>
      <defs>
        <clipPath id={clip}>
          <rect x={0} y={0} width={fill * 100} height={100} />
        </clipPath>
        <clipPath id={`sr-shape-${index}`}>
          <polygon points={OUTLINE} />
        </clipPath>
        <radialGradient id={`sr-gloss-${index}`} cx="34%" cy="26%" r="40%">
          <stop offset="0%" stopColor="#fffbe6" stopOpacity={0.95} />
          <stop offset="100%" stopColor="#fffbe6" stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* The empty slot: a dark, recessed star the gold fills into. */}
      <polygon points={OUTLINE} fill="#1c1608" stroke="#4a3b14" strokeWidth={2} strokeLinejoin="round" />
      <g clipPath={`url(#${clip})`}>
        {/* Shadow under it, then the bevelled faces, then the rim and the shine. */}
        <polygon points={OUTLINE} transform="translate(2.5 3.5)" fill="#000" opacity={0.45} />
        {FACETS.map((f, i) => (
          <polygon key={i} points={f.points} fill={gold(f.lit)} stroke={gold(f.lit * 0.9)} strokeWidth={0.4} />
        ))}
        <polygon points={OUTLINE} fill="none" stroke="#7a4d02" strokeWidth={2.2} strokeLinejoin="round" />
        <polygon points={OUTLINE} fill={`url(#sr-gloss-${index})`} />
        {/* The glint, kept inside the star. */}
        <path d="M 36,40 Q 42,28 50,22" clipPath={`url(#sr-shape-${index})`} stroke="#fffde8" strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.85} />
      </g>
    </svg>
  );
}

export function StarReveal({ stars, quote, onDismiss }: { stars: number; quote: string; onDismiss?: () => void }) {
  const target = Math.max(0, Math.min(5, Math.round(stars * 4) / 4));
  const still = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [shown, setShown] = useState(still ? target : 0);
  const [quoteIn, setQuoteIn] = useState(still);

  useEffect(() => {
    if (still) return;
    if (shown < target) {
      const t = window.setTimeout(() => setShown((s) => Math.min(target, s + 0.25)), QUARTER_MS);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setQuoteIn(true), QUOTE_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [shown, target, still]);

  const fills = useMemo(() => Array.from({ length: 5 }, (_, i) => Math.max(0, Math.min(1, shown - i))), [shown]);

  return (
    <div
      data-testid="star-reveal"
      role="button"
      tabIndex={0}
      onClick={onDismiss}
      onKeyDown={(e) => (e.key === 'Escape' || e.key === 'Enter') && onDismiss?.()}
      className="mv-star-backdrop absolute inset-0 z-30 flex cursor-pointer flex-col items-center justify-center gap-6"
    >
      <div className="flex h-[min(18vw,150px)] items-center gap-[min(1.6vw,16px)]" aria-label={`${target} stars`}>
        {fills.map((fill, i) => (
          <div key={i} className="aspect-square h-full">
            <Star fill={fill} index={i} popped={fill === 1} />
          </div>
        ))}
      </div>
      <p
        data-testid="star-quote"
        className={`max-w-[80%] text-center font-serif text-[clamp(18px,2.4vw,30px)] italic leading-snug text-amber-50 transition-all duration-700 ${quoteIn ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
        style={{ textShadow: '0 2px 12px rgba(0,0,0,0.9)' }}
      >
        “{quote}”
      </p>
    </div>
  );
}
