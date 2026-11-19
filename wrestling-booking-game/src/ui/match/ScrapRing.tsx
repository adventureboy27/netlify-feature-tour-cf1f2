// The plywood ring (Setting.ring 'plywood'): what a few teenagers knock
// together out of whatever was behind the garage. Boards of every length and
// colour running every which way, a pallet in one side, a sign somebody
// "found", a blue tarp for a canvas — wrinkled, ripped and taped — real rope
// (three different ropes, because that is what there was) tied off round
// fence posts, a towel and a pool noodle for turnbuckle pads, the company's
// name spray-painted on the front, and the whole thing up on cinder blocks.
//
// Drawn only; Arena.tsx decides when, and hands over where the ring is. Every
// "random" detail comes from a fixed seed, so it is the same ring every show
// — they built it once.

import { memo, useMemo } from 'react';
import { markerPath, markerText, markerWidth } from './markerFont';

export type ScrapGeo = {
  mat: { backY: number; frontY: number; backL: number; backR: number; frontL: number; frontR: number };
  platform: { backY: number; frontY: number; backL: number; backR: number; frontL: number; frontR: number };
  skirtBottom: number;
};

/** Top, middle, bottom: three different ropes. */
export const SCRAP_ROPES = [
  { base: '#b8955e', twist: '#7a5a30', hi: '#e2c690' }, // hemp off a boat trailer
  { base: '#2f6fb3', twist: '#173f6e', hi: '#7fb0e6' }, // blue poly from the hardware store
  { base: '#d6ad35', twist: '#8f6f12', hi: '#f3dc8a' }, // a yellow ski rope
] as const;

