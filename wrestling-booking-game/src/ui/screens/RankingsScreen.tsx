// Where everybody stands.
//
// Two lists, because they answer two questions. The contender list is your
// booking sheet — who the crowd would buy in a title match this month. The
// world list is the argument you have with the other promotions: whose champion
// is the real champion.
//
// Both are derived on read rather than stored, so they are never stale and
// there is nothing to keep in sync.

import { useMemo, useState } from 'react';
import { useGameStore } from '../../state/store';
import { contenderRankings, worldRankings } from '../../engine/world/rankings';
import { titlesOf, shortTitleName } from '../../data/titles';
import { billedAs } from '../../engine/generate/nickname';
import { identityOf } from '../../data/promotionIdentity';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { effectiveAppearance } from '../../engine/generate/gimmickLook';
import { StatBar } from '../components/display';

type Tab = 'contenders' | 'world';

export function RankingsScreen() {
  const world = useGameStore((s) => s.world);
  const [tab, setTab] = useState<Tab>('contenders');

  const lists = useMemo(() => {
    if (!world) return null;
    const ctx = { currentWeek: world.week, titles: world.titles, settings: world.settings };
    const roster = world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean);
    return {
      contenders: contenderRankings(roster, world.promotion.id, ctx),
      world: worldRankings(Object.values(world.wrestlers), ctx),
    };
  }, [world]);

  if (!world || !lists) return null;

  const promotionOf = (id: string | null) =>
    id === world.promotion.id ? world.promotion : world.rivals.find((r) => r.id === id);

  const myChampions = titlesOf(world.titles, world.promotion.id).filter((t) => !t.vacant);

  return (
    <div className="p-3 pb-24 text-neutral-100">
      <h1 className="mb-3 text-base font-semibold">Rankings</h1>

      <div className="mb-3 flex gap-1">
        {(['contenders', 'world'] as Tab[]).map((option) => (
          <button
            key={option}
            type="button"
            data-testid={`rankings-${option}`}
            onClick={() => setTab(option)}
            className={`rounded px-3 py-1 text-xs ${
              tab === option ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            {option === 'contenders' ? 'Your contenders' : 'The whole business'}
          </button>
        ))}
      </div>

      {tab === 'contenders' ? (
        <>
          {myChampions.length > 0 && (
            <section className="mb-3">
              <h2 className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Holding the belts</h2>
              <div className="flex flex-col gap-1">
                {myChampions.map((title) => (
                  <div
                    key={title.id}
                    className="flex items-center gap-2 rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: title.colorway.plate }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {title.currentHolderIds
                        .map((id) => world.wrestlers[id])
                        .filter(Boolean)
                        .map((w) => billedAs(w!))
                        .join(' & ')}
                    </span>
                    <span className="shrink-0 text-[10px] text-neutral-500">{shortTitleName(title)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <h2 className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Next in line</h2>
          <div className="flex flex-col gap-1">
            {lists.contenders.map((entry) => {
              const w = world.wrestlers[entry.wrestlerId];
              if (!w) return null;
              return (
                <article
                  key={entry.wrestlerId}
                  data-testid={`contender-${entry.rank}`}
                  className="flex items-center gap-2 rounded border border-neutral-800 bg-neutral-900 p-1.5"
                >
                  <span className="w-5 shrink-0 text-right font-mono text-xs text-neutral-500">{entry.rank}</span>
                  <PaperDoll
                    appearance={effectiveAppearance(w, world.stables)}
                    gender={w.gender}
                    alignment={w.alignment}
                    size="thumb"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{billedAs(w)}</div>
                    <div className="text-[10px] text-neutral-500">
                      {w.record.wins}-{w.record.losses}
                      {w.record.draws > 0 && `-${w.record.draws}`}
                    </div>
                    <StatBar label="Momentum" value={w.momentum} />
                  </div>
                </article>
              );
            })}
            {lists.contenders.length === 0 && (
              <p className="text-xs text-neutral-500">Nobody available. Your whole roster is hurt or gone.</p>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1">
          {lists.world.map((entry) => {
            const w = world.wrestlers[entry.wrestlerId];
            if (!w) return null;
            const company = promotionOf(w.promotionId);
            const belt = entry.titleId ? world.titles.find((t) => t.id === entry.titleId) : null;
            const isMine = w.promotionId === world.promotion.id;

            return (
              <article
                key={entry.wrestlerId}
                data-testid={`world-rank-${entry.rank}`}
                className={`flex items-center gap-2 rounded border p-1.5 ${
                  isMine ? 'border-emerald-800 bg-emerald-950/30' : 'border-neutral-800 bg-neutral-900'
                }`}
              >
                <span className="w-6 shrink-0 text-right font-mono text-xs text-neutral-500">{entry.rank}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{billedAs(w)}</div>
                  <div className="truncate text-[10px] text-neutral-500">
                    {company?.name ?? 'Unsigned'}
                    {company && (
                      <span className="ml-1 text-neutral-600">· {identityOf(company.identity).label}</span>
                    )}
                  </div>
                </div>
                {belt && (
                  <span
                    className="shrink-0 rounded px-1 py-px text-[9px] font-medium"
                    style={{ backgroundColor: belt.colorway.strap, color: belt.colorway.plate }}
                    title={belt.name}
                  >
                    {shortTitleName(belt)}
                  </span>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
