// A pyro charge going off: drawn by hand, in the same ink as the wrestlers.
// Three tongues of flame inside one another (outline, orange, yellow, a
// white-hot core), each flickering at its own speed, sparks popping inside
// it, embers thrown off the top, and a glow on the mat under it. The whole
// thing rises and dies away (match.css mv-pyro); nothing here loops for
// longer than the burst lasts.

// The flame, in a 60×160 box, base at the bottom. Hand-drawn: uneven tongues,
// one leaning, none symmetrical.
const OUTER = 'M 6,154 C 2,128 10,108 6,84 C 14,96 16,104 18,92 C 14,64 22,44 18,18 C 28,40 30,52 32,38 C 34,22 30,10 34,2 C 42,24 48,40 44,62 C 50,56 52,48 54,40 C 58,64 56,84 50,100 C 56,98 58,94 60,88 C 60,118 56,138 54,154 C 46,161 14,161 6,154 Z';
const MIDDLE = 'M 12,155 C 9,134 16,118 14,100 C 20,108 22,112 24,104 C 22,82 28,66 27,46 C 34,62 36,72 38,60 C 40,72 44,80 42,96 C 46,92 48,88 50,84 C 52,110 50,138 48,155 C 40,160 20,160 12,155 Z';
const CORE = 'M 20,156 C 18,140 22,126 22,114 C 26,120 28,122 30,114 C 30,104 33,96 34,88 C 38,100 40,112 38,124 C 41,122 42,118 43,116 C 44,134 42,148 41,156 C 36,159 25,159 20,156 Z';

/** Where the sparks pop: x, height up the flame (0 base, 1 tip), delay in s, size. */
const SPARKS: readonly (readonly [number, number, number, number])[] = [
  [24, 0.35, 0.05, 1],
  [38, 0.5, 0.18, 0.8],
  [30, 0.62, 0.3, 1.2],
  [18, 0.48, 0.42, 0.7],
  [42, 0.3, 0.5, 0.9],
  [28, 0.75, 0.6, 0.8],
  [36, 0.7, 0.72, 1],
];
/** Embers thrown off the top: where they leave from, and which way they go. */
const EMBERS: readonly (readonly [number, number, number])[] = [
  [26, -14, 0.1],
  [34, 10, 0.2],
  [30, -4, 0.35],
  [40, 18, 0.45],
  [22, -22, 0.55],
];

/** A four-point sparkle, centred on 0,0. */
const STAR = 'M 0,-5 L 1.2,-1.2 L 5,0 L 1.2,1.2 L 0,5 L -1.2,1.2 L -5,0 L -1.2,-1.2 Z';

export function PyroBurst({ left, bottom, width, height }: { left: number; bottom: number; width: number; height: number }) {
  return (
    <div className="pointer-events-none absolute" style={{ left: left - width / 2, top: bottom - height, width, height, zIndex: 6 }} aria-hidden>
      {/* Light on the mat under it. */}
      <div
        className="mv-pyro-glow absolute"
        style={{ left: '-60%', right: '-60%', bottom: '-4%', height: '14%', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(255,200,90,0.75), rgba(255,120,30,0.25) 60%, transparent)' }}
      />
      <div className="mv-pyro absolute inset-0">
        <svg viewBox="0 0 60 160" className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none">
          <g className="mv-flick-a" style={{ transformOrigin: '50% 100%', transformBox: 'fill-box' }}>
            <path d={OUTER} fill="#ff6a17" stroke="#3a1404" strokeWidth={2.4} strokeLinejoin="round" />
          </g>
          <g className="mv-flick-b" style={{ transformOrigin: '50% 100%', transformBox: 'fill-box' }}>
            <path d={MIDDLE} fill="#ffb428" stroke="#7a2c06" strokeWidth={1.2} strokeLinejoin="round" />
          </g>
          <g className="mv-flick-c" style={{ transformOrigin: '50% 100%', transformBox: 'fill-box' }}>
            <path d={CORE} fill="#fff4c4" />
          </g>
          {SPARKS.map(([x, up, delay, size], i) => (
            <g key={i} transform={`translate(${x} ${160 - up * 150}) scale(${size})`}>
              <path d={STAR} className="mv-spark" fill="#fffbe8" stroke="#ffd34a" strokeWidth={0.6} style={{ animationDelay: `${delay}s` }} />
            </g>
          ))}
          {EMBERS.map(([x, drift, delay], i) => (
            <circle key={i} cx={x} cy={14} r={1.6} className="mv-ember" fill="#ffcf5a" style={{ animationDelay: `${delay}s`, ['--mv-drift' as string]: `${drift}px` }} />
          ))}
        </svg>
      </div>
    </div>
  );
}
