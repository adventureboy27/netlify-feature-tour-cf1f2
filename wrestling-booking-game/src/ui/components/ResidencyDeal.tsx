// Signing for a room, and living in it.
//
// Two states, and they are different pages really. Before you sign this is an
// offer: eight small buildings in eight small towns, each with a rent, a
// number of seats, and — the figure that actually matters — how many people in
// that town will ever come. After you sign it is a status: how long is left,
// how tired the town has got, and the one button that buys you out.
//
// The downsides are stated as plainly as the rent, because they are the deal.
// Nothing here warns anybody off; it says what the arrangement is and lets a
// booker with a month of rent in the bank decide whether that is worse than
// closing (§0).

import { useState } from 'react';
import { useGameStore } from '../../state/store';
import {
  homesOnOffer,
  residencyTerms,
  residencyRent,
  residencyDeposit,
  residencyStatus,
  exposureLine,
  localCeiling,
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
    const ceiling = localCeiling(world.residency, world.settings);
    return (
      <section className="mb-4 rounded-lg border border-amber-800 bg-amber-950/20 p-3">
        <div className="text-[10px] uppercase tracking-wide text-amber-400/80">In residence</div>
        <p className="text-sm font-semibold text-amber-200">
          {world.residency.homeName}, {world.residency.town}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-neutral-300">
          {residencyStatus(world.residency, world.settings)}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-neutral-400">{exposureLine(world.residency)}</p>
        <p className="mt-1 text-[11px] text-neutral-500">
          <Money amount={world.residency.rentPerWeek} /> a week, flat. No travel and no lorry. About{' '}
          {ceiling.toLocaleString()} people will turn up, however good the card is.
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

  return (
    <section className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-neutral-200">Take a room for the season</span>
        <span className="shrink-0 text-neutral-600">{open ? '−' : '+'}</span>
      </button>
      <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
        One small building in one small town, every week. Cheap flat rent, nothing spent on travel, and no lorry to
        keep. You will not sell it out, you cannot charge much, merch barely moves, and nobody outside that town will
        have heard of anybody on your roster.
      </p>

      {open && (
        <div className="mt-3 flex flex-col gap-2">
          {homesOnOffer().map((home) => (
            <div key={home.id} className="rounded border border-neutral-800 bg-neutral-950 p-2">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-100">
                  {home.name}
                  <span className="ml-1 font-normal text-neutral-500">{home.town}</span>
                </span>
                <span className="shrink-0 text-[11px] text-neutral-500">{home.capacity.toLocaleString()} seats</span>
              </div>
              <p className="mt-0.5 text-[10px] leading-snug text-neutral-500">{home.blurb}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-amber-500/80">
                About {home.localCrowd.toLocaleString()} will ever come · they will pay up to ${home.topTicket} a
                ticket
              </p>

              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {terms.map((term) => {
                  const deposit = residencyDeposit(home, term, world.settings);
                  const afford = world.promotion.bankBalance >= deposit;
                  return (
                    <button
                      key={term.weeks}
                      type="button"
                      data-testid={`residency-${home.id}-${term.weeks}`}
                      disabled={!afford}
                      onClick={() => sign(home.id, term.weeks)}
                      className={`rounded px-2 py-1.5 text-left text-[11px] ${
                        afford ? 'bg-amber-700 text-amber-50' : 'bg-neutral-900 text-neutral-600'
                      }`}
                    >
                      <span className="block font-semibold">{term.label}</span>
                      <span className="block">
                        <Money amount={residencyRent(home, term)} /> a week
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
        </div>
      )}
    </section>
  );
}
