// Fill a slot — the reference's "tap a slot, land back on the roster for
// selection" screen. One job: pick who goes in this match, on which side.
// Everything else about the match (stipulation, stakes, ringside) lives on
// MatchSetupScreen, reached once there is somebody here to set them for.
//
// A wide two-pane layout: the roster to browse on the left (as much of it
// visible at once as the window allows), and a fixed right rail showing who
// is already committed to each side and which one "Add" currently targets —
// visible the whole time you're scrolling the list, not a separate screen.

import { useState } from 'react';
import { useGameStore } from '../../state/store';
import { RowKey, GENDER_LABEL } from '../components/WrestlerRow';
import { WrestlerTile } from '../components/WrestlerTile';
import { ScreenHeader } from '../components/ScreenHeader';
import { Panel, promotionTheme } from '../components/chrome';
import { slotLabel } from '../cardLabels';
import { alignmentLabel } from '../../engine/career/scouting';
import { titlesHeldBy } from '../../data/titles';
import type { Id, Wrestler } from '../../engine/types';

/** Same shape RosterScreen's own SORTS uses — each screen picks the handful that actually matter to its own decision, not one shared list. */
const SORTS = {
  popularity: { label: 'Popularity', of: (w: Wrestler) => w.popularity },
  condition: { label: 'Condition', of: (w: Wrestler) => w.health },
  momentum: { label: 'Momentum', of: (w: Wrestler) => w.momentum },
  morale: { label: 'Morale', of: (w: Wrestler) => w.morale },
  age: { label: 'Age', of: (w: Wrestler) => -w.age },
  name: { label: 'Name', of: () => 0 },
} as const;

type SortKey = keyof typeof SORTS;

type AlignmentFilter = 'all' | 'Face' | 'Heel' | 'Tweener';
type GenderFilter = 'all' | Wrestler['gender'];

