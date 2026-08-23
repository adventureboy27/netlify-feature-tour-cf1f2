// Fills in the mechanical numbers and default look for a gimmick that only
// specifies its identity — id, name, category, alignment lean, concept,
// promo lines. Lets a new gimmick be added to data/gimmicks.ts with
// nothing but the character itself, per CLAUDE.md's "content lives in
// data/ as typed arrays" rule: nobody hand-tunes a popularity ceiling for
// entry #187, the category picks a sane look, and the numbers come from a
// stable per-id seed rather than a coin flip that would reroll on every
// load.
//
// Every explicit field on a seed always wins — this only fills gaps.

import type { Gimmick, GimmickLook } from '../types';
import { rngFromSeed } from '../rng';

/** One sensible silhouette per content-draft category. A gimmick with no matching category falls back to a plain, neutral look. */
const CATEGORY_LOOK: Record<string, GimmickLook> = {
  Classic: { attire: 'plain', palette: 'earthy' },
  'Law and disorder': { attire: 'plain', palette: 'monochrome' },
  'Blue collar': { attire: 'plain', palette: 'earthy' },
  'Rural and outlaw': { attire: 'brawler', palette: 'earthy', hair: 'wild' },
  'Military and paramilitary': { attire: 'plain', palette: 'earthy', hair: 'short' },
  'Showbiz and entertainment': { attire: 'flashy', palette: 'bright' },
  'Sports crossovers': { attire: 'athletic', palette: 'bright' },
  'Intellectual and eccentric': { attire: 'formal', palette: 'monochrome' },
  'Mystical and supernatural': { attire: 'savage', palette: 'dark' },
  'Corporate, political, and media': { attire: 'formal', palette: 'gold' },
  'Historical and mythic': { attire: 'savage', palette: 'blood' },
  'Animal and nature acts': { attire: 'brawler', palette: 'earthy' },
  'Food and hospitality': { attire: 'plain', palette: 'bright' },
  Medical: { attire: 'formal', palette: 'monochrome' },
  'School and education': { attire: 'plain', palette: 'monochrome' },
  'Tech and modern': { attire: 'athletic', palette: 'monochrome' },
  'Everyman-with-an-edge': { attire: 'plain', palette: 'bright' },
  'Travel and exploration': { attire: 'athletic', palette: 'earthy' },
  'Weather and disaster': { attire: 'savage', palette: 'dark' },
  'Music, beyond the one rock-star slot': { attire: 'flashy', palette: 'bright', hair: 'long' },
  'More everyday jobs': { attire: 'plain', palette: 'earthy' },
  'Sci-fi and speculative': { attire: 'athletic', palette: 'monochrome' },
  'More combat sports': { attire: 'athletic', palette: 'bright' },
  'More rural and agricultural': { attire: 'brawler', palette: 'earthy' },
  'More corporate and pop culture': { attire: 'formal', palette: 'gold' },
  'Minor tweak': { attire: 'plain', palette: 'earthy' },
};

const FALLBACK_LOOK: GimmickLook = { attire: 'plain', palette: 'earthy' };

export type GimmickSeed = Pick<Gimmick, 'id' | 'name' | 'category' | 'alignmentLean' | 'concept' | 'promoLines'> &
  Partial<Pick<Gimmick, 'prop' | 'popularityCeiling' | 'growthRateMultiplier' | 'merchMultiplier' | 'territoryFit' | 'look'>>;

/** Turn a minimal seed into a full `Gimmick` — see the module doc comment. */
export function deriveGimmickDefaults(seed: GimmickSeed): Gimmick {
  const rng = rngFromSeed(`gimmickdefault:${seed.id}`);
  return {
    ...seed,
    popularityCeiling: seed.popularityCeiling ?? Math.round(65 + rng.next() * 30),
    growthRateMultiplier: seed.growthRateMultiplier ?? Number((0.85 + rng.next() * 0.4).toFixed(2)),
    merchMultiplier: seed.merchMultiplier ?? Number((0.75 + rng.next() * 0.55).toFixed(2)),
    territoryFit: seed.territoryFit ?? {},
    look: seed.look ?? CATEGORY_LOOK[seed.category] ?? FALLBACK_LOOK,
  };
}
