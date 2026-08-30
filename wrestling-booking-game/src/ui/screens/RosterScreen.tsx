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
import { canFormTeam, teamOf, TEAM_PROBLEM_TEXT } from '../../engine/world/tagTeams';
import { titlesHeldBy } from '../../data/titles';
import { Money } from '../components/display';
import type { Id, Wrestler } from '../../engine/types';

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

  const roster = useMemo(() => {
    if (!world) return [];
    const list = world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean);
    if (sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name));
    return [...list].sort((a, b) => SORTS[sort].of(b) - SORTS[sort].of(a));
  }, [world, sort]);

  if (!world) return null;

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
          Roster <span className="text-neutral-500">— {roster.length}</span>
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

      <TagTeamPanel />
      <MotivationKey />

      <div className="grid grid-cols-[380px_1fr] gap-4">
        <div className="flex max-h-[75vh] flex-col gap-1.5 overflow-y-auto pr-1">
          {roster.map((w) => (
            <div key={w.id} data-testid={`roster-${w.id}`}>
              <WrestlerRow
                wrestler={w}
                settings={world.settings}
                titles={world.titles}
                territoryId={world.showSetup.territoryId}
                territoryName={world.territories.find((t) => t.id === world.showSetup.territoryId)?.name}
                compact
                selected={w.id === activeId}
                onClick={() => setSelectedId(w.id)}
              />
            </div>
          ))}
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
            <p className="text-sm text-neutral-500">Nobody on the roster yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Forming and splitting tag teams.
 *
 * The AI does this on its own for every promotion, so leaving the player
 * unable to do it was the odd gap: you could watch Northern Combat League
 * build a tag division and not build your own. Collapsed by default because
 * most weeks you are not thinking about it.
 *
 * Splitting a team that holds the belts vacates them, which is the honest
 * consequence — and the game does not warn you before you do it.
 */
function TagTeamPanel() {
  const world = useGameStore((s) => s.world);
  const formTeam = useGameStore((s) => s.formTagTeam);
  const disband = useGameStore((s) => s.disbandTagTeam);

  const [open, setOpen] = useState(false);
  const [partnerA, setPartnerA] = useState('');
  const [partnerB, setPartnerB] = useState('');
  const [name, setName] = useState('');

  if (!world) return null;

  const rosterIds = new Set(world.promotion.rosterIds);
  const teams = world.stables.filter(
    (t) => t.kind === 'tagTeam' && t.disbandedWeek === null && t.memberIds.every((id) => rosterIds.has(id)),
  );
  const unattached = world.promotion.rosterIds
    .map((id) => world.wrestlers[id])
    .filter((w): w is Wrestler => Boolean(w) && !teamOf(world.stables, w!.id));

  const a = world.wrestlers[partnerA];
  const b = world.wrestlers[partnerB];
  const check = canFormTeam(a, b, world.stables, rosterIds, name);
  // Only complain once they have actually picked two people.
  const problem = partnerA && partnerB && !check.ok ? check.problem : null;

  function submit() {
    if (!check.ok) return;
    formTeam(partnerA, partnerB, name);
    setPartnerA('');
    setPartnerB('');
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
          Tag teams
          <span className="ml-2 text-xs text-neutral-500">{teams.length}</span>
        </span>
        <span className="text-neutral-600">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="border-t border-neutral-800 p-3">
          {teams.length > 0 && (
            <ul className="mb-3 flex flex-col gap-1">
              {teams.map((team) => {
                const members = team.memberIds.map((id) => world.wrestlers[id]).filter(Boolean);
                const belts = titlesHeldBy(world.titles, team.memberIds[0] ?? '').filter((t) => t.tier === 'tag');
                return (
                  <li
                    key={team.id}
                    data-testid={`team-${team.id}`}
                    className="flex items-center gap-2 rounded bg-neutral-950 p-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{team.name}</span>
                      <span className="block truncate text-[10px] text-neutral-500">
                        {members.map((m) => m!.name).join(' & ')}
                        <span className="ml-1 text-neutral-600">
                          {team.record.wins}-{team.record.losses}
                          {team.record.draws > 0 && `-${team.record.draws}`}
                        </span>
                      </span>
                      {belts.length > 0 && (
                        <span className="block truncate text-[10px] text-amber-500/90">
                          {belts.map((belt) => belt.name).join(', ')}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      data-testid={`disband-${team.id}`}
                      onClick={() => disband(team.id)}
                      className="shrink-0 rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-300 hover:bg-rose-900/70"
                    >
                      Split them up
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="text-[11px] uppercase tracking-wide text-neutral-500">Put a team together</div>
          <div className="mt-1 grid gap-1 sm:grid-cols-2">
            {[
              { value: partnerA, set: setPartnerA, label: 'First' },
              { value: partnerB, set: setPartnerB, label: 'Second' },
            ].map((slot) => (
              <select
                key={slot.label}
                data-testid={`partner-${slot.label.toLowerCase()}`}
                value={slot.value}
                onChange={(e) => slot.set(e.target.value)}
                className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-100"
              >
                <option value="">{slot.label} — nobody</option>
                {unattached.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            ))}
          </div>

          <input
            type="text"
            data-testid="team-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Team name — leave it blank and the announcers will absolutely handle it"
            className="mt-1 w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs placeholder:text-neutral-600"
          />

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              data-testid="form-team"
              disabled={!check.ok}
              onClick={submit}
              className={`rounded px-3 py-1 text-xs ${
                check.ok
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-neutral-800 text-neutral-600'
              }`}
            >
              Form the team
            </button>
            {problem && <span className="text-[11px] text-amber-400">{TEAM_PROBLEM_TEXT[problem]}</span>}
          </div>

          {unattached.length < 2 && (
            <p className="mt-2 text-[11px] text-neutral-600">
              Every single body on this roster is already spoken for on a team.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
