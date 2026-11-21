// Name generation, booking-game-design.md §6.
// Pattern A (60%): [FirstName] [LastName]
// Pattern B (25%): [EpithetNoun] or [Adjective][Noun]
// Pattern C (15%): [Title] [Name]
// Rejects real-wrestler blocklist matches and duplicates within the active world.

import type { Rng } from '../rng';
import { weightedPick, pick, chance } from '../rng';
import {
  MASCULINE_FIRST_NAMES,
  FEMININE_FIRST_NAMES,
  SURNAMES,
  EPITHET_NOUNS,
  EPITHET_ADJECTIVES,
  NAME_TITLES,
} from '../../data/names';
import { isBlockedName } from '../../data/blocklist';

type NamePattern = 'twoPart' | 'epithet' | 'titled';

function rollPattern(rng: Rng): NamePattern {
  return weightedPick(rng, [
    ['twoPart', 0.6],
    ['epithet', 0.25],
    ['titled', 0.15],
  ]);
}

function generateCandidate(rng: Rng, gender: 'm' | 'f'): string {
  // Ring names follow the person. A women's division full of men's names is
  // the sort of thing you only notice once and then cannot stop noticing.
  const firstNames = gender === 'f' ? FEMININE_FIRST_NAMES : MASCULINE_FIRST_NAMES;
  const pattern = rollPattern(rng);
  switch (pattern) {
    case 'twoPart':
      return `${pick(rng, firstNames)} ${pick(rng, SURNAMES)}`;
    case 'epithet':
      return chance(rng, 0.5) ? pick(rng, EPITHET_NOUNS) : `${pick(rng, EPITHET_ADJECTIVES)} ${pick(rng, EPITHET_NOUNS)}`;
    case 'titled':
      return `${pick(rng, NAME_TITLES)} ${pick(rng, firstNames)}`;
  }
}

/**
 * Names that merely *look* alike are as bad as duplicates. Two wrestlers
 * called Briar Quintero and Tamsin Quintero read as brothers; Blackout and
 * Blackoutt reads as a bug. So a candidate is rejected when it shares a
 * surname with somebody, or when it is a small edit away from a name already
 * in use.
 */
export function normalizeName(name: string): string {
  const cached = NORMALIZED.get(name);
  if (cached !== undefined) return cached;

  const normalized = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/^the\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  // The similarity check compares every candidate against every existing
  // name, so without this the normalisation alone is quadratic. Bounded so a
  // long-running world cannot grow it without limit.
  if (NORMALIZED.size < NORMALIZED_CACHE_LIMIT) NORMALIZED.set(name, normalized);
  return normalized;
}

const NORMALIZED = new Map<string, string>();
const NORMALIZED_CACHE_LIMIT = 20_000;

/** Levenshtein, capped — we only care whether it is small. */
export function editDistance(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
      current.push(value);
      best = Math.min(best, value);
    }
    // Whole row already past the cap — it can only get worse.
    if (best > cap) return cap + 1;
    previous = current;
  }
  return previous[b.length]!;
}

/** Distinctive words: the ones that would make two names sound related. */
function significantWords(normalized: string): string[] {
  return normalized.split(' ').filter((word) => word.length >= 4);
}

/**
 * A prepared view of the names already in use.
 *
 * Built once per generation attempt rather than once per candidate: the
 * similarity check compares against every existing name, and rebuilding the
 * comparison structures for each of up to four hundred candidates turned name
 * generation into the slowest thing in the game.
 */
export interface NameIndex {
  normalized: Set<string>;
  surnames: Set<string>;
  /** Distinctive words belonging to one-word ring names. */
  soloWords: Set<string>;
  /** Distinctive words from every name, for matching a one-word candidate. */
  allWords: Set<string>;
  /** Normalized names bucketed by length, for the edit-distance pass. */
  byLength: Map<number, string[]>;
}

export function buildNameIndex(existing: Iterable<string>): NameIndex {
  const index: NameIndex = {
    normalized: new Set(),
    surnames: new Set(),
    soloWords: new Set(),
    allWords: new Set(),
    byLength: new Map(),
  };

  for (const raw of existing) {
    const name = normalizeName(raw);
    if (!name) continue;

    index.normalized.add(name);

    const words = name.split(' ');
    if (words.length > 1) index.surnames.add(words[words.length - 1]!);
    for (const word of significantWords(name)) {
      index.allWords.add(word);
      if (words.length === 1) index.soloWords.add(word);
    }

    const bucket = index.byLength.get(name.length) ?? [];
    bucket.push(name);
    index.byLength.set(name.length, bucket);
  }

  return index;
}

export function isTooSimilar(candidate: string, existing: ReadonlySet<string> | NameIndex): boolean {
  const index = existing instanceof Set ? buildNameIndex(existing) : (existing as NameIndex);
  const a = normalizeName(candidate);
  if (!a) return true;
  if (index.normalized.has(a)) return true;

  const words = a.split(' ');

  // A shared surname makes two people sound like family.
  if (words.length > 1 && index.surnames.has(words[words.length - 1]!)) return true;

  // A one-word ring name is the whole act, so it collides with that word
  // appearing anywhere. A two-word name only collides with a one-word act —
  // otherwise every wrestler sharing a first name would be rejected.
  const pool = words.length === 1 ? index.allWords : index.soloWords;
  for (const word of significantWords(a)) if (pool.has(word)) return true;

  // And anything a typo away. Only names of a comparable length can be.
  for (let length = a.length - SIMILAR_EDIT_DISTANCE; length <= a.length + SIMILAR_EDIT_DISTANCE; length++) {
    for (const other of index.byLength.get(length) ?? []) {
      if (editDistance(a, other, SIMILAR_EDIT_DISTANCE) <= SIMILAR_EDIT_DISTANCE) return true;
    }
  }

  return false;
}

/** How many single-character edits still counts as "the same name". */
const SIMILAR_EDIT_DISTANCE = 2;

const MAX_ATTEMPTS = 400;

/**
 * Generate a ring name that isn't on the real-wrestler blocklist and hasn't
 * already been used in this world. `existingNames` is mutated-free — callers
 * add the result themselves once they've decided to keep it.
 */
export function generateName(rng: Rng, existingNames: ReadonlySet<string>, gender: 'm' | 'f' = 'm'): string {
  const index = buildNameIndex(existingNames);
  let lastResort: string | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = generateCandidate(rng, gender);
    const key = candidate.trim().toLowerCase();
    if (isBlockedName(candidate)) continue;
    if (existingNames.has(key)) continue;

    // Exact-unique is the floor; hold it in reserve in case the name space is
    // so crowded that nothing clears the similarity bar.
    lastResort ??= candidate;
    if (!isTooSimilar(candidate, index)) return candidate;
  }

  if (lastResort) return lastResort;
  throw new Error('generateName: exhausted attempts without finding a unique, unblocked name');
}
