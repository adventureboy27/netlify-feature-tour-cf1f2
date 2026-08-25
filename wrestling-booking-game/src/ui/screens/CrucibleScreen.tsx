// The Crucible's permanent record.
//
// Year, company, and who carried the Iron Crown — the three things anybody
// would want off a roll of honor, oldest at the bottom the way a plaque reads.
// Multiple winners get counted, because winning it twice is a different kind of
// career from winning it once.

import { useGameStore } from '../../state/store';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { CUP_NAME, CUP_TROPHY, crownsFor } from '../../engine/world/cup';

export function CrucibleScreen() {
  const world = useGameStore((s) => s.world);
  if (!world) return null;

  const history = [...world.cupHistory].reverse();
  const current = world.crown;

  // Who has won it more than once, most first — the short list that matters.
  const multiple = [...new Set(world.cupHistory.map((r) => r.wrestlerId))]
    .map((id) => ({ id, reigns: crownsFor(world.cupHistory, id) }))
    .filter((x) => x.reigns.length > 1)
    .sort((a, b) => b.reigns.length - a.reigns.length);

  return (
    <div className="space-y-3 p-3 pb-6">
      <section className="rounded-lg border border-emerald-800 bg-emerald-950/20 p-3">
        <h2 className="text-sm font-semibold text-emerald-300">{CUP_NAME}</h2>
        <p className="mt-1 text-xs text-neutral-400">
          Every August, every company that can afford the entry fee throws their hat in — one bracket, one
          winner, no exceptions. That winner carries {CUP_TROPHY} for the entire year and walks away with half
          the pot in their own pocket.
        </p>
      </section>

      {current && (
        <section className="rounded-lg border border-amber-700 bg-amber-950/25 p-3">
          <div className="text-[10px] uppercase tracking-wide text-amber-300/80">
            Reigning · {current.year}
          </div>
          <div className="mt-1 flex items-center gap-3">
            {world.wrestlers[current.wrestlerId] && (
              <PaperDoll
                appearance={world.wrestlers[current.wrestlerId]!.appearance}
                gender={world.wrestlers[current.wrestlerId]!.gender}
                alignment={world.wrestlers[current.wrestlerId]!.alignment}
                size="bust"
              />
            )}
            <div className="min-w-0">
              <div className="truncate text-base font-bold text-amber-200">
                🏆 {current.wrestlerName}
              </div>
              <div className="truncate text-xs text-neutral-400">{current.promotionName}</div>
            </div>
          </div>
        </section>
      )}

      {multiple.length > 0 && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
          <h2 className="mb-2 text-sm font-medium text-neutral-200">More than once</h2>
          <div className="flex flex-col gap-1">
            {multiple.map(({ id, reigns }) => (
              <div key={id} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate text-neutral-200">{reigns[0]!.wrestlerName}</span>
                <span className="shrink-0 font-semibold text-amber-300">
                  🏆 ×{reigns.length}
                  <span className="ml-1 text-[10px] font-normal text-neutral-500">
                    {reigns.map((r) => r.year).join(', ')}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
        <h2 className="mb-2 text-sm font-medium text-neutral-200">
          Roll of honor — {world.cupHistory.length}
        </h2>
        {history.length === 0 ? (
          <p className="text-xs text-neutral-500">
            Nobody has won it yet — that first crown is still up for grabs in August.
          </p>
        ) : (
          <div className="flex flex-col">
            {history.map((reign, i) => (
              <div
                key={`${reign.year}-${reign.wrestlerId}-${i}`}
                className="flex items-baseline justify-between gap-2 border-b border-neutral-800 py-1.5 last:border-b-0"
              >
                <span className="w-10 shrink-0 text-[11px] tabular-nums text-neutral-500">
                  {reign.year}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-100">
                  {reign.wrestlerName}
                </span>
                <span className="min-w-0 max-w-[45%] truncate text-right text-[11px] text-neutral-400">
                  {reign.promotionName}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
