// Two existing rivals go after each other, publicly — nothing to do with
// the player at all. Purely flavor with a real, asymmetric consequence: one
// side wins the exchange and gets a real bump, the other pays for it.
//
// Once per rival, either side: reuses the same "happenedFor" tracking shape
// as rogueTurn/scandal/breakawayPromotion (World.worldStoryHappenedFor),
// both promotions in the pair marked so neither is picked into a second
// rivalry. Originally had no cooldown at all — combined with the story-roll
// seed bug (see state/store.ts), this one in particular ended up firing far
// more than any other story in the registry, confirmed by playing many
// seeds out with tools/probe.mjs.

import type { Rng } from '../rng';
import { chance, clamp, shuffle } from '../rng';
import type { Promotion, WorldSettings } from '../types';

export function eligibleForOwnerRivalry(
  week: number,
  livingRivals: readonly Promotion[],
  alreadyHappenedIds: readonly string[],
  settings: WorldSettings,
): boolean {
  const eligible = livingRivals.filter((r) => !alreadyHappenedIds.includes(r.id));
  return week >= settings.ownerRivalryEarliestWeek && eligible.length >= 2;
}

/** Two distinct rivals, neither already through a rivalry, picked at random. */
export function pickOwnerRivalryPair(
  rng: Rng,
  livingRivals: readonly Promotion[],
  alreadyHappenedIds: readonly string[],
): [Promotion, Promotion] {
  const eligible = livingRivals.filter((r) => !alreadyHappenedIds.includes(r.id));
  const [a, b] = shuffle(rng, eligible);
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
