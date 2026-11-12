// How badly a nostalgic promoter wants somebody back — see data/owners.ts's
// 'nostalgic' profile and the header comment there. Not a bidding-war
// behavior (biddingTemperaments.ts already covers that, and a flat
// per-auction multiplier can't single out one candidate by age or history
// on its own) — this is the quiet, uncontested weekly free-agent pickup a
// nostalgic rival makes every week regardless of who else is fighting over
// anybody, which is where "the same handful of familiar faces" actually
// comes from.

import type { Wrestler, WorldSettings } from '../types';

/**
 * How much a nostalgic promoter wants this particular free agent back.
 *
 * Always positive — the base weight alone guarantees that, so a weighted
 * pick across a whole free-agent pool never has a zero-total problem, and
 * nobody is ever truly excluded, just heavily outweighed by a real faded
 * star. Decline (how far they've fallen from their own peak) is weighted
 * above raw career-high popularity on purpose: "used to be huge and is not
 * any more" is the actual signal, not just "was ever popular."
 */
export function nostalgicSigningWeight(w: Wrestler, settings: WorldSettings): number {
  const decline = Math.max(0, w.careerHighPopularity - w.popularity);
  const age = Math.max(0, w.age - settings.nostalgicAgeFloor);
  return (
    settings.nostalgicBaseWeight +
    w.careerHighPopularity * settings.nostalgicCareerHighWeight +
    decline * settings.nostalgicDeclineWeight +
    age * settings.nostalgicAgeWeight
  );
}
