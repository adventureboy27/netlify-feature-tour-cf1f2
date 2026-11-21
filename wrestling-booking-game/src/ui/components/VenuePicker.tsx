// Picking the room.
//
// This was nine lines in a list, each showing a name, a seat count and a
// rent. That was enough when the only thing a venue did was hold people. It
// now matters who takes a cut of the gate, whether the bar is yours, how much
// of the rig will physically go through the door, and whether there is a roof
// — so the list has to say all of that without becoming a spreadsheet.
//
// The compromise: one line of facts per room (seats, rent, what it does to
// your current rig), and the unusual facilities underneath in words. An
// ordinary hall says almost nothing, which is itself the information.
//
// Nothing here warns. The fairground is listed exactly as invitingly as the
// armoury and says "Open to the sky" — what that means in February is the
// player's problem, and finding out is the game.

import { useState } from 'react';
import { VENUES } from '../../data/venues';
import { venueFacilities, venueRigLine, roomFitLine } from '../../engine/economy/venue';
import type { Id, Venue, WorldSettings } from '../../engine/types';
import { Money } from './display';

type Filter = 'available' | 'all';

export function VenuePicker({
  selectedId,
  companyRating,
  productionRungs,
  settings,
  onSelect,
}: {
  selectedId: Id;
  companyRating: number;
  productionRungs: readonly Id[];
  settings: WorldSettings;
  onSelect: (id: Id) => void;
}) {
  const [filter, setFilter] = useState<Filter>('available');

  const bySize = [...VENUES].sort((a, b) => a.capacity - b.capacity);
  const open = bySize.filter((v) => companyRating >= v.minCompanyRating);
  const shut = bySize.filter((v) => companyRating < v.minCompanyRating);
  const shown = filter === 'available' ? open : bySize;

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-neutral-300">Venue — rented every show</h2>
        {shut.length > 0 && (
          <button
            type="button"
            onClick={() => setFilter(filter === 'available' ? 'all' : 'available')}
            className="shrink-0 text-[11px] text-neutral-500 underline decoration-dotted"
          >
            {filter === 'available' ? `Show the ${shut.length} you cannot rent` : 'Only what will rent to you'}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {shown.map((venue) => (
          <VenueCard
            key={venue.id}
            venue={venue}
            selected={venue.id === selectedId}
            locked={companyRating < venue.minCompanyRating}
            productionRungs={productionRungs}
            settings={settings}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

function VenueCard({
  venue,
  selected,
  locked,
  productionRungs,
  settings,
  onSelect,
}: {
  venue: Venue;
  selected: boolean;
  locked: boolean;
  productionRungs: readonly Id[];
  settings: WorldSettings;
  onSelect: (id: Id) => void;
}) {
  const facilities = venueFacilities(venue, settings);
  const stranded = roomFitLine(productionRungs, venue);

  return (
    <button
      type="button"
      data-testid={`venue-${venue.id}`}
      disabled={locked}
      onClick={() => onSelect(venue.id)}
      className={`rounded border p-2 text-left text-xs ${
        selected
          ? 'border-emerald-500 bg-emerald-950/40'
          : locked
            ? 'border-neutral-900 bg-neutral-950 opacity-40'
            : 'border-neutral-800 bg-neutral-900 hover:border-neutral-600'
      }`}
    >
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate font-medium text-neutral-100">
          {venue.name}
          {venue.outdoor && <span className="ml-1.5 text-[10px] font-normal text-sky-400">no roof</span>}
        </span>
        <span className="shrink-0 text-neutral-300">{venue.capacity.toLocaleString()} seats</span>
        <span className="shrink-0 text-neutral-500">
          <Money amount={venue.rentalCost} />
        </span>
      </div>

      <p className="mt-0.5 text-[10px] leading-snug text-neutral-500">
        {locked ? 'Will not rent to you yet.' : venue.blurb}
      </p>

      {!locked && (
        <>
          {facilities.length > 0 && (
            <p className="mt-1 text-[10px] leading-snug text-neutral-400">{facilities.join(' · ')}</p>
          )}
          <p className="mt-0.5 text-[10px] text-neutral-500">{venueRigLine(venue)}</p>
          {/* Stated, not warned about: this is a fact about the room, and it is
              here before the booking rather than in the results after it. */}
          {stranded && <p className="mt-0.5 text-[10px] text-amber-500/80">{stranded}</p>}
        </>
      )}
    </button>
  );
}
