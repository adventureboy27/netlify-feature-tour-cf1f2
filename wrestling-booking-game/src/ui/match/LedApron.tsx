// The premium ring's apron: the whole front skirt is one LED sign, round
// bulbs in a dot-matrix, run like a drive-in's roadside sign — a chasing
// border, letters that scroll and flash, colour wipes and bursts between.
//
// It runs its own little programme (the night, the names, the match, the
// company) and the room breaks into it: a boo turns it red, a roar puts the
// star's name up, and when it is over it is the winner's. Nothing here is a
// fact the match did not record — it reads the same reaction and result the
// rest of the stage does.
//
// Drawn on a canvas, bulbs batched by colour, at most thirty frames a second;
// with reduced motion it holds still and only changes when the room does.

import { memo, useEffect, useMemo, useRef } from 'react';
import { bitmap } from './ledFont';
import type { Mood } from './crowd';
import { PLATFORM, SKIRT_BOTTOM, VIEW } from './Arena';

/** Bulbs top to bottom: a border row at each edge, and room for letters two bulbs to a dot. */
const ROWS = 18;
const COLS = Math.round((PLATFORM.frontR - PLATFORM.frontL) / ((SKIRT_BOTTOM - PLATFORM.frontY) / ROWS));
/** Inside the border. */
const IN_L = 2;
const IN_R = COLS - 3;
const IN_W = IN_R - IN_L + 1;
const MID_X = (COLS - 1) / 2;
const MID_Y = (ROWS - 1) / 2;

const GOLD = '#ffd54a';
const WHITE = '#fff4dc';
const RED = '#ff2b25';
const BLUE = '#3d8bff';
/** The rainbow, in a few steps so the bulbs batch. */
const HUES = Array.from({ length: 18 }, (_, i) => `hsl(${i * 20},100%,58%)`);
const hue = (deg: number) => HUES[(((Math.floor(deg / 20) % 18) + 18) % 18)]!;

type Paint = (x: number, y: number, t: number) => string;
const solid = (c: string): Paint => () => c;
const rainbow: Paint = (x, _y, t) => hue(x * 5 - t * 260);
const fire: Paint = (_x, y, t) => (y + Math.floor(t * 6)) % 4 < 2 ? GOLD : '#ff8a1e';

/** A deterministic flicker: the same bulbs twinkle the same way every time. */
const hash = (x: number, y: number, n: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + n * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

type Set = (x: number, y: number, c: string) => void;
interface Scene {
  dur: number;
  draw: (set: Set, t: number) => void;
  /** The border's colour while this is up. */
  border?: 'gold' | 'red' | 'rainbow';
}

/** Lay text into the sign: centred and still if it fits, or scrolled through if it does not. */
function words(text: string, paint: Paint, opts: { flash?: number; minDur?: number; speed?: number } = {}): Scene {
  const big = bitmap(text, 2);
  const small = bitmap(text, 1);
  const fits = big.length <= IN_W ? { cols: big, h: 14 } : small.length <= IN_W ? { cols: small, h: 7 } : null;
  const put = (set: Set, cols: boolean[][], h: number, x0: number, t: number) => {
    const y0 = Math.round(MID_Y - h / 2 + 0.5);
    for (let i = 0; i < cols.length; i++) {
      const x = x0 + i;
      if (x < IN_L || x > IN_R) continue;
      const col = cols[i]!;
      for (let j = 0; j < h; j++) if (col[j]) set(x, y0 + j, paint(x, y0 + j, t));
    }
  };
  if (fits) {
    const x0 = Math.round(MID_X - fits.cols.length / 2 + 0.5);
    return {
      dur: opts.minDur ?? 2.4,
      draw: (set, t) => {
        // A blink, not a strobe: off a quarter of the time, so it is mostly readable.
        if (opts.flash && Math.floor(t / opts.flash) % 4 === 3) return;
        put(set, fits.cols, fits.h, x0, t);
      },
    };
  }
  const speed = opts.speed ?? 48;
  return {
    dur: Math.max(opts.minDur ?? 0, (IN_W + big.length) / speed),
    draw: (set, t) => put(set, big, 14, Math.round(IN_R - t * speed), t),
  };
}

/**
 * Two scenes at once: a pattern behind, words in front. The first colour a
 * bulb is given sticks, so the words go first; and the pattern keeps out of
 * the box round them, a bulb clear, so the letters read on black.
 */
const over = (back: Scene['draw'], front: Scene): Scene => ({
  ...front,
  draw: (set, t) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    front.draw((x, y, c) => {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      set(x, y, c);
    }, t);
    back((x, y, c) => {
      if (x >= x0 - 2 && x <= x1 + 2 && y >= y0 - 1 && y <= y1 + 1) return;
      set(x, y, c);
    }, t);
  },
});