function lcg(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

/** Weathered grey, pine, cedar, old stain, a painted board or two. */
const WOOD = ['#9c7447', '#b48a55', '#857563', '#8a5a3a', '#a89577', '#6e5a43', '#c49d63', '#7c7266', '#9a6b3f', '#b9a27c'] as const;
const PAINTED = ['#4f7a52', '#9b3a2e', '#d8d2c0', '#3f5f7d'] as const;

/** A point on a quad given by its back and front edges (u across, v back to front). */
function onQuad(q: ScrapGeo['mat'], u: number, v: number): [number, number] {
  const y = q.backY + (q.frontY - q.backY) * v;
  const l = q.backL + (q.frontL - q.backL) * v;
  const r = q.backR + (q.frontR - q.backR) * v;
  return [l + (r - l) * u, y];
}
const pts = (p: [number, number][]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/**
 * A length of real rope: sagging, twisted (darker lay marks along it), with a
 * glint on top. `kind` is 0, 1, 2 for top, middle, bottom.
 */
export function ScrapRope({ x1, y1, x2, y2, kind, w = 3.4, sag = 0, shadow = false }: { x1: number; y1: number; x2: number; y2: number; kind: number; w?: number; sag?: number; shadow?: boolean }) {
  const c = SCRAP_ROPES[kind % 3]!;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + sag * 2;
  const d = `M ${x1},${y1} Q ${mx},${my} ${x2},${y2}`;
  return (
    <g fill="none" strokeLinecap="round">
      {shadow && <path d={d} transform="translate(0 2)" stroke="#000" strokeWidth={w + 2.5} opacity={0.28} />}
      <path d={d} stroke={c.base} strokeWidth={w} />
      {/* The lay: dark turns along it, offset top and bottom so they slant like strands. */}
      <path d={d} transform={`translate(0 ${(w * 0.18).toFixed(2)})`} stroke={c.twist} strokeWidth={w * 0.45} strokeDasharray={`${(w * 0.5).toFixed(2)} ${(w * 0.7).toFixed(2)}`} opacity={0.9} />
      <path d={d} transform={`translate(0 ${(-w * 0.15).toFixed(2)})`} stroke={c.twist} strokeWidth={w * 0.4} strokeDasharray={`${(w * 0.5).toFixed(2)} ${(w * 0.7).toFixed(2)}`} strokeDashoffset={w * 0.35} opacity={0.75} />
      <path d={d} transform={`translate(0 ${(-w * 0.22).toFixed(2)})`} stroke={c.hi} strokeWidth={w * 0.28} opacity={0.55} />
    </g>
  );
}

/** Where a rope is tied off round a post: a lump of knot and a loose end hanging down. */
function Knot({ x, y, kind, side, w = 3.4 }: { x: number; y: number; kind: number; side: -1 | 1; w?: number }) {
  const c = SCRAP_ROPES[kind % 3]!;
  const tail = `M ${x + side * 3},${y + 2} q ${side * 6},${8} ${side * 2},${16 + kind * 3}`;
  return (
    <g strokeLinecap="round" fill="none">
      <path d={tail} stroke={c.base} strokeWidth={w * 0.8} />
      <path d={tail} stroke={c.twist} strokeWidth={w * 0.7} strokeDasharray="2 2.5" opacity={0.7} />
      <ellipse cx={x} cy={y} rx={w * 1.5} ry={w * 1.2} fill={c.base} stroke={c.twist} strokeWidth={1.2} />
      <path d={`M ${x - w},${y - 1} q ${w},${w * 1.4} ${w * 2},0`} stroke={c.twist} strokeWidth={1} />
    </g>
  );
}

/**
 * A fence post for a ring post: a 4x4, a little out of true, with grain and
 * a nail or two. Leans about its foot.
 */
export function ScrapPost({ x, top, bottom, width, lean = 0, tone = 0 }: { x: number; top: number; bottom: number; width: number; lean?: number; tone?: number }) {
  const fill = ['#8d6b45', '#7b6550', '#9a7a52', '#6f5a45'][tone % 4]!;
  return (
    <g transform={`rotate(${lean} ${x} ${bottom})`}>
      <rect x={x - width / 2} y={top} width={width} height={bottom - top} fill={fill} />
      <rect x={x + width / 2 - width * 0.3} y={top} width={width * 0.3} height={bottom - top} fill="#000" opacity={0.25} />
      <path d={`M ${x - width * 0.25},${top + 6} l 1,${(bottom - top) * 0.4} M ${x},${top + 20} l -1,${(bottom - top) * 0.5} M ${x - width * 0.1},${top + (bottom - top) * 0.6} l 1,${(bottom - top) * 0.3}`} stroke="#000" strokeOpacity={0.22} strokeWidth={1} />
      {/* A sawn top, not quite square. */}
      <polygon points={`${x - width / 2},${top} ${x + width / 2},${top - 2} ${x + width / 2},${top + 2} ${x - width / 2},${top + 3}`} fill="#c9a874" />
      <circle cx={x - width * 0.15} cy={top + (bottom - top) * 0.78} r={1.1} fill="#2a2a2a" />
    </g>
  );
}

/**
 * Turnbuckle padding, such as it is. `kind` 0: a striped beach towel held
 * on with duct tape. 1: a length of pool noodle. 2: a pillow taped round it.
 * 3: just tape.
 */
export function ScrapPad({ x, y, w, h, kind }: { x: number; y: number; w: number; h: number; kind: number }) {
  if (kind === 0) {
    return (
      <g>
        <rect x={x - w / 2 - 1} y={y - h / 2 - 2} width={w + 2} height={h + 4} rx={3} fill="#e8dcc0" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={x - w / 2 - 1} y={y - h / 2 - 2 + i * ((h + 4) / 3)} width={w + 2} height={(h + 4) / 6} fill={['#d2463c', '#2f8ec4', '#e8b82e'][i]} />
        ))}
        <rect x={x - w / 2 - 2} y={y - 1.5} width={w + 4} height={3.5} fill="#b9bcc2" />
        <path d={`M ${x - w / 2},${y + h / 2 + 2} l 2,5 l 3,-4 l 3,5`} fill="none" stroke="#e8dcc0" strokeWidth={1.5} />
      </g>
    );
  }
  if (kind === 1) {
    return (
      <g>
        <rect x={x - w / 2 + 1} y={y - h / 2} width={w - 2} height={h} rx={(w - 2) / 2} fill="#39d07a" />
        <rect x={x - w / 2 + 3} y={y - h / 2 + 2} width={3} height={h - 4} rx={1.5} fill="#a9f5c6" opacity={0.7} />
        <ellipse cx={x} cy={y - h / 2 + 1} rx={(w - 2) / 2} ry={2.4} fill="#2aa85f" />
        <rect x={x - w / 2} y={y + h * 0.15} width={w} height={3} fill="#b9bcc2" />
      </g>
    );
  }
  if (kind === 2) {
    return (
      <g>
        <path d={`M ${x - w / 2 - 3},${y - h / 2} q ${w / 2 + 3},-4 ${w + 6},0 q 3,${h / 2} 0,${h} q ${-(w / 2 + 3)},4 ${-(w + 6)},0 q -3,${-h / 2} 0,${-h} z`} fill="#ece6d6" />
        <path d={`M ${x - w / 2},${y - 2} q ${w / 2},3 ${w},0`} fill="none" stroke="#b9b09a" strokeWidth={1} />
        <rect x={x - w / 2 - 3} y={y + 1} width={w + 6} height={3} fill="#b9bcc2" />
      </g>
    );
  }
  return (
    <g>
      <rect x={x - w / 2 - 1} y={y - 3} width={w + 2} height={6} fill="#b9bcc2" />
      <rect x={x - w / 2 - 1} y={y - 3} width={w + 2} height={1.5} fill="#e4e6ea" opacity={0.7} />
    </g>
  );
}

