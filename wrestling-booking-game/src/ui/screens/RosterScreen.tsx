// Roster — §21: "Grid of name plates. Color-coded... Health as a red bar
// consuming the plate from the right. Sortable by any stat."
//
// A master-detail split, not a drill-down: the list on the left is for
// scanning and picking who to look at, and the right pane shows everything
// about whoever's selected — contract, discipline, career ledger, retire/
// release/role/repackage — without leaving the screen or losing your place
// in the list. `WrestlerDetailBody` (`ui/components/WrestlerDetail.tsx`) is
// the same content `WrestlerDetailScreen` shows when a name is tapped from
// somewhere with no list of its own to embed it in.

import { useMemo, useState } from 'react';
import { useGameStore } from '../../state/store';
import { MotivationKey, WrestlerRow } from '../components/WrestlerRow';
import { WrestlerDetailBody } from '../components/WrestlerDetail';
import { teamOf, groupOf, canFormGroup, TEAM_PROBLEM_TEXT } from '../../engine/world/tagTeams';
import { titlesHeldBy } from '../../data/titles';
import { billedAs } from '../../engine/generate/nickname';
import { Money } from '../components/display';
import { KickFromGroupControl } from '../components/KickFromGroupControl';
import type { Id, Wrestler } from '../../engine/types';

/** A deal this close to its last week reads as "ending soon" in the roster filter. UI-only judgment call, not a balance number. */
const ENDING_SOON_WEEKS = 4;

type FilterKey = 'injured' | 'endingSoon' | 'champion' | 'tagTeam';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'injured', label: 'Injured' },
  { key: 'endingSoon', label: 'Ending soon' },
  { key: 'champion', label: 'Champion' },
  { key: 'tagTeam', label: 'Tag team' },
];

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

