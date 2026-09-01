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
import { WrestlerRow, RowKey } from '../components/WrestlerRow';
import { ScreenHeader } from '../components/ScreenHeader';
import { slotLabel } from '../cardLabels';
import type { Id, Wrestler } from '../../engine/types';

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
  const available = roster
    .filter((w) => !bookedIds.has(w.id))
    // Unlike an injury, a paperwork freeze is a hard bar to working at all —
    // there is no "book him anyway" for a license stuck in review. Off the
    // picker entirely rather than shown-but-blocked; the roster screen's own
    // "Papers held up" chip is where the booker sees why. See
    // engine/world/paperworkLockout.ts.
    .filter((w) => !w.paperworkFrozen)
    .filter((w) => w.name.toLowerCase().includes(search.toLowerCase()));

  const bySide = (s: number): Wrestler[] =>
    segment.participants
      .filter((p) => p.side === s)
      .map((p) => roster.find((w) => w.id === p.wrestlerId))
      .filter((w): w is Wrestler => Boolean(w));

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
            className="mb-2 w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600"
          />
          <RowKey />
          <div data-testid="roster-picker" className="grid grid-cols-2 gap-2 xl:grid-cols-3">
            {available.map((w) => (
              <div
                key={w.id}
                data-testid="roster-pick"
                // A plain div, not WrestlerRow's own onClick — the row also
                // needs a real, separate Add button, and WrestlerRow puts
                // everything including `trailing` inside one <button> once
                // onClick is set, which would nest a button inside a button.
                // stopPropagation on Add is what keeps "add" from also
                // triggering "view detail".
                role={onNavigateWrestler ? 'button' : undefined}
                tabIndex={onNavigateWrestler ? 0 : undefined}
                onClick={onNavigateWrestler ? () => onNavigateWrestler(w.id) : undefined}
                className={onNavigateWrestler ? 'cursor-pointer' : undefined}
              >
                <WrestlerRow
                  wrestler={w}
                  settings={world.settings}
                  titles={world.titles}
                  territoryId={world.showSetup.territoryId}
                  territoryName={world.territories.find((t) => t.id === world.showSetup.territoryId)?.name}
                  compact
                  trailing={
                    <button
                      type="button"
                      data-testid={`add-${w.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setParticipant(slotIndex, w.id, side);
                        onBack();
                      }}
                      className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500"
                    >
                      Add
                    </button>
                  }
                />
              </div>
            ))}
          </div>
          {available.length === 0 && (
            <p className="py-6 text-center text-sm text-neutral-600">
              Nobody left standing who is not already booked on this card.
            </p>
          )}
        </div>

        {/* The right rail — fixed while the roster list scrolls, so you can
            always see who's already committed and which side Add targets. */}
        <div className="sticky top-3 flex h-fit flex-col gap-3">
          {[0, 1].map((s) => (
            <div key={s} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-neutral-500">Side {s + 1}</span>
                <button
                  type="button"
                  data-testid={`side-${s}`}
                  onClick={() => setSide(s)}
                  className={`rounded px-2 py-0.5 text-[11px] ${side === s ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
                >
                  {side === s ? 'Adding here' : 'Add here'}
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
