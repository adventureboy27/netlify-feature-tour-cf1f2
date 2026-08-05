// Roster — §21: "Grid of name plates. Color-coded... Health as a red bar
// consuming the plate from the right. Sortable by any stat."
//
// The bar this screen has to clear: you should be able to look at one card
// and know what that wrestler is *about* without opening anything. Who they
// are, whose side they're on, what they're carrying, who they can't stand,
// what they cost you, and whether they can work this week.
//
// Stats stay bars and words (§0). The two exceptions are age and the contract,
// because "31" and "$450/wk for 60 weeks" are facts a booker needs exactly,
// not impressions.

import { useMemo, useState } from 'react';
import { useGameStore } from '../../state/store';
import { activeRivalriesFor } from '../../engine/sim/rivalry';
import { effectiveAppearance } from '../../engine/generate/gimmickLook';
import { CAREER_STATUS_LABELS, CAREER_STATUS_BLURBS, yearsPro } from '../../engine/career/status';
import { egoLabel } from '../../engine/career/ego';
import { retirementPressure } from '../../engine/career/retirement';
import { contractUrgency } from '../../engine/economy/contracts';
import { titlesHeldBy, shortTitleName, reignLength } from '../../data/titles';
import {
  relationshipsFor,
  otherParty,
  isAlly,
  isEnemy,
  RELATIONSHIP_LABELS,
} from '../../engine/career/relationships';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { StatBar, HeatBadge, Money } from '../components/display';
import type { Wrestler } from '../../engine/types';

const SORTS = {
  popularity: { label: 'Popularity', of: (w: Wrestler) => w.popularity },
  condition: { label: 'Condition', of: (w: Wrestler) => w.health },
  momentum: { label: 'Momentum', of: (w: Wrestler) => w.momentum },
  morale: { label: 'Morale', of: (w: Wrestler) => w.morale },
  cost: { label: 'Cost', of: (w: Wrestler) => w.contract?.weeklyRate ?? 0 },
  ego: { label: 'Ego', of: (w: Wrestler) => w.ego },
  age: { label: 'Age', of: (w: Wrestler) => -w.age },
  contract: { label: 'Deal ending', of: (w: Wrestler) => -(w.contract?.weeksRemaining ?? 0) },
  name: { label: 'Name', of: () => 0 },
} as const;

type SortKey = keyof typeof SORTS;

/** Face / heel / tweener, spelled out. The dot alone was too subtle here. */
function alignmentOf(w: Wrestler): { label: string; className: string } {
  if (w.alignment >= 15) return { label: 'FACE', className: 'bg-emerald-900/70 text-emerald-300' };
  if (w.alignment <= -15) return { label: 'HEEL', className: 'bg-purple-900/70 text-purple-300' };
  return { label: 'TWEENER', className: 'bg-neutral-700 text-neutral-300' };
}

