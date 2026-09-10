// The billionaire merger — §16-adjacent, a one-time late-game escalation.
//
// An outside buyer with real money acquires the two strongest surviving
// rivals. She does not fold them into one company; she keeps both running as
// separate shows, under a shared brand, split East and West. The two halves
// come out of it stronger — her money shows up as rating and bankroll — and
// far colder to anybody who is not their own sibling: getting either of them
// to share a building with an outsider now costs a great deal more than it
// used to.
//
// This never reverses and, in this build, never repeats: once it has
// happened it is simply the new shape of the business for the rest of the
// save. See World.mergerHappened.

import type { Rng } from '../rng';
import { pick } from '../rng';
import type { Id, Promotion, WorldSettings } from '../types';

const BRANDS = ['Vantage', 'Colossus', 'Dominion', 'Paragon', 'Highgate', 'Blackwell'];

const BUYERS = ['Adaline Voss', 'Imogen Blackwood', 'Vivienne Cross', 'Theodora Lang', 'Odalys Reyes'];

export interface MergerTargets {
  east: Promotion;
  west: Promotion;
  brand: string;
  buyer: string;
}

/**
 * Whether the business is even old enough, and big enough, for a merger to
 * make sense. Two companies to buy is not enough on its own — there has to be
 * at least one more left over besides the player, or the "remaining
 * companies" this is supposed to make life harder for would not exist.
 */
export function eligibleForMerger(
  week: number,
  livingRivals: readonly Promotion[],
  alreadyHappened: boolean,
  settings: WorldSettings,
): boolean {
  if (alreadyHappened) return false;
  if (week < settings.mergerEarliestWeek) return false;
  return livingRivals.length >= settings.mergerMinLivingRivals;
}

/**
 * Who gets bought. The two strongest survivors — a buyer with this kind of
 * money is not interested in a struggling regional outfit, she wants the two
 * companies already worth something.
 */
export function pickMergerTargets(rng: Rng, livingRivals: readonly Promotion[]): [Promotion, Promotion] {
  const ranked = [...livingRivals].sort((a, b) => b.rating - a.rating);
  const [first, second] = ranked;
  // Which one ends up East and which West is not a rating question — it is
  // presentation, and presentation is the one thing left to the draw.
  return pick(rng, [
    [first!, second!],
    [second!, first!],
  ]);
}

/** The new shared names, and who is doing the buying. */
export function nameMerger(rng: Rng): { brand: string; buyer: string } {
  return { brand: pick(rng, BRANDS), buyer: pick(rng, BUYERS) };
}

/**
 * Apply the buyout to both halves in place — mutates, because the caller
 * owns a draft. Renames, boosts rating and bankroll, and stamps the shared
 * `conglomerateId` every other system reads to recognise the pair.
 */
export function applyMerger(
  east: Promotion,
  west: Promotion,
  conglomerateId: Id,
  brand: string,
  settings: WorldSettings,
): void {
  east.name = `${brand} East`;
  west.name = `${brand} West`;
  for (const half of [east, west]) {
    half.conglomerateId = conglomerateId;
    half.rating = Math.min(100, half.rating + settings.mergerRatingBoost);
    half.bankBalance += settings.mergerBankInjection;
  }
}

/** Is this promotion part of the conglomerate, and not the given side's own sibling? */
export function isHostileOutsider(them: Promotion, us: Promotion): boolean {
  return Boolean(them.conglomerateId) && them.conglomerateId !== us.conglomerateId;
}
