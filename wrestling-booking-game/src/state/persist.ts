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
// Bumped when the World gains state a running save cannot be without — v2
// added the year record the end-of-year awards are judged on, which cannot be
// reconstructed from a mid-year save.
// Bumped whenever the World shape gains a field the code then dereferences
// without a guard. Version 3 shipped mid-development and then grew
// staffManagers, releaseRequests, contractNews, weeklyNews and thisYear
// without a bump — a save from that window would load (the version matched)
// and then throw on the first `world.weeklyNews.filter`. There is no
// migration path by design: a mismatched save is refused with a message,
// which is honest, and far better than loading one that explodes later.
// Version 5 dropped refereeNews and contractNews in favour of the single
// weeklyNews wire.
const SCHEMA_VERSION = 5;

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

// ---------------------------------------------------------------------------
// Taking a save out of the browser
//
// A promotion that has run for thirty simulated years lives in one browser's
// localStorage, which is one cleared cache from gone. These two turn it into a
// file the player owns.

export function exportSave(world: World, rngState: number): string {
  const file: SaveFile = {
    schema: SCHEMA_VERSION,
    savedAtWeek: world.week,
    promotionName: world.promotion.name,
    rngState,
    world,
  };
  return JSON.stringify(file);
}

/**
 * Read a save file back. Returns null with a reason rather than throwing,
 * because the input is whatever the player picked off their disk.
 */
export function importSave(raw: string): { file: SaveFile } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: 'That file is not a save — it is not even JSON.' };
  }
  if (typeof parsed !== 'object' || parsed === null) return { error: 'That file does not contain a save.' };

  const file = parsed as Partial<SaveFile>;
  if (!file.world || typeof file.world !== 'object') return { error: 'That file has no world in it.' };
  if (file.schema !== SCHEMA_VERSION) {
    return {
      error: `That save is from a different version of the game (schema ${file.schema ?? 'unknown'}, this build reads ${SCHEMA_VERSION}).`,
    };
  }
  // A save missing the spine is not worth guessing at — better a clear refusal
  // than a world that half-loads and breaks three weeks later.
  const world = file.world as Partial<World>;
  if (!world.promotion || !world.wrestlers || typeof world.week !== 'number') {
    return { error: 'That save is incomplete.' };
  }
  return { file: file as SaveFile };
}

/** A filename that says what it is and when it was. */
export function saveFilename(world: World): string {
  const safe = world.promotion.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  const year = world.settings.startingYear + Math.floor(world.week / 52);
  return `${safe || 'promotion'}-${year}-week-${world.week}.wbg.json`;
}