/** The boards of the platform's top, round the canvas: every length, colour and direction. */
function ApronTop({ geo }: { geo: ScrapGeo }) {
  const boards = useMemo(() => {
    const p = geo.platform;
    const rnd = lcg(7331);
    const out: { pts: string; fill: string; nails: [number, number][] }[] = [];
    // How deep the apron is, as a fraction of the platform front to back.
    const d = (geo.mat.backY - p.backY) / (p.frontY - p.backY);
    const side = (geo.mat.frontL - p.frontL) / (p.frontR - p.frontL);
    const board = (u0: number, u1: number, v0: number, v1: number) => {
      const corners: [number, number][] = [onQuad(p, u0, v0), onQuad(p, u1, v0), onQuad(p, u1, v1), onQuad(p, u0, v1)];
      // Sawn by eye: nudge every corner a hair.
      const j = corners.map(([x, y]) => [x + (rnd() - 0.5) * 2.2, y + (rnd() - 0.5) * 0.8] as [number, number]);
      const fill = rnd() < 0.08 ? PAINTED[Math.floor(rnd() * PAINTED.length)]! : WOOD[Math.floor(rnd() * WOOD.length)]!;
      const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      out.push({ pts: pts(j), fill, nails: [mid(j[0]!, j[3]!), mid(j[1]!, j[2]!)] });
    };
    // Front and back strips: boards laid across, in runs of odd lengths.
    for (const [v0, v1] of [[1 - d, 1], [0, d]] as const) {
      const rows = 2;
      for (let r = 0; r < rows; r++) {
        let u = 0;
        const a = v0 + ((v1 - v0) * r) / rows;
        const b = v0 + ((v1 - v0) * (r + 1)) / rows;
        while (u < 1) {
          const len = Math.min(1 - u, 0.07 + rnd() * 0.22);
          board(u, u + len, a, b);
          u += len;
        }
      }
    }
    // The sides: boards laid front to back, short ones, some doubled up.
    for (const [u0, u1] of [[0, side], [1 - side, 1]] as const) {
      let v = d;
      while (v < 1 - d) {
        const len = Math.min(1 - d - v, 0.18 + rnd() * 0.3);
        const split = rnd() < 0.5;
        if (split) {
          board(u0, (u0 + u1) / 2, v, v + len);
          board((u0 + u1) / 2, u1, v, v + len * (0.6 + rnd() * 0.4));
        } else board(u0, u1, v, v + len);
        v += len;
      }
    }
    return out;
  }, [geo]);
  return (
    <g>
      {boards.map((b, i) => (
        <g key={i}>
          <polygon points={b.pts} fill={b.fill} stroke="#2e2116" strokeWidth={1.1} strokeLinejoin="round" />
          {b.nails.map(([x, y], n) => (
            <circle key={n} cx={x} cy={y} r={0.9} fill="#2b2b2b" />
          ))}
        </g>
      ))}
    </g>
  );
}

/**
 * A blue tarp for a canvas. Sun-faded, wrinkled where it was never pulled
 * tight, ripped through to the boards in two places, one of them taped over
 * (badly), grommets showing along the front.
 */
