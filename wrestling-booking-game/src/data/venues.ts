// Venues — rented for every single show, never owned.
//
// The rent is the promotion's biggest fixed risk. A school gym costs almost
// nothing and caps your gate at a few hundred people; a stadium can hold
// forty thousand and will happily bankrupt you if eight thousand turn up. The
// decision every week is whether you believe your own card.
//
// `minCompanyRating` is the other half of it: a real arena does not rent to a
// promotion nobody has heard of. You grow into the buildings.
//
// ---------------------------------------------------------------------------
// Why this is a list of choices rather than a ladder
// ---------------------------------------------------------------------------
//
// The first version of this file was nine rooms in a straight line, each one
// bigger and dearer than the last, and every one of them strictly better than
// the one below it the moment you could fill it. There was no decision in it —
// only a queue. So each tier now holds several rooms of similar size that make
// their money in different ways, and picking between them is a real question:
//
//   - **The house takes a cut.** Halls charge rent and walk away. Arenas
//     charge rent *and* a share of the gate, so the better you draw the more
//     they take. You cannot get rich in somebody else's building.
//   - **The bar is not always yours.** A VFW hall hands you the takings
//     because the bar is the reason they rent to you. A casino keeps every
//     cent, a school keeps the tuck shop for the PTA, and a hotel has a
//     catering contract older than your promotion.
//   - **The merch table has a landlord too**, in the buildings big enough to
//     employ somebody to notice it.
//   - **The ceiling is a real ceiling.** `productionCapacity` is in the same
//     haul units as the production ladder. A gym cannot hang a lighting rig
//     and has nowhere to put a video wall, so the gear you paid for stays on
//     the truck. This is the quiet pressure that pushes a company with a rig
//     out of the rooms it grew up in.
//   - **Some rooms are simply better rooms.** `atmosphere` is the character
//     of the building whether or not it is full — a bingo hall is hot at four
//     hundred and a convention centre is a carpeted box at eight thousand.
//   - **Some rooms have no roof.** Cheap seats by the thousand, and a sky.
//
// The result is that the obvious pick is often wrong. The fairground holds
// seven times what the armory holds for less rent — and one storm takes the
// night off you.

import type { Venue } from '../engine/types';

