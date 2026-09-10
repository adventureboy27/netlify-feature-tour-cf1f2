// Whether tonight's feed actually held — see docs/BACKLOG.md's Phase F entry.
//
// A dark match (sim/darkMatch.ts) never had cameras on it in the first place.
// This is the other way a match can go unseen: it was supposed to air, the
// cameras were rolling, and something in the truck let go partway through.
// Reuses the exact same downstream treatment a dark match gets — excluded
// from the show's rating, and its participants' popularity gain dampened by
// settings.darkMatchPopularityShare, because a match nobody at home saw is
// worth the same to a career either way it happened.
//
// Once per show, not once per match — a feed does not drop twice
// independently in one night in any believable way. Worse camera/production
// gear makes it likelier, via the same equipmentInjuryReduction Phase C
// already wired up for everything else in this stack.

import type { Rng } from '../rng';
import { chance, pick } from '../rng';
import type { WorldSettings } from '../types';

/**
 * Which match slot the feed dropped during, or null if the broadcast held.
 *
 * `eligibleSlots` should be the indices of real matches only — the same
 * two-or-more-sides-with-real-participants filter the show's own rating
 * tally already applies, so this never picks a slot that wouldn't have
 * counted toward the rating anyway.
 */
export function rollBroadcastDropout(
  rng: Rng,
  eligibleSlots: readonly number[],
  equipmentInjuryReduction: number,
  settings: WorldSettings,
): number | null {
  if (eligibleSlots.length === 0) return null;
  const odds = settings.broadcastDropoutChance * (1 - equipmentInjuryReduction);
  if (!chance(rng, odds)) return null;
  return pick(rng, eligibleSlots);
}

const DROPOUT_LINES = [
  'Technical difficulties knocked the broadcast dark right in the middle of {match}, and nobody watching at home saw a second of it.',
  'The feed went down during {match} and never came back before the bell. Anybody who tuned in missed the whole thing.',
  'Whatever went out over the air during {match}, it was not the match — the picture was just gone.',
];

/** The write-up line for a dropped feed, naming the match it happened in. */
export function broadcastDropoutLine(rng: Rng, matchDescription: string): string {
  return pick(rng, DROPOUT_LINES).replace('{match}', matchDescription);
}