function Tarp({ geo }: { geo: ScrapGeo }) {
  const m = geo.mat;
  const q = (u: number, v: number) => onQuad(m, u, v);
  const P = (u: number, v: number) => q(u, v).map((n) => n.toFixed(1)).join(',');
  // Folds where it was never pulled tight: [u0, v0, u1, v1, bend]. Most of
  // them fan out from the corners, where the slack ended up.
  const wrinkles: [number, number, number, number, number][] = [
    [0.0, 0.05, 0.14, 0.3, 5],
    [0.02, 0.12, 0.2, 0.22, -4],
    [0.0, 0.92, 0.16, 0.68, -6],
    [0.03, 0.98, 0.22, 0.86, 4],
    [1.0, 0.06, 0.84, 0.28, -5],
    [0.98, 0.14, 0.8, 0.12, 3],
    [1.0, 0.95, 0.86, 0.66, 5],
    [0.4, 0.3, 0.52, 0.48, 7],
    [0.55, 0.85, 0.7, 0.98, -4],
    [0.3, 0.62, 0.4, 0.92, 6],
  ];
  return (
    <g>
      <defs>
        <linearGradient id="mv-tarp" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3f73aa" />
          <stop offset="55%" stopColor="#5585b8" />
          <stop offset="100%" stopColor="#3a6aa0" />
        </linearGradient>
      </defs>
      {/* The tarp hangs past the edge of the boards here and there. */}
      <polygon points={`${P(0, 0)} ${P(1, 0)} ${P(1.012, 1)} ${P(-0.01, 1.04)}`} fill="url(#mv-tarp)" />
      {/* Bleached where the sun gets it. */}
      <polygon points={`${P(0.55, 0)} ${P(0.95, 0)} ${P(0.8, 0.6)} ${P(0.5, 0.45)}`} fill="#a9c6e2" opacity={0.18} />
      <ellipse cx={q(0.25, 0.6)[0]} cy={q(0.25, 0.6)[1]} rx={70} ry={12} fill="#a9c6e2" opacity={0.12} />
      {wrinkles.map(([u0, v0, u1, v1, bow], i) => {
        const [x0, y0] = q(u0, v0);
        const [x1, y1] = q(u1, v1);
        // An S-bend, so it reads as cloth and not a scratch.
        const ax = x0 + (x1 - x0) * 0.33 + bow * 2;
        const ay = y0 + (y1 - y0) * 0.33 - bow * 0.5;
        const bx = x0 + (x1 - x0) * 0.66 - bow * 1.5;
        const by = y0 + (y1 - y0) * 0.66 + bow * 0.4;
        const d = `M ${x0},${y0} C ${ax},${ay} ${bx},${by} ${x1},${y1}`;
        return (
          <g key={i} fill="none" strokeLinecap="round">
            <path d={d} transform="translate(0 2.4)" stroke="#173558" strokeWidth={6} opacity={0.32} />
            <path d={d} transform="translate(0 1.2)" stroke="#23466f" strokeWidth={3} opacity={0.35} />
            <path d={d} stroke="#8fb6df" strokeWidth={2.4} opacity={0.6} />
          </g>
        );
      })}
      {/* A stain nobody wants to talk about. */}
      <ellipse cx={q(0.66, 0.7)[0]} cy={q(0.66, 0.7)[1]} rx={34} ry={7} fill="#2b2a24" opacity={0.22} />
      <ellipse cx={q(0.69, 0.68)[0]} cy={q(0.69, 0.68)[1]} rx={14} ry={3} fill="#2b2a24" opacity={0.18} />
      {/* Rip one, near the front: through to the boards, a flap folded back. */}
      <polygon points={`${P(0.8, 0.72)} ${P(0.845, 0.7)} ${P(0.87, 0.78)} ${P(0.9, 0.8)} ${P(0.86, 0.9)} ${P(0.82, 0.86)} ${P(0.79, 0.8)}`} fill="#9a7447" stroke="#1d3d63" strokeWidth={2} strokeLinejoin="round" />
      {/* Frayed threads round the hole. */}
      <path d={`M ${P(0.8, 0.72)} l -3,-2 M ${P(0.79, 0.8)} l -4,1 M ${P(0.82, 0.86)} l -2,3 M ${P(0.86, 0.9)} l 1,4 M ${P(0.9, 0.8)} l 4,1`} stroke="#9cc0e6" strokeWidth={1} />
      {/* A long split by the near ropes, curling open. */}
      <path d={`M ${P(0.12, 0.8)} L ${P(0.16, 0.83)} L ${P(0.2, 0.81)} L ${P(0.25, 0.85)} L ${P(0.22, 0.87)} L ${P(0.17, 0.86)} L ${P(0.13, 0.84)} Z`} fill="#8a6640" stroke="#1d3d63" strokeWidth={1.6} strokeLinejoin="round" />
      <path d={`M ${P(0.16, 0.83)} L ${P(0.2, 0.81)} L ${P(0.21, 0.79)} Z`} fill="#7fa6cf" />
      <path d={`M ${P(0.83, 0.75)} L ${P(0.85, 0.86)}`} stroke="#5a4129" strokeWidth={1} />
      <polygon points={`${P(0.845, 0.7)} ${P(0.87, 0.78)} ${P(0.905, 0.71)}`} fill="#7fa6cf" stroke="#2a4f7a" strokeWidth={0.8} />
      {/* Rip two, at the back, and the duct tape across it. */}
      <polygon points={`${P(0.2, 0.18)} ${P(0.27, 0.15)} ${P(0.31, 0.24)} ${P(0.24, 0.3)} ${P(0.21, 0.26)}`} fill="#8e6c43" />
      <polygon points={`${P(0.17, 0.16)} ${P(0.33, 0.27)} ${P(0.32, 0.31)} ${P(0.16, 0.2)}`} fill="#b7bbc1" opacity={0.95} />
      <polygon points={`${P(0.31, 0.12)} ${P(0.33, 0.15)} ${P(0.18, 0.33)} ${P(0.16, 0.29)}`} fill="#c6c9ce" opacity={0.95} />
      <polygon points={`${P(0.17, 0.16)} ${P(0.33, 0.27)} ${P(0.33, 0.275)} ${P(0.17, 0.165)}`} fill="#eef0f3" opacity={0.6} />
      {/* A third patch: tape over nothing in particular, peeling at one end. */}
      <polygon points={`${P(0.45, 0.55)} ${P(0.6, 0.57)} ${P(0.6, 0.62)} ${P(0.45, 0.6)}`} fill="#b7bbc1" />
      <polygon points={`${P(0.6, 0.57)} ${P(0.64, 0.52)} ${P(0.645, 0.565)} ${P(0.6, 0.62)}`} fill="#d8dbdf" />
      {/* Grommets along the front hem. */}
      {[0.06, 0.2, 0.34, 0.48, 0.62, 0.76, 0.9].map((u) => {
        const [x, y] = q(u, 0.985);
        return <circle key={u} cx={x} cy={y} r={2.3} fill="none" stroke="#c9ced6" strokeWidth={1.4} />;
      })}
      {/* The hem itself, where it folds over the edge. */}
      <path d={`M ${P(-0.01, 1.04)} L ${P(1.012, 1)}`} stroke="#2d5888" strokeWidth={2.5} />
    </g>
  );
}

