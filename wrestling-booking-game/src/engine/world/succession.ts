// Succession — a rival's founder dies, or finally steps back.
//
// Lighter than the merger and not a one-time thing: any living rival can go
// through this once, tracked per-promotion (World.successionHappenedFor)
// rather than a single world-wide flag. What comes out the other side is a
// real roll, not a foregone conclusion — a steady hand barely changes
// anything, a sharp one makes the company genuinely more dangerous, and a
// weak one costs them, sometimes enough to shed staff who were loyal to the
// old regime (see ownershipShakeup.ts, called by whichever story needs it).

import type { Rng } from '../rng';
import { clamp, pick, weightedPick } from '../rng';
import type { Id, Promotion, WorldSettings } from '../types';

export type HeirBranch = 'steady' | 'sharp' | 'weak';

/** Whether the business is old enough, and there is anyone left it hasn't already happened to. */
export function eligibleForSuccession(
  week: number,
  livingRivals: readonly Promotion[],
  alreadySucceededIds: readonly Id[],
  settings: WorldSettings,
): boolean {
  if (week < settings.successionEarliestWeek) return false;
  return livingRivals.some((r) => !alreadySucceededIds.includes(r.id));
}

/** Who it happens to this time — anyone who hasn't already been through it. */
export function pickSuccessionTarget(
  rng: Rng,
  livingRivals: readonly Promotion[],
  alreadySucceededIds: readonly Id[],
): Promotion {
  const eligible = livingRivals.filter((r) => !alreadySucceededIds.includes(r.id));
  return pick(rng, eligible);
}

/**
 * Which way the new regime goes. Steady is the most common outcome on
 * purpose — most successions barely register, which is what makes the
 * sharp and weak ones feel like real news when they land.
 */
export function rollHeirBranch(rng: Rng): HeirBranch {
  return weightedPick(rng, [
    ['steady', 45],
    ['sharp', 25],
    ['weak', 30],
  ]);
}

/** Apply the branch to the promotion in place — mutates, the caller owns the draft. */
export function applySuccession(rival: Promotion, branch: HeirBranch, settings: WorldSettings): void {
  switch (branch) {
    case 'steady':
      break;
    case 'sharp':
      rival.rating = clamp(rival.rating + settings.successionRatingBoostSharp, 0, 100);
      rival.reputation = clamp(rival.reputation + settings.successionReputationBoostSharp, 0, 100);
      break;
    case 'weak':
      rival.rating = clamp(rival.rating - settings.successionRatingDropWeak, 0, 100);
      rival.reputation = clamp(rival.reputation - settings.successionReputationDropWeak, 0, 100);
      break;
  }
}
