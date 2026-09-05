// The merch table and the concession stand.
//
// Both work the same way and the shape is the whole design: **a fixed cost
// every show, and a return per head.** Stock is bought before the doors open
// and does not care how many people walk through them, so every line on this
// page pays above some particular crowd and loses money below it.
//
// That single fact is the decision. A folding table of t-shirts pays for
// itself in front of two hundred people. Replica belts do not pay in front of
// two thousand. A booker in a school gym who stocks the lot is not ambitious,
// he is broke by March — and nothing in the game will tell him so beforehand,
// because working that out is the game (§0).
//
// The second decision is fit. A mask stall in front of a lucha roster sells
// three times what it sells in front of a card of brawlers, and the gimmicks
// have carried a merch multiplier since the day that file was written. Fit is
// what stops the answer being "buy the most expensive one you can afford".

import type { Id } from '../engine/types';

/**
 * What a line of stock keys off, for the fit multiplier.
 *
 * - `none` — sells the same to everybody.
 * - `gimmick` — scales with the merch pull of the people on the card. Masks,
 *   plush, anything sold on a character rather than a logo.
 * - `prestige` — scales with how big the company is. Nobody buys a replica
 *   belt off a promotion running a bingo hall.
 * - `hardcore` / `family` — scales with the house style.
 */
export type StandFit = 'none' | 'gimmick' | 'prestige' | 'hardcore' | 'family';

export interface Stand {
  id: Id;
  name: string;
  /** Bought in before the doors open, whatever the crowd turns out to be. */
  costPerShow: number;
  /** What it returns for every person in the building, before fit. */
  perHead: number;
  fit: StandFit;
  blurb: string;
  /** Concessions need the building's permission; merch does not. */
  needsBarRights?: boolean;
  /** Some things only work with nothing over your head. */
  outdoorOnly?: boolean;
  /** Needs a rung of the production ladder — you cannot sell a show you did not film. */
  requiresRung?: Id;
}

// ---------------------------------------------------------------- the merch table

export const MERCH_LINES: Stand[] = [
  {
    id: 'shirts',
    name: 'T-shirts',
    costPerShow: 220,
    perHead: 1.9,
    fit: 'gimmick',
    blurb: 'A folding table and four designs. The one thing every single promotion sells.',
  },
  {
    id: 'programmes',
    name: 'Programs',
    // The cheapest thing on the table on purpose: the first merch decision a
    // booker makes should be a viable one in the room he actually starts in.
    costPerShow: 60,
    perHead: 0.55,
    fit: 'none',
    blurb: 'Printed fresh the morning of the show. Dirt cheap, and everybody grabs one on the way in.',
  },
  {
    id: 'foamHands',
    name: 'Foam hands and signs',
    costPerShow: 130,
    perHead: 0.7,
    fit: 'family',
    blurb: 'Sells straight to the kids, and every kid comes with somebody holding a wallet.',
  },
  {
    id: 'masks',
    name: 'Masks',
    costPerShow: 340,
    perHead: 1.7,
    fit: 'gimmick',
    blurb: 'Only worth setting up the stall if somebody on that card is actually wearing one.',
  },
  {
    id: 'photos',
    name: 'Photos and autographs',
    costPerShow: 180,
    perHead: 1.1,
    fit: 'gimmick',
    blurb: 'Eight-by-tens and a marker pen. Somebody has to stand there signing all night long.',
  },
  {
    id: 'plush',
    name: 'Plush and toys',
    costPerShow: 520,
    perHead: 1.5,
    fit: 'family',
    blurb: 'Does absolutely nothing in front of a room that came here to see somebody bleed.',
  },
  {
    id: 'weaponsMerch',
    name: 'Souvenir kendo sticks',
    costPerShow: 260,
    perHead: 1.4,
    fit: 'hardcore',
    blurb: 'Signed, taped up, and sold straight to the people who cheered loudest when it broke.',
  },
  {
    id: 'tapes',
    name: 'Show recordings',
    costPerShow: 640,
    perHead: 1.8,
    fit: 'prestige',
    // You cannot sell a recording of a show nobody filmed.
    requiresRung: 'cameras',
    blurb: 'Last month’s card, sold right here at this month’s show. Needs somebody actually filming it first.',
  },
  {
    id: 'replicaBelts',
    name: 'Replica championships',
    costPerShow: 2_400,
    perHead: 3.6,
    fit: 'prestige',
    blurb: 'Expensive to stock, and worth absolutely nothing in a small hall.',
  },
];

// ---------------------------------------------------------------- the stand

export const CONCESSIONS: Stand[] = [
  {
    id: 'foldingTable',
    name: 'A cooler and a folding table',
    costPerShow: 60,
    perHead: 0.5,
    fit: 'none',
    needsBarRights: true,
    blurb: 'Cans and chips, sold by somebody’s cousin who showed up early.',
  },
  {
    id: 'snackBar',
    name: 'Snack bar',
    costPerShow: 300,
    perHead: 1.6,
    fit: 'none',
    needsBarRights: true,
    blurb: 'Hot dogs, popcorn, and a line so long it misses the entire opener.',
  },
  {
    id: 'fullBar',
    name: 'Full bar',
    costPerShow: 900,
    perHead: 3.4,
    fit: 'none',
    needsBarRights: true,
    blurb: 'The single best line of business in this entire industry, and it needs a real license to run.',
  },
  {
    id: 'foodTrucks',
    name: 'Food trucks',
    costPerShow: 700,
    perHead: 2.6,
    fit: 'none',
    needsBarRights: true,
    outdoorOnly: true,
    blurb: 'Four of them lined up along the fence. Only works where there is actually a fence to line them up on.',
  },
];

export const ALL_STANDS: Stand[] = [...MERCH_LINES, ...CONCESSIONS];

export function standById(id: Id): Stand | undefined {
  return ALL_STANDS.find((s) => s.id === id);
}

