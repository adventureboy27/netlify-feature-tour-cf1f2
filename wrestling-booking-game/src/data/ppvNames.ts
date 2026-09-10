// Signature events.
//
// A pay-per-view called "PPV #14" is a calendar entry. One called Blood Harvest
// that runs every October and has a fifteen-year lineage is an institution, and
// the difference costs nothing but a list of names.
//
// Each promotion draws a set at world creation and cycles them in order, so
// the same event comes round at the same point every year and the player
// learns the shape of their own calendar. The names are grouped by the kind of
// company that would run them — a mat-wrestling outfit does not promote
// Barbed Wire Massacre.

import type { PromotionArchetype } from './promotionIdentity';

export interface PPVSet {
  archetype: PromotionArchetype;
  names: string[];
}

/** Used when a promotion's own archetype has nothing left to give. */
export const UNIVERSAL_PPV_NAMES = [
  'The Reckoning',
  'Crossfire',
  'Last Stand',
  'Breaking Point',
  'No Way Out',
  'The Gauntlet',
  'Cold Blood',
  'Ground Zero',
];

export const PPV_SETS: PPVSet[] = [
  {
    archetype: 'oldSchool',
    names: ['Starrcade Classic', 'The Territories Cup', 'Homecoming', 'Iron Man Invitational', 'Founders Night'],
  },
  {
    archetype: 'athletic',
    names: ['Peak Performance', 'The Proving Ground', 'Velocity', 'Best of the Best', 'Limit Break'],
  },
  {
    archetype: 'hardcore',
    names: ['Blood Harvest', 'Barbed Wire Massacre', 'The Meat Grinder', 'Scars', 'Hell in the Valley'],
  },
  {
    archetype: 'sportsEntertainment',
    names: ['Spectacle', 'The Main Event', 'Prime Time', 'All In', 'Center Stage'],
  },
  {
    archetype: 'territory',
    names: ['County Fair Bash', 'The Armory Brawl', 'Hometown Heroes', 'Harvest Riot', 'The Long Haul'],
  },
];

/**
 * A promotion's calendar: four signature events, in the order they run.
 *
 * Drawn from the house's own set first and topped up from the universal pool,
 * so a company always has enough and always leads with something that sounds
 * like them.
 */
export function ppvCalendarFor(archetype: PromotionArchetype, wanted: number, offset: number): string[] {
  const own = PPV_SETS.find((set) => set.archetype === archetype)?.names ?? [];
  const pool = [...own, ...UNIVERSAL_PPV_NAMES];
  const calendar: string[] = [];
  for (let i = 0; i < wanted; i++) {
    calendar.push(pool[(offset + i) % pool.length]!);
  }
  return calendar;
}
