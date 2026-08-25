// The competition, roster by roster.
//
// Your own roster gets a full detail pane under every name — where a rival's
// people have been was nowhere in the game. This is that screen for
// everybody else: pick a company, see who they have, and see the road that
// got each of them there. Read-only on purpose — this is scouting, not
// management. Nothing here signs, releases, or tampers with anybody.
//
// Master-detail, same as your own roster: a compact list on the left for the
// selected company, and `WrestlerDetailBody` on the right for whoever's
// selected — read-only (`editable={false}`), so belts and the career ledger
// (which used to sit inline on every row) now live in the one detail pane
// instead of being repeated down the whole list.

import { useMemo, useState } from 'react';
import { useGameStore } from '../../state/store';
import { identityOf } from '../../data/promotionIdentity';
import { WrestlerRow } from '../components/WrestlerRow';
import { WrestlerDetailBody } from '../components/WrestlerDetail';
import type { Id, Promotion, Wrestler } from '../../engine/types';

export function RivalRosterScreen({ onNavigate }: { onNavigate?: (wrestlerId: Id) => void } = {}) {
  const world = useGameStore((s) => s.world);
  const [selectedId, setSelectedId] = useState<Id | null>(null);
  const [selectedWrestlerId, setSelectedWrestlerId] = useState<Id | null>(null);

  // Closed companies have nothing left to scout — their people scattered to
  // the free agent pool or somebody else's roster, and are found there.
  const rivals = useMemo(
    () => (world ? [...world.rivals].filter((r) => r.closedWeek === null).sort((a, b) => b.rating - a.rating) : []),
    [world],
  );

  if (!world) return null;

  const selected: Promotion | null = rivals.find((r) => r.id === selectedId) ?? rivals[0] ?? null;

  const roster: Wrestler[] = selected
    ? selected.rosterIds
        .map((id) => world.wrestlers[id])
        .filter((w): w is Wrestler => Boolean(w && !w.deceased))
        .sort((a, b) => b.popularity - a.popularity)
    : [];

  const rosterIds = new Set(roster.map((w) => w.id));
  const activeId = selectedWrestlerId && rosterIds.has(selectedWrestlerId) ? selectedWrestlerId : (roster[0]?.id ?? null);
  const active = activeId ? world.wrestlers[activeId] : undefined;

  return (
    <div className="p-6 text-neutral-100">
      <h1 className="text-lg font-bold">The competition</h1>
      <p className="mb-3 text-[11px] leading-snug text-neutral-500">
        Every company still standing, and every single body on their roster — who they are, what they carry, and
        exactly where they worked before this.
      </p>

      {rivals.length === 0 ? (
        <p className="text-xs text-neutral-500">Nobody else is left in the business.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {rivals.map((rival) => (
              <button
                key={rival.id}
                type="button"
                data-testid={`rival-pick-${rival.id}`}
                onClick={() => {
                  setSelectedId(rival.id);
                  setSelectedWrestlerId(null);
                }}
                className={`rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                  selected?.id === rival.id
                    ? 'border-emerald-600 bg-emerald-950/40 text-neutral-100'
                    : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-600'
                }`}
              >
                <div className="font-semibold">{rival.name}</div>
                <div className="text-[10px] text-neutral-500">
                  {identityOf(rival.identity).label} · rating {Math.round(rival.rating)} · {rival.rosterIds.length}{' '}
                  signed
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <div className="grid grid-cols-[380px_1fr] gap-4">
              <div className="flex max-h-[75vh] flex-col gap-1.5 overflow-y-auto pr-1">
                {roster.map((w) => (
                  <div key={w.id}>
                    <WrestlerRow
                      wrestler={w}
                      settings={world.settings}
                      compact
                      selected={w.id === activeId}
                      onClick={() => setSelectedWrestlerId(w.id)}
                    />
                  </div>
                ))}
                {roster.length === 0 && <p className="text-xs text-neutral-500">Nobody signed right now.</p>}
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
                {active ? (
                  <div className="max-w-2xl">
                    <WrestlerDetailBody wrestler={active} editable={false} onNavigateWrestler={(id) => onNavigate?.(id)} />
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">Nobody selected.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
