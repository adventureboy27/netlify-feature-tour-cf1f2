// The broadcast ring's apron: a full-colour screen the width of the ring.
//
// It runs a package like a television open — the night's name in chrome,
// the faces with VS between them, a package for each of them in their own
// colours (flames behind a heel, light behind a face, a glitch for somebody
// the crowd cannot make up its mind about), what the match is for — and cuts
// to the ring when something happens there: a big move or a near fall comes
// up with the face of whoever did it and the name of the move, the same name
// the commentary calls. When it is over it is the winner's.
//
// Nothing on it is invented: every name, face, move and result is the one
// the match recorded. Drawn in the DOM (the faces are the wrestlers' own
// art), animated with CSS (match.css, .mv-tv-*), which reduced motion stills.

import { memo, useEffect, useMemo, useState } from 'react';
import { PLATFORM, SKIRT_BOTTOM, VIEW } from './Arena';
import { Bust, starColorOf } from './StarMoment';
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

/** A face in a frame: their art, or their photo. */
function Face({ w, size, from, delay = 0, ring }: { w: Wrestler; size: number; from?: 'left' | 'right'; delay?: number; ring?: string }) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden ${from === 'left' ? 'mv-tv-inl' : from === 'right' ? 'mv-tv-inr' : 'mv-tv-pop'}`}
      style={{ width: size, height: size, borderRadius: 4, background: `linear-gradient(160deg, ${ring ?? tvColorOf(w)}, #07080c 75%)`, boxShadow: `0 0 ${size * 0.18}px ${ring ?? tvColorOf(w)}`, animationDelay: `${delay}s` }}
    >
      <div className="mv-tv-kenburns absolute inset-0">
        <Bust star={w} />
      </div>
    </div>
  );
}

/** Behind somebody's package: what kind of wrestler they are, as light. */
function Aura({ w }: { w: Wrestler }) {
  const s = standingOf(w);
  const c = tvColorOf(w);
  if (s === 'heel') return <div className="mv-tv-flames absolute inset-0" />;
  if (s === 'face') return <div className="mv-tv-rays absolute inset-0" style={{ '--tv-c': c } as React.CSSProperties} />;
  return <div className="mv-tv-static absolute inset-0" />;
}

/** Light streaking across behind everything. */
function Streaks({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {[0.18, 0.42, 0.63, 0.81].map((top, i) => (
        <span key={i} className="mv-tv-streak absolute h-px" style={{ top: `${top * 100}%`, width: '35%', background: `linear-gradient(90deg, transparent, ${i % 2 ? '#ffffff' : color}, transparent)`, animationDelay: `${i * 0.37}s`, animationDuration: `${1.1 + i * 0.25}s` }} />
      ))}
    </div>
  );
}

