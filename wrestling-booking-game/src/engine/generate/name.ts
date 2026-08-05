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

const MAX_ATTEMPTS = 200;

/**
 * Generate a ring name that isn't on the real-wrestler blocklist and hasn't
 * already been used in this world. `existingNames` is mutated-free — callers
 * add the result themselves once they've decided to keep it.
 */
export function generateName(rng: Rng, existingNames: ReadonlySet<string>, gender: 'm' | 'f' = 'm'): string {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = generateCandidate(rng, gender);
    const key = candidate.trim().toLowerCase();
    if (isBlockedName(candidate)) continue;
    if (existingNames.has(key)) continue;
    return candidate;
  }
  throw new Error('generateName: exhausted attempts without finding a unique, unblocked name');
}
