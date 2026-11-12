// What renting a particular building actually does to a night.
//
// The venue used to be two numbers — seats and rent — and everything else
// about a room was a sentence of flavour text. This is the rest of it: who
// takes a share of what you sell, how much of your rig will physically go
// through the door, whether the room is a room at all, and what happens when
// there is no roof.
//
// Pure. Every function here takes a Venue and gives back a number or a
// sentence; nothing reaches into the world.

import { clamp } from '../rng';
import type { Id, Venue, WorldSettings } from '../types';
import type { WeatherSeverity } from '../../data/weather';
import { PRODUCTION_LADDER, rungById } from './production';

// ---------------------------------------------------------------- the landlord

/**
 * What the building keeps of the gate.
 *
 * On top of the rent, not instead of it. This is the reason a bigger room is
 * not simply better once you can fill it — the house's share grows with the
 * house, so a sell-out in an arena hands over more money than the whole gate
 * of the hall you left behind.
 */
export function houseTakeOfGate(gate: number, venue: Venue): number {
  return Math.round(Math.max(0, gate) * clamp(venue.houseCut, 0, 1));
}

/** What the building keeps of the merch table. */
export function houseTakeOfMerch(merch: number, venue: Venue): number {
  return Math.round(Math.max(0, merch) * clamp(venue.merchCut, 0, 1));
}

/**
 * Everything the promotion owes the building for the night, rent included.
 *
 * One figure because that is how a settlement arrives: a single number on a
 * sheet of paper in a room under the stands, and the booker finds out what
 * the percentage meant after the fact.
 */
export function venueSettlement(gate: number, merch: number, venue: Venue): number {
  return venue.rentalCost + venue.loadIn + houseTakeOfGate(gate, venue) + houseTakeOfMerch(merch, venue);
}

// ---------------------------------------------------------------- what fits

/**
 * The part of the rig that will actually go into this room, bottom of the
 * ladder up.
 *
 * Gear that does not fit stays on the truck: no benefit, and no upkeep either,
 * because it never came off the trailer. Taken bottom-up rather than
 * best-first on purpose — the ring goes in before the video wall, always, and
 * a room that can only take one of them takes the one you cannot run without.
 *
 * This is what stops a company buying its way to a great show in a gym, and it
 * is the quiet pressure that eventually moves a promotion out of the rooms it
 * grew up in.
 */
export function productionInRoom(owned: readonly Id[], venue: Venue): Id[] {
  const has = new Set(owned);
  const fitted: Id[] = [];
  let used = 0;

  for (const rung of PRODUCTION_LADDER) {
    if (!has.has(rung.id)) continue;
    if (used + rung.haulSpace > venue.productionCapacity) continue;
    fitted.push(rung.id);
    used += rung.haulSpace;
  }
  return fitted;
}

/** The rungs that came out of the truck and went straight back in. */
export function productionLeftOnTheTruck(owned: readonly Id[], venue: Venue): Id[] {
  const fitted = new Set(productionInRoom(owned, venue));
  return owned.filter((id) => !fitted.has(id) && rungById(id));
}

/**
 * Said plainly, for the page. Not a warning — §0 — just a fact about the
 * room, available to anybody who reads it before booking rather than after.
 */
export function roomFitLine(owned: readonly Id[], venue: Venue): string | null {
  const stranded = productionLeftOnTheTruck(owned, venue);
  if (stranded.length === 0) return null;

  // Named by the biggest thing left behind rather than listed in full. A room
  // that strands five rungs printed five names, which made every card on the
  // venue page carry the same wall of amber text and told the reader less
  // than one clause would have.
  const worst = PRODUCTION_LADDER.filter((r) => stranded.includes(r.id)).pop();
  const name = worst?.name.toLowerCase() ?? 'some of the rig';

  return stranded.length === 1
    ? `Your ${name} will not fit in here.`
    : `Your ${name} and more besides will not fit in here.`;
}

// ---------------------------------------------------------------- the room itself

