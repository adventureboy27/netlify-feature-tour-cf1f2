// Where somebody is actually over.
//
// Popularity was one number, and one number means a wrestler draws the same
// house in every town on the map. That is not how any of this has ever worked
// — the whole territory era was built on the opposite fact — and it quietly
// made two systems I had already built into scenery. The circuits ranked
// people by taste-fit alone. The map was a picture.
//
// Worse, `Wrestler.homeTerritoryId` had been on the type the whole time,
// written once at generation as the literal string 'territory-unassigned',
// and read by nothing anywhere in the game. A hometown pop was not unbuilt;
// it was inexpressible.
//
// So: standing is per town, and the national number becomes what it should
// always have been — reputation, which travels, rather than a draw, which
// does not.
//
//   A national star is known everywhere and slightly better than his local
//   number wherever he goes. That is what national fame buys.
//
//   A local hero out-draws him at home and nobody has heard of him two
//   states over. That is what a territory is.
//
//   Working a town builds you there. Not working it lets you fade there,
//   slowly, and never below what your national reputation carries. You
//   cannot be forgotten somewhere while you are famous everywhere.
//
// The decision this creates is the one the map was always supposed to pose:
// a roster built in one region is cheap and safe and does not travel, and the
// week you expand you find out how much of your business was the towns rather
// than the people.

import { clamp } from '../rng';
import type { Id, Wrestler, WorldSettings } from '../types';

/**
 * What somebody is worth in one particular town, 0-100.
 *
 * A blend of what they are nationally and what they are here. The national
 * share is deliberately the larger half: this is a business where television
 * exists, and a genuine star is a genuine star everywhere. The local half is
 * what makes a town yours.
 */
export function popularityIn(
  wrestler: Wrestler,
  territoryId: Id,
  settings: WorldSettings,
): number {
  const s = settings;
  const local = localStanding(wrestler, territoryId, settings);
  return clamp(
    wrestler.popularity * s.reachNationalShare + local * (1 - s.reachNationalShare),
    0,
    100,
  );
}

/**
 * What they are in this town on its own, before national reputation is added.
 *
 * Somewhere they have never worked, this is a fraction of their national
 * profile — word travels, but hearing about somebody is not the same as
 * having seen them. Their hometown starts ahead of that, because it is theirs.
 */
export function localStanding(
  wrestler: Wrestler,
  territoryId: Id,
  settings: WorldSettings,
): number {
  const stored = wrestler.regionalPopularity?.[territoryId];
  if (typeof stored === 'number') return clamp(stored, 0, 100);
  const unseen = wrestler.popularity * settings.reachUnseenShare;
  if (!isHometown(wrestler, territoryId)) return clamp(unseen, 0, 100);
  // Home is the national number plus a bump, not a fraction of it plus a
  // bump. Measured the other way round, somebody at 50 came out at exactly 50
  // in their own town — no hometown advantage at all — because the unseen
  // discount ate the whole head start. Where you are from is the one place
  // that is never a strange town.
  return clamp(wrestler.popularity + settings.reachHometownHead, 0, 100);
}

/** Is this where they are from? */
export function isHometown(wrestler: Wrestler, territoryId: Id): boolean {
  return Boolean(wrestler.homeTerritoryId) && wrestler.homeTerritoryId === territoryId;
}

/**
 * What working a town does for you there.
 *
 * Scaled by how the match went, because being on the show is not the same as
 * being good on the show, and by how far below your national profile you
 * currently are here — the first night in a new town moves the needle much
 * further than the fiftieth in your own.
 */
export function workingGain(
  wrestler: Wrestler,
  territoryId: Id,
  matchRating: number,
  settings: WorldSettings,
): number {
  const s = settings;
  const here = localStanding(wrestler, territoryId, settings);
  const room = Math.max(0, s.reachLocalCeiling - here) / s.reachLocalCeiling;
  const quality = clamp(matchRating / 100, 0, 1);
  const home = isHometown(wrestler, territoryId) ? s.reachHometownGainBonus : 1;
  return (s.reachGainBase + quality * s.reachGainPerQuality) * room * home;
}

/**
 * What a week away from a town costs you there.
 *
 * Never below the floor their national reputation holds up — being famous is
 * exactly the thing that stops a town forgetting you. A nobody fades to
 * nothing; a household name never does.
 */
export function absenceDecay(
  wrestler: Wrestler,
  territoryId: Id,
  settings: WorldSettings,
): number {
  const floor = wrestler.popularity * settings.reachUnseenShare;
  const here = localStanding(wrestler, territoryId, settings);
  if (here <= floor) return 0;
  return Math.min(settings.reachDecayPerWeek, here - floor);
}

/** Apply a change to one town. Mutates, because the caller owns a draft. */
export function setLocal(wrestler: Wrestler, territoryId: Id, value: number): void {
  if (!wrestler.regionalPopularity) wrestler.regionalPopularity = {};
  wrestler.regionalPopularity[territoryId] = clamp(value, 0, 100);
}

/**
 * How far somebody's name actually carries, in words.
 *
 * The single most useful thing to know about a roster you are thinking of
 * taking on the road, and the reason this system is worth having a readout
 * for at all.
 */
export type Reach = 'national' | 'regional' | 'local' | 'unknown';

export function reachOf(wrestler: Wrestler, settings: WorldSettings): Reach {
  if (wrestler.popularity >= settings.reachNationalPopularity) return 'national';
  const towns = Object.values(wrestler.regionalPopularity ?? {}).filter(
    (v): v is number => typeof v === 'number' && v >= settings.reachKnownHere,
  ).length;
  if (towns >= settings.reachRegionalTowns) return 'regional';
  if (towns >= 1) return 'local';
  return 'unknown';
}

export function reachLabel(reach: Reach): string {
  switch (reach) {
    case 'national':
      return 'Known everywhere';
    case 'regional':
      return 'Known in the region';
    case 'local':
      return 'A local draw';
    case 'unknown':
      return 'Nobody has seen him';
  }
}

/** The towns somebody is genuinely over in, strongest first. */
export function strongholds(
  wrestler: Wrestler,
  settings: WorldSettings,
  limit = 3,
): { territoryId: Id; standing: number }[] {
  return Object.entries(wrestler.regionalPopularity ?? {})
    .filter((entry): entry is [Id, number] => typeof entry[1] === 'number' && entry[1] >= settings.reachKnownHere)
    .map(([territoryId, standing]) => ({ territoryId, standing }))
    .sort((a, b) => b.standing - a.standing)
    .slice(0, limit);
}

/**
 * Everybody on a card, weighed for the town it is actually in.
 *
 * This is the number the gate should be reading. Using the national one meant
 * a card of local heroes drew the same in their own back yard as it did four
 * hundred miles away, which is the specific thing this whole module exists to
 * stop.
 */
export function cardDrawIn(
  cast: readonly Wrestler[],
  territoryId: Id,
  settings: WorldSettings,
): number {
  if (cast.length === 0) return 0;
  return cast.reduce((sum, w) => sum + popularityIn(w, territoryId, settings), 0) / cast.length;
}

/** How much better (or worse) somebody is here than their national number. */
export function homeAdvantage(
  wrestler: Wrestler,
  territoryId: Id,
  settings: WorldSettings,
): number {
  return popularityIn(wrestler, territoryId, settings) - wrestler.popularity;
}
