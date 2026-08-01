// Random trait-vector generation for the paper-doll system, §7.
// M0 only needs a wrestler to carry a valid Appearance — the renderer, the
// editor, and the visual-distinctness check (Hamming distance >= 3 against
// the rest of the roster) are M1 work and are not implemented here.

import type { Rng } from '../rng';
import { randInt } from '../rng';
import type { Appearance } from '../types';

const RANGES = {
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

export function generateAppearance(rng: Rng): Appearance {
  return {
    skinTone: randInt(rng, 0, RANGES.skinTone),
    build: randInt(rng, 0, RANGES.build),
    height: randInt(rng, 0, RANGES.height),
    hairStyle: randInt(rng, 0, RANGES.hairStyle),
    hairColor: randInt(rng, 0, RANGES.hairColor),
    facialHair: randInt(rng, 0, RANGES.facialHair),
    faceShape: randInt(rng, 0, RANGES.faceShape),
    eyes: randInt(rng, 0, RANGES.eyes),
    attireTop: randInt(rng, 0, RANGES.attireTop),
    attireBottom: randInt(rng, 0, RANGES.attireBottom),
    boots: randInt(rng, 0, RANGES.boots),
    mask: randInt(rng, 0, RANGES.mask),
    accessory: randInt(rng, 0, RANGES.accessory),
    glasses: randInt(rng, 0, RANGES.glasses),
    shirt: randInt(rng, 0, RANGES.shirt),
    tattoos: randInt(rng, 0, RANGES.tattoos),
    beltStyle: randInt(rng, 0, RANGES.beltStyle),
    primaryColor: randInt(rng, 0, RANGES.primaryColor),
    secondaryColor: randInt(rng, 0, RANGES.secondaryColor),
    accentColor: randInt(rng, 0, RANGES.accentColor),
  };
}