/** The company's initials, for when the night has no name of its own and the full name has already been up. */
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase();

const wipe: Scene['draw'] = (set, t) => {
  for (let x = IN_L; x <= IN_R; x++)
    for (let y = 1; y < ROWS - 1; y++) {
      const k = x + y * 1.5 - t * 70;
      if (((k % 18) + 18) % 18 < 9) set(x, y, hue(Math.floor(k / 18) * 60));
    }
};
const burst: Scene['draw'] = (set, t) => {
  for (let x = IN_L; x <= IN_R; x++)
    for (let y = 1; y < ROWS - 1; y++) {
      const d = Math.hypot(x - MID_X, (y - MID_Y) * 2.2) - t * 55;
      if (((d % 14) + 14) % 14 < 4) set(x, y, hue(Math.floor(d / 14) * 70));
    }
};
const sparkle = (rate: number): Scene['draw'] => (set, t) => {
  const n = Math.floor(t * 14);
  for (let x = IN_L; x <= IN_R; x++) for (let y = 1; y < ROWS - 1; y++) if (hash(x, y, n) < rate) set(x, y, hash(y, x, n) < 0.5 ? WHITE : GOLD);
};
const arrows: Scene['draw'] = (set, t) => {
  for (let x = IN_L; x <= IN_R; x++)
    for (let y = 1; y < ROWS - 1; y++) {
      const k = (((x - Math.abs(y - MID_Y) * 1.3 - t * 60) % 22) + 22) % 22;
      if (k < 3) set(x, y, Math.floor((x - t * 60) / 22) % 2 ? GOLD : '#ff8a1e');
    }
};
const hatch = (c: string): Scene['draw'] => (set, t) => {
  for (let x = IN_L; x <= IN_R; x++) for (let y = 1; y < ROWS - 1; y++) if ((((x - y + Math.floor(t * 20)) % 8) + 8) % 8 === 0) set(x, y, c);
};

/** Who is in it, as the sign would bill them: surnames, joined. */
const billed = (names: readonly string[]) => names.map((n) => n.trim().split(/\s+/).pop()!).join(' & ');

/** Shout lines between the billing. Wrestling, not anybody's catchphrase. */
const SHOUTS = ['MAKE SOME NOISE!', 'ARE YOU READY?', 'LIVE!', '1 - 2 - 3!', 'BELL TO BELL', 'STAND UP!'];

export interface Marquee {
  /** The night: the show's name, or the company's. */
  event: string;
  promotion: string;
  /** Each side's names. */
  sides: readonly (readonly string[])[];
  /** What kind of match, if it is not just a match. */
  stipulation?: string | null;
  /** What it is for. */
  title?: string | null;
  /** Who won it, for when it is over (empty for nobody). */
  winners: readonly string[];
}

function programme(m: Marquee, round: number): Scene[] {
  const scenes: Scene[] = [];
  scenes.push({ ...words(m.event, rainbow, { minDur: 2.6 }), border: 'rainbow' });
  const [a, b] = m.sides;
  if (a && b && a.length + b.length <= 4) {
    scenes.push(words(billed(a), solid(RED), { minDur: 1.4 }));
    scenes.push({ ...over(sparkle(0.05), words('VS', solid(WHITE), { flash: 0.2, minDur: 1 })), border: 'rainbow' });
    scenes.push(words(billed(b), solid(BLUE), { minDur: 1.4 }));
  }
  scenes.push({ dur: 1.8, draw: wipe, border: 'rainbow' });
  scenes.push(over(sparkle(0.04), words(m.event === m.promotion ? initials(m.promotion) : m.promotion, fire, { minDur: 2.4 })));
  if (m.title) scenes.push(words(`* ${m.title} *`, solid(GOLD), { minDur: 2.4 }));
  else if (m.stipulation) scenes.push(words(m.stipulation, rainbow, { minDur: 2.2 }));
  scenes.push({ dur: 1.8, draw: burst, border: 'rainbow' });
  scenes.push(words(SHOUTS[round % SHOUTS.length]!, (_x, _y, t) => (Math.floor(t * 4) % 2 ? GOLD : WHITE), { minDur: 2 }));
  scenes.push({ dur: 1.6, draw: arrows });
  return scenes;
}

