// Two existing rivals go after each other, publicly — nothing to do with
// the player at all. Purely flavor with a real, asymmetric consequence: one
// side wins the exchange and gets a real bump, the other pays for it.

import type { Rng } from '../rng';
import { chance, clamp, shuffle } from '../rng';
import type { Promotion, WorldSettings } from '../types';

export function eligibleForOwnerRivalry(
  week: number,
  livingRivals: readonly Promotion[],
  settings: WorldSettings,
): boolean {
  return week >= settings.ownerRivalryEarliestWeek && livingRivals.length >= 2;
}

/** Two distinct rivals, picked at random. */
export function pickOwnerRivalryPair(rng: Rng, livingRivals: readonly Promotion[]): [Promotion, Promotion] {
  const [a, b] = shuffle(rng, livingRivals);
  return [a!, b!];
}

export interface OwnerRivalryOutcome {
  winner: Promotion;
  loser: Promotion;
  line: string;
}

export function applyOwnerRivalry(
  rng: Rng,
  a: Promotion,
  b: Promotion,
  settings: WorldSettings,
): OwnerRivalryOutcome {
  const aWins = chance(rng, 0.5);
  const winner = aWins ? a : b;
  const loser = aWins ? b : a;
  winner.rating = clamp(winner.rating + settings.ownerRivalryRatingSwing, 0, 100);
  loser.rating = clamp(loser.rating - settings.ownerRivalryRatingSwing / 2, 0, 100);
  return {
    winner,
    loser,
    line: `${winner.name} and ${loser.name} have been going at each other publicly all week, and ${winner.name} is the one who came out of it looking better.`,
  };
}
