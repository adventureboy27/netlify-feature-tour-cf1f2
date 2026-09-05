// The match-up, as a picture.
//
// A wrestling game with no match to watch still has to show you a match. The
// results page listed six bouts as six sentences — "Baron Nash beat Buddy
// Underhill by pinfall" — which is accurate and completely inert. Nothing on
// the page looked like wrestling.
//
// So each bout gets the thing a poster has always had: two people facing each
// other across the middle of the frame, names underneath, and the winner lit.
// The sprites already existed and were used on exactly one section at the
// bottom of the page.
//
// This renders the *match-up*, not the result text — the write-up still runs
// underneath it, and everything it says is still said in words.

import type { Wrestler } from '../../engine/types';
import { billedAs } from '../../engine/generate/nickname';
import { PaperDoll } from '../paperdoll/PaperDoll';

export interface BoutSide {
  wrestlers: Wrestler[];
  /** null before the bell, true/false after. Drives who is lit. */
  won: boolean | null;
}

/**
 * One corner. The right-hand side is mirrored so the pair composes as two
 * corners of a ring rather than as the same pose printed twice.
 */
function Corner({ side, mirror, dim }: { side: BoutSide; mirror: boolean; dim: boolean }) {
  const lit = side.won === true;
  return (
    <div className={`flex min-w-0 flex-col items-center gap-1 ${dim ? 'opacity-45 saturate-50' : ''}`}>
      <div className={`flex ${mirror ? 'flex-row-reverse' : ''} ${side.wrestlers.length > 1 ? '-space-x-3' : ''}`}>
        {side.wrestlers.map((w) => (
          <div
            key={w.id}
            className={`rounded-md border bg-neutral-950 ${
              lit ? 'border-emerald-600/70 shadow-[0_0_14px_-2px_rgba(16,185,129,0.45)]' : 'border-neutral-800'
            }`}
          >
            <PaperDoll photoDataUrl={w.photoDataUrl} name={w.name} size="bust" flip={mirror} />
          </div>
        ))}
      </div>
      <div className="w-full text-center">
        {side.wrestlers.map((w) => (
          <div
            key={w.id}
            className={`truncate text-[13px] font-semibold leading-tight ${lit ? 'text-emerald-300' : 'text-neutral-300'}`}
          >
            {billedAs(w)}
          </div>
        ))}
        {lit && <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-500">Winner</div>}
      </div>
    </div>
  );
}

/**
 * Two corners and whatever sits between them — the stars, or "DRAW".
 *
 * A draw dims nobody: it is the one outcome where both sides are equally the
 * story, and greying the pair of them out would say the opposite.
 */
export function Bout({ sides, centre }: { sides: BoutSide[]; centre: React.ReactNode }) {
  const decided = sides.some((s) => s.won === true);
  const [left, ...rest] = sides;
  if (!left) return null;

  return (
    <div className="flex items-start justify-center gap-2 py-1">
      <div className="flex-1">
        <Corner side={left} mirror={false} dim={decided && left.won !== true} />
      </div>
      <div className="flex shrink-0 flex-col items-center gap-0.5 pt-6">{centre}</div>
      {rest.map((side, i) => (
        <div key={i} className="flex-1">
          <Corner side={side} mirror dim={decided && side.won !== true} />
        </div>
      ))}
    </div>
  );
}

/** The word in the middle before the bell, and the fallback after a draw. */
export function VersusMark({ children = 'vs' }: { children?: React.ReactNode }) {
  return (
    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-600">{children}</span>
  );
}
