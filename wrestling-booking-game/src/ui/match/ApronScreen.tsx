// The broadcast ring's apron: a full-colour LED wall the width of the ring.
//
// It runs a package like a television open — the night's name in chrome,
// the faces with VS between them, a package for each of them in their own
// colours (flames behind a heel, light turning behind a face, energy that
// will not settle for somebody the crowd cannot make up its mind about), what
// the match is for — and cuts to the ring when something happens there: a
// big move or a near fall comes up with the face of whoever did it and the
// name of the move, the same name the commentary calls. When it is over it
// is the winner's.
//
// What makes it read as a real screen rather than a web page: the picture
// behind everything never stops moving (ScreenShader.tsx, on the graphics
// card); titles fly in a letter at a time; every cut is a light swipe with a
// flare; faces are scanned in; and it is a physical thing — a fine LED pixel
// grid, a bloom, and its light spilling onto the floor in front of the ring.
//
// Nothing on it is invented: every name, face, move and result is the one
// the match recorded. Animated with CSS (match.css, .mv-tv-*), which reduced
// motion stills.

import { memo, useEffect, useMemo, useState } from 'react';
import { PLATFORM, SKIRT_BOTTOM, VIEW } from './Arena';
import { Bust, starColorOf } from './StarMoment';
import { ScreenShader, type Backdrop } from './ScreenShader';
import { standingOf, type Mood } from './crowd';
import type { Id, Wrestler } from '../../engine/types';

export interface Broadcast {
  /** The night: the show's name, or the company's. */
  event: string;
  promotion: string;
  sides: readonly (readonly Wrestler[])[];
  stipulation?: string | null;
  title?: string | null;
}

/** Something happening in the ring this beat, as the screen cuts to it. */
export interface ScreenAction {
  /** Changes every beat, so the same move twice is two cuts. */
  key: number;
  actor: Wrestler;
  text: string;
}

const upper = (s: string) => s.toUpperCase();
const GOLD = '#ffc933';

/** Strong colours for somebody whose gear has none: picked by who they are, so it is always the same one. */
const VIVID = ['#ff2d55', '#ff7a00', '#ffd000', '#22d36b', '#00c8ff', '#3d6bff', '#a64dff', '#ff3dd2'];
/**
 * Their colour on television: what they wear, unless what they wear is
 * white, black or grey — a package in grey does not pop — and then one of
 * the strong ones, the same every time.
 */