/** Spray paint: wobbled edges, a soft overspray, and drips. */
function SprayName({ text, x, y, size, color }: { text: string; x: number; y: number; size: number; color: string }) {
  const drips = useMemo(() => {
    const rnd = lcg(text.length * 97 + 13);
    const n = Math.min(9, 3 + text.length);
    const width = text.length * size * 0.58;
    return Array.from({ length: n }, () => ({ dx: (rnd() - 0.5) * width * 0.9, len: 4 + rnd() * 14 }));
  }, [text, size]);
  return (
    <g>
      <defs>
        <filter id="mv-spray" x="-10%" y="-30%" width="120%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={4} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={3.2} result="d" />
          <feGaussianBlur in="SourceGraphic" stdDeviation={2.6} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="d" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#mv-spray)" transform={`rotate(-3 ${x} ${y})`}>
        <text x={x} y={y} textAnchor="middle" fontFamily="Impact, 'Arial Black', sans-serif" fontSize={size} fill={color} opacity={0.92} letterSpacing={2}>
          {text}
        </text>
        {drips.map((d, i) => (
          <path key={i} d={`M ${x + d.dx},${y - 2} l 0,${d.len}`} stroke={color} strokeWidth={1.6} strokeLinecap="round" opacity={0.85} />
        ))}
      </g>
    </g>
  );
}