/** How the room is taking it, on the sign. */
function reactionScene(mood: Mood, big: boolean, star?: string): Scene {
  switch (mood) {
    case 'boo':
      return { ...over(hatch('#5a0d0b'), words(big ? 'BOOOO!' : 'BOO!', solid(RED), { flash: 0.22, minDur: 9 })), border: 'red' };
    case 'ooh':
      return over(sparkle(0.06), words('OOOH!', solid(WHITE), { minDur: 9 }));
    case 'mixed':
      return { ...over(hatch('#3a2a10'), words('!!!', (x) => (x < MID_X ? RED : BLUE), { flash: 0.3, minDur: 9 })), border: 'rainbow' };
    default:
      return star
        ? { ...over(burst, words(star, solid(GOLD), { minDur: 9 })), border: 'rainbow' }
        : { ...over(big ? burst : sparkle(0.05), words(big ? 'YEAH!!' : 'YEAH!', big ? solid(WHITE) : rainbow, { minDur: 9 })), border: big ? 'rainbow' : 'gold' };
  }
}

function finaleScenes(winners: readonly string[], belt: boolean, promotion: string): Scene[] {
  if (winners.length === 0) return [{ ...words('WHAT A MATCH!', rainbow, { minDur: 3 }) }, over(sparkle(0.04), words(promotion, fire))];
  return [
    { ...over(burst, words('WINNER', (_x, _y, t) => (Math.floor(t * 5) % 2 ? GOLD : WHITE), { minDur: 2.2 })), border: 'rainbow' },
    { ...over(sparkle(0.05), words(billed(winners), solid(GOLD), { minDur: 3 })), border: 'gold' },
    ...(belt ? [{ ...over(burst, words('CHAMPION!', fire, { minDur: 2.4 })), border: 'rainbow' as const }] : []),
    { dur: 1.6, draw: wipe, border: 'rainbow' },
  ];
}

/** The chasing lights round the edge: every third bulb, marching. */
function border(set: Set, t: number, kind: Scene['border']) {
  const step = Math.floor(t * (kind === 'rainbow' ? 20 : 12));
  const walk: [number, number][] = [];
  for (let x = 0; x < COLS; x++) walk.push([x, 0]);
  for (let y = 1; y < ROWS; y++) walk.push([COLS - 1, y]);
  for (let x = COLS - 2; x >= 0; x--) walk.push([x, ROWS - 1]);
  for (let y = ROWS - 2; y > 0; y--) walk.push([0, y]);
  walk.forEach(([x, y], i) => {
    if ((i + step) % 3 !== 0) return;
    set(x, y, kind === 'red' ? RED : kind === 'rainbow' ? hue(i * 9) : i % 2 ? GOLD : WHITE);
  });
}