/** Chrome lettering with a sheen running across it. */
function Chrome({ text, size, gold = false }: { text: string; size: number; gold?: boolean }) {
  return (
    <span
      className={`mv-tv-chrome font-black italic leading-none ${gold ? 'mv-tv-gold' : ''}`}
      style={{ fontSize: size, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}
    >
      {text}
    </span>
  );
}

/** Fit text to a width: shrink it, never wrap it. */
const fit = (text: string, width: number, max: number, perChar = 0.62) => Math.min(max, width / Math.max(1, text.length * perChar));

type Scene = { key: string; dur: number; node: React.ReactNode };

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
  const face = ch * 0.84;

  const cast = useMemo(() => show.sides.flat(), [show.sides]);
  const castKey = cast.map((c) => c.id).join('|');

  // The package, in order. Built from the match, so it is the same every time.
  const programme = useMemo<Scene[]>(() => {
    const scenes: Scene[] = [];
    scenes.push({
      key: 'title',
      dur: 3.6,
      node: (
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: `radial-gradient(ellipse at center, ${accent}66, #05060a 70%)` }}>
          <Streaks color={accent} />
          <div className="mv-tv-punch relative">
            <Chrome text={upper(show.event)} size={fit(show.event, cw * 0.86, ch * 0.5)} />
          </div>
          {show.event !== show.promotion && (
            <span className="mv-tv-fadeup relative font-bold uppercase text-white/80" style={{ fontSize: ch * 0.14, letterSpacing: '0.4em', animationDelay: '0.4s' }}>
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
        dur: 4.2,
        node: (
          <div className="absolute inset-0 overflow-hidden" style={{ background: '#05060a' }}>
            {/* Each side's half in their colour, cut on a slant. */}
            <div className="mv-tv-inl absolute inset-y-0 left-0" style={{ width: '56%', background: `linear-gradient(90deg, ${ca}, ${ca}22 80%)`, clipPath: 'polygon(0 0, 100% 0, 88% 100%, 0 100%)' }} />
            <div className="mv-tv-inr absolute inset-y-0 right-0" style={{ width: '56%', background: `linear-gradient(270deg, ${cb}, ${cb}22 80%)`, clipPath: 'polygon(12% 0, 100% 0, 100% 100%, 0 100%)' }} />
            <Streaks color="#ffffff" />
            <div className="absolute inset-y-0 left-[2%] flex items-center gap-2">
              {a.map((x, i) => <Face key={x.id} w={x} size={face} from="left" delay={i * 0.12} />)}
              <span className="mv-tv-inl font-black italic text-white" style={{ fontSize: fit(namesA, cw * 0.27, ch * 0.36), textShadow: '0.06em 0.06em 0 #000', whiteSpace: 'nowrap', animationDelay: '0.2s' }}>{upper(namesA)}</span>
            </div>
            <div className="absolute inset-y-0 right-[2%] flex items-center gap-2">
              <span className="mv-tv-inr font-black italic text-white" style={{ fontSize: fit(namesB, cw * 0.27, ch * 0.36), textShadow: '0.06em 0.06em 0 #000', whiteSpace: 'nowrap', animationDelay: '0.2s' }}>{upper(namesB)}</span>
              {b.map((x, i) => <Face key={x.id} w={x} size={face} from="right" delay={i * 0.12} />)}
            </div>
            <div className="mv-tv-bolt absolute inset-y-0 left-1/2 -translate-x-1/2" style={{ width: ch * 0.5 }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="mv-tv-vs font-black italic" style={{ fontSize: ch * 0.62 }}>VS</span>
            </div>
            <div className="mv-tv-flash absolute inset-0" style={{ animationDelay: '0.55s' }} />
          </div>
        ),
      });
    } else if (cast.length > 0) {
      // A crowd of them: every face, sliding past, and what it is.
      scenes.push({
        key: 'field',
        dur: 4.5,
        node: (
          <div className="absolute inset-0 overflow-hidden" style={{ background: `linear-gradient(90deg, #05060a, ${accent}55, #05060a)` }}>
            <div className="mv-tv-belt absolute inset-y-0 left-0 flex items-center gap-2" style={{ paddingLeft: cw }}>
              {cast.map((x) => <Face key={x.id} w={x} size={face * 0.9} />)}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Chrome text={upper(show.stipulation ?? 'EVERYBODY IN')} size={fit(show.stipulation ?? 'EVERYBODY IN', cw * 0.6, ch * 0.42)} />
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
        dur: 3.4,
        node: (
          <div className="absolute inset-0 overflow-hidden" style={{ background: `linear-gradient(100deg, ${c}cc 0%, #07080c 55%)` }}>
            <Aura w={x} />
            <Streaks color={c} />
            <div className="absolute inset-y-0 left-[3%] flex items-center">
              <Face w={x} size={face} from="left" />
            </div>
            <div className="absolute inset-y-0 flex flex-col justify-center" style={{ left: `calc(3% + ${face * 1.25}px)`, right: '3%' }}>
              {x.nickname && (
                <span className="mv-tv-fadeup font-bold uppercase" style={{ fontSize: ch * 0.14, color: '#fff3c4', letterSpacing: '0.25em', whiteSpace: 'nowrap', animationDelay: '0.25s' }}>
                  “{x.nickname}”
                </span>
              )}
              <span className={`mv-tv-inr font-black italic text-white ${standingOf(x) === 'tweener' ? 'mv-tv-glitchtext' : ''}`} style={{ fontSize: fit(x.name, cw * 0.62, ch * 0.46), lineHeight: 1, textShadow: `0 0 12px ${c}, 0.06em 0.06em 0 #000`, whiteSpace: 'nowrap' }}>
                {upper(x.name)}
              </span>
            </div>
            <span className={`mv-tv-tag absolute right-[2%] top-[12%] font-black uppercase ${tag === 'CHAMPION' ? 'mv-tv-gold-bg' : ''}`} style={{ fontSize: ch * 0.16, padding: '0.15em 0.6em', background: tag === 'CHAMPION' ? undefined : c, color: tag === 'CHAMPION' ? '#2a1d00' : '#fff', letterSpacing: '0.2em' }}>
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
        dur: 3.4,
        node: (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ background: show.title ? 'radial-gradient(ellipse at center, #5a4200, #05060a 70%)' : `radial-gradient(ellipse at center, ${accent}55, #05060a 70%)` }}>
            <div className="mv-tv-rays absolute inset-0" style={{ '--tv-c': show.title ? '#ffd34d' : accent } as React.CSSProperties} />
            <div className="mv-tv-punch relative">
              <Chrome text={upper(forText)} size={fit(forText, cw * 0.86, ch * 0.42)} gold={Boolean(show.title)} />
            </div>
          </div>
        ),
      });
    }
    return scenes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show.event, show.promotion, show.title, show.stipulation, castKey, accent, Math.round(cw), Math.round(ch)]);

  // What is up: the result, a cut to the ring, a star's moment, or the package.
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState(0);
  const current = programme[index % Math.max(1, programme.length)];
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % programme.length);
      if ((index + 1) % programme.length === 0) setRound((r) => r + 1);
    }, current.dur * 1000);
    return () => clearTimeout(t);
  }, [index, current, programme.length]);

  let scene: Scene | undefined = current;
  if (winners) {
    const c = winners[0] ? tvColorOf(winners[0]) : accent;
    const label = caption ?? (winners.length ? 'YOUR WINNER!' : 'NO WINNER');
    scene = {
      key: `win-${winners.map((x) => x.id).join('|')}-${round % 2}`,
      dur: 0,
      node: (
        <div className="absolute inset-0 overflow-hidden" style={{ background: `radial-gradient(ellipse at 30% 50%, ${c}, #05060a 70%)` }}>
          <div className="mv-tv-rays absolute inset-0" style={{ '--tv-c': '#ffd34d' } as React.CSSProperties} />
          <Streaks color="#ffd34d" />
          <div className="absolute inset-y-0 left-[3%] flex items-center gap-2">
            {winners.slice(0, 3).map((x, i) => <Face key={x.id} w={x} size={face} from="left" delay={i * 0.1} ring="#ffd34d" />)}
          </div>
          <div className="absolute inset-y-0 flex flex-col justify-center" style={{ left: `calc(3% + ${face * Math.min(3, Math.max(1, winners.length)) * 1.12 + 10}px)`, right: '3%' }}>
            <span className="mv-tv-punch" style={{ lineHeight: 1 }}>
              <Chrome text={label} size={fit(label, cw * 0.55, ch * 0.4)} gold />
            </span>
            {winners.length > 0 && (
              <span className="mv-tv-fadeup font-black italic text-white" style={{ fontSize: fit(winners.map(surname).join(' & '), cw * 0.55, ch * 0.3), textShadow: '0.06em 0.06em 0 #000', whiteSpace: 'nowrap', animationDelay: '0.3s' }}>
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
      node: (
        <div className="absolute inset-0 overflow-hidden" style={{ background: `linear-gradient(90deg, ${c} 0%, #07080c 50%)` }}>
          <div className="mv-tv-speed absolute inset-0" />
          <div className="absolute inset-y-0 left-[3%] flex items-center">
            <Face w={action.actor} size={face} />
          </div>
          <div className="absolute inset-y-0 flex flex-col justify-center" style={{ left: `calc(3% + ${face * 1.25}px)`, right: '3%' }}>
            <span className="mv-tv-fadeup font-bold uppercase text-white/85" style={{ fontSize: ch * 0.14, letterSpacing: '0.3em' }}>
              {upper(action.actor.name)}
            </span>
            <span className="mv-tv-slam" style={{ lineHeight: 1 }}>
              <Chrome text={upper(action.text)} size={fit(action.text, cw * 0.66, ch * 0.5)} />
            </span>
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
      node: (
        <div className="absolute inset-0 overflow-hidden" style={{ background: `radial-gradient(ellipse at 25% 50%, ${c}, #05060a 70%)` }}>
          <div className="mv-tv-rays absolute inset-0" style={{ '--tv-c': c } as React.CSSProperties} />
          <Streaks color={c} />
          <div className="absolute inset-y-0 left-[3%] flex items-center">
            <Face w={star} size={face} from="left" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center" style={{ paddingLeft: face }}>
            <span className="mv-tv-punch">
              <Chrome text={upper(star.name)} size={fit(star.name, cw * 0.7, ch * 0.52)} />
            </span>
          </div>
        </div>
      ),
    };
  }

  return (
    <div
      data-testid="apron-screen"
      className="mv-tv pointer-events-none absolute overflow-hidden"
      style={{ left, top, width: cw, height: ch, '--tv-accent': accent } as React.CSSProperties}
      aria-label={`${show.event}: ${cast.map((c) => c.name).join(', ')}`}
      role="img"
    >
      {scene && (
        <div key={scene.key} className="mv-tv-cut absolute inset-0">
          {scene.node}
        </div>
      )}
      {/* The room is furious: the picture breaks up red. */}
      {mood === 'boo' && big && <div className="mv-tv-redglitch absolute inset-0" />}
      {/* The company's bug in the corner, and the screen itself: scan lines, a sheen, a bezel. */}
      <span className="absolute bottom-[6%] right-[1.2%] font-black italic text-white/70" style={{ fontSize: ch * 0.12, letterSpacing: '0.1em' }}>
        {show.promotion.split(/\s+/).map((p) => p[0]).join('').toUpperCase()}
      </span>
      <div className="mv-tv-scan absolute inset-0" />
      <div className="mv-tv-sheen absolute inset-0" />
      <div className="absolute inset-0" style={{ boxShadow: `inset 0 0 0 2px #000, inset 0 0 0 3px ${accent}aa, inset 0 0 ${ch * 0.3}px #000a` }} />
    </div>
  );
});
