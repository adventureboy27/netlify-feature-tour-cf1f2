// Random trait-vector generation for the paper-doll system, §7.

import type { Rng } from '../rng';
import { randInt, chance } from '../rng';
import type { Appearance } from '../types';

// Exported so the appearance editor (ui/) can drive its controls off the
// same authoritative max-per-trait values instead of duplicating them.
export const APPEARANCE_TRAIT_RANGES = {
  skinTone: 11,
  build: 5,
  height: 4,
  hairStyle: 23,
  hairColor: 11,
  facialHair: 11,
  faceShape: 7,
  eyes: 7,
  attireTop: 15,
  attireBottom: 15,
  boots: 9,
  mask: 11,
  accessory: 15,
  glasses: 9,
  shirt: 15,
  tattoos: 11,
  beltStyle: 5,
  primaryColor: 19,
  secondaryColor: 19,
  accentColor: 19,
} as const;

// DESIGN: §7 marks several traits "0 = none" (hairStyle/bald, mask, glasses,
// facialHair, accessory, tattoos; shirt is the same pattern by convention).
// A plain uniform roll over the full range gives "none" only a 1-in-N shot —
// for mask (0-11) that's 92% of the roster masked, which is backwards for a
// wrestling promotion where masks are the exception. Each optional trait
// instead rolls presence first at a plausible real-world rate, then picks a
// variant only if present.
function rollOptionalTrait(rng: Rng, max: number, presentProbability: number): number {
  if (!chance(rng, presentProbability)) return 0;
  return randInt(rng, 1, max);
}

export function generateAppearance(rng: Rng): Appearance {
  return {
    skinTone: randInt(rng, 0, APPEARANCE_TRAIT_RANGES.skinTone),
    build: randInt(rng, 0, APPEARANCE_TRAIT_RANGES.build),
    height: randInt(rng, 0, APPEARANCE_TRAIT_RANGES.height),
    hairStyle: rollOptionalTrait(rng, APPEARANCE_TRAIT_RANGES.hairStyle, 0.92), // ~8% bald
    hairColor: randInt(rng, 0, APPEARANCE_TRAIT_RANGES.hairColor),
    facialHair: rollOptionalTrait(rng, APPEARANCE_TRAIT_RANGES.facialHair, 0.5),
    faceShape: randInt(rng, 0, APPEARANCE_TRAIT_RANGES.faceShape),
    eyes: randInt(rng, 0, APPEARANCE_TRAIT_RANGES.eyes),
    attireTop: randInt(rng, 0, APPEARANCE_TRAIT_RANGES.attireTop),
    attireBottom: randInt(rng, 0, APPEARANCE_TRAIT_RANGES.attireBottom),
    boots: randInt(rng, 0, APPEARANCE_TRAIT_RANGES.boots),
    mask: rollOptionalTrait(rng, APPEARANCE_TRAIT_RANGES.mask, 0.1),
    accessory: rollOptionalTrait(rng, APPEARANCE_TRAIT_RANGES.accessory, 0.3),
    glasses: rollOptionalTrait(rng, APPEARANCE_TRAIT_RANGES.glasses, 0.12),
    shirt: rollOptionalTrait(rng, APPEARANCE_TRAIT_RANGES.shirt, 0.2),
    tattoos: rollOptionalTrait(rng, APPEARANCE_TRAIT_RANGES.tattoos, 0.35),
    beltStyle: randInt(rng, 0, APPEARANCE_TRAIT_RANGES.beltStyle),
    primaryColor: randInt(rng, 0, APPEARANCE_TRAIT_RANGES.primaryColor),
    secondaryColor: randInt(rng, 0, APPEARANCE_TRAIT_RANGES.secondaryColor),
    accentColor: randInt(rng, 0, APPEARANCE_TRAIT_RANGES.accentColor),
  };
}

const APPEARANCE_KEYS = Object.keys(APPEARANCE_TRAIT_RANGES) as (keyof Appearance)[];

/** Number of trait fields that differ between two appearances. */
export function appearanceHammingDistance(a: Appearance, b: Appearance): number {
  let distance = 0;
  for (const key of APPEARANCE_KEYS) {
    if (a[key] !== b[key]) distance++;
  }
  return distance;
}

// DESIGN: §7 says "reject a candidate whose trait vector is within Hamming
// distance 3 of an existing roster member's" without pinning down whether
// "within 3" is inclusive. Read as: distance must be strictly greater than 3
// (i.e. >= 4 of the 20 trait fields differ) to count as sufficiently
// distinct — the stricter reading, consistent with "pick the harder,
// harder-to-satisfy option" from CLAUDE.md.
export const MIN_DISTINCT_HAMMING_DISTANCE = 4;
const MAX_DISTINCT_ATTEMPTS = 200;

/**
 * Generate an appearance guaranteed to be visually distinct (§7) from every
 * appearance already in the roster. Falls back to the last rolled candidate
 * if the trait space is saturated (e.g. a roster far larger than the trait
 * combinatorics support) rather than looping forever.
 */
export function generateDistinctAppearance(rng: Rng, existing: readonly Appearance[]): Appearance {
  let candidate = generateAppearance(rng);
  for (let attempt = 0; attempt < MAX_DISTINCT_ATTEMPTS; attempt++) {
    const isDistinct = existing.every(
      (other) => appearanceHammingDistance(candidate, other) >= MIN_DISTINCT_HAMMING_DISTANCE,
    );
    if (isDistinct) return candidate;
    candidate = generateAppearance(rng);
  }
  return candidate;
}
