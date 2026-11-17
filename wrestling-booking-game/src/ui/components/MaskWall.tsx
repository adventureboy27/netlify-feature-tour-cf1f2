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
    <section data-testid="mask-wall" className="mt-3 rounded-md border border-amber-900/70 bg-[#2a1d12] p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="text-[11px] font-black uppercase tracking-widest text-amber-300">Masks won</h4>
        <span className="text-[10px] text-amber-900">{won.length} on the wall</span>
      </div>
      <div className="flex flex-wrap gap-3">
        {won.map((trophy, i) => {
          const art = maskWorn(wrestlers[trophy.fromId]);
          const when = weekLabel(trophy.week, settings);
          return (
            <figure key={`${trophy.fromId}-${trophy.week}-${i}`} className="flex w-[118px] flex-col items-center">
              {/* The mask on its hook, then the plate under it. */}
              <div className="relative h-[70px] w-[70px] rounded-full bg-[#120b06] shadow-inner">
                {art &&
                  (art.color ? (
                    <div className="absolute inset-1" style={{ backgroundColor: art.color, ...maskOnly(art.url) }} />
                  ) : (
                    <img src={art.url} alt="" className="absolute inset-1 h-[calc(100%-8px)] w-[calc(100%-8px)] object-contain" />
                  ))}
              </div>
              <figcaption className="mt-1.5 w-full rounded-sm border border-amber-700/70 bg-gradient-to-b from-amber-200 to-amber-400 px-2 py-1 text-center text-neutral-900 shadow">
                <div className="truncate text-[10px] font-black uppercase">from {trophy.fromName}</div>
                <div className="text-[9px] font-semibold">{when.month} week {when.weekOfMonth}, {when.year}</div>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
