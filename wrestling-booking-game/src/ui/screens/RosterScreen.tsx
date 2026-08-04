// Roster — §21: "Grid of name plates. Color-coded: green face, purple heel,
// pink women's division, gray non-wrestler. Health as a red bar consuming the
// plate from the right. Sortable by any stat."
//
// Stats are bars, never numbers (§0). The sort keys read the real values; the
// player only ever sees the ordering and the bar.

import { useMemo, useState } from 'react';
import { useGameStore } from '../../state/store';
import { activeRivalriesFor } from '../../engine/sim/rivalry';
import { effectiveAppearance } from '../../engine/generate/gimmickLook';
import { CAREER_STATUS_LABELS, CAREER_STATUS_BLURBS } from '../../engine/career/status';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { StatBar, AlignmentDot, HeatBadge } from '../components/display';
import type { Wrestler } from '../../engine/types';

const SORTS = {
  popularity: { label: 'Popularity', of: (w: Wrestler) => w.popularity },
  condition: { label: 'Condition', of: (w: Wrestler) => w.health },
  momentum: { label: 'Momentum', of: (w: Wrestler) => w.momentum },
  morale: { label: 'Morale', of: (w: Wrestler) => w.morale },
  skill: { label: 'Skill', of: (w: Wrestler) => w.skill },
  age: { label: 'Age', of: (w: Wrestler) => -w.age },
  name: { label: 'Name', of: () => 0 },
} as const;

type SortKey = keyof typeof SORTS;

export function RosterScreen() {
  const world = useGameStore((s) => s.world);
  const [sort, setSort] = useState<SortKey>('popularity');

  const roster = useMemo(() => {
    if (!world) return [];
    const list = world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean);
    if (sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name));
    return [...list].sort((a, b) => SORTS[sort].of(b) - SORTS[sort].of(a));
  }, [world, sort]);

  if (!world) return null;

  const stableOf = (w: Wrestler) =>
    world.stables.find((s) => s.disbandedWeek === null && s.memberIds.includes(w.id));

  return (
    <div className="p-3 pb-24 text-neutral-100">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-base font-semibold">Roster — {roster.length}</h1>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {(Object.keys(SORTS) as SortKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSort(key)}
            className={`rounded px-2 py-1 text-[11px] ${sort === key ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
          >
            {SORTS[key].label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {roster.map((w) => {
          const rivalries = activeRivalriesFor(world.rivalries, [w.id]);
          return (
            <article
              key={w.id}
              className="relative flex gap-2 overflow-hidden rounded border border-neutral-800 bg-neutral-900 p-2"
            >
              {/* Health consumes the plate from the right, §21. */}
              <div
                className="pointer-events-none absolute inset-y-0 right-0 bg-rose-950/40"
                style={{ width: `${100 - w.health}%` }}
                aria-hidden
              />
              <PaperDoll
                // Members of a stable wrestle in the group's colours.
                appearance={effectiveAppearance(w, world.stables)}
                gender={w.gender}
                alignment={w.alignment}
                size="bust"
              />
              <div className="relative min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <AlignmentDot alignment={w.alignment} />
                  <span className="truncate text-sm font-medium">{w.name}</span>
                </div>
                <div
                  className="mb-0.5 truncate text-[10px] text-amber-500/80"
                  title={CAREER_STATUS_BLURBS[w.careerStatus]}
                >
                  {CAREER_STATUS_LABELS[w.careerStatus]}
                  {stableOf(w) && <span className="ml-1 text-sky-400">· {stableOf(w)!.name}</span>}
                </div>
                <div className="mb-1 truncate text-[10px] text-neutral-500">
                  {w.archetype} · {w.style} · {w.gimmick.name}
                </div>
                <StatBar label="Popularity" value={w.popularity} />
                <StatBar label="Skill" value={w.skill} />
                <StatBar label="Momentum" value={w.momentum} />
                <StatBar label="Condition" value={w.health} tone="health" />
                {rivalries.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {rivalries.map((r) => (
                      <HeatBadge key={r.id} heat={r.heat} shootHeat={r.shootHeat} />
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
