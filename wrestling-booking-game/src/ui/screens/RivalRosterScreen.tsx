// The competition, roster by roster.
//
// Your own roster gets a full card and a career ledger under every name —
// where a rival's people have been was nowhere in the game. This is that
// screen for everybody else: pick a company, see who they have, and see the
// road that got each of them there. Read-only on purpose — this is scouting,
// not management. Nothing here signs, releases, or tampers with anybody.

import { useMemo, useState } from 'react';
import { useGameStore } from '../../state/store';
import { identityOf } from '../../data/promotionIdentity';
import { titlesHeldBy, shortTitleName } from '../../data/titles';
import { WrestlerRow } from '../components/WrestlerRow';
import { CareerLedger } from '../components/CareerLedger';
import { Panel, SectionHead } from '../components/chrome';
import type { Promotion, Wrestler } from '../../engine/types';

export function RivalRosterScreen({ onNavigate }: { onNavigate?: (wrestlerId: string) => void } = {}) {
  const world = useGameStore((s) => s.world);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  return (
    <div className="p-3 pb-24 text-neutral-100">
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
                onClick={() => setSelectedId(rival.id)}
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
            <>
              <SectionHead hint={`${roster.length} signed`}>{selected.name}</SectionHead>
              <div className="flex flex-col gap-2">
                {roster.map((w) => {
                  const belts = titlesHeldBy(world.titles, w.id);
                  return (
                    <Panel key={w.id} className="p-2">
                      <WrestlerRow
                        wrestler={w}
                        settings={world.settings}
                        onClick={onNavigate ? () => onNavigate(w.id) : undefined}
                      />
                      {belts.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {belts.map((belt) => (
                            <span
                              key={belt.id}
                              className="rounded px-1.5 py-px text-[10px] font-medium"
                              style={{ backgroundColor: belt.colorway.strap, color: belt.colorway.plate }}
                            >
                              {shortTitleName(belt)}
                            </span>
                          ))}
                        </div>
                      )}
                      <CareerLedger wrestler={w} settings={world.settings} />
                    </Panel>
                  );
                })}
                {roster.length === 0 && <p className="text-xs text-neutral-500">Nobody signed right now.</p>}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
