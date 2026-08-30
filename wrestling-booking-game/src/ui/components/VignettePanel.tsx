// The mystery-video reel airing tonight in place of an actual debut — see
// engine/career/vignette.ts. Read-only, like the reel itself: nobody casts
// this week to week, it was cast the day the booker paid for it at signing
// time. Sits under the match card the same way promo/dark-match slots do,
// because it airs on the show without ever consuming a match spot.

import { useGameStore } from '../../state/store';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { vignetteProgressLine, vignetteWeekNumber, type Vignette } from '../../engine/career/vignette';
import type { Wrestler } from '../../engine/types';

export function VignettePanel() {
  const world = useGameStore((s) => s.world);
  if (!world) return null;

  const running = world.promotion.rosterIds
    .map((id) => world.wrestlers[id])
    .filter((w): w is Wrestler & { vignette: Vignette } => w !== undefined && Boolean(w.vignette));

  if (running.length === 0) return null;

  return (
    <section className="mt-4">
      <h2 className="mb-1 text-sm font-medium text-neutral-300">Vignette package airing tonight</h2>
      <p className="mb-2 text-[11px] text-neutral-500">
        Nothing to cast here — the campaign was bought and paid for the day they signed. Nobody in this crowd
        knows the name yet.
      </p>

      <div className="flex flex-col gap-2">
        {running.map((w) => (
          <div
            key={w.id}
            data-testid={`vignette-slot-${w.id}`}
            className="flex items-center gap-2 rounded border border-violet-900/60 bg-violet-950/10 p-2"
          >
            <PaperDoll photoDataUrl={w.photoDataUrl} name={w.name} size="thumb" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-neutral-200">{w.name}</div>
              <div className="text-[10px] text-violet-400">
                Week {vignetteWeekNumber(w.vignette)} of {w.vignette.totalWeeks}
              </div>
              <div className="text-[11px] text-neutral-500">{vignetteProgressLine(w.vignette)}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
