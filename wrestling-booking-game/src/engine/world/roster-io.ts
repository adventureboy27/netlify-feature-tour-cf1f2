// Taking a roster out, and putting one back.
//
// Two different jobs share this file because they share a format.
//
// The first is a save you can move: a decades-long promotion living in one
// browser's localStorage is one cleared cache away from gone, and a file the
// player owns fixes that.
//
// The second is the one people actually want, which is putting their own
// wrestlers in. A roster file is a plain list of names, looks and stats — no
// ids, no world state, nothing that ties it to the save it came from — so one
// can be written by hand or by somebody else's tool and dropped into any game.
//
// The hard rule for imports: NOTHING IS TRUSTED. Every field is checked, every
// number clamped, anything missing filled from a default, and anything the
// file says about ids is ignored and reassigned. A malformed roster must
// produce a boring wrestler, never a broken save.

import type { Appearance, Wrestler } from '../types';
import { APPEARANCE_TRAIT_RANGES } from '../generate/appearance';
import { clamp, shuffle, type Rng } from '../rng';

/** The format version. Bumped only when an old file could be misread. */
export const ROSTER_FORMAT = 1;

/** One wrestler, as a file describes them. Everything is optional but the name. */
export interface RosterEntry {
  name: string;
  nickname?: string;
  gender?: 'm' | 'f';
  age?: number;
  /** -100 heel to +100 face. */
  alignment?: number;
  popularity?: number;
  charisma?: number;
  strength?: number;
  skill?: number;
  agility?: number;
  stamina?: number;
  toughness?: number;
  style?: string;
  /** Trait numbers. Anything unrecognised is ignored. */
  appearance?: Record<string, number>;
  /**
   * Which promotion this wrestler belongs to, for a multi-promotion import.
   * See groupByCompany — if every entry in a file carries one, the game
   * builds one promotion per distinct value rather than a single pool.
   */
  company?: string;
}

export interface RosterFile {
  format: number;
  /** Free text, so a shared file can say what it is. */
  label?: string;
  wrestlers: RosterEntry[];
}

/** Which fields travel. Everything else is world state and does not belong in a roster file. */
const STAT_KEYS = ['popularity', 'charisma', 'strength', 'skill', 'agility', 'stamina', 'toughness'] as const;

export function exportRoster(wrestlers: readonly Wrestler[], label?: string): RosterFile {
  return {
    format: ROSTER_FORMAT,
    label,
    wrestlers: wrestlers.map((w) => ({
      name: w.name,
      nickname: w.nickname,
      gender: w.gender,
      age: w.age,
      alignment: w.alignment,
      popularity: w.popularity,
      charisma: w.charisma,
      strength: w.strength,
      skill: w.skill,
      agility: w.agility,
      stamina: w.stamina,
      toughness: w.toughness,
      style: w.style,
      appearance: { ...w.appearance } as unknown as Record<string, number>,
    })),
  };
}

/** What came back from a file, and everything that was wrong with it. */
export interface ImportResult {
  entries: RosterEntry[];
  /** Human-readable, and shown to the player. A silent import is a trap. */
  problems: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Clamp a number a file supplied, or return undefined if it did not supply one.
 *
 * Undefined matters: an absent field must fall through to what generation
 * rolled, not to a default. Filling in 50 across the board made every
 * name-only entry the same bland mannequin, which is the opposite of what a
 * one-line entry should get.
 */
function readNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return clamp(value, min, max);
}

/**
 * Read a roster file. Never throws: a file that is wrong in every possible way
 * comes back as an empty list and a pile of complaints.
 */
export function parseRoster(raw: string): ImportResult {
  const problems: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { entries: [], problems: ['That is not a roster file — it is not even JSON.'] };
  }

  if (!isRecord(parsed)) return { entries: [], problems: ['That file does not contain a roster.'] };
  if (typeof parsed.format === 'number' && parsed.format > ROSTER_FORMAT) {
    problems.push(`That file was written by a newer version (format ${parsed.format}). Some of it may be ignored.`);
  }
  if (!Array.isArray(parsed.wrestlers)) {
    return { entries: [], problems: [...problems, 'That file has no wrestlers in it.'] };
  }

  const entries: RosterEntry[] = [];
  const seen = new Set<string>();

  parsed.wrestlers.forEach((row: unknown, index: number) => {
    if (!isRecord(row)) {
      problems.push(`Entry ${index + 1} is not a wrestler and was skipped.`);
      return;
    }
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!name) {
      problems.push(`Entry ${index + 1} has no name and was skipped.`);
      return;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      problems.push(`${name} appears more than once. Only the first was kept.`);
      return;
    }
    seen.add(key);

    const entry: RosterEntry = { name };
    if (typeof row.nickname === 'string' && row.nickname.trim()) entry.nickname = row.nickname.trim();
    if (row.gender === 'f' || row.gender === 'm') entry.gender = row.gender;
    const age = readNumber(row.age, 18, 70);
    if (age !== undefined) entry.age = age;
    const alignment = readNumber(row.alignment, -100, 100);
    if (alignment !== undefined) entry.alignment = alignment;
    for (const stat of STAT_KEYS) {
      const value = readNumber(row[stat], 0, 100);
      if (value !== undefined) entry[stat] = value;
    }
    if (typeof row.style === 'string') entry.style = row.style;
    if (typeof row.company === 'string' && row.company.trim()) entry.company = row.company.trim();

    // Appearance traits are checked against the ranges the generator uses, so
    // a file cannot produce a sprite the atlas has no cell for.
    if (isRecord(row.appearance)) {
      const appearance: Record<string, number> = {};
      // APPEARANCE_TRAIT_RANGES gives the number of cells the atlas cuts for
      // each trait, so a valid value is 0..count-1. Anything outside is
      // clamped rather than rejected: a file asking for hair style 900 gets
      // the last hairstyle, not a crash and not an invisible wrestler.
      for (const [trait, count] of Object.entries(APPEARANCE_TRAIT_RANGES)) {
        const value = row.appearance[trait];
        if (typeof value === 'number' && Number.isFinite(value)) {
          appearance[trait] = clamp(Math.round(value), 0, Math.max(0, count - 1));
        }
      }
      entry.appearance = appearance;
    }

    entries.push(entry);
  });

  if (entries.length === 0 && problems.length === 0) problems.push('That file has no wrestlers in it.');
  return { entries, problems };
}

