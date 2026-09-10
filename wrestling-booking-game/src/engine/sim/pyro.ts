// Pyro: the thing everybody remembers, and — every so often — the thing that
// catches somebody on the way to the ring.
//
// Modeled directly on sim/ringcraft.ts's rollBotch: its own risk formula, its
// own line, and a `hurtSomebody` flag the caller folds into the general
// injury chain the same way a blown spot already does. It never fires at all
// unless the show actually fired pyro that night — see data/production.ts's
// pyroCharges/pyroRig and economy/production.ts's pyro rung — and cheaper
// gear (a lower equipmentInjuryReduction) makes it likelier when it can fire
// at all, same plumbing Phase C already wired up for everything else.
//
// Deliberately rare, and deliberately minor when it lands — a scorch, not a
// catastrophe. This is the downside half of buying pyro; the upside (rating,
// attendance) is already real. See CLAUDE.md: every purchase needs a genuine
// upside, and the cheap version of anything that can hurt somebody should be
// able to.

import type { Rng } from '../rng';
import { chance, pick } from '../rng';
import type { WorldSettings } from '../types';

/** Everything the roll needs from a participant. */
export type PyroWorker = { id: string; name: string };

export type PyroBurn = {
  /** Who caught it. */
  workerId: string;
  workerName: string;
  /** What the crowd saw, in the write-up's words. */
  text: string;
  /** Rating cost — a spooked crowd and a stopped entrance is not the show anybody paid to see. */
  ratingCost: number;
  /** Whether it left a real mark. The general injury chain still decides what, and how long. */
  hurtSomebody: boolean;
};

const PYRO_LINES = [
  '{who} did not get clear of the pyro in time on the way to that ring, and everybody in the building saw it happen.',
  'A charge went off closer to the entrance than it should have, and {who} caught more of that heat than anybody wanted.',
  '{who} walked right through where that pyro was supposed to have already cleared.',
];

/**
 * Did the entrance pyro catch somebody tonight.
 *
 * Only ever rolls at all when the show actually fired pyro — see the
 * `pyroActive` flag, fed by whether the pyro rung or the pyro-charges show
 * extra is in play. Cheaper production makes it likelier when it can happen,
 * same as everything else `equipmentInjuryReduction` already touches.
 */
export function rollPyroBurn(
  rng: Rng,
  workers: readonly PyroWorker[],
  pyroActive: boolean,
  equipmentInjuryReduction: number,
  settings: WorldSettings,
): PyroBurn | null {
  if (!pyroActive || workers.length === 0) return null;

  const odds = settings.pyroBurnChance * (1 - equipmentInjuryReduction);
  if (!chance(rng, odds)) return null;

  const victim = pick(rng, workers);
  const hurtSomebody = chance(rng, settings.pyroBurnInjuryShare);

  return {
    workerId: victim.id,
    workerName: victim.name,
    text: pick(rng, PYRO_LINES).replace('{who}', victim.name),
    ratingCost: settings.pyroBurnRatingCost,
    hurtSomebody,
  };
}
