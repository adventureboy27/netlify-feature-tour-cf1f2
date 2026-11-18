// A star's moment: the building is theirs.
//
// For a main eventer (or bigger) the whole room is reacting to — walking
// out, a big moment, a win — the big screen over the entrance fills with
// their face and their name, a banner with their name drops either side of
// it, and every lamp in the rig swings to their colour (Arena.tsx). If they
// have just won it and the room is with them, it rains confetti.
//
// Everything is placed in the arena picture's own units (VIEW), so it sits
// on the screen and the rig wherever the stage is drawn.

import { memo } from 'react';
import { assignLook, lookSubjectOf } from '../paperdoll/assignLook';
import { ComposedPortrait } from '../paperdoll/ComposedPortrait';
import { VIEW } from './Arena';
import type { Wrestler } from '../../engine/types';
import type { Mood } from './crowd';

/** Their colour: what they wear, or gold if what they wear has none. */
export function starColorOf(w: Wrestler): string {
  const subject = lookSubjectOf(w);
  const look = subject ? assignLook(subject) : null;
  return look?.top?.color ?? look?.outer?.color ?? look?.waistband?.color ?? '#ffcf4d';
}

const pct = (n: number, of: number) => `${(n / of) * 100}%`;
/** The big screen over the entrance, in picture units (Arena.tsx). */
const SCREEN = { x: 430, y: 30, w: 340, h: 118 };

/** Confetti, placed by arithmetic so it falls the same way every time. */
const CONFETTI = Array.from({ length: 60 }, (_, i) => {
  const frac = (n: number) => n - Math.floor(n);
  const a = frac(Math.sin(i * 12.9898) * 43758.5453);
  const b = frac(Math.sin(i * 78.233) * 12543.123);
  return { x: a * 100, delay: b * 1.6, every: 2.2 + a * 1.6, drift: (b - 0.5) * 14, spin: 300 + a * 500, kind: i % 4 };
});

/** Head and shoulders, from their own art (or their photo). */
function Bust({ star }: { star: Wrestler }) {
  if (star.photoDataUrl) return <img src={star.photoDataUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />;
  const subject = lookSubjectOf(star);
  const look = subject ? assignLook(subject) : null;
  if (!look) return null;
  return (
    <div className="absolute" style={{ left: '-45%', top: '-4%', width: '190%', aspectRatio: '1' }}>
      <ComposedPortrait look={look} alt="" inked />
    </div>
  );
}

export const StarMoment = memo(function StarMoment({ star, mood, victory, color, u, caption }: { star: Wrestler; mood: Mood; victory: boolean; color: string; /** Pixels per hundredth of the stage's width. */ u: number; /** What the screen would have said (YOUR WINNER!, NEW CHAMPION!): said under their name. */ caption?: string | null }) {
  const angry = mood === 'boo';
  const name = star.name.toUpperCase();
  const surname = star.name.trim().split(/\s+/).pop()!.toUpperCase();
  const tint = angry ? '#d9302a' : color;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {/* The big screen: their face and their name, flashing. */}
      <div
        className={`${victory ? "mv-starscreen mv-starhold" : "mv-starscreen"} absolute overflow-hidden`}
        style={{ left: pct(SCREEN.x, VIEW.w), top: pct(SCREEN.y, VIEW.h), width: pct(SCREEN.w, VIEW.w), height: pct(SCREEN.h, VIEW.h), borderRadius: 6, background: `linear-gradient(110deg, ${tint} 0%, #0b0c12 70%)`, boxShadow: `0 0 24px ${tint}` }}
      >
        <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: '34%' }}>
          <Bust star={star} />
        </div>
        <div className="absolute inset-y-0 right-0 flex flex-col items-center justify-center" style={{ width: '68%' }}>
          <span className="mv-starname font-black italic leading-none text-white" style={{ fontSize: Math.min(3.1, 37 / Math.max(6, name.length)) * u, textShadow: `0 0 10px ${tint}, 0.08em 0.08em 0 #000` }}>
            {name}
          </span>
          {(caption || victory) && (
            <span className="mt-1 font-black uppercase tracking-widest" style={{ fontSize: 1.1 * u, color: angry ? '#ffb3ad' : '#fff3c4' }}>
              {caption ?? (angry ? 'gets away with it' : 'wins!')}
            </span>
          )}
        </div>
      </div>
      {/* Banners either side of the screen, dropping from the rig. */}
      {[300, 900].map((x) => (
        <div
          key={x}
          className={`${victory ? "mv-starbanner mv-starhold" : "mv-starbanner"} absolute flex items-center justify-center`}
          style={{ left: pct(x - 56, VIEW.w), top: pct(27, VIEW.h), width: pct(112, VIEW.w), height: pct(165, VIEW.h), background: `linear-gradient(to bottom, ${tint}, #0b0c12)`, clipPath: 'polygon(0 0, 100% 0, 100% 88%, 50% 100%, 0 88%)' }}
        >
          <span className="font-black italic text-white" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: Math.min(2.6, 23 / Math.max(5, surname.length)) * u, letterSpacing: '0.08em', textShadow: '0.08em 0.08em 0 #000' }}>
            {surname}
          </span>
        </div>
      ))}
    </div>
  );
});

/** A win the room loves: it rains confetti, in front of everything. */
export const Confetti = memo(function Confetti({ color, u }: { color: string; u: number }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className="mv-confetti absolute"
          style={{ left: `${c.x}%`, top: '-3%', width: c.kind === 3 ? '0.35%' : '0.7%', height: c.kind === 3 ? '3%' : '1.1%', background: c.kind === 0 ? '#ffd34d' : c.kind === 1 ? '#ffffff' : color, animationDelay: `${c.delay}s`, animationDuration: `${c.every}s`, '--drift': `${c.drift * u}px`, '--spin': `${c.spin}deg` } as React.CSSProperties}
        />
      ))}
    </div>
  );
});