/**
 * Fold a file entry onto a freshly generated wrestler.
 *
 * Generation runs first and the file overwrites what it specifies, so a
 * two-line entry with only a name still produces a complete, playable wrestler
 * rather than a hole with a name on it.
 */
export function applyRosterEntry(base: Wrestler, entry: RosterEntry): Wrestler {
  const merged: Wrestler = {
    ...base,
    name: entry.name,
    nickname: entry.nickname ?? base.nickname,
    gender: entry.gender ?? base.gender,
    age: entry.age ?? base.age,
    alignment: entry.alignment ?? base.alignment,
    popularity: entry.popularity ?? base.popularity,
    charisma: entry.charisma ?? base.charisma,
    strength: entry.strength ?? base.strength,
    skill: entry.skill ?? base.skill,
    agility: entry.agility ?? base.agility,
    stamina: entry.stamina ?? base.stamina,
    toughness: entry.toughness ?? base.toughness,
  };
  merged.crowdReaction = merged.alignment;
  if (entry.appearance) {
    merged.appearance = { ...base.appearance, ...entry.appearance } as unknown as Appearance;
  }
  return merged;
}

/** Pretty-printed, because a roster file is meant to be edited by hand. */
export function serializeRoster(file: RosterFile): string {
  return JSON.stringify(file, null, 2);
}

// ---------------------------------------------------------------------------
// Splitting one file across several promotions — the new-game import.

export interface CompanyGroups {
  /** Company name -> the wrestlers tagged for it, in file order. */
  groups: Map<string, RosterEntry[]>;
  /** In a file where some entries are tagged and some are not, the rest. */
  ungrouped: RosterEntry[];
}

/**
 * Read a parsed roster as either a set of named companies or one flat pool.
 *
 * Returns `null` when nothing in the file carries a `company` — the whole
 * file is a flat pool, for `splitEvenlyByGender` to divide up. Returns groups
 * the moment even one entry is tagged; anything left untagged in that file
 * comes back as `ungrouped` rather than silently dropped or forced into a
 * company nobody asked it to join.
 */
export function groupByCompany(entries: readonly RosterEntry[]): CompanyGroups | null {
  if (!entries.some((e) => e.company)) return null;

  const groups = new Map<string, RosterEntry[]>();
  const ungrouped: RosterEntry[] = [];
  for (const entry of entries) {
    if (!entry.company) {
      ungrouped.push(entry);
      continue;
    }
    const list = groups.get(entry.company);
    if (list) list.push(entry);
    else groups.set(entry.company, [entry]);
  }
  return { groups, ungrouped };
}

/**
 * Deal a flat pool out across N destinations, keeping each one's gender mix
 * close to even.
 *
 * Split by gender first and deal each half separately, rather than shuffling
 * everybody together and hoping — with a small pool and few slots, one
 * shuffle can easily leave a promotion all of one gender by chance, which is
 * exactly the outcome this exists to rule out. Which slots absorb the
 * remainder, when a gender's count doesn't divide evenly, is re-randomised
 * per gender so the same slot doesn't systematically end up the one that
 * always gets the extra.
 */
export function splitEvenlyByGender(
  entries: readonly RosterEntry[],
  slotCount: number,
  rng: Rng,
): RosterEntry[][] {
  const n = Math.max(1, slotCount);
  const buckets: RosterEntry[][] = Array.from({ length: n }, () => []);

  const byGender = new Map<string, RosterEntry[]>();
  for (const entry of entries) {
    const key = entry.gender ?? '?';
    const list = byGender.get(key);
    if (list) list.push(entry);
    else byGender.set(key, [entry]);
  }

  for (const group of byGender.values()) {
    const dealOrder = shuffle(rng, Array.from({ length: n }, (_, i) => i));
    shuffle(rng, group).forEach((entry, i) => {
      buckets[dealOrder[i % n]!]!.push(entry);
    });
  }
  return buckets;
}
