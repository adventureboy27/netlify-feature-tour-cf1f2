// Where the furniture comes from. See engine/sim/ringProps.ts.
//
// Everything a match is fought with is somewhere in the building before it
// is in anybody's hands: under the ring (an endless supply), or, for the
// steel steps, bolted to the corner until somebody takes them.

import type { FinishType, RingItem } from '../engine/types';

/**
 * Gear a match cannot be won without, that can be replaced from under the
 * ring if it gives out — and the finish the match then has instead of
 * nobody winning. A cage cannot be fetched; a ladder or a table can.
 */
export const REPLACED_FROM_UNDER_THE_RING: Partial<Record<string, FinishType>> = {
  ladder: 'cleanPin',
  tables: 'knockout',
};

/** How each item is named in a sentence. */
export const RING_ITEM_NAMES: Record<RingItem, string> = {
  chair: 'a steel chair',
  can: 'a trash can',
  kendo: 'a kendo stick',
  steps: 'the steel steps',
  ladder: 'a ladder',
  table: 'a table',
};

/** Fetched from under the ring. {actor} {item} */
export const UNDER_THE_RING_LINES: Record<'weapon' | 'ladder' | 'table', readonly string[]> = {
  weapon: [
    '{actor} rolled out to the floor and came back up from under the ring with {item}.',
    '{actor} reached under the apron and pulled out {item}.',
  ],
  ladder: [
    '{actor} dragged {item} out from under the ring and slid it in.',
    '{actor} went under the ring and came back out with {item}.',
  ],
  table: [
    '{actor} pulled {item} out from under the ring and slid it into the ring.',
    '{actor} hauled {item} out from under the apron.',
  ],
};

/** A replacement for one that gave out. {actor} {item} */
export const ANOTHER_ONE_LINES: readonly string[] = [
  'With the last one wrecked, {actor} went back under the ring for {item}.',
  'There is always another one under there: {actor} dragged out {item}.',
];

/** The steel steps, off the corner. {actor} */
export const STEPS_OFF_THE_CORNER_LINES: readonly string[] = [
  '{actor} pulled the steel steps away from the corner of the ring.',
  '{actor} tore the steel steps loose from the corner.',
];

/**
 * In a tables match the only way it ends is somebody going through a table
 * and the table breaking — and then the one who put them through has won it.
 * Nobody goes through together and nobody walks away: a finish the dice
 * call a double knockout is the one who did the putting through winning.
 */
export const THROUGH_A_TABLE_WINS: Partial<Record<string, Partial<Record<FinishType, FinishType>>>> = {
  tables: { doubleKO: 'knockout' },
};

/** A tables match's table that would not break. {actor} put {target} into it. */
export const TABLE_HELD_LINES: readonly string[] = [
  '{actor} drove {target} into the table and the wood never gave. A table that does not break does not win a tables match.',
  '{actor} put {target} down on the table and it held — not a crack in it, and nothing to call.',
];
