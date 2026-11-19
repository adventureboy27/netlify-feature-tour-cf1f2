// Tag team names.
//
// A tag division only means something if the teams have names. "Draven &
// Mercer" is a pairing; "The Brass Knuckle Boys" is an act, and an act can be
// ranked, feuded with, and remembered.
//
// Two sources, in order of preference: a proper team name from the pool, and
// — when the pool is exhausted or the pairing is a thrown-together one — the
// two surnames, which is exactly what a commentator would call them.

/** Proper team names. Deliberately 1980s-shaped. */
export const TEAM_NAMES = [
  'The Brass Knuckle Boys',
  'The Midnight Freight',
  'The Steel Curtain',
  'The Wrecking Crew',
  'The Iron Brotherhood',
  'The Blackhearts',
  'The Roadwork',
  'The Sunset Kings',
  'The Hard Times',
  'The Company Men',
  'The Wild Bunch',
  'The Bruise Brothers',
  'The Last Stand',
  'The Long Riders',
  'The Fifth Avenue Boys',
  'The Motor City Mechanics',
  'The Southern Storm',
  'The Chain Reaction',
  'The Cutting Crew',
  'The Heavy Machinery',
  'The Nightshift',
  'The Gatekeepers',
  'The Rough Riders',
  'The Union',
  'The Firm',
  'The Outfit',
  'The Dynasty',
  'The Deadbolts',
  'The Silver Dollars',
  'The Twin Peaks',
  'The Night Patrol',
  'The Hard Chargers',
  'The Rat Pack',
  'The Heavy Hitters',
  'The Powerhouse Connection',
  'The High Rollers',
  'The Barnburners',
  'The Anvils',
  'The Working Class',
  'The Main Street Muscle',
];

/** Names for a women's team. Kept separate so the flavour lands. */
export const WOMENS_TEAM_NAMES = [
  'The Glamour Squad',
  'The High-Flying Angels',
  'The Velvet Hammers',
  'The Trailblazers',
  'The Firecrackers',
  'The Storm Chasers',
  'The Wildflowers',
  'The Iron Roses',
  'The Steel Magnolias',
  'The Riot Squad',
  'The Fury',
  'The Sisterhood',
];

/** "Draven & Mercer" — the fallback, and never wrong. */
export function surnamePair(nameA: string, nameB: string): string {
  const last = (name: string) => name.split(/\s+/).slice(-1)[0] ?? name;
  return `${last(nameA)} & ${last(nameB)}`;
}
