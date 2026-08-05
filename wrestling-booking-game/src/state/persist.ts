// Saving the game.
//
// The whole point of a promotion is that it runs for decades, so a save has
// to survive closing the tab. Everything lives in localStorage — no network,
// no accounts, no cloud (CLAUDE.md: fully offline).
//
// The World is plain data by construction, so JSON round-trips it as-is. The
// only thing outside it is the RNG's position in its stream, which is saved
// alongside so a reloaded game keeps rolling from where it stopped instead of
// replaying the same "random" week.

import type { World } from './world';

const SLOT_KEY = 'wbg.save.v1';
const SCHEMA_VERSION = 1;

export interface SaveFile {
  schema: number;
  savedAtWeek: number;
  promotionName: string;
  rngState: number;
  world: World;
}

function storage(): Storage | null {
  try {
    // Private-mode Safari and locked-down browsers throw on access, not on use.
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function saveGame(world: World, rngState: number): boolean {
  const store = storage();
  if (!store) return false;

  const file: SaveFile = {
    schema: SCHEMA_VERSION,
    savedAtWeek: world.week,
    promotionName: world.promotion.name,
    rngState,
    world,
  };

  try {
    store.setItem(SLOT_KEY, JSON.stringify(file));
    return true;
  } catch {
    // Out of quota, or storage disabled mid-session. The game keeps running;
    // it just will not survive a reload, and the caller can say so.
    return false;
  }
}

export function loadGame(): SaveFile | null {
  const store = storage();
  if (!store) return null;

  const raw = store.getItem(SLOT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SaveFile;
    // A save from an older schema is not worth guessing at. Better to start
    // clean than to load a world with half its systems missing.
    if (parsed.schema !== SCHEMA_VERSION || !parsed.world) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** What is in the slot, without deserialising the whole world. */
export function savedGameSummary(): { promotionName: string; week: number } | null {
  const file = loadGame();
  return file ? { promotionName: file.promotionName, week: file.savedAtWeek } : null;
}

export function clearSave(): void {
  storage()?.removeItem(SLOT_KEY);
}
