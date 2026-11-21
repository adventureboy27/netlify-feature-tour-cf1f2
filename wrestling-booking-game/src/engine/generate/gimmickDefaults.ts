// Fills in the mechanical numbers for a gimmick that only specifies its
// identity — id, name, category, alignment lean, concept, promo lines. Lets
// a new gimmick be added to data/gimmicks.ts with nothing but the character
// itself, per CLAUDE.md's "content lives in data/ as typed arrays" rule:
// nobody hand-tunes a popularity ceiling for entry #187, and the numbers
// come from a stable per-id seed rather than a coin flip that would reroll
// on every load.
//
// Every explicit field on a seed always wins — this only fills gaps.

import type { Gimmick } from '../types';
import { rngFromSeed } from '../rng';

export type GimmickSeed = Pick<Gimmick, 'id' | 'name' | 'category' | 'alignmentLean' | 'concept' | 'promoLines'> &
  Partial<Pick<Gimmick, 'prop' | 'popularityCeiling' | 'growthRateMultiplier' | 'merchMultiplier' | 'territoryFit' | 'masked'>>;

/** Turn a minimal seed into a full `Gimmick` — see the module doc comment. */
export function deriveGimmickDefaults(seed: GimmickSeed): Gimmick {
  const rng = rngFromSeed(`gimmickdefault:${seed.id}`);
  return {
    ...seed,
    popularityCeiling: seed.popularityCeiling ?? Math.round(65 + rng.next() * 30),
    growthRateMultiplier: seed.growthRateMultiplier ?? Number((0.85 + rng.next() * 0.4).toFixed(2)),
    merchMultiplier: seed.merchMultiplier ?? Number((0.75 + rng.next() * 0.55).toFixed(2)),
    territoryFit: seed.territoryFit ?? {},
  };
}