/** The front of the platform: a patchwork of scrap, on blocks. */
function FrontFace({ geo, name }: { geo: ScrapGeo; name: string }) {
  const p = geo.platform;
  const top = p.frontY;
  const blockTop = geo.skirtBottom - 24;
  const L = p.frontL;
  const R = p.frontR;
  const W = R - L;
  const H = blockTop - top;
  const X = (f: number) => L + W * f;
  const planks = useMemo(() => {
    const rnd = lcg(4242);
    const out: { x: number; y: number; w: number; h: number; fill: string; rot?: number }[] = [];
    const wood = () => WOOD[Math.floor(rnd() * WOOD.length)]!;
    // Section A: boards laid flat, each a different width and length.
    let y = top;
    for (const h of [17, 22, 14, H - 53]) {
      let x = L;
      while (x < X(0.22)) {
        const w = Math.min(X(0.22) - x, 60 + rnd() * 90);
        out.push({ x, y, w, h, fill: wood() });
        x += w;
      }
      y += h;
    }
    // Section B: fence pickets standing up, odd widths.
    let x = X(0.22);
    while (x < X(0.4)) {
      const w = Math.min(X(0.4) - x, 12 + rnd() * 10);
      out.push({ x, y: top, w, h: H + (rnd() - 0.5) * 6, fill: rnd() < 0.3 ? '#c9b38c' : wood() });
      x += w;
    }
    // Section D: a painted door panel, flat, chipped.
    out.push({ x: X(0.6), y: top, w: X(0.78) - X(0.6), h: H, fill: '#4f7a52' });
    // Section E: more boards, one long one right across.
    out.push({ x: X(0.78), y: top, w: R - X(0.78), h: 20, fill: wood() });
    y = top + 20;
    for (const h of [16, 25, H - 61]) {
      let x2 = X(0.78);
      while (x2 < R) {
        const w = Math.min(R - x2, 40 + rnd() * 70);
        out.push({ x: x2, y, w, h, fill: wood() });
        x2 += w;
      }
      y += h;
    }
    return out;
  }, [L, R, W, H, top]);

  const pallet = { x: X(0.4), w: X(0.6) - X(0.4) };
  const short = name.length <= 12 ? name : name.split(/\s+/).filter(Boolean).map((s) => s[0]!.toUpperCase()).join('');
  return (
    <g>
      {/* What shows between the boards: the dark under the ring. */}
      <rect x={L} y={top} width={W} height={H} fill="#1b140d" />
      {planks.map((b, i) => (
        <g key={i}>
          <rect x={b.x + 0.6} y={b.y + 0.6} width={b.w - 1.2} height={b.h - 1.2} fill={b.fill} stroke="#2e2116" strokeWidth={1} />
          <path d={`M ${b.x + 4},${b.y + b.h * 0.4} l ${b.w * 0.5},1 M ${b.x + b.w * 0.3},${b.y + b.h * 0.7} l ${b.w * 0.6},-1`} stroke="#000" strokeOpacity={0.12} strokeWidth={1} />
          <circle cx={b.x + 3} cy={b.y + 4} r={0.9} fill="#2b2b2b" />
          <circle cx={b.x + b.w - 3} cy={b.y + 4} r={0.9} fill="#2b2b2b" />
        </g>
      ))}
      {/* Section C: a shipping pallet, stood on its edge — slats with gaps. */}
      <rect x={pallet.x} y={top} width={pallet.w} height={H} fill="#1b140d" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={pallet.x + 1} y={top + 2 + i * (H / 5)} width={pallet.w - 2} height={H / 5 - 5} fill={i % 2 ? '#c8a877' : '#bd9c6a'} stroke="#2e2116" strokeWidth={1} />
      ))}
      {[0.04, 0.47, 0.9].map((f) => (
        <rect key={f} x={pallet.x + pallet.w * f} y={top} width={pallet.w * 0.06} height={H} fill="#a8875a" stroke="#2e2116" strokeWidth={1} />
      ))}
      <text x={pallet.x + pallet.w * 0.25} y={top + H * 0.62} fontFamily="'Courier New', monospace" fontWeight={700} fontSize={9} fill="#3b2a1a" opacity={0.6}>
        HT · EPAL
      </text>
      {/* The door panel's paint, coming off. */}
      <rect x={X(0.6) + 8} y={top + 8} width={X(0.78) - X(0.6) - 16} height={H - 16} fill="none" stroke="#3b5f3e" strokeWidth={2} />
      <path d={`M ${X(0.63)},${top + 14} q 8,-3 14,4 q -6,5 -14,-4 Z M ${X(0.72)},${top + H - 18} q 10,-2 12,6 q -9,2 -12,-6 Z`} fill="#a8875a" opacity={0.8} />
      <circle cx={X(0.765)} cy={top + H / 2} r={3} fill="#c9b27a" />
      {/* A board off somebody's "No Trespassing" sign. */}
      <g transform={`rotate(-1.5 ${X(0.88)} ${top + 30})`}>
        <rect x={X(0.8)} y={top + 21} width={X(0.97) - X(0.8)} height={20} fill="#e6dcc2" stroke="#2e2116" strokeWidth={1} />
        <text x={X(0.805)} y={top + 36} fontFamily="'Arial Black', Impact, sans-serif" fontSize={13} fill="#b2322b" letterSpacing={1}>
          O TRESPASSI
        </text>
      </g>
      {/* A brace nailed on crooked, across two sections. */}
      <polygon points={`${X(0.2)},${top + 6} ${X(0.215)},${top + 2} ${X(0.42)},${blockTop - 6} ${X(0.405)},${blockTop - 2}`} fill="#a77d4e" stroke="#2e2116" strokeWidth={1} />
      <SprayName text={short.toUpperCase()} x={(L + R) / 2 - 20} y={top + H * 0.72} size={Math.min(42, 520 / Math.max(3, short.length))} color="#e2231a" />
      {/* Bottom edge: boards that never got cut to length. */}
      <path d={`M ${L},${blockTop} l 40,2 l 60,-3 l 90,4 l 70,-2 l 110,3 l 80,-4 l 120,3 l 90,-1 l ${W - 660},2`} fill="none" stroke="#1b140d" strokeWidth={3} />

      {/* Up on blocks. Whatever was lying around. */}
      <rect x={L} y={blockTop} width={W} height={geo.skirtBottom - blockTop} fill="#0c0a08" opacity={0.85} />
      <CinderBlock x={L + 6} y={blockTop} />
      <g>
        {/* A tyre on its side. */}
        <ellipse cx={X(0.31)} cy={blockTop + 13} rx={36} ry={11} fill="#1d1d1f" />
        <ellipse cx={X(0.31)} cy={blockTop + 10} rx={36} ry={10} fill="#2a2a2d" />
        <ellipse cx={X(0.31)} cy={blockTop + 10} rx={20} ry={5} fill="#0c0c0d" />
      </g>
      <CinderBlock x={(L + R) / 2 - 30} y={blockTop} />
      <g>
        {/* Bricks, two of them, one on the other. */}
        <rect x={X(0.7)} y={blockTop + 12} width={44} height={12} fill="#9e4a35" stroke="#5e2a1e" strokeWidth={1} />
        <rect x={X(0.7) + 4} y={blockTop} width={44} height={12} fill="#a9533c" stroke="#5e2a1e" strokeWidth={1} />
      </g>
      <CinderBlock x={R - 66} y={blockTop} />
    </g>
  );
}