export function SlotRosterPicker({
  slotIndex,
  onBack,
  onNavigateWrestler,
}: {
  slotIndex: number;
  onBack: () => void;
  /** Tap a name to view their detail screen instead of adding them. */
  onNavigateWrestler?: (id: Id) => void;
}) {
  const world = useGameStore((s) => s.world);
  const setParticipant = useGameStore((s) => s.setSegmentParticipant);
  const [side, setSide] = useState(0);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('popularity');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [alignmentFilter, setAlignmentFilter] = useState<AlignmentFilter>('all');
  const [injuredOnly, setInjuredOnly] = useState(false);
  const [championOnly, setChampionOnly] = useState(false);

  if (!world) return null;
  const segment = world.currentCard[slotIndex];
  // Defensive — a stale slotIndex (the card was re-rolled out from under this
  // screen) should not crash the app.
  if (!segment) return <ScreenHeader title="That slot is gone" onBack={onBack} />;

  const roster = world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean);

  // Anyone already on the card — including in this very segment — is off the
  // picker. They're visible in their side's list on the right, and offering
  // them again only ever means a misclick that silently moves them between
  // sides.
  const bookedIds = new Set(world.currentCard.flatMap((s) => s.participants.map((p) => p.wrestlerId)));
  const unbooked = roster
    .filter((w) => !bookedIds.has(w.id))
    // Unlike an injury, a paperwork freeze is a hard bar to working at all —
    // there is no "book him anyway" for a license stuck in review. Off the
    // picker entirely rather than shown-but-blocked; the roster screen's own
    // "Papers held up" chip is where the booker sees why. See
    // engine/world/paperworkLockout.ts.
    .filter((w) => !w.paperworkFrozen);

  // Same shape as RosterScreen's own filter+sort: narrow first, then order —
  // a 30+ name roster is exactly the case a dense tile grid still needs a
  // way to cut down, same as the list it replaced did.
  const available = unbooked
    .filter((w) => w.name.toLowerCase().includes(search.toLowerCase()))
    .filter((w) => genderFilter === 'all' || w.gender === genderFilter)
    .filter((w) => alignmentFilter === 'all' || alignmentLabel(w.alignment) === alignmentFilter)
    .filter((w) => !injuredOnly || w.injury)
    .filter((w) => !championOnly || titlesHeldBy(world.titles, w.id).length > 0);
  const sorted =
    sort === 'name'
      ? [...available].sort((a, b) => a.name.localeCompare(b.name))
      : [...available].sort((a, b) => SORTS[sort].of(b) - SORTS[sort].of(a));

  const bySide = (s: number): Wrestler[] =>
    segment.participants
      .filter((p) => p.side === s)
      .map((p) => roster.find((w) => w.id === p.wrestlerId))
      .filter((w): w is Wrestler => Boolean(w));

  const theme = promotionTheme(world.promotion.identity);

  return (
    <div className="p-6 text-neutral-100">
      <ScreenHeader title={slotLabel(slotIndex, world.currentCard.length)} subtitle="Pick who's in it" onBack={onBack} />

      <div className="mt-4 grid grid-cols-[1fr_320px] gap-6">
        <div className="min-w-0">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the roster…"
            className="mb-2 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
          />

          {/* Sort — same "pick the handful that matter" convention as
              RosterScreen's own row of chips, so the mental model carries
              over from one roster screen to another. */}
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-600">Sort</span>
            {(Object.keys(SORTS) as SortKey[]).map((key) => (
              <button
                key={key}
                type="button"
                data-testid={`picker-sort-${key}`}
                onClick={() => setSort(key)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 active:scale-95 ${
                  sort === key
                    ? `${theme.action} text-white shadow-panel`
                    : 'bg-neutral-900 text-neutral-400 ring-1 ring-inset ring-neutral-800 hover:text-neutral-200'
                }`}
              >
                {SORTS[key].label}
              </button>
            ))}
          </div>

          {/* Filter — gender and alignment are single-pick (nobody is both),
              injured/champion are plain toggles. Booking a division match or
              a face-vs-heel pairing is exactly the moment a 30-name grid
              needs cutting down, not just searching by a name you already
              remember. */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-600">Filter</span>
            {(['all', 'm', 'f'] as const).map((g) => (
              <button
                key={g}
                type="button"
                data-testid={`picker-filter-gender-${g}`}
                onClick={() => setGenderFilter(g)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 active:scale-95 ${
                  genderFilter === g
                    ? `${theme.action} text-white shadow-panel`
                    : 'bg-neutral-900 text-neutral-400 ring-1 ring-inset ring-neutral-800 hover:text-neutral-200'
                }`}
              >
                {g === 'all' ? 'Any gender' : GENDER_LABEL[g]}
              </button>
            ))}
            {(['all', 'Face', 'Heel', 'Tweener'] as const).map((a) => (
              <button
                key={a}
                type="button"
                data-testid={`picker-filter-alignment-${a}`}
                onClick={() => setAlignmentFilter(a)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 active:scale-95 ${
                  alignmentFilter === a
                    ? `${theme.action} text-white shadow-panel`
                    : 'bg-neutral-900 text-neutral-400 ring-1 ring-inset ring-neutral-800 hover:text-neutral-200'
                }`}
              >
                {a === 'all' ? 'Any alignment' : a}
              </button>
            ))}
            <button
              type="button"
              data-testid="picker-filter-injured"
              onClick={() => setInjuredOnly((v) => !v)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 active:scale-95 ${
                injuredOnly
                  ? `${theme.action} text-white shadow-panel`
                  : 'bg-neutral-900 text-neutral-400 ring-1 ring-inset ring-neutral-800 hover:text-neutral-200'
              }`}
            >
              Injured
            </button>
            <button
              type="button"
              data-testid="picker-filter-champion"
              onClick={() => setChampionOnly((v) => !v)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 active:scale-95 ${
                championOnly
                  ? `${theme.action} text-white shadow-panel`
                  : 'bg-neutral-900 text-neutral-400 ring-1 ring-inset ring-neutral-800 hover:text-neutral-200'
              }`}
            >
              Champion
            </button>
            {(genderFilter !== 'all' || alignmentFilter !== 'all' || injuredOnly || championOnly || search.trim() !== '') && (
              <button
                type="button"
                data-testid="picker-clear-filters"
                onClick={() => {
                  setSearch('');
                  setGenderFilter('all');
                  setAlignmentFilter('all');
                  setInjuredOnly(false);
                  setChampionOnly(false);
                }}
                className="text-[11px] text-neutral-500 underline decoration-dotted hover:text-neutral-300"
              >
                Clear
              </button>
            )}
          </div>

          <RowKey />
          {/* As many as the window has room for — a real desktop-sized grid,
              not a capped 2-3 column list, per CLAUDE.md's own "screens use a
              real window's worth of space" rule. A tile (portrait on top,
              status strip below) is what actually scales that way; a wide
              row tops out around 3 across no matter the monitor. */}
          <div
            data-testid="roster-picker"
            className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8"
          >
            {sorted.map((w) => (
              <div key={w.id} data-testid="roster-pick">
                <WrestlerTile
                  wrestler={w}
                  settings={world.settings}
                  titles={world.titles}
                  theme={theme}
                  onClick={onNavigateWrestler ? () => onNavigateWrestler(w.id) : undefined}
                  trailing={
                    <button
                      type="button"
                      data-testid={`add-${w.id}`}
                      onClick={() => {
                        setParticipant(slotIndex, w.id, side);
                        onBack();
                      }}
                      className="w-full rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500"
                    >
                      Add
                    </button>
                  }
                />
              </div>
            ))}
          </div>
          {sorted.length === 0 && unbooked.length > 0 && (
            <p className="py-6 text-center text-sm text-neutral-600">
              Nobody matches that search.{' '}
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setGenderFilter('all');
                  setAlignmentFilter('all');
                  setInjuredOnly(false);
                  setChampionOnly(false);
                }}
                className="text-emerald-400 underline decoration-dotted hover:text-emerald-300"
              >
                Clear filters
              </button>
            </p>
          )}
          {unbooked.length === 0 && (
            <p className="py-6 text-center text-sm text-neutral-600">
              Nobody left standing who is not already booked on this card.
            </p>
          )}
        </div>

        {/* The right rail — fixed while the roster list scrolls, so you can
            always see who's already committed and which side Add targets.
            The side currently receiving Add taps is highlighted in the
            save's own colour, not just a smaller label on its button — the
            one thing you need to know before you tap Add on a tile is which
            side it's going to, and that should be readable without hunting
            for the right word on a small pill. */}
        <div className="sticky top-3 flex h-fit flex-col gap-3">
          {[0, 1].map((s) => (
            <Panel
              key={s}
              elevation="raised"
              className={`p-3 ${side === s ? `${theme.edge} bg-gradient-to-br ${theme.wash} to-neutral-900` : ''}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Side {s + 1}</span>
                <button
                  type="button"
                  data-testid={`side-${s}`}
                  onClick={() => setSide(s)}
                  className={`rounded px-2 py-0.5 text-[11px] font-semibold ${side === s ? `${theme.action} text-white shadow-panel` : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'}`}
                >
                  {side === s ? '● Adding here' : 'Add here'}
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {bySide(s).map((w) => (
                  <span key={w.id} className="truncate text-[12px] text-neutral-300">
                    {w.name}
                  </span>
                ))}
                {bySide(s).length === 0 && <p className="text-[12px] text-neutral-600">Nobody yet</p>}
              </div>
            </Panel>
          ))}
        </div>
      </div>
    </div>
  );
}
