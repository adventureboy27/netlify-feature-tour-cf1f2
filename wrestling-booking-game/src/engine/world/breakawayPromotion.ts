// A real chunk of an existing rival's own roster walks out together and
// founds a brand-new promotion — not somebody starting from nothing
// (engine/world/newPromotions.ts already covers that half of the cycle),
// somebody starting from a fracture.
//
// Deliberately pure and small: this module only decides *whether* and
// *who* — picking the source rival and who defects. The actual founding
// (engine/world/newPromotions.ts's foundPromotion) and the roster move stay
// in the store, the same boundary succession's own roster-shedding aftermath
// already respects.

import type { Rng } from '../rng';
import { pick } from '../rng';
import type { Promotion, WorldSettings } from '../types';

export function eligibleForBreakaway(
  week: number,
  livingRivals: readonly Promotion[],
  alreadyHappenedIds: readonly string[],
  settings: WorldSettings,
): boolean {
  return (
    week >= settings.breakawayEarliestWeek &&
    livingRivals.some(
      (r) => !alreadyHappenedIds.includes(r.id) && r.rosterIds.length >= settings.breakawayMinRosterSize,
    )
  );
}

/** The rival a chunk of roster is about to walk out on. */
export function pickBreakawaySource(
  rng: Rng,
  livingRivals: readonly Promotion[],
  alreadyHappenedIds: readonly string[],
  settings: WorldSettings,
): Promotion {
  const eligible = livingRivals.filter(
    (r) => !alreadyHappenedIds.includes(r.id) && r.rosterIds.length >= settings.breakawayMinRosterSize,
  );
  return pick(rng, eligible);
}