function CinderBlock({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={60} height={24} fill="#8d8f93" stroke="#5c5e62" strokeWidth={1.5} />
      <rect x={x + 7} y={y + 6} width={18} height={12} fill="#5c5e62" />
      <rect x={x + 35} y={y + 6} width={18} height={12} fill="#5c5e62" />
      <path d={`M ${x + 2},${y + 3} l 10,2`} stroke="#b4b6ba" strokeWidth={1} />
    </g>
  );
}

/** The platform and canvas: boards round the edge, the tarp, and the patchwork front. */
export const ScrapPlatform = memo(function ScrapPlatform({ geo, name }: { geo: ScrapGeo; name: string }) {
  const p = geo.platform;
  return (
    <g>
      <polygon points={`${p.backL},${p.backY} ${p.backR},${p.backY} ${p.frontR},${p.frontY} ${p.frontL},${p.frontY}`} fill="#3a2a1a" />
      <ApronTop geo={geo} />
      <Tarp geo={geo} />
      <FrontFace geo={geo} name={name} />
    </g>
  );
});

/** A rope tied at both ends: knots at each post, the rope sagging between. */
export function ScrapRopeRun({ x1, x2, y, kind, sag, w, shadow }: { x1: number; x2: number; y: number; kind: number; sag: number; w?: number; shadow?: boolean }) {
  return (
    <g>
      <ScrapRope x1={x1} y1={y} x2={x2} y2={y} kind={kind} sag={sag} w={w} shadow={shadow} />
      <Knot x={x1 + 2} y={y} kind={kind} side={-1} w={w} />
      <Knot x={x2 - 2} y={y} kind={kind} side={1} w={w} />
    </g>
  );
}

/**
 * Each wrestler's name in marker on a bit of cardboard box, leaned against
 * the front of the ring on the side they start from. Written fast by
 * somebody kneeling on the grass: letters a little off the line, a little
 * tilted, a different size — but every one of them readable.
 */
/** Most of a side's signs that fit along the front before they bury the ring. */
const MAX_SIGNS_PER_SIDE = 3;

function hashOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Split a long name over two lines at the space nearest the middle. */
function signLines(name: string): string[] {
  const t = markerText(name);
  if (t.length <= 11 || !t.includes(' ')) return [t];
  const mid = t.length / 2;
  let best = -1;
  for (let i = 0; i < t.length; i++) if (t[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return [t.slice(0, best), t.slice(best + 1)];
}

function CardboardSign({ name, x, floorY, w, h, tilt, seed }: { name: string; x: number; floorY: number; w: number; h: number; tilt: number; seed: number }) {
  const rnd = lcg(seed % 2147483647 || 1);
  const lines = signLines(name);
  const longest = Math.max(...lines.map((l) => markerWidth(l)));
  // Letter height: as big as fits, smaller when it takes two lines.
  const size = Math.min(lines.length > 1 ? 17 : 22, (w - 18) / Math.max(1, longest));
  const top = floorY - h;
  // A box flap: one corner torn off, the cut edge not straight.
  const tear = 6 + rnd() * 8;
  const tornLeft = rnd() < 0.5;
  const outline = tornLeft
    ? `M ${x + tear},${top} L ${x + w},${top + 1} L ${x + w - 1},${floorY} L ${x},${floorY} L ${x + 1},${top + tear} L ${x + tear * 0.4},${top + tear * 0.7} Z`
    : `M ${x},${top + 1} L ${x + w - tear},${top} L ${x + w - tear * 0.5},${top + tear * 0.6} L ${x + w},${top + tear} L ${x + w - 1},${floorY} L ${x + 1},${floorY} Z`;
  const ink = '#16130f';
  return (
    <g transform={`rotate(${tilt} ${x + w / 2} ${floorY})`}>
      {/* Its shadow on the boards behind, and on the grass. */}
      <path d={outline} transform="translate(4 -3)" fill="#000" opacity={0.3} />
      <ellipse cx={x + w / 2} cy={floorY + 1} rx={w * 0.55} ry={3} fill="#000" opacity={0.35} />
      <path d={outline} fill="#c79e64" stroke="#8a6534" strokeWidth={1.2} strokeLinejoin="round" />
      {/* Corrugation showing along the cut top, and a crease where the box folded. */}
      <path d={`M ${x + 3},${top + 3} ${Array.from({ length: Math.floor(w / 4) }, (_, i) => `l 2,${i % 2 ? -1.6 : 1.6}`).join(' ')}`} fill="none" stroke="#9c7742" strokeWidth={0.8} opacity={0.8} />
      <path d={`M ${x + w * (0.28 + rnd() * 0.1)},${top + 2} l 1,${h - 3}`} stroke="#a9834f" strokeWidth={1.3} opacity={0.7} />
      {/* Whatever the box said before. */}
      <text x={x + w - 6} y={floorY - 5} textAnchor="end" fontFamily="Arial, sans-serif" fontWeight={700} fontSize={6} fill="#7a5a2c" opacity={0.55}>
        {rnd() < 0.5 ? '↑ THIS SIDE UP' : 'FRAGILE'}
      </text>
      {/* The name, in marker. */}
      {lines.map((line, li) => {
        const baseY = top + h * (lines.length > 1 ? (li === 0 ? 0.45 : 0.82) : 0.68) + (rnd() - 0.5) * 3;
        const tilt = ((rnd() - 0.5) * 6).toFixed(1);
        return (
          <path
            key={li}
            d={markerPath(line, x + w / 2 + (rnd() - 0.5) * 6, baseY, size, rnd)}
            transform={`rotate(${tilt} ${x + w / 2} ${baseY})`}
            fill="none"
            stroke={ink}
            strokeWidth={Math.max(2.2, size * 0.16)}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#mv-marker)"
          />
        );
      })}
      {/* A marker scribble under it: somebody's idea of a flourish. */}
      {lines.length === 1 && rnd() < 0.6 && (
        <path
          d={`M ${x + w * 0.22},${floorY - 7} q ${w * 0.15},${3 + rnd() * 3} ${w * 0.3},0 t ${w * 0.26},${-1}`}
          fill="none"
          stroke={ink}
          strokeWidth={1.8}
          strokeLinecap="round"
          filter="url(#mv-marker)"
        />
      )}
    </g>
  );
}

/** Every wrestler's sign, leaned against the front of the ring on their own side. */
export const CardboardSigns = memo(function CardboardSigns({ geo, left, right }: { geo: ScrapGeo; left: readonly string[]; right: readonly string[] }) {
  const p = geo.platform;
  const floorY = geo.skirtBottom + 10;
  const w = 122;
  const h = 62;
  const place = (names: readonly string[], side: -1 | 1) =>
    names.slice(0, MAX_SIGNS_PER_SIDE).map((name, i) => {
      // From the corner inward on the left (clear of the steps), and in from the corner on the right.
      // Side by side, not overlapped: every name has to stay readable. Three a side just fit.
      const x = side < 0 ? p.frontL + 30 + i * (w + 6) : p.frontR - 30 - w - i * (w + 6);
      const seed = hashOf(`${name}:${side}:${i}`);
      const tilt = ((seed % 70) / 10 - 3.5) + side * 1.5;
      return <CardboardSign key={`${side}-${i}-${name}`} name={name} x={x} floorY={floorY - (i % 2) * 4} w={w} h={h} tilt={tilt} seed={seed} />;
    });
  return (
    <g>
      <defs>
        {/* Marker on cardboard: the edges bleed and wobble a little. */}
        <filter id="mv-marker" x="-5%" y="-20%" width="110%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves={2} seed={9} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={1.6} />
        </filter>
      </defs>
      {place(left, -1)}
      {place(right, 1)}
    </g>
  );
});
