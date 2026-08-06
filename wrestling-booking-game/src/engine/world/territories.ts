// Territories — §16.
//
// A promotion is not one audience, it is twelve of them, and each has its own
// memory of you. Run a good show in a town and more of it turns out next time;
// stay away and it forgets you at a steady, unforgiving rate. That decay is
// the whole system: it is what stops the player finding the one big market and
// running there every week forever, and it is what makes a touring schedule a
// real decision rather than a menu.
//
// Territories also have taste. The preference weights are a rating modifier
// applied to the show, so the card that drew a riot in the hardcore parish
// gets sat on its hands in the town that came for chain wrestling. Same card,
// same wrestlers, different night.
//
// Nothing here writes to the world. Every function takes what it needs and
// returns a number or a decision; the store applies it.

import type { Id, Territory, TerritoryPreferenceTag, WorldSettings, Wrestler } from '../types';

/** How over a promotion is in a town. Nobody starts over anywhere. */
export function followingOf(territory: Territory, promotionId: Id): number {
  return territory.following[promotionId] ?? 0;
}

/**
 * What running here tonight did for you. Following is earned by the show, not
 * by showing up — a bad card in a good town moves almost nothing.
 */
export function followingGain(showStars: number, settings: WorldSettings): number {
  return showStars * settings.territoryFollowingPerStar;
}

/**
 * And what staying away costs. Applied to every territory a promotion did not
 * run in this week, which is eleven of the twelve.
 */
export function followingDecay(settings: WorldSettings): number {
  return settings.territoryFollowingDecayPerWeek;
}

/** Which tags a card actually delivered on, 0-1 each. */
export interface CardTraits {
  /** Share of competitors who work as faces / as heels. */
  faces: number;
  heels: number;
  /** Share of the card that was hardcore, technical, high-flying, women's. */
  hardcore: number;
  technical: number;
  highFlying: number;
  womensWrestling: number;
  /** Average booked match length against the settings' idea of a long match. */
  longMatches: number;
  /** How big the biggest name on the card is, 0-1. */
  starPower: number;
}

const TAGS: TerritoryPreferenceTag[] = [
  'faces',
  'heels',
  'hardcore',
  'technical',
  'highFlying',
  'womensWrestling',
  'longMatches',
  'starPower',
];

/**
 * How much a town liked the shape of this card, as a rating modifier.
 *
 * A weight of +1 met in full is worth the whole bonus; a weight of -1 met in
 * full costs the same. A card that delivers nothing a town wants is neutral
 * rather than punished — you are only punished for giving them what they
 * actively do not want.
 */
export function territoryFit(territory: Territory, traits: CardTraits, settings: WorldSettings): number {
  let total = 0;
  for (const tag of TAGS) {
    const weight = territory.preferenceWeights[tag];
    if (weight === undefined) continue;
    total += weight * traits[tag];
  }
  return total * settings.territoryFitRatingWeight;
}

/**
 * Running in somebody else's town. Not forbidden, and not free: an invasion
 * damages the owner's following and is how a promotion is driven off the map.
 */
export function isInvasion(territory: Territory, promotionId: Id): boolean {
  return territory.ownerPromotionId !== null && territory.ownerPromotionId !== promotionId;
}

/** What an invasion does to the promotion that holds the town. */
export function invasionDamage(showStars: number, settings: WorldSettings): number {
  return showStars * settings.territoryInvasionDamagePerStar;
}

/**
 * Whether tonight's house claims the town.
 *
 * A territory is claimed by drawing the biggest crowd anybody ever has there.
 * Unclaimed towns fall to whoever sets the first real record; a held town
 * changes hands only by beating the record that holds it — which is why an
 * invasion is a statement rather than a formality.
 */
export function claimsTerritory(
  record: AttendanceRecord | undefined,
  attendance: number,
  settings: WorldSettings,
): boolean {
  if (attendance < settings.territoryClaimMinimumAttendance) return false;
  if (!record) return true;
  return attendance > record.attendance;
}

/** The biggest crowd a town has ever drawn, and who drew it. */
export interface AttendanceRecord {
  territoryId: Id;
  promotionId: Id;
  attendance: number;
  week: number;
}

/**
 * Read a card's shape for the preference check.
 *
 * Deliberately built from what was actually booked rather than from the
 * promotion's stated identity: a hardcore company that ran six technical
 * matches has run a technical show, whatever it calls itself.
 */
export function readCardTraits(
  matches: {
    participants: Wrestler[];
    violenceLevel: number;
    lengthMinutes: number;
  }[],
  settings: WorldSettings,
): CardTraits {
  const empty: CardTraits = {
    faces: 0,
    heels: 0,
    hardcore: 0,
    technical: 0,
    highFlying: 0,
    womensWrestling: 0,
    longMatches: 0,
    starPower: 0,
  };
  if (matches.length === 0) return empty;

  const everybody = matches.flatMap((m) => m.participants);
  if (everybody.length === 0) return empty;

  const shareOf = (predicate: (w: Wrestler) => boolean) =>
    everybody.filter(predicate).length / everybody.length;

  const styleShare = (styles: readonly string[]) =>
    shareOf((w) => styles.includes(w.style as string));

  return {
    faces: shareOf((w) => w.alignment > 0),
    heels: shareOf((w) => w.alignment < 0),
    hardcore:
      matches.reduce((sum, m) => sum + Math.min(1, m.violenceLevel / settings.territoryHardcoreFullViolence), 0) /
      matches.length,
    technical: styleShare(['technical', 'submission', 'oldSchool']),
    highFlying: styleShare(['highFlyer', 'luchador']),
    womensWrestling: shareOf((w) => w.gender === 'f'),
    longMatches:
      matches.reduce((sum, m) => sum + Math.min(1, m.lengthMinutes / settings.territoryLongMatchMinutes), 0) /
      matches.length,
    starPower: Math.max(0, ...everybody.map((w) => w.popularity)) / 100,
  };
}

/**
 * Which buildings make sense in a market this size. You cannot put an
 * eighteen-thousand-seat arena in a town of two thousand, however much money
 * you have.
 */
export function venueFitsTerritory(venueCapacity: number, territoryCapacity: number): boolean {
  return venueCapacity <= territoryCapacity;
}

/** Where a promotion is most over, for the AI picking somewhere to run. */
export function strongestTerritory(territories: readonly Territory[], promotionId: Id): Territory | undefined {
  return [...territories].sort((a, b) => followingOf(b, promotionId) - followingOf(a, promotionId))[0];
}
