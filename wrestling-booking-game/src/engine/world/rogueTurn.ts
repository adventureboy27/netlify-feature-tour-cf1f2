// A rival drops the regulation act entirely and goes outlaw — more
// violence, fewer rules, a real identity shift that sticks for the rest of
// the save. Once per rival: reuses the same "happenedFor" tracking shape as
// succession, kept generic on World.worldStoryHappenedFor rather than a
// dedicated field, since this is the first of several new stories that only
// need "has this already happened to this rival."

import type { Rng } from '../rng';
import { chance, clamp, pick } from '../rng';
import type { Promotion, WorldSettings } from '../types';

export function eligibleForRogueTurn(
  week: number,
  livingRivals: readonly Promotion[],
  alreadyTurnedIds: readonly string[],
  settings: WorldSettings,
): boolean {
  return week >= settings.rogueEarliestWeek && livingRivals.some((r) => !alreadyTurnedIds.includes(r.id));
}

export function pickRogueTarget(
  rng: Rng,
  livingRivals: readonly Promotion[],
  alreadyTurnedIds: readonly string[],
): Promotion {
  const eligible = livingRivals.filter((r) => !alreadyTurnedIds.includes(r.id));
  return pick(rng, eligible);
}

export interface RogueTurnOutcome {
  ratingSwing: number;
  line: string;
}

export function applyRogueTurn(rng: Rng, rival: Promotion, settings: WorldSettings): RogueTurnOutcome {
  rival.styleProfile.violenceTolerance = clamp(
    rival.styleProfile.violenceTolerance + settings.rogueViolenceBoost,
    0,
    100,
  );
  const swing = (chance(rng, 0.5) ? 1 : -1) * settings.rogueRatingSwing;
  rival.rating = clamp(rival.rating + swing, 0, 100);
  return {
    ratingSwing: swing,
    line:
      swing >= 0
        ? `${rival.name} has thrown the rulebook out entirely — no more pretending to run a regulated show, and a real slice of the audience loves them for it.`
        : `${rival.name} has thrown the rulebook out entirely, and this time it read as exactly the mess it looked like.`,
  };
}
