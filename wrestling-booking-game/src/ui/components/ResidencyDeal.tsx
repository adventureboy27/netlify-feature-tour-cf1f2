// Signing for a room, and living in it.
//
// Two states, and they are different screens really. Before you sign, this is
// an offer: pick a room and a term and see what the rent drops to. Once
// signed it is a status — how long is left, and how tired the town has got —
// plus the one button that gets you out, at a price.
//
// It sits directly under the venue list because it is the same decision seen
// from the other end: the list is what you rent this week, this is what you
// rent for the year.

import { useState } from 'react';
import { useGameStore } from '../../state/store';
import { VENUES } from '../../data/venues';
import {
  residencyTerms,
  residencyRent,
  residencyDeposit,
  residencyStatus,
  residencyAvailable,
  residencyBlockedNote,
  breakLeaseCost,
} from '../../engine/economy/residency';
import { Money } from './display';

export function ResidencyDeal() {
  const world = useGameStore((s) => s.world);
  const sign = useGameStore((s) => s.signResidency);
  const leave = useGameStore((s) => s.breakResidency);
  const [open, setOpen] = useState(false);
  if (!world) return null;

  if (world.residency) {
    const owed = breakLeaseCost(world.residency, world.settings);
    return (
      <section className="mb-4 rounded-lg border border-amber-800 bg-amber-950/20 p-3">
        <div className="text-[10px] uppercase tracking-wide text-amber-400/80">In residence</div>
        <p className="text-sm font-semibold text-amber-200">{world.residency.venueName}</p>
        <p className="mt-1 text-[11px] leading-snug text-neutral-300">
          {residencyStatus(world.residency, world.settings)}
        </p>
        <p className="mt-1 text-[11px] text-neutral-500">
          <Money amount={world.residency.rentPerWeek} /> a week. No travel, no lorry, and the room is not yours to
          change while the term runs.
        </p>
        <button
          type="button"
          onClick={leave}
          className="mt-2 w-full rounded bg-neutral-800 px-3 py-2 text-xs font-semibold text-neutral-200"
        >
          Buy out the rest of the term — <Money amount={owed} />
        </button>
      </section>
    );
  }

  const terms = residencyTerms(world.settings);
  const rooms = VENUES.filter(
    (v) => world.promotion.rating >= v.minCompanyRating && residencyAvailable(v, world.settings),
  ).sort((a, b) => a.capacity - b.capacity);

  const shut = VENUES.filter(
    (v) => world.promotion.rating >= v.minCompanyRating && !residencyAvailable(v, world.settings),
  );

  return (
    <section className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-neutral-200">Take a room for the season</span>
        <span className="shrink-0 text-neutral-600">{open ? '−' : '+'}</span>
      </button>
      <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
        Cheaper rent, nothing spent on travel, and no lorry to keep — the gear lives in the building. The town gets
        tired of you.
      </p>

      {open && (
        <div className="mt-3 flex flex-col gap-2">
          {rooms.map((venue) => (
            <div key={venue.id} className="rounded border border-neutral-800 bg-neutral-950 p-2">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-100">{venue.name}</span>
                <span className="shrink-0 text-[11px] text-neutral-500">
                  {venue.capacity.toLocaleString()} seats · <Money amount={venue.rentalCost} /> a night
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {terms.map((term) => {
                  const deposit = residencyDeposit(venue, term, world.settings);
                  const afford = world.promotion.bankBalance >= deposit;
                  return (
                    <button
                      key={term.weeks}
                      type="button"
                      data-testid={`residency-${venue.id}-${term.weeks}`}
                      disabled={!afford}
                      onClick={() => sign(venue.id, term.weeks)}
                      className={`rounded px-2 py-1.5 text-left text-[11px] ${
                        afford ? 'bg-amber-700 text-amber-50' : 'bg-neutral-900 text-neutral-600'
                      }`}
                    >
                      <span className="block font-semibold">{term.label}</span>
                      <span className="block">
                        <Money amount={residencyRent(venue, term)} /> a week
                      </span>
                      <span className="block opacity-80">
                        <Money amount={deposit} /> down
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {rooms.length === 0 && (
            <p className="text-[11px] text-neutral-500">
              Nothing you can rent does season deals. {shut[0] ? residencyBlockedNote(shut[0], world.settings) : ''}
            </p>
          )}
          {rooms.length > 0 && shut.length > 0 && (
            <p className="text-[10px] leading-snug text-neutral-600">
              The bigger rooms will not: {residencyBlockedNote(shut[shut.length - 1]!, world.settings)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