/**
 * The building's contribution to how the night was received, before anybody
 * counts the house.
 *
 * Separate from the fullness modifier, which is about how many people came.
 * This is about the room: a bingo hall is hot at four hundred and a convention
 * centre is a shed at eight thousand, and no attendance figure changes either.
 */
export function venueAtmosphereModifier(venue: Venue, settings: WorldSettings): number {
  return venue.atmosphere * settings.venueAtmosphereWeight;
}

/** What the bar and the tuck shop are worth per head, if they are yours at all. */
export function concessionsPerHead(venue: Venue): number {
  return Math.max(0, venue.concessionsPerHead);
}

// ---------------------------------------------------------------- no roof

export interface OpenAirOutcome {
  /** Multiplier on the draw, after the room has had its say. */
  draw: number;
  /** Whether the night is off entirely. */
  cancelled: boolean;
}

/**
 * What the weather does when there is nothing over the crowd.
 *
 * Indoors, bad weather keeps some people at home. Outdoors it is the show:
 * rough weather empties the place and a genuinely severe night takes the card
 * off you whatever you had planned for it. This is the price of the cheap
 * seats by the thousand, and it is charged rarely enough that the fairground
 * is still frequently the right call.
 */
export function openAirWeather(
  weatherDraw: number,
  alreadyCancelled: boolean,
  severity: WeatherSeverity | null,
  venue: Venue,
  settings: WorldSettings,
): OpenAirOutcome {
  if (!venue.outdoor || severity === null || severity === 'flavour') {
    return { draw: weatherDraw, cancelled: alreadyCancelled };
  }

  // A draw of 0.8 indoors is 0.8 - (0.2 * multiplier) in the open.
  const shortfall = Math.max(0, 1 - weatherDraw);
  const draw = Math.max(settings.openAirWorstDraw, 1 - shortfall * settings.openAirWeatherMultiplier);

  return {
    draw,
    // Real weather does not merely thin an outdoor crowd; there is no show.
    // Note this is not a warning the player gets on the night — booking a
    // field *is* the decision, and it was made a week ago with "Open to the
    // sky" written on the room. §0.
    cancelled: alreadyCancelled || severity === 'notable' || severity === 'severe' || severity === 'catastrophe',
  };
}

// ---------------------------------------------------------------- reading a room

/**
 * The facilities, in words, for the venue list.
 *
 * Only the things that are unusual about this particular room get a line —
 * a page where every building says "the bar is yours" teaches nobody anything.
 */
export function venueFacilities(venue: Venue, settings: WorldSettings): string[] {
  const notes: string[] = [];

  if (venue.outdoor) notes.push('Open to the sky');
  if (venue.houseCut >= settings.venueHeavyCut) notes.push('The house takes a heavy cut of the gate');
  else if (venue.houseCut > 0) notes.push('The house takes a share of the gate');
  if (venue.merchCut >= settings.venueHeavyCut) notes.push('And a large slice of the merch table');
  else if (venue.merchCut > 0) notes.push('And a slice of the merch table');

  if (venue.concessionsPerHead <= 0) notes.push('The bar is theirs, all of it');
  else if (venue.concessionsPerHead >= settings.venueGoodBar) notes.push('The bar takings are yours');
  else if (venue.concessionsPerHead < settings.venuePoorBar) notes.push('Barely a concession stand');

  if (venue.atmosphere >= settings.venueGreatRoom) notes.push('A wonderful room to work');
  else if (venue.atmosphere <= settings.venuePoorRoom) notes.push('It has never sounded loud in here');

  if (venue.loadIn >= settings.venueHardLoadIn) notes.push('An awkward, expensive load-in');

  return notes;
}

/** How much of the rig this room takes, said without a number. */
export function venueRigLine(venue: Venue): string {
  const whole = PRODUCTION_LADDER.reduce((sum, r) => sum + r.haulSpace, 0);
  const share = venue.productionCapacity / Math.max(whole, 1);
  if (share >= 1) return 'Takes the whole production';
  if (share >= 0.6) return 'Takes most of the production';
  if (share >= 0.3) return 'Takes about half the production';
  return 'Takes very little production';
}