export function RosterScreen() {
  const world = useGameStore((s) => s.world);
  const retireWrestler = useGameStore((s) => s.retireWrestler);
  const [sort, setSort] = useState<SortKey>('popularity');

  const roster = useMemo(() => {
    if (!world) return [];
    const list = world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean);
    if (sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name));
    return [...list].sort((a, b) => SORTS[sort].of(b) - SORTS[sort].of(a));
  }, [world, sort]);

  if (!world) return null;

  const currentYear = world.settings.startingYear + Math.floor(world.week / 52);
  const stableOf = (w: Wrestler) =>
    world.stables.find((s) => s.disbandedWeek === null && s.memberIds.includes(w.id));

  return (
    <div className="p-3 pb-24 text-neutral-100">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-base font-semibold">Roster — {roster.length}</h1>
        <span className="text-xs text-neutral-500">
          wages <Money amount={roster.reduce((sum, w) => sum + (w.contract?.weeklyRate ?? 0), 0)} />
          /wk
        </span>
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

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {roster.map((w) => {
          const rivalries = activeRivalriesFor(world.rivalries, [w.id]);
          const belts = titlesHeldBy(world.titles, w.id);
          const alignment = alignmentOf(w);
          const group = stableOf(w);

          const pressure = retirementPressure(w, { currentYear, settings: world.settings });

          const bonds = relationshipsFor(world.relationships, w.id)
            .filter((r) => world.promotion.rosterIds.includes(otherParty(r, w.id)))
            .slice(0, 3);

          return (
            <article
              key={w.id}
              data-testid={`roster-${w.id}`}
              className="relative flex gap-2 overflow-hidden rounded border border-neutral-800 bg-neutral-900 p-2"
            >
              {/* Health consumes the plate from the right, §21. */}
              <div
                className="pointer-events-none absolute inset-y-0 right-0 bg-rose-950/40"
                style={{ width: `${100 - w.health}%` }}
                aria-hidden
              />

              <div className="relative shrink-0">
                <PaperDoll
                  appearance={effectiveAppearance(w, world.stables)}
                  gender={w.gender}
                  alignment={w.alignment}
                  size="bust"
                />
                {w.injury && (
                  <span
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[11px] font-bold text-white shadow"
                    title={`${w.injury.description} — ${w.injury.weeksRemaining} weeks out`}
                  >
                    ✚
                  </span>
                )}
              </div>

              <div className="relative min-w-0 flex-1">
                {/* name, alignment, age */}
                {w.nickname && (
                  <div className="truncate text-[10px] italic text-amber-400/90">“{w.nickname}”</div>
                )}
                <div className="flex items-baseline gap-1.5">
                  <span className="truncate text-sm font-medium">{w.name}</span>
                  <span className={`shrink-0 rounded px-1 py-px text-[9px] font-bold ${alignment.className}`}>
                    {alignment.label}
                  </span>
                  <span className="shrink-0 text-[10px] text-neutral-500">{w.age}</span>
                </div>

                {/* championships */}
                {belts.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {belts.map((belt) => (
                      <span
                        key={belt.id}
                        className="flex items-center gap-1 rounded px-1 py-px text-[10px] font-medium"
                        style={{ backgroundColor: belt.colorway.strap, color: belt.colorway.plate }}
                        title={`${belt.name} — champion ${reignLength(belt, world.week)} weeks`}
                      >
                        <BeltIcon color={belt.colorway.plate} />
                        {shortTitleName(belt)}
                      </span>
                    ))}
                  </div>
                )}

                {/* injury */}
                {w.injury && (
                  <div className="mt-0.5 text-[10px] font-medium text-rose-400">
                    ✚ Out {w.injury.weeksRemaining} {w.injury.weeksRemaining === 1 ? 'week' : 'weeks'} · {w.injury.severity}
                  </div>
                )}

                {/* who they are */}
                <div className="truncate text-[10px] text-amber-500/80" title={CAREER_STATUS_BLURBS[w.careerStatus]}>
                  {CAREER_STATUS_LABELS[w.careerStatus]} · {yearsPro(w, currentYear)}y pro · {egoLabel(w.ego)}
                  {group && <span className="ml-1 text-sky-400">· {group.name}</span>}
                </div>
                <div className="truncate text-[10px] text-neutral-500">
                  {w.archetype} · {w.style} · {w.gimmick.name}
                </div>

                {/* physical stats */}
                <div className="mt-1 grid grid-cols-2 gap-x-3">
                  <StatBar label="Popularity" value={w.popularity} />
                  <StatBar label="Strength" value={w.strength} />
                  <StatBar label="Skill" value={w.skill} />
                  <StatBar label="Agility" value={w.agility} />
                  <StatBar label="Stamina" value={w.stamina} />
                  <StatBar label="Mic work" value={w.charisma} />
                  <StatBar label="Momentum" value={w.momentum} />
                  <StatBar label="Condition" value={w.health} tone="health" />
                </div>

                {/* allies and enemies */}
                {bonds.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {bonds.map((bond) => {
                      const other = world.wrestlers[otherParty(bond, w.id)];
                      if (!other) return null;
                      const tone = isEnemy(bond)
                        ? 'bg-rose-950/70 text-rose-300'
                        : isAlly(bond)
                          ? 'bg-emerald-950/70 text-emerald-300'
                          : 'bg-neutral-800 text-neutral-400';
                      return (
                        <span
                          key={`${bond.aId}-${bond.bId}`}
                          className={`rounded px-1 py-px text-[9px] ${tone}`}
                          title={`${RELATIONSHIP_LABELS[bond.type]} — ${other.name}`}
                        >
                          {isEnemy(bond) ? '✕' : '✓'} {other.name.split(' ').slice(-1)[0]}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* feuds */}
                {rivalries.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {rivalries.map((r) => (
                      <HeatBadge key={r.id} heat={r.heat} shootHeat={r.shootHeat} />
                    ))}
                  </div>
                )}

                {/* the deal */}
                <div className="mt-1 flex items-center justify-between border-t border-neutral-800 pt-1 text-[10px]">
                  {w.contract ? (
                    <>
                      <span className="text-neutral-400">
                        <Money amount={w.contract.weeklyRate} />
                        <span className="text-neutral-600">/wk</span>
                        <span className="ml-1 text-neutral-600">· {w.contract.weeksRemaining}w left</span>
                      </span>
                      <span
                        className={
                          contractUrgency(w.contract) === 'Expiring'
                            ? 'text-rose-400'
                            : contractUrgency(w.contract) === 'Running down'
                              ? 'text-amber-400'
                              : 'text-neutral-600'
                        }
                      >
                        {contractUrgency(w.contract)}
                      </span>
                    </>
                  ) : (
                    <span className="text-rose-400">No contract</span>
                  )}
                </div>

                {/* The end of the road, and whether they are near it. */}
                {pressure >= world.settings.retirementUiThreshold && (
                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
                    <span className="text-amber-500/90">
                      {pressure >= 0.75 ? 'Talking about hanging them up' : 'Thinking about the end'}
                    </span>
                    <button
                      type="button"
                      data-testid={`retire-${w.id}`}
                      onClick={() => retireWrestler(w.id)}
                      className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-300 hover:bg-amber-900/70"
                    >
                      Retire them
                    </button>
                  </div>
                )}

                {w.contract && w.contract.clauses.length > 0 && (
                  <div className="mt-0.5 truncate text-[9px] text-amber-400/80" title={w.contract.clauses.join(', ')}>
                    {w.contract.clauses.join(' · ')}
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

/** A tiny championship plate. Reads as a belt at 10px, which an emoji does not. */
function BeltIcon({ color }: { color: string }) {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" aria-hidden className="shrink-0">
      <rect x="0" y="3" width="10" height="2" fill={color} opacity="0.55" />
      <ellipse cx="5" cy="4" rx="2.6" ry="3.4" fill={color} />
    </svg>
  );
}
