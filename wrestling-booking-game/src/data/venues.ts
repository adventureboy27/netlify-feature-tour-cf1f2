// Venues — rented for every single show, never owned.
//
// The rent is the promotion's biggest fixed risk. A school gym costs almost
// nothing and caps your gate at a few hundred people; a stadium can hold
// forty thousand and will happily bankrupt you if eight thousand turn up. The
// decision every week is whether you believe your own card.
//
// `minCompanyRating` is the other half of it: a real arena does not rent to a
// promotion nobody has heard of. You grow into the buildings.

import type { Venue } from '../engine/types';

export const VENUES: Venue[] = [
  {
    id: 'schoolGym',
    name: 'School Gymnasium',
    capacity: 250,
    rentalCost: 350,
    prestige: 2,
    minCompanyRating: 0,
    blurb: 'Folding chairs and a scoreboard nobody turns off.',
  },
  {
    id: 'vfwHall',
    name: 'VFW Hall',
    capacity: 400,
    rentalCost: 650,
    prestige: 6,
    minCompanyRating: 0,
    blurb: 'Low ceiling, cheap bar, loyal regulars.',
  },
  {
    id: 'nationalGuardArmory',
    name: 'National Guard Armory',
    capacity: 900,
    rentalCost: 1800,
    prestige: 14,
    minCompanyRating: 25,
    blurb: 'The traditional home of territory wrestling.',
  },
  {
    id: 'conferenceCenter',
    name: 'Conference Center',
    capacity: 1600,
    rentalCost: 4200,
    prestige: 22,
    minCompanyRating: 35,
    blurb: 'Carpeted, well lit, and charges for every extra chair.',
  },
  {
    id: 'theater',
    name: 'Civic Theater',
    capacity: 2400,
    rentalCost: 8000,
    prestige: 34,
    minCompanyRating: 45,
    blurb: 'Everyone has a good view. The acoustics do half your work.',
  },
  {
    id: 'civicArena',
    name: 'Civic Arena',
    capacity: 6000,
    rentalCost: 24000,
    prestige: 52,
    minCompanyRating: 58,
    blurb: 'A real building. Empty seats show on camera.',
  },
  {
    id: 'majorArena',
    name: 'Major Arena',
    capacity: 15000,
    rentalCost: 78000,
    prestige: 72,
    minCompanyRating: 72,
    blurb: 'Where the big promotions run. They will take your money either way.',
  },
  {
    id: 'coliseum',
    name: 'The Coliseum',
    capacity: 25000,
    rentalCost: 140000,
    prestige: 82,
    minCompanyRating: 80,
    blurb: 'The room you graduate into. The upper bowl is the honest part.',
  },
  {
    id: 'domeStadium',
    name: 'Domed Stadium',
    capacity: 45000,
    rentalCost: 260000,
    prestige: 95,
    minCompanyRating: 86,
    blurb: 'Once a year, if you are very sure.',
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
  return allowed[allowed.length - 1] ?? fallbackVenue();
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
 */
export function bestFittingVenue(companyRating: number, expectedAudience: number): Venue {
  const allowed = VENUES.filter((v) => companyRating >= v.minCompanyRating);
  // Walk down from the biggest permitted room to the first one the audience
  // would genuinely fill, and fall back to the smallest if nothing fits.
  const fits = allowed.filter((v) => expectedAudience >= v.capacity * VENUE_COMFORTABLE_FILL);
  return fits[fits.length - 1] ?? allowed[0] ?? fallbackVenue();
}

/**
 * How full a room has to be before it is the right room. Set just under the
 * threshold that earns the full-house bonus, so "the venue that fits" is also
 * "the venue that looks good on camera".
 */
export const VENUE_COMFORTABLE_FILL = 0.7;