export const VENUES: Venue[] = [
  // ---------------------------------------------------------------- open to all
  {
    id: 'schoolGym',
    name: 'School Gymnasium',
    kind: 'hall',
    capacity: 250,
    rentalCost: 350,
    prestige: 2,
    minCompanyRating: 0,
    blurb: 'Folding chairs, squeaky floors, and a scoreboard nobody ever turns off.',
    houseCut: 0,
    // The PTA runs the tuck shop and the PTA keeps it.
    concessionsPerHead: 0.4,
    merchCut: 0,
    productionCapacity: 4,
    atmosphere: 2,
    loadIn: 0,
    outdoor: false,
  },
  {
    id: 'vfwHall',
    name: 'VFW Hall',
    kind: 'hall',
    capacity: 400,
    rentalCost: 650,
    prestige: 6,
    minCompanyRating: 0,
    blurb: 'Low ceiling, dirt-cheap bar, and regulars loyal enough to run through a wall for this place.',
    houseCut: 0,
    // The bar is the whole reason they rent to you, and it is yours.
    concessionsPerHead: 2.6,
    merchCut: 0,
    productionCapacity: 5,
    atmosphere: 5,
    loadIn: 0,
    outdoor: false,
  },
  {
    id: 'fleaMarket',
    name: 'Flea Market Pavilion',
    kind: 'hall',
    capacity: 550,
    rentalCost: 480,
    prestige: 4,
    minCompanyRating: 0,
    blurb: 'Concrete floor, roll-up doors, and a cold draft off the loading bay that never quits.',
    houseCut: 0,
    concessionsPerHead: 0.9,
    merchCut: 0,
    productionCapacity: 6,
    // A shed is a shed however many people are in it.
    atmosphere: -1,
    loadIn: 200,
    outdoor: false,
  },
  {
    id: 'unionHall',
    name: 'Union Hall',
    kind: 'hall',
    capacity: 700,
    rentalCost: 1_100,
    prestige: 11,
    minCompanyRating: 10,
    blurb: 'They have run meetings in this hall for sixty straight years. They flat-out know how to fill a room.',
    houseCut: 0,
    concessionsPerHead: 2.4,
    merchCut: 0,
    productionCapacity: 6,
    atmosphere: 6,
    loadIn: 0,
    outdoor: false,
  },

  // ---------------------------------------------------------------- territory days
  {
    id: 'bingoHall',
    name: 'Bingo Hall',
    kind: 'hall',
    capacity: 800,
    rentalCost: 1_400,
    prestige: 13,
    minCompanyRating: 18,
    blurb: 'Close enough to that ring to hear every single boot. Not one bad seat in the house.',
    houseCut: 0,
    concessionsPerHead: 2.2,
    merchCut: 0,
    productionCapacity: 6,
    // The hottest small room in the game, and it stays that way.
    atmosphere: 8,
    loadIn: 0,
    outdoor: false,
  },
  {
    id: 'nationalGuardArmory',
    name: 'National Guard Armory',
    kind: 'hall',
    capacity: 1_100,
    rentalCost: 1_900,
    prestige: 16,
    minCompanyRating: 22,
    blurb: 'The traditional home of territory wrestling, and it still feels exactly like it.',
    houseCut: 0,
    concessionsPerHead: 1.9,
    merchCut: 0,
    productionCapacity: 9,
    atmosphere: 5,
    loadIn: 0,
    outdoor: false,
  },
  {
    id: 'rollerRink',
    name: 'Roller Rink',
    kind: 'club',
    capacity: 1_300,
    rentalCost: 2_400,
    prestige: 18,
    minCompanyRating: 24,
    blurb: 'A disco ball spinning overhead, a snack counter, and a floor that has genuinely seen worse.',
    houseCut: 0.04,
    concessionsPerHead: 2.5,
    merchCut: 0,
    productionCapacity: 8,
    atmosphere: 4,
    loadIn: 150,
    outdoor: false,
  },
  {
    id: 'countyFairground',
    name: 'County Fairground',
    kind: 'openAir',
    capacity: 2_600,
    rentalCost: 1_600,
    prestige: 15,
    minCompanyRating: 20,
    blurb: 'Grandstand seating for the price of a hall. Bring a tarp, just in case.',
    houseCut: 0,
    concessionsPerHead: 2.1,
    merchCut: 0,
    productionCapacity: 12,
    atmosphere: 3,
    loadIn: 450,
    // The first real gamble on the list: seven times the armory's seats for
    // less than its rent, and a sky over all of them.
    outdoor: true,
  },

  // ---------------------------------------------------------------- going somewhere
  {
    id: 'recCenter',
    name: 'Community Recreation Center',
    kind: 'hall',
    capacity: 1_600,
    rentalCost: 3_000,
    prestige: 21,
    minCompanyRating: 30,
    blurb: 'Municipal, strip-lit, and available every single week of the year, rain or shine.',
    houseCut: 0.03,
    concessionsPerHead: 1.4,
    merchCut: 0,
    productionCapacity: 10,
    atmosphere: 1,
    loadIn: 0,
    outdoor: false,
  },
  {
    id: 'hotelBallroom',
    name: 'Hotel Ballroom',
    kind: 'club',
    capacity: 1_400,
    rentalCost: 4_100,
    prestige: 26,
    minCompanyRating: 32,
    blurb: 'Chandeliers overhead, a catering contract older than your entire promotion, and valet parking out front.',
    houseCut: 0.08,
    // The hotel has held the bar contract since 1961 and is not sharing it.
    concessionsPerHead: 0.3,
    merchCut: 0.1,
    productionCapacity: 7,
    atmosphere: 3,
    loadIn: 350,
    outdoor: false,
  },
  {
    id: 'conferenceCenter',
    name: 'Conference Center',
    kind: 'hall',
    capacity: 2_000,
    rentalCost: 4_400,
    prestige: 22,
    minCompanyRating: 35,
    blurb: 'Carpeted, well lit, and they will bill you for every single extra chair.',
    houseCut: 0.05,
    concessionsPerHead: 1.1,
    merchCut: 0.05,
    productionCapacity: 11,
    // Nothing that happens in here has ever sounded loud.
    atmosphere: -3,
    loadIn: 0,
    outdoor: false,
  },
  {
    id: 'iceRink',
    name: 'Ice Rink',
    kind: 'arena',
    capacity: 2_800,
    rentalCost: 5_600,
    prestige: 29,
    minCompanyRating: 38,
    blurb: 'They board right over the ice for you. It stays cold in there anyway.',
    houseCut: 0.06,
    concessionsPerHead: 2.0,
    merchCut: 0.05,
    productionCapacity: 15,
    atmosphere: -1,
    loadIn: 600,
    outdoor: false,
  },

  // ---------------------------------------------------------------- a real company
  {
    id: 'theater',
    name: 'Civic Theater',
    kind: 'theatre',
    capacity: 2_400,
    rentalCost: 8_000,
    prestige: 34,
    minCompanyRating: 45,
    blurb: 'Every single seat has a good view. These acoustics do half your work for you.',
    houseCut: 0.05,
    concessionsPerHead: 1.6,
    merchCut: 0.08,
    // Built for an orchestra. There is no fly space and no dock.
    productionCapacity: 8,
    atmosphere: 9,
    loadIn: 900,
    outdoor: false,
  },
  {
    id: 'casinoShowroom',
    name: 'Casino Showroom',
    kind: 'club',
    capacity: 1_900,
    rentalCost: 6_800,
    prestige: 41,
    minCompanyRating: 46,
    blurb: 'They want this room packed and they want every single dollar spent inside it.',
    // The most expensive landlord in the game, and the best address at this size.
    houseCut: 0.16,
    concessionsPerHead: 0,
    merchCut: 0.22,
    productionCapacity: 9,
    atmosphere: 7,
    loadIn: 400,
    outdoor: false,
  },
  {
    id: 'universityFieldhouse',
    name: 'University Fieldhouse',
    kind: 'arena',
    capacity: 4_500,
    rentalCost: 10_000,
    prestige: 37,
    minCompanyRating: 48,
    blurb: 'A student body with absolutely nothing on the calendar and a bus route right to the door.',
    houseCut: 0.05,
    concessionsPerHead: 1.7,
    merchCut: 0.05,
    productionCapacity: 18,
    atmosphere: 6,
    loadIn: 0,
    outdoor: false,
  },
  {
    id: 'ballpark',
    name: 'Minor League Ballpark',
    kind: 'openAir',
    capacity: 7_000,
    rentalCost: 7_500,
    prestige: 33,
    minCompanyRating: 47,
    blurb: 'Ring right on the infield, seats on three sides, and a whole summer to get it right.',
    houseCut: 0.07,
    concessionsPerHead: 2.8,
    merchCut: 0.08,
    productionCapacity: 20,
    atmosphere: 4,
    loadIn: 1_200,
    outdoor: true,
  },
  {
    id: 'amphitheater',
    name: 'Music Amphitheater',
    kind: 'openAir',
    capacity: 5_500,
    // Under the ice rink per seat, like every room with no roof: the weather
    // risk has to be paid for in the rent or nobody would ever take it.
    rentalCost: 10_000,
    prestige: 44,
    minCompanyRating: 52,
    blurb: 'Built for bands, and every single seat points at exactly the same place.',
    houseCut: 0.09,
    concessionsPerHead: 2.6,
    merchCut: 0.12,
    productionCapacity: 22,
    atmosphere: 8,
    loadIn: 800,
    outdoor: true,
  },

  // ---------------------------------------------------------------- the buildings
  {
    id: 'conventionHall',
    name: 'Convention Hall',
    kind: 'hall',
    capacity: 8_500,
    rentalCost: 20_000,
    prestige: 46,
    minCompanyRating: 55,
    blurb: 'Eighty thousand square feet of pure nothing, and every last inch of it is yours.',
    houseCut: 0.05,
    concessionsPerHead: 1.2,
    merchCut: 0.06,
    // Enormous, and the only large room that will take the whole rig.
    productionCapacity: 30,
    // A hangar with a ring in it.
    atmosphere: -4,
    loadIn: 0,
    outdoor: false,
  },
  {
    id: 'civicArena',
    name: 'Civic Arena',
    kind: 'arena',
    capacity: 6_500,
    rentalCost: 24_000,
    prestige: 52,
    minCompanyRating: 58,
    blurb: 'A genuine real building. Empty seats show up on camera, so you had better not have any.',
    houseCut: 0.09,
    concessionsPerHead: 2.2,
    merchCut: 0.1,
    productionCapacity: 24,
    atmosphere: 4,
    loadIn: 0,
    outdoor: false,
  },
  {
    id: 'hockeyArena',
    name: 'Hockey Arena',
    kind: 'arena',
    capacity: 12_000,
    rentalCost: 40_000,
    prestige: 63,
    minCompanyRating: 66,
    blurb: 'A tenant team, a scoreboard the size of a house, and a building that has run this drill a thousand times.',
    houseCut: 0.11,
    concessionsPerHead: 2.9,
    merchCut: 0.13,
    productionCapacity: 34,
    atmosphere: 6,
    loadIn: 0,
    outdoor: false,
  },

  // ---------------------------------------------------------------- the big rooms
  {
    id: 'majorArena',
    name: 'Major Arena',
    kind: 'arena',
    capacity: 16_000,
    rentalCost: 78_000,
    prestige: 72,
    minCompanyRating: 72,
    blurb: 'Where the big promotions run their biggest nights. They will take your money either way, sold out or not.',
    houseCut: 0.13,
    concessionsPerHead: 3.1,
    merchCut: 0.15,
    productionCapacity: 40,
    atmosphere: 6,
    loadIn: 0,
    outdoor: false,
  },
  {
    id: 'sportsPalace',
    name: 'Sports Palace',
    kind: 'arena',
    capacity: 20_000,
    rentalCost: 106_000,
    prestige: 79,
    minCompanyRating: 76,
    blurb: 'Steep, thunderously loud, and built by people who understood exactly what a crowd is for.',
    houseCut: 0.12,
    concessionsPerHead: 2.7,
    merchCut: 0.14,
    productionCapacity: 44,
    // The best big room in the game. Twenty thousand and it still sounds close.
    atmosphere: 10,
    loadIn: 0,
    outdoor: false,
  },
  {
    id: 'coliseum',
    name: 'The Coliseum',
    kind: 'arena',
    capacity: 26_000,
    rentalCost: 142_000,
    prestige: 84,
    minCompanyRating: 80,
    blurb: 'The room you graduate into. That upper bowl is the honest part of the whole building.',
    houseCut: 0.14,
    concessionsPerHead: 3.0,
    merchCut: 0.15,
    productionCapacity: 44,
    atmosphere: 7,
    loadIn: 0,
    outdoor: false,
  },

  // ---------------------------------------------------------------- once a year
  {
    id: 'domeStadium',
    name: 'Domed Stadium',
    kind: 'stadium',
    capacity: 47_000,
    rentalCost: 265_000,
    prestige: 95,
    minCompanyRating: 86,
    blurb: 'Once a year, and only if you are absolutely, positively sure.',
    houseCut: 0.15,
    concessionsPerHead: 3.2,
    merchCut: 0.18,
    productionCapacity: 44,
    // Too big to be hot. It is spectacle, not heat, and it is priced for it.
    atmosphere: 3,
    loadIn: 0,
    outdoor: false,
  },
  {
    id: 'openStadium',
    name: 'Open-Air Stadium',
    kind: 'stadium',
    // Capped just under the largest market on the map: a room nobody can
    // legally run in is dead content, however good the idea is.
    capacity: 51_000,
    rentalCost: 205_000,
    prestige: 92,
    minCompanyRating: 84,
    blurb: 'Three thousand more seats than the dome, sixty thousand less in rent, and a wide-open sky overhead.',
    houseCut: 0.14,
    concessionsPerHead: 3.4,
    merchCut: 0.17,
    productionCapacity: 44,
    atmosphere: 6,
    loadIn: 2_500,
    // The biggest gamble the game offers, and the last one on the list on
    // purpose: the largest house in wrestling, rained off.
    outdoor: true,
  },
];