export function RosterScreen({
  onNavigate,
  onRepackage,
  onOpenFeuds,
}: {
  /** Fallback for a name that isn't in this roster (a rare off-roster relationship). */
  onNavigate?: (wrestlerId: Id) => void;
  onRepackage?: (wrestlerId: Id) => void;
  onOpenFeuds?: (wrestlerId: Id) => void;
} = {}) {
  const world = useGameStore((s) => s.world);
  const [sort, setSort] = useState<SortKey>('popularity');
  const [selectedId, setSelectedId] = useState<Id | null>(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set());

  function toggleFilter(key: FilterKey) {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function clearSearch() {
    setQuery('');
    setFilters(new Set());
  }

  const fullRoster = useMemo(() => {
    if (!world) return [];
    return world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean);
  }, [world]);

  const roster = useMemo(() => {
    if (!world) return [];
    const q = query.trim().toLowerCase();
    const filtered = fullRoster.filter((w) => {
      if (q && !billedAs(w).toLowerCase().includes(q) && !w.name.toLowerCase().includes(q)) return false;
      if (filters.has('injured') && !w.injury) return false;
      if (filters.has('endingSoon') && !(w.contract && w.contract.weeksRemaining <= ENDING_SOON_WEEKS)) return false;
      if (filters.has('champion') && titlesHeldBy(world.titles, w.id).length === 0) return false;
      if (filters.has('tagTeam') && !teamOf(world.stables, w.id)) return false;
      return true;
    });
    if (sort === 'name') return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    return [...filtered].sort((a, b) => SORTS[sort].of(b) - SORTS[sort].of(a));
  }, [world, fullRoster, sort, query, filters]);

  if (!world) return null;

  const searchActive = query.trim() !== '' || filters.size > 0;

  const rosterIds = new Set(roster.map((w) => w.id));
  // The selection re-clamps to the top of the (possibly re-sorted) list
  // whenever it points at nobody real any more — a re-sort, or somebody
  // leaving via retire/release right there in the detail pane.
  const activeId = selectedId && rosterIds.has(selectedId) ? selectedId : (roster[0]?.id ?? null);
  const active = activeId ? world.wrestlers[activeId] : undefined;

  /** Tag partner / manager / ally taps inside the detail pane: reselect in place if they're on this same roster, otherwise fall back to a real navigation. */
  function onSelectWrestler(id: Id) {
    if (rosterIds.has(id)) setSelectedId(id);
    else onNavigate?.(id);
  }

  return (
    <div className="p-6 text-neutral-100">
      <div className="mb-3 flex items-end justify-between gap-2">
        <h1 className="text-xl font-black tracking-tight">
          Roster{' '}
          <span className="text-neutral-500">
            {searchActive ? `— showing ${roster.length} of ${fullRoster.length}` : `— ${roster.length}`}
          </span>
        </h1>
        <span className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-[11px] font-medium text-neutral-400">
          wages <Money amount={roster.reduce((sum, w) => sum + (w.contract?.weeklyRate ?? 0), 0)} />
          <span className="text-neutral-600">/wk</span>
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(Object.keys(SORTS) as SortKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSort(key)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 active:scale-95 ${
              sort === key
                ? 'bg-emerald-600 text-white shadow-[0_0_0_1px_rgb(5,150,105),0_0_12px_-2px_rgb(5,150,105)]'
                : 'bg-neutral-900 text-neutral-400 ring-1 ring-inset ring-neutral-800 hover:text-neutral-200'
            }`}
          >
            {SORTS[key].label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <input
          type="text"
          data-testid="roster-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name"
          className="w-48 rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs placeholder:text-neutral-600"
        />
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            data-testid={`roster-filter-${key}`}
            onClick={() => toggleFilter(key)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 active:scale-95 ${
              filters.has(key)
                ? 'bg-emerald-600 text-white shadow-[0_0_0_1px_rgb(5,150,105),0_0_12px_-2px_rgb(5,150,105)]'
                : 'bg-neutral-900 text-neutral-400 ring-1 ring-inset ring-neutral-800 hover:text-neutral-200'
            }`}
          >
            {label}
          </button>
        ))}
        {searchActive && (
          <button
            type="button"
            data-testid="roster-clear-search"
            onClick={clearSearch}
            className="text-[11px] text-neutral-500 underline decoration-dotted hover:text-neutral-300"
          >
            Clear
          </button>
        )}
      </div>

      <TagTeamPanel />
      <MotivationKey />

      <div className="grid grid-cols-[380px_1fr] gap-4">
        <div className="flex max-h-[75vh] flex-col gap-1.5 overflow-y-auto pr-1">
          {roster.length === 0 && fullRoster.length > 0 ? (
            <div className="rounded border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-500">
              Nobody matches that search.{' '}
              <button
                type="button"
                onClick={clearSearch}
                className="text-emerald-400 underline decoration-dotted hover:text-emerald-300"
              >
                Clear filters
              </button>
            </div>
          ) : (
            roster.map((w) => (
              <div key={w.id} data-testid={`roster-${w.id}`}>
                <WrestlerRow
                  wrestler={w}
                  settings={world.settings}
                  titles={world.titles}
                  stables={world.stables}
                  territoryId={world.showSetup.territoryId}
                  territoryName={world.territories.find((t) => t.id === world.showSetup.territoryId)?.name}
                  compact
                  selected={w.id === activeId}
                  onClick={() => setSelectedId(w.id)}
                />
              </div>
            ))
          )}
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          {active ? (
            <div className="max-w-2xl">
              <WrestlerDetailBody
                wrestler={active}
                editable
                onNavigateWrestler={onSelectWrestler}
                onRepackage={onRepackage}
                onOpenFeuds={onOpenFeuds}
              />
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              {fullRoster.length === 0 ? 'Nobody on the roster yet.' : 'Nobody matches that search.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Forming and splitting teams and factions.
 *
 * The AI does this on its own for every promotion, so leaving the player
 * unable to do it was the odd gap: you could watch Northern Combat League
 * build a tag division and not build your own. Collapsed by default because
 * most weeks you are not thinking about it.
 *
 * Two or three people is a team, four or more a faction — kindForSize is the
 * one place that rule lives. Splitting a group that holds the belts vacates
 * them, which is the honest consequence — and the game does not warn you
 * before you do it. Kicking one member out of a group of three or more,
 * rather than dissolving the whole act, can be staged as a turn instead of
 * happening quietly — see KickFromGroupControl.
 */
function TagTeamPanel() {
  const world = useGameStore((s) => s.world);
  const formGroup = useGameStore((s) => s.formGroup);
  const disband = useGameStore((s) => s.disbandTagTeam);

  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Id[]>([]);
  const [name, setName] = useState('');

  if (!world) return null;

  const rosterIds = new Set(world.promotion.rosterIds);
  const groups = world.stables.filter(
    (t) => t.disbandedWeek === null && t.memberIds.every((id) => rosterIds.has(id)),
  );
  const unattached = world.promotion.rosterIds
    .map((id) => world.wrestlers[id])
    .filter((w): w is Wrestler => Boolean(w) && !groupOf(world.stables, w!.id));

  const members = picked.map((id) => world.wrestlers[id]);
  const check = canFormGroup(members, world.stables, rosterIds, name);
  const needsName = picked.length > 2 && !name.trim();
  // Only complain once at least two people are picked.
  const problem = picked.length >= 2 && !check.ok ? check.problem : null;

  function togglePick(id: Id) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  function submit() {
    if (!check.ok || needsName) return;
    formGroup(picked, name);
    setPicked([]);
    setName('');
  }

  return (
    <section className="mb-3 rounded border border-neutral-800 bg-neutral-900">
      <button
        type="button"
        data-testid="tag-teams-toggle"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="text-sm font-medium">
          Teams &amp; factions
          <span className="ml-2 text-xs text-neutral-500">{groups.length}</span>
        </span>
        <span className="text-neutral-600">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="border-t border-neutral-800 p-3">
          {groups.length > 0 && (
            <ul className="mb-3 flex flex-col gap-1">
              {groups.map((group) => {
                const members = group.memberIds.map((id) => world.wrestlers[id]).filter(Boolean);
                const belts = titlesHeldBy(world.titles, group.memberIds[0] ?? '').filter(
                  (t) => t.tier === 'tag' || t.tier === 'trios',
                );
                return (
                  <li
                    key={group.id}
                    data-testid={`team-${group.id}`}
                    className="rounded bg-neutral-950 p-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">
                          {group.name}
                          <span className="ml-1.5 text-[9px] uppercase tracking-wide text-neutral-600">
                            {group.kind === 'stable' ? 'Faction' : 'Team'}
                          </span>
                        </span>
                        <span className="block truncate text-[10px] text-neutral-500">
                          {members.map((m) => m!.name).join(', ')}
                          <span className="ml-1 text-neutral-600">
                            {group.record.wins}-{group.record.losses}
                            {group.record.draws > 0 && `-${group.record.draws}`}
                          </span>
                        </span>
                        {belts.length > 0 && (
                          <span className="block truncate text-[10px] text-amber-500/90">
                            {belts.map((belt) => belt.name).join(', ')}
                          </span>
                        )}
                      </span>
                      {world.factionDestroyer &&
                      (world.factionDestroyer.stableAId === group.id || world.factionDestroyer.stableBId === group.id) ? (
                        <span className="shrink-0 text-[10px] text-amber-400">Locked while the story is live</span>
                      ) : (
                        <button
                          type="button"
                          data-testid={`disband-${group.id}`}
                          onClick={() => disband(group.id)}
                          className="shrink-0 rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-300 hover:bg-rose-900/70"
                        >
                          Disband entirely
                        </button>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {members.map((m) => (
                        <span
                          key={m!.id}
                          className="flex items-center gap-1 rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] text-neutral-400"
                        >
                          {m!.name}
                          <KickFromGroupControl
                            stableId={group.id}
                            memberId={m!.id}
                            memberName={m!.name}
                            alreadyStaged={world.scheduledGroupTurns.some((t) => t.departingId === m!.id)}
                          />
                        </span>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
            Put a team or faction together — two or three is a team, four or more a faction
          </div>
          <div className="mt-1 flex max-h-32 flex-wrap gap-1 overflow-y-auto">
            {unattached.map((w) => (
              <button
                key={w.id}
                type="button"
                data-testid={`pick-${w.id}`}
                onClick={() => togglePick(w.id)}
                className={`rounded px-2 py-1 text-[10px] ${
                  picked.includes(w.id)
                    ? 'bg-emerald-700 text-white'
                    : 'bg-neutral-950 text-neutral-400 hover:bg-neutral-800'
                }`}
              >
                {w.name}
              </button>
            ))}
          </div>

          <input
            type="text"
            data-testid="team-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              picked.length > 2
                ? 'Faction name — required for four or more'
                : 'Team name — leave it blank and the announcers will absolutely handle it'
            }
            className="mt-1 w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs placeholder:text-neutral-600"
          />

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              data-testid="form-team"
              disabled={!check.ok || needsName}
              onClick={submit}
              className={`rounded px-3 py-1 text-xs ${
                check.ok && !needsName
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-neutral-800 text-neutral-600'
              }`}
            >
              {picked.length > 2 ? 'Form the faction' : 'Form the team'}
            </button>
            {problem && <span className="text-[11px] text-amber-400">{TEAM_PROBLEM_TEXT[problem]}</span>}
            {!problem && needsName && (
              <span className="text-[11px] text-amber-400">A faction needs a name</span>
            )}
          </div>

          {unattached.length < 2 && (
            <p className="mt-2 text-[11px] text-neutral-600">
              Every single body on this roster is already spoken for on a team or faction.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
