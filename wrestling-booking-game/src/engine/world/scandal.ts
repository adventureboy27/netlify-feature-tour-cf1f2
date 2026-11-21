// A rival's leadership gets caught in a real scandal — nothing to do with
// in-ring performance, everything to do with who is running the place.
// Real, immediate damage; once per rival, the same "happenedFor" shape as
// rogueTurn. The roster-shedding aftermath (people who want nothing to do
// with the fallout) reuses ownershipShakeup.ts's pickShakeupReleases —
// exactly the reusable sub-story function this system was designed around.

import type { Rng } from '../rng';
import { pick, clamp } from '../rng';
import type { Promotion, WorldSettings } from '../types';

export function eligibleForScandal(
  week: number,
  livingRivals: readonly Promotion[],
  alreadyHappenedIds: readonly string[],
  settings: WorldSettings,
): boolean {
  return week >= settings.scandalEarliestWeek && livingRivals.some((r) => !alreadyHappenedIds.includes(r.id));
}

export function pickScandalTarget(
  rng: Rng,
  livingRivals: readonly Promotion[],
  alreadyHappenedIds: readonly string[],
): Promotion {
  const eligible = livingRivals.filter((r) => !alreadyHappenedIds.includes(r.id));
  return pick(rng, eligible);
}

export interface ScandalOutcome {
  line: string;
}

/** Mutates the rival's rating and reputation directly. */
export function applyScandal(rival: Promotion, settings: WorldSettings): ScandalOutcome {
  rival.rating = clamp(rival.rating - settings.scandalRatingDrop, 0, 100);
  rival.reputation = clamp(rival.reputation - settings.scandalReputationDrop, 0, 100);
  return {
    line: `${rival.name} is in real trouble this week — a genuine scandal at the top of the company, and it is costing them everywhere it can be seen.`,
  };
}
