// A rival's television arrangement shifts — a new deal, a lost slot, a
// timeslot bump or a demotion. Purely a rival-side story: no player
// decision, because the player has no seat at that table. Real either
// direction, on purpose — the business does not only ever get worse for
// somebody else.
//
// Once per rival: reuses the same "happenedFor" tracking shape as
// rogueTurn/scandal/breakawayPromotion (World.worldStoryHappenedFor).
// Originally had no cooldown at all — the only entry in the whole registry
// without one — which combined with the story-roll seed bug (see
// state/store.ts) meant it and ownerRivalry ended up firing far more often
// than every self-gating sibling, confirmed by playing many seeds out with
// tools/probe.mjs.

import type { Rng } from '../rng';
import { chance, clamp, pick } from '../rng';
import type { Promotion, WorldSettings } from '../types';

export function eligibleForNetworkRealignment(
  week: number,
  livingRivals: readonly Promotion[],
  alreadyHappenedIds: readonly string[],
  settings: WorldSettings,
): boolean {
  return (
    week >= settings.networkRealignmentEarliestWeek &&
    livingRivals.some((r) => !alreadyHappenedIds.includes(r.id))
  );
}

export function pickNetworkRealignmentTarget(
  rng: Rng,
  livingRivals: readonly Promotion[],
  alreadyHappenedIds: readonly string[],
): Promotion {
  const eligible = livingRivals.filter((r) => !alreadyHappenedIds.includes(r.id));
  return pick(rng, eligible);
}

export interface NetworkRealignmentOutcome {
  ratingSwing: number;
  line: string;
}

/** Mutates the rival's rating directly — the same shape as merger/succession's own apply functions. */
export function applyNetworkRealignment(rng: Rng, rival: Promotion, settings: WorldSettings): NetworkRealignmentOutcome {
  const swing = (chance(rng, 0.5) ? 1 : -1) * settings.networkRealignmentRatingSwing;
  rival.rating = clamp(rival.rating + swing, 0, 100);
  return {
    ratingSwing: swing,
    line:
      swing >= 0
        ? `${rival.name} just landed real television real estate — a better slot, a longer deal, or both.`
        : `${rival.name} just lost real television ground — a worse slot, a shorter deal, or the whole arrangement.`,
  };
}
