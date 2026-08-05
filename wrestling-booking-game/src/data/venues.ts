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
 */
export function bestAvailableVenue(companyRating: number): Venue {
  const allowed = VENUES.filter((v) => companyRating >= v.minCompanyRating);
  return allowed[allowed.length - 1] ?? fallbackVenue();
}
