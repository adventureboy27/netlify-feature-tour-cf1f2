// How many matches a show has room for — its own ladder, deliberately
// unrelated to the venue you are renting or the ring/sound/lights you own.
//
// A promotion can be running out of a free backyard lot with an eight-match
// card because that is where the money went, or renting a real arena and
// still running a bare four-match show because it never bought the room to
// book anything bigger. Two different things a booker spends on, and which
// one gets the money first is a real decision — not a side effect of paying
// for the building or the gear.
//
// A replacement ladder, like the planned ring tiers: you own one tier at a
// time, not a stack of them. Nobody runs a six-slot card and a four-slot card
// on alternating weeks; buying up retires whatever you had.

import type { Id } from '../engine/types';

export interface CardSizeTier {
  id: Id;
  name: string;
  /** TV segment slots a show has room for. Dark match slots are separate — see darkMatchSlots. */
  slots: number;
  cost: number;
  blurb: string;
}

export const CARD_SIZE_TIERS: CardSizeTier[] = [
  {
    id: 'backyardCard',
    name: 'Backyard Card',
    slots: 4,
    cost: 0,
    blurb: 'Four matches is what you can actually fill from a roster this size, and that is the whole card.',
  },
  {
    id: 'localCard',
    name: 'Local Card',
    slots: 6,
    cost: 12_000,
    blurb: 'A real card, top to bottom — an opener, a midcard, and a main event worth building toward.',
  },
  {
    id: 'regionalCard',
    name: 'Regional Card',
    slots: 8,
    cost: 48_000,
    blurb: 'Room for a real undercard alongside the angles that matter, so nothing has to get cut to fit.',
  },
];

export function cardSizeTierById(id: Id): CardSizeTier | undefined {
  return CARD_SIZE_TIERS.find((t) => t.id === id);
}

/** The rung above the one you are on, or null at the top. */
export function nextCardSizeTier(currentId: Id): CardSizeTier | null {
  const index = CARD_SIZE_TIERS.findIndex((t) => t.id === currentId);
  if (index < 0) return CARD_SIZE_TIERS[0] ?? null;
  return CARD_SIZE_TIERS[index + 1] ?? null;
}
