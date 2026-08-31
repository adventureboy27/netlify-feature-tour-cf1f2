// A roster shake-up when who's in charge changes — the one beat that's the
// same shape whether the trigger is a death, a scandal, a merger, or a
// takeover. Built once, called by whichever story needs it, parameterized
// by who's doing it and (in the wire text the caller writes) why.
//
// Deliberately narrow: this only decides *who* goes. Actually releasing
// them — clearing their contract, adding them to free agency, writing the
// wire line — is the caller's job, the same way every other departure in
// this game goes through storeHelpers.ts's letThemGo rather than this
// pure module reaching into World itself.

import type { Rng } from '../rng';
import { randInt, shuffle } from '../rng';
import type { Id, WorldSettings } from '../types';

/** Which of a roster gets shed. Never more than the roster actually has. */
export function pickShakeupReleases(rng: Rng, rosterIds: readonly Id[], settings: WorldSettings): Id[] {
  if (rosterIds.length === 0) return [];
  const count = Math.min(
    rosterIds.length,
    randInt(rng, settings.shakeupReleaseMin, settings.shakeupReleaseMax),
  );
  return shuffle(rng, [...rosterIds]).slice(0, count);
}
