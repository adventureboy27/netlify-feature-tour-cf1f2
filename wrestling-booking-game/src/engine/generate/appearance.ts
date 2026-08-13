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

/**
 * @param gender Which body the sprite will be drawn on. Only facial hair reads
 *   it: the trait used to draw nothing at all, so a 50% beard roll across the
 *   whole population was invisible and harmless. Now that the atlas has a face
 *   slot, half the women in the business turned up in goatees.
 */
export function generateAppearance(rng: Rng, gender?: 'm' | 'f'): Appearance {
  return {
    skinTone: randInt(rng, 0, APPEARANCE_TRAIT_RANGES.skinTone),
    build: randInt(rng, 0, APPEARANCE_TRAIT_RANGES.build),
    height: randInt(rng, 0, APPEARANCE_TRAIT_RANGES.height),
    hairStyle: rollOptionalTrait(rng, APPEARANCE_TRAIT_RANGES.hairStyle, 0.92), // ~8% bald
    hairColor: randInt(rng, 0, APPEARANCE_TRAIT_RANGES.hairColor),
    // No bearded women. The fem frame does not draw the face slot at all
    // (atlas/traits.ts owns that); this just stops the save carrying a value
    // nobody will ever see. Expressed as a zero probability rather than a
    // branch around the call so the number of draws taken off the stream does
    // not depend on gender — skipping the roll shifts every seeded world that
    // follows, which surfaced as five unrelated store tests drifting.
    facialHair: rollOptionalTrait(rng, APPEARANCE_TRAIT_RANGES.facialHair, gender === 'f' ? 0 : 0.5),
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

/**
 * The traits that actually reach the sprite.
 *
 * Seven of the twenty do not: faceShape, eyes, shirt, tattoos and beltStyle
 * have never had a cell, and attireBottom and boots lost theirs when the game
 * went portrait-only — the `lower` and `feet` slots were measured to draw
 * exactly zero pixels inside the crop every screen uses, so they were cut.
 *
 * That distinction matters, because the distinctness rule below used to count
 * all twenty — two wrestlers could clear "four traits apart" on faceShape,
 * eyes, tattoos and shirt alone and then render as the same man. On a
 * 2000-strong world that put two hundred silhouettes on three or more people,
 * and the worst of them on ten.
 *
 * The seven are still generated and saved. Dropping their rng draws would
 * shift every seeded world downstream — the same reason facialHair rolls at
 * probability zero for women rather than skipping the call. Cheap to keep,
 * expensive to remove, and they cost nothing but bytes in the save.
 *
 * Kept here rather than in the renderer so the engine stays free of ui/
 * imports; ui/paperdoll/atlas/traits.test.ts asserts this list is exactly the
 * set of traits that change what gets drawn, so adding a cell for tattoos
 * fails the test until this list catches up.
 */
export const RENDERED_APPEARANCE_KEYS: readonly (keyof Appearance)[] = [
  'skinTone',
  'build',
  'height',
  'hairStyle',
  'hairColor',
  'facialHair',
  'attireTop',
  'mask',
  'accessory',
  'glasses',
  'primaryColor',
  'secondaryColor',
  'accentColor',
];

/** Number of trait fields that differ between two appearances. */
export function appearanceHammingDistance(a: Appearance, b: Appearance): number {
  let distance = 0;
  for (const key of APPEARANCE_KEYS) {
    if (a[key] !== b[key]) distance++;
  }
  return distance;
}

/** The same count, over the traits somebody can actually see. */
export function visibleHammingDistance(a: Appearance, b: Appearance): number {
  let distance = 0;
  for (const key of RENDERED_APPEARANCE_KEYS) {
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
export function generateDistinctAppearance(
  rng: Rng,
  existing: readonly Appearance[],
  gender?: 'm' | 'f',
): Appearance {
  let candidate = generateAppearance(rng, gender);
  for (let attempt = 0; attempt < MAX_DISTINCT_ATTEMPTS; attempt++) {
    // Measured over the visible traits only. Distance across all twenty is
    // the letter of §7 and it was not enough: it let two men be "distinct"
    // on four fields nobody can see.
    const isDistinct = existing.every(
      (other) => visibleHammingDistance(candidate, other) >= MIN_DISTINCT_HAMMING_DISTANCE,
    );
    if (isDistinct) return candidate;
    candidate = generateAppearance(rng, gender);
  }
  return candidate;
}