export function tvColorOf(w: Wrestler): string {
  const c = starColorOf(w);
  const m = /^#?([0-9a-f]{6})$/i.exec(c);
  if (m) {
    const n = parseInt(m[1]!, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat > 0.35 && max > 70) return c;
  }
  let h = 0;
  for (const ch of w.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return VIVID[h % VIVID.length]!;
}
const surname = (w: Wrestler) => w.name.trim().split(/\s+/).pop()!;

/** What plays behind somebody: flames for a heel, light for a face, energy for anybody in between. */
const backdropFor = (w: Wrestler, focus: number): Backdrop => {
  const c = tvColorOf(w);
  const s = standingOf(w);
  return s === 'heel' ? { mode: 'fire', a: c, b: c } : s === 'face' ? { mode: 'rays', a: c, b: '#ffffff', focus } : { mode: 'energy', a: c, b: '#7a2cff', speed: 1.6 };
};

/** A face in a frame, scanned in from the bottom with a bright line: their art, or their photo. */
function Face({ w, size, delay = 0, ring }: { w: Wrestler; size: number; delay?: number; ring?: string }) {
  const c = ring ?? tvColorOf(w);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="mv-tv-reveal absolute inset-0 overflow-hidden"
        style={{ borderRadius: 3, background: `radial-gradient(circle at 50% 35%, ${c}, #07080c 80%)`, boxShadow: `0 0 0 1.5px ${c}, 0 0 ${size * 0.25}px ${c}`, animationDelay: `${delay}s` }}
      >
        <div className="mv-tv-kenburns absolute inset-0">
          <Bust star={w} />
        </div>
        {/* Rim light and a sheen across the glass. */}
        <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${c}55, transparent 30%, transparent 70%, ${c}55)`, mixBlendMode: 'screen' }} />
        <div className="mv-tv-facesheen absolute inset-0" style={{ animationDelay: `${delay + 0.6}s` }} />
      </div>
      <div className="mv-tv-scanline absolute inset-x-0" style={{ animationDelay: `${delay}s`, boxShadow: `0 0 8px 2px ${c}`, '--tv-face': `${-size}px` } as React.CSSProperties} />
    </div>
  );
}

/**
 * Chrome lettering that flies in a letter at a time — from big and blurred to
 * sharp — then has a glint run across it.
 */
function Kinetic({ text, size, gold = false, delay = 0, from = 'drop' }: { text: string; size: number; gold?: boolean; delay?: number; from?: 'drop' | 'slide' }) {
  const letters = [...upper(text)];
  // The glint runs through the letters themselves (a second layer of each
  // letter's own gradient), one after the next, once they have all landed.
  const glintAt = delay + letters.length * 0.035 + 0.25;
  return (
    <span className={`relative inline-flex font-black italic leading-none ${gold ? 'mv-tv-goldtext' : 'mv-tv-chrometext'}`} style={{ fontSize: size, letterSpacing: '0.03em', whiteSpace: 'pre' }}>
      {letters.map((ch, i) => (
        <span key={i} className={from === 'drop' ? 'mv-tv-letter' : 'mv-tv-letterslide'} style={{ animationDelay: `${delay + i * 0.035}s, ${glintAt + i * 0.025}s` }}>
          {ch}
        </span>
      ))}
    </span>
  );
}

/** Fit text to a width: shrink it, never wrap it. */
const fit = (text: string, width: number, max: number, perChar = 0.64) => Math.min(max, width / Math.max(1, text.length * perChar));

type Scene = { key: string; dur: number; bg: Backdrop; node: React.ReactNode };

export const ApronScreen = memo(function ApronScreen({
  w,
  h,
  show,
  accent,
  holders,
  action,
  mood,
  big,
  star,
  winners,
  caption,
}: {
  w: number;
  h: number;
  show: Broadcast;
  accent: string;
  /** Whoever walked in holding a title. */
  holders: ReadonlySet<Id>;
  action: ScreenAction | null;
  mood: Mood | null;
  big: boolean;
  star?: Wrestler;
  /** Set once it is over. */
  winners?: readonly Wrestler[];
  caption?: string | null;
}) {
  const left = (PLATFORM.frontL / VIEW.w) * w;
  const top = (PLATFORM.frontY / VIEW.h) * h;
  const cw = ((PLATFORM.frontR - PLATFORM.frontL) / VIEW.w) * w;
  const ch = ((SKIRT_BOTTOM - PLATFORM.frontY) / VIEW.h) * h;
  const face = ch * 0.8;
  /** Where a face on the left sits, as a fraction across: the rays come from behind it. */
  const faceFocus = (0.03 * cw + face / 2) / cw;

  const cast = useMemo(() => show.sides.flat(), [show.sides]);
  const castKey = cast.map((c) => c.id).join('|');

  // The package, in order. Built from the match, so it is the same every time.
  const programme = useMemo<Scene[]>(() => {
    const scenes: Scene[] = [];
    scenes.push({
      key: 'title',
      dur: 4,
      bg: { mode: 'energy', a: accent, b: '#3d6bff' },
      node: (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Kinetic text={show.event} size={fit(show.event, cw * 0.86, ch * 0.5)} />
          {show.event !== show.promotion && (
            <span className="mv-tv-fadeup font-bold uppercase text-white/85" style={{ fontSize: ch * 0.14, letterSpacing: '0.45em', animationDelay: '0.7s' }}>
              {show.promotion}
            </span>
          )}
        </div>
      ),
    });
    const [a = [], b = []] = show.sides;
    if (a.length > 0 && b.length > 0 && a.length <= 2 && b.length <= 2) {
      const ca = tvColorOf(a[0]!);
      const cb = tvColorOf(b[0]!);
      const namesA = a.map(surname).join(' & ');
      const namesB = b.map(surname).join(' & ');
      scenes.push({
        key: 'vs',
        dur: 4.6,
        bg: { mode: 'energy', a: ca, b: cb, speed: 1.4 },
        node: (
          <div className="absolute inset-0">
            {/* Each side's half, cut on a slant, glass over the moving light. */}
            <div className="mv-tv-inl absolute inset-y-0 left-0" style={{ width: '55%', background: `linear-gradient(90deg, ${ca}aa, ${ca}11 85%)`, clipPath: 'polygon(0 0, 100% 0, 88% 100%, 0 100%)' }} />
            <div className="mv-tv-inr absolute inset-y-0 right-0" style={{ width: '55%', background: `linear-gradient(270deg, ${cb}aa, ${cb}11 85%)`, clipPath: 'polygon(12% 0, 100% 0, 100% 100%, 0 100%)' }} />
            <div className="absolute inset-y-0 left-[2.5%] flex items-center gap-2">
              {a.map((x, i) => <Face key={x.id} w={x} size={face} delay={0.1 + i * 0.12} />)}
              <Kinetic text={namesA} size={fit(namesA, cw * 0.26, ch * 0.36)} from="slide" delay={0.3} />
            </div>
            <div className="absolute inset-y-0 right-[2.5%] flex items-center gap-2">
              <Kinetic text={namesB} size={fit(namesB, cw * 0.26, ch * 0.36)} from="slide" delay={0.45} />
              {b.map((x, i) => <Face key={x.id} w={x} size={face} delay={0.25 + i * 0.12} />)}
            </div>
            <div className="mv-tv-bolt absolute inset-y-0 left-1/2 -translate-x-1/2" style={{ width: ch * 0.55 }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="mv-tv-vs font-black italic" style={{ fontSize: ch * 0.66 }}>VS</span>
            </div>
            <div className="mv-tv-flash absolute inset-0" style={{ animationDelay: '0.75s' }} />
          </div>
        ),
      });
    } else if (cast.length > 0) {
      // A crowd of them: every face sliding past under what it is.
      const label = show.stipulation ?? 'EVERYBODY IN';
      scenes.push({
        key: 'field',
        dur: 5,
        bg: { mode: 'grid', a: accent, b: '#ffffff', speed: 1.3 },
        node: (
          <div className="absolute inset-0 overflow-hidden">
            <div className="mv-tv-belt absolute inset-y-0 left-0 flex items-center gap-2" style={{ paddingLeft: cw }}>
              {cast.map((x) => <Face key={x.id} w={x} size={face * 0.9} />)}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Kinetic text={label} size={fit(label, cw * 0.6, ch * 0.42)} delay={0.2} />
            </div>
          </div>
        ),
      });
    }
    // A package for each of them (the first four).
    for (const x of cast.slice(0, 4)) {
      const c = tvColorOf(x);
      const tag = holders.has(x.id) ? 'CHAMPION' : standingOf(x) === 'heel' ? 'HATED' : standingOf(x) === 'face' ? 'FAN FAVOURITE' : 'UNPREDICTABLE';
      scenes.push({
        key: `pkg-${x.id}`,
        dur: 4,
        bg: backdropFor(x, faceFocus),
        node: (
          <div className="absolute inset-0">
            <div className="mv-tv-inl absolute inset-y-0 left-0" style={{ width: '62%', background: `linear-gradient(90deg, ${c}88, transparent)`, clipPath: 'polygon(0 0, 100% 0, 92% 100%, 0 100%)' }} />
            <div className="absolute inset-y-0 left-[3%] flex items-center">
              <Face w={x} size={face} />
            </div>
            <div className="absolute inset-y-0 flex flex-col justify-center" style={{ left: `calc(3% + ${face * 1.22}px)`, right: '16%' }}>
              {x.nickname && (
                <span className="mv-tv-fadeup font-bold uppercase" style={{ fontSize: ch * 0.14, color: '#fff3c4', letterSpacing: '0.25em', whiteSpace: 'nowrap', animationDelay: '0.2s', textShadow: '0 0 6px #000' }}>
                  “{x.nickname}”
                </span>
              )}
              <span className={standingOf(x) === 'tweener' ? 'mv-tv-glitchwrap' : ''}>
                <Kinetic text={x.name} size={fit(x.name, cw * 0.58, ch * 0.46)} from="slide" delay={0.15} />
              </span>
            </div>
            <span className={`mv-tv-tag absolute right-[2%] top-[14%] font-black uppercase ${tag === 'CHAMPION' ? 'mv-tv-gold-bg' : ''}`} style={{ fontSize: ch * 0.16, padding: '0.15em 0.6em', background: tag === 'CHAMPION' ? undefined : c, color: tag === 'CHAMPION' ? '#2a1d00' : '#fff', letterSpacing: '0.2em' }}>
              {tag}
            </span>
          </div>
        ),
      });
    }
    const forText = show.title ? `FOR THE ${show.title}` : show.stipulation;
    if (forText) {
      scenes.push({
        key: 'for',
        dur: 3.8,
        bg: { mode: 'grid', a: show.title ? GOLD : accent, b: show.title ? '#ff9a00' : '#ffffff' },
        node: (
          <div className="absolute inset-0 flex items-center justify-center">
            <Kinetic text={forText} size={fit(forText, cw * 0.86, ch * 0.42)} gold={Boolean(show.title)} delay={0.15} />
          </div>
        ),
      });
    }
    return scenes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show.event, show.promotion, show.title, show.stipulation, castKey, accent, Math.round(cw), Math.round(ch)]);

  // What is up: the result, a cut to the ring, a star's moment, or the package.
  const [index, setIndex] = useState(0);
  const current = programme[index % Math.max(1, programme.length)];
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % programme.length), current.dur * 1000);
    return () => clearTimeout(t);
  }, [index, current, programme.length]);

  let scene: Scene | undefined = current;
  if (winners) {
    const label = caption ?? (winners.length ? 'YOUR WINNER!' : 'NO WINNER');
    const across = face * Math.min(3, Math.max(1, winners.length)) * 1.1 + 10;
    scene = {
      key: `win-${winners.map((x) => x.id).join('|')}`,
      dur: 0,
      bg: { mode: 'rays', a: GOLD, b: winners[0] ? tvColorOf(winners[0]) : accent, focus: faceFocus },
      node: (
        <div className="absolute inset-0">
          <div className="absolute inset-y-0 left-[3%] flex items-center gap-2">
            {winners.slice(0, 3).map((x, i) => <Face key={x.id} w={x} size={face} delay={i * 0.1} ring={GOLD} />)}
          </div>
          <div className="absolute inset-y-0 flex flex-col justify-center" style={{ left: `calc(3% + ${across}px)`, right: '3%' }}>
            <Kinetic text={label} size={fit(label, cw * 0.55, ch * 0.4)} gold delay={0.2} />
            {winners.length > 0 && (
              <span className="mv-tv-fadeup font-black italic text-white" style={{ fontSize: fit(winners.map((x) => x.name).join(' & '), cw * 0.55, ch * 0.28), textShadow: '0 0 10px #000, 0.06em 0.06em 0 #000', whiteSpace: 'nowrap', animationDelay: '0.8s' }}>
                {upper(winners.map((x) => x.name).join(' & '))}
              </span>
            )}
          </div>
          <div className="mv-tv-flash absolute inset-0" />
        </div>
      ),
    };
  } else if (action) {
    const c = tvColorOf(action.actor);
    scene = {
      key: `act-${action.key}`,
      dur: 0,
      bg: { mode: 'grid', a: c, b: '#ffffff', speed: 3.2 },
      node: (
        <div className="mv-tv-shake absolute inset-0">
          <div className="mv-tv-speed absolute inset-0" />
          <div className="absolute inset-y-0 left-[3%] flex items-center">
            <Face w={action.actor} size={face} />
          </div>
          <div className="absolute inset-y-0 flex flex-col justify-center" style={{ left: `calc(3% + ${face * 1.22}px)`, right: '3%' }}>
            <span className="mv-tv-fadeup font-bold uppercase text-white/90" style={{ fontSize: ch * 0.14, letterSpacing: '0.3em', textShadow: '0 0 6px #000' }}>
              {upper(action.actor.name)}
            </span>
            <Kinetic text={action.text} size={fit(action.text, cw * 0.64, ch * 0.5)} from="slide" />
          </div>
          <div className="mv-tv-flash absolute inset-0" />
        </div>
      ),
    };
  } else if (star && big && mood !== 'boo') {
    const c = tvColorOf(star);
    scene = {
      key: `star-${star.id}`,
      dur: 0,
      bg: { mode: 'rays', a: c, b: '#ffffff', focus: faceFocus, speed: 1.4 },
      node: (
        <div className="absolute inset-0">
          <div className="absolute inset-y-0 left-[3%] flex items-center">
            <Face w={star} size={face} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center" style={{ paddingLeft: face }}>
            <Kinetic text={star.name} size={fit(star.name, cw * 0.7, ch * 0.52)} delay={0.1} />
          </div>
        </div>
      ),
    };
  }

  const glow = scene?.bg.a ?? accent;
  return (
    <>
      {/* The wall's light on the floor in front of the ring. */}
      <div
        className="mv-tv-spill pointer-events-none absolute"
        style={{ left: left - cw * 0.05, top: top + ch * 0.92, width: cw * 1.1, height: ch * 0.9, background: `radial-gradient(ellipse 50% 60% at 50% 0%, ${glow}, transparent 70%)` }}
        aria-hidden
      />
      <div
        data-testid="apron-screen"
        className="mv-tv pointer-events-none absolute overflow-hidden"
        style={{ left, top, width: cw, height: ch, '--tv-accent': accent, boxShadow: `0 0 ${ch * 0.35}px ${glow}66` } as React.CSSProperties}
        aria-label={`${show.event}: ${cast.map((c) => c.name).join(', ')}`}
        role="img"
      >
        <div className="mv-tv-picture absolute inset-0">
          {scene && <ScreenShader width={cw} height={ch} backdrop={scene.bg} />}
          {scene && (
            <div key={scene.key} className="mv-tv-wipe absolute inset-0">
              {scene.node}
            </div>
          )}
        </div>
        {/* Every cut: a light swipe and a flare across the glass. */}
        {scene && <div key={`swipe-${scene.key}`} className="mv-tv-swipe absolute inset-y-0" />}
        {scene && <div key={`flare-${scene.key}`} className="mv-tv-flare absolute" />}
        {/* The room is furious: the picture breaks up red. */}
        {mood === 'boo' && big && <div className="mv-tv-redglitch absolute inset-0" />}
        <span className="absolute bottom-[7%] right-[1.2%] font-black italic text-white/75" style={{ fontSize: ch * 0.12, letterSpacing: '0.1em', textShadow: '0 0 4px #000' }}>
          {show.promotion.split(/\s+/).map((p) => p[0]).join('').toUpperCase()}
        </span>
        {/* The wall itself: a fine grid of LEDs, a sheen, a bezel. */}
        <div className="mv-tv-pixels absolute inset-0" />
        <div className="mv-tv-sheen absolute inset-0" />
        <div className="absolute inset-0" style={{ boxShadow: `inset 0 0 0 2px #000, inset 0 0 0 3px ${accent}aa, inset 0 0 ${ch * 0.3}px #000a` }} />
      </div>
    </>
  );
});
