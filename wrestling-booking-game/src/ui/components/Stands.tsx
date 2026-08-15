// The merch table and the concession stand.
//
// One decision per row, and it is always the same decision: this costs a fixed
// amount tonight and returns a little from every person who turns up, so is
// the crowd big enough? The page answers that in two ways — the break-even in
// people, and how that reads against the room actually booked.
//
// The break-even is printed as a number of human beings, which is allowed:
// §0 bans stat bars and percentages, not counting the house. A booker who
// cannot see it is not making a decision, he is guessing.

import { useGameStore } from '../../state/store';
import {
  standsOnOffer,
  breakEvenCrowd,
  standVerdict,
  MERCH_LINES,
  type Stand,
  type StandContext,
} from '../../engine/economy/stands';
import { productionInRoom } from '../../engine/economy/venue';
import { venueById, fallbackVenue } from '../../data/venues';
import { Money } from './display';

export function Stands() {
  const world = useGameStore((s) => s.world);
  const toggleStand = useGameStore((s) => s.toggleStand);
  if (!world) return null;

  const venue = venueById(world.showSetup.venueId) ?? fallbackVenue();
  const ctx: StandContext = {
    // What the card is worth to a merch table is not known until it is booked,
    // so the page reasons about an ordinary card and the night settles the
    // real figure. Deliberately not a projection of tonight's line-up: that
    // would turn the stall into a readout of the card rather than a decision.
    gimmickMerchMultiplier: 1,
    prestige: world.promotion.rating,
    identity: world.promotion.identity,
    venue,
    rigInRoom: productionInRoom(world.productionRungs, venue),
    settings: world.settings,
  };

  const offers = standsOnOffer(ctx);
  const merch = offers.filter((o) => MERCH_LINES.some((m) => m.id === o.stand.id));
  const bar = offers.filter((o) => !MERCH_LINES.some((m) => m.id === o.stand.id));

  const running = world.showSetup.standIds;
  const nightlyCost = running.reduce(
    (sum, id) => sum + (offers.find((o) => o.stand.id === id)?.stand.costPerShow ?? 0),
    0,
  );

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-neutral-300">The tables — stocked every show</h2>
        <span className="shrink-0 text-[11px] text-neutral-500">
          <Money amount={nightlyCost} /> a night
        </span>
      </div>

      <Block label="Merchandise" rows={merch} running={running} ctx={ctx} onToggle={toggleStand} />
      <Block label="Concessions" rows={bar} running={running} ctx={ctx} onToggle={toggleStand} />
    </section>
  );
}

function Block({
  label,
  rows,
  running,
  ctx,
  onToggle,
}: {
  label: string;
  rows: { stand: Stand; blocked: string | null }[];
  running: readonly string[];
  ctx: StandContext;
  onToggle: (id: string) => void;
}) {
  return (
    <>
      <h3 className="mb-1 mt-2 text-[10px] uppercase tracking-wide text-neutral-500">{label}</h3>
      <div className="flex flex-col gap-1">
        {rows.map(({ stand, blocked }) => {
          const on = running.includes(stand.id);
          const need = breakEvenCrowd(stand, ctx);

          return (
            <button
              key={stand.id}
              type="button"
              data-testid={`stand-${stand.id}`}
              disabled={Boolean(blocked)}
              onClick={() => onToggle(stand.id)}
              className={`rounded border p-2 text-left text-xs ${
                on
                  ? 'border-emerald-500 bg-emerald-950/40'
                  : blocked
                    ? 'border-neutral-900 bg-neutral-950 opacity-40'
                    : 'border-neutral-800 bg-neutral-900 hover:border-neutral-600'
              }`}
            >
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate font-medium text-neutral-100">{stand.name}</span>
                <span className="shrink-0 text-neutral-500">
                  <Money amount={stand.costPerShow} />
                </span>
              </div>
              <p className="mt-0.5 text-[10px] leading-snug text-neutral-500">{blocked ?? stand.blurb}</p>
              {!blocked && (
                <p className="mt-0.5 text-[10px] text-neutral-400">
                  Pays from {Number.isFinite(need) ? `${need.toLocaleString()} through the door` : 'nobody'} ·{' '}
                  {standVerdict(stand, ctx)}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