export const LedApron = memo(function LedApron({
  w,
  h,
  marquee,
  mood,
  big,
  star,
  winners,
  belt,
}: {
  /** The stage's size in pixels. */
  w: number;
  h: number;
  marquee: Marquee;
  mood: Mood | null;
  big: boolean;
  /** A star's name, when the room is theirs. */
  star?: string;
  /** Set once it is over: who won (empty for nobody). */
  winners?: readonly string[];
  belt?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // What should be up, rebuilt when the room or the result changes; the loop reads it.
  const reel = useRef<{ scenes: Scene[]; since: number; round: number; marquee: Marquee | null }>({ scenes: [], since: 0, round: 0, marquee: null });
  const winnersKey = winners?.join('|');
  const sceneKey = useMemo(() => JSON.stringify([marquee, mood, big, star, winnersKey, belt]), [marquee, mood, big, star, winnersKey, belt]);

  useEffect(() => {
    const now = performance.now() / 1000;
    const r = reel.current;
    // Only the programme comes round again with a new shout; a reaction or the result just repeats.
    r.marquee = !winners && !mood ? marquee : null;
    if (winners) r.scenes = finaleScenes(winners, Boolean(belt), marquee.promotion);
    else if (mood) r.scenes = [reactionScene(mood, big, star)];
    else r.scenes = programme(marquee, r.round);
    r.since = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);

  const left = (PLATFORM.frontL / VIEW.w) * w;
  const top = (PLATFORM.frontY / VIEW.h) * h;
  const cw = ((PLATFORM.frontR - PLATFORM.frontL) / VIEW.w) * w;
  const ch = ((SKIRT_BOTTOM - PLATFORM.frontY) / VIEW.h) * h;

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = Math.round(cw * dpr);
    el.height = Math.round(ch * dpr);
    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pitchX = el.width / COLS;
    const pitchY = el.height / ROWS;
    const rad = Math.min(pitchX, pitchY) * 0.5;
    const lit = new Map<string, number[]>();
    const on = new Uint8Array(COLS * ROWS);

    const frame = (nowMs: number) => {
      const r = reel.current;
      const now = nowMs / 1000;
      // Where in the reel: scenes play in turn and the programme comes round again.
      let total = r.scenes.reduce((s, sc) => s + sc.dur, 0);
      if (!still && total > 0 && now - r.since >= total) {
        r.since += total * Math.floor((now - r.since) / total);
        if (r.marquee) {
          r.round += 1;
          r.scenes = programme(r.marquee, r.round);
          total = r.scenes.reduce((s, sc) => s + sc.dur, 0);
        }
      }
      let t = still ? 0.6 : now - r.since;
      let i = 0;
      while (i < r.scenes.length - 1 && t >= r.scenes[i]!.dur) t -= r.scenes[i++]!.dur;
      const scene = r.scenes[i];

      lit.clear();
      on.fill(0);
      const set: Set = (x, y, c) => {
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
        const k = y * COLS + x;
        if (on[k]) return;
        on[k] = 1;
        let list = lit.get(c);
        if (!list) lit.set(c, (list = []));
        list.push(x, y);
      };
      border(set, still ? 0 : now, scene?.border ?? 'gold');
      scene?.draw(set, t);

      ctx.clearRect(0, 0, el.width, el.height);
      const cx = (x: number) => (x + 0.5) * pitchX;
      const cy = (y: number) => (y + 0.5) * pitchY;
      // The dark bulbs: every socket shows, lit or not.
      ctx.fillStyle = '#211d24';
      ctx.beginPath();
      for (let y = 0; y < ROWS; y++)
        for (let x = 0; x < COLS; x++) {
          if (on[y * COLS + x]) continue;
          ctx.moveTo(cx(x) + rad * 0.62, cy(y));
          ctx.arc(cx(x), cy(y), rad * 0.62, 0, Math.PI * 2);
        }
      ctx.fill();
      // The lit ones: a halo, the bulb, a glint.
      for (const [c, pts] of lit) {
        ctx.fillStyle = c;
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        for (let p = 0; p < pts.length; p += 2) {
          ctx.moveTo(cx(pts[p]!) + rad * 1.3, cy(pts[p + 1]!));
          ctx.arc(cx(pts[p]!), cy(pts[p + 1]!), rad * 1.3, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        for (let p = 0; p < pts.length; p += 2) {
          ctx.moveTo(cx(pts[p]!) + rad * 0.8, cy(pts[p + 1]!));
          ctx.arc(cx(pts[p]!), cy(pts[p + 1]!), rad * 0.8, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      for (const pts of lit.values())
        for (let p = 0; p < pts.length; p += 2) {
          const gx = cx(pts[p]!) - rad * 0.25;
          const gy = cy(pts[p + 1]!) - rad * 0.25;
          ctx.moveTo(gx + rad * 0.25, gy);
          ctx.arc(gx, gy, rad * 0.25, 0, Math.PI * 2);
        }
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    if (still) {
      frame(performance.now());
      return;
    }
    let raf = 0;
    let last = 0;
    const tick = (ms: number) => {
      raf = requestAnimationFrame(tick);
      if (ms - last < 33) return;
      last = ms;
      frame(ms);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cw, ch, sceneKey]);

  return (
    <canvas
      ref={canvas}
      data-testid="led-apron"
      className="pointer-events-none absolute"
      style={{ left, top, width: cw, height: ch }}
      aria-label={`${marquee.event}: ${marquee.promotion}`}
      role="img"
    />
  );
});