export function venueById(id: string): Venue | undefined {
  return VENUES.find((v) => v.id === id);
}

/** Venues that will currently take your booking. */
export function availableVenues(companyRating: number): Venue[] {
  return VENUES.filter((v) => companyRating >= v.minCompanyRating);
}

/** The cheapest thing you can run, for when the bank account says so. */
export function fallbackVenue(): Venue {
  return VENUES[0]!;
}

/**
 * The biggest building this promotion is allowed to rent. A company carrying
 * thirty wrestlers is not running a school gym — the gym is what you fall back
 * to when the money is gone, not where you start with a full payroll.
 *
 * This is a *permission* gate and nothing more. It says what a promotion may
 * rent, not what it can fill, and renting the biggest room you are allowed is
 * usually a mistake — see bestFittingVenue.
 */
export function bestAvailableVenue(companyRating: number): Venue {
  const allowed = VENUES.filter((v) => companyRating >= v.minCompanyRating);
  return maxBy(allowed, (v) => v.capacity) ?? fallbackVenue();
}

/**
 * The room this promotion should actually be in: the largest one it can both
 * rent and come close to filling.
 *
 * Separate from bestAvailableVenue because the two answers are different, and
 * conflating them is what put a brand-new promotion into a theatre it could
 * fill to 39% and bankrupt itself inside a month. A hall that looks packed is
 * worth more than an arena that looks abandoned — that is what
 * venueFullBonus and venueEmptyPenalty are for.
 *
 * Indoor only. This picks rooms for the AI and for fallbacks, and betting a
 * night on the weather is a decision a person makes, not a default.
 */
export function bestFittingVenue(companyRating: number, expectedAudience: number): Venue {
  const allowed = VENUES.filter((v) => companyRating >= v.minCompanyRating && !v.outdoor);
  const fits = allowed.filter((v) => expectedAudience >= v.capacity * VENUE_COMFORTABLE_FILL);
  return maxBy(fits, (v) => v.capacity) ?? minBy(allowed, (v) => v.capacity) ?? fallbackVenue();
}

// The list is grouped by tier for readability rather than sorted by size, so
// "the biggest" has to actually look rather than take the last element.
function maxBy<T>(items: readonly T[], by: (item: T) => number): T | undefined {
  return items.reduce<T | undefined>((best, item) => (!best || by(item) > by(best) ? item : best), undefined);
}

function minBy<T>(items: readonly T[], by: (item: T) => number): T | undefined {
  return items.reduce<T | undefined>((best, item) => (!best || by(item) < by(best) ? item : best), undefined);
}

/**
 * How full a room has to be before it is the right room. Set just under the
 * threshold that earns the full-house bonus, so "the venue that fits" is also
 * "the venue that looks good on camera".
 */
export const VENUE_COMFORTABLE_FILL = 0.7;
