// Where everybody stands.
//
// Three lists, because they answer three questions. The contender list is your
// booking sheet — who the crowd would buy in a title match this month. The
// world list is the argument you have with the other promotions: whose champion
// is the real champion. The circuits are the answer to neither of those and
// the most useful of the three: whose scene is this.
//
// A single global list is flat. Everybody is measured against everybody, so it
// reads as the biggest company's roster in order and a territory act who sells
// out three towns a week never appears. The circuits let somebody be the
// biggest thing on one loop and nobody in the big rooms, which is a real
// position and a real decision about whether to expand.
//
// Both are derived on read rather than stored, so they are never stale and
// there is nothing to keep in sync.

import { useMemo, useState } from 'react';
import { useGameStore } from '../../state/store';
import { contenderRankings, worldRankings } from '../../engine/world/rankings';
import { circuitRankings } from '../../engine/world/circuits';
import { CIRCUITS } from '../../data/circuits';
import { titlesOf, shortTitleName } from '../../data/titles';
import { billedAs } from '../../engine/generate/nickname';
import { identityOf } from '../../data/promotionIdentity';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { StatBar } from '../components/display';
import { Tabs, promotionTheme } from '../components/chrome';

type Tab = 'contenders' | 'world' | 'circuits';

const TAB_OPTIONS: { id: Tab; label: string }[] = [
  { id: 'contenders', label: 'Your contenders' },
  { id: 'world', label: 'The business' },
  { id: 'circuits', label: 'The circuits' },
];

export function RankingsScreen() {
  const world = useGameStore((s) => s.world);
  const [tab, setTab] = useState<Tab>('contenders');
  const [circuitId, setCircuitId] = useState<string>(CIRCUITS[0]!.id);

  const lists = useMemo(() => {
    if (!world) return null;
    const ctx = { currentWeek: world.week, titles: world.titles, settings: world.settings };
    const roster = world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean);
    const everyone = Object.values(world.wrestlers);
    return {
      contenders: contenderRankings(roster, world.promotion.id, ctx),
      world: worldRankings(everyone, ctx),
      circuit: circuitRankings(everyone, circuitId, world.territories, ctx),
    };
  }, [world, circuitId]);

  if (!world || !lists) return null;

  const promotionOf = (id: string | null) =>
    id === world.promotion.id ? world.promotion : world.rivals.find((r) => r.id === id);

  const myChampions = titlesOf(world.titles, world.promotion.id).filter((t) => !t.vacant);
  const selectedCircuit = CIRCUITS.find((c) => c.id === circuitId);
  const theme = promotionTheme(world.promotion.identity);

  return (
    <div className="p-3 pb-6 text-neutral-100">
      <h1 className="mb-3 text-xl font-black tracking-tight">Rankings</h1>

      <div className="mb-3">
        <Tabs options={TAB_OPTIONS} active={tab} onChange={setTab} theme={theme} testIdPrefix="rankings" />
      </div>

      {tab === 'circuits' ? (
        <>
          {/* Pick a loop. The blurb and the hard sell are the whole
              explanation of why this list is not the world list — a scene is
              defined as much by what it will not forgive as by what it wants. */}
          <div className="mb-2 grid grid-cols-2 gap-1">
            {CIRCUITS.map((circuit) => (
              <button
                key={circuit.id}
                type="button"
                data-testid={`circuit-${circuit.id}`}
                onClick={() => setCircuitId(circuit.id)}
                className={`rounded-lg border p-2 text-left text-xs transition ${
                  circuitId === circuit.id
                    ? 'border-emerald-600 bg-emerald-950/40 text-neutral-100'
                    : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-600'
                }`}
              >
                <div className="font-semibold">{circuit.name}</div>
                <div className="mt-0.5 text-[10px] leading-snug text-neutral-500">
                  {circuit.territoryIds
                    .map((id) => world.territories.find((t) => t.id === id)?.name)
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </button>
            ))}
          </div>

          {selectedCircuit && (
            <div className="mb-2 rounded-lg border border-neutral-800 bg-neutral-950 p-2.5">
              <p className="text-xs leading-snug text-neutral-300">{selectedCircuit.blurb}</p>
              <p className="mt-1 text-[11px] leading-snug text-rose-300/70">{selectedCircuit.hardSell}</p>
            </div>
          )}

          <div className="flex flex-col gap-1">
            {lists.circuit.map((entry) => {
              const w = world.wrestlers[entry.wrestlerId];
              if (!w) return null;
              const company = promotionOf(w.promotionId);
              const isMine = w.promotionId === world.promotion.id;
              // Where they sit on the world list, for contrast. Being #2 here
              // and #40 in the business is the entire point of the screen.
              const worldRank = lists.world.find((r) => r.wrestlerId === entry.wrestlerId)?.rank ?? null;

              return (
                <article
                  key={entry.wrestlerId}
                  data-testid={`circuit-rank-${entry.rank}`}
                  className={`flex items-center gap-2 rounded border p-1.5 ${
                    isMine ? 'border-emerald-800 bg-emerald-950/30' : 'border-neutral-800 bg-neutral-900'
                  }`}
                >
                  <span className="w-5 shrink-0 text-right font-mono text-xs text-neutral-500">{entry.rank}</span>
                  <PaperDoll photoDataUrl={w.photoDataUrl} name={w.name} size="thumb" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{billedAs(w)}</div>
                    <div className="truncate text-[10px] text-neutral-500">{company?.name ?? 'Unsigned'}</div>
                  </div>
                  <span className="shrink-0 text-right text-[10px] leading-tight text-neutral-600">
                    {worldRank !== null ? (
                      <>
                        #{worldRank}
                        <br />
                        business
                      </>
                    ) : (
                      <>
                        unranked
                        <br />
                        business
                      </>
                    )}
                  </span>
                </article>
              );
            })}
          </div>
        </>
      ) : tab === 'contenders' ? (
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
                  <PaperDoll photoDataUrl={w.photoDataUrl} name={w.name} size="thumb" />
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
              <p className="text-xs text-neutral-500">
                Nobody available. Your entire roster is banged up or out the door.
              </p>
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
