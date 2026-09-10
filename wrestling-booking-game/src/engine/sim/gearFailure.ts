// Which specific unit gave out, once the match has already decided that
// something did — modeled directly on sim/pyro.ts's rollPyroBurn.
//
// This never decides *whether* the gear fails — that's simulateMatch.ts's
// job, via rollFinish's weighted pick landing on 'equipmentFailure'. By the
// time this runs, the finish is already settled; all this does is name
// which of tonight's assigned units gets blamed, weighted toward whichever
// one was worn worst.

import type { Rng } from '../rng';
import { weightedPick } from '../rng';
import type { Id } from '../types';

export interface GearUnitInPlay {
  id: Id;
  name: string;
  /** 0-100. */
  condition: number;
}

export interface GearFailureOutcome {
  unitId: Id;
  /** What the write-up says happened. Never empty — see CLAUDE.md's §0. */
  text: string;
}

export function rollGearFailure(rng: Rng, units: readonly GearUnitInPlay[]): GearFailureOutcome | null {
  if (units.length === 0) return null;
  const chosen = weightedPick(rng, units.map((u) => [u, Math.max(1, 100 - u.condition)] as const));
  return {
    unitId: chosen.id,
    text: `The ${chosen.name.toLowerCase()} gave out completely, right there in the middle of the match.`,
  };
}
