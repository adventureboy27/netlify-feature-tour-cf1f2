// The trophy wall: every mask this wrestler has taken off somebody in a ring.
// Each one hangs on a plate with the name it came off and the date it was taken.
import type { Id, Wrestler, WorldSettings } from '../../engine/types';
import { weekLabel } from '../../engine/world/calendar';
import { maskWorn } from '../paperdoll/maskWorn';
import { maskOnly } from '../paperdoll/ComposedPortrait';

export function MaskWall({ wrestler, wrestlers, settings }: { wrestler: Wrestler; wrestlers: Record<Id, Wrestler>; settings: WorldSettings }) {
  const won = wrestler.masksWon ?? [];
  if (won.length === 0) return null;
  return (
    <section data-testid="mask-wall" className="mt-3 flex max-h-[340px] flex-col rounded-md border border-amber-900/70 bg-[#2a1d12] p-3">
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <h4 className="text-[11px] font-black uppercase tracking-widest text-amber-300">Masks won</h4>
        <span className="text-[10px] text-amber-500">{won.length} on the wall</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-3 overflow-y-auto pr-1">
        {won.map((trophy, i) => {
          const art = maskWorn(wrestlers[trophy.fromId]);
          const when = weekLabel(trophy.week, settings);
          return (
            <figure key={`${trophy.fromId}-${trophy.week}-${i}`} className="flex w-[118px] flex-col items-center">
              {/* The mask on its hook, then the plate under it. */}
              {/* The art is drawn on a whole-figure canvas, with the mask near the top of it: the canvas is
                  made big and shifted so the mask lands in the middle of the plate. */}
              <div className="relative h-[70px] w-[70px] overflow-hidden rounded-full bg-[#120b06] shadow-inner">
                {art &&
                  (art.color ? (
                    <div className="absolute h-[230px] w-[230px]" style={{ left: -80, top: -29, backgroundColor: art.color, ...maskOnly(art.url) }} />
                  ) : (
                    <img src={art.url} alt="" className="absolute h-[230px] w-[230px] max-w-none" style={{ left: -80, top: -29 }} />
                  ))}
              </div>
              <figcaption className="mt-1.5 w-full rounded-sm border border-amber-700/70 bg-gradient-to-b from-amber-200 to-amber-400 px-2 py-1 text-center text-neutral-900 shadow">
                <div className="break-words text-[10px] font-black uppercase leading-tight">from {trophy.fromName}</div>
                <div className="text-[9px] font-semibold">{when.month} week {when.weekOfMonth}, {when.year}</div>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
