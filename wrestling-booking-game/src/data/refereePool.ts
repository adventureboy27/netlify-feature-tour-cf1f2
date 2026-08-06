// The officials, as people.
//
// Referees used to be a static price list everybody shared. They are signed
// characters now — a contract, a wage, a body that gets tired, a standing in
// the business — so this file holds what they *start* as and the engine holds
// what happens to them after that.
//
// Twelve hand-written ones because the crooked official everybody knows is
// crooked only works if he has a name and turns up again. Generated ones top
// the pool back up when rivals sign yours away, so a long save never runs out
// of shirts.
//
// The spread matters more than any single line: there has to be an Earl
// Hollis worth real money and an Orville Tibbs who costs nothing and shows
// you why.

export interface RefereeSeed {
  id: string;
  name: string;
  competence: number;
  bendable: number;
  toughness: number;
  age: number;
  /** Years in the shirt. */
  experience: number;
  blurb: string;
}

export const REFEREE_SEEDS: RefereeSeed[] = [
  {
    id: 'ref-hollis',
    name: 'Earl Hollis',
    competence: 92,
    bendable: 5,
    toughness: 55,
    age: 58,
    experience: 31,
    blurb: 'Thirty years, never missed a count, never been in the wrong place.',
  },
  {
    id: 'ref-dawkins',
    name: 'Ray Dawkins',
    competence: 84,
    bendable: 12,
    toughness: 50,
    age: 44,
    experience: 17,
    blurb: 'Solid, unglamorous, gets out of the way.',
  },
  {
    id: 'ref-mcnally',
    name: 'Sean McNally',
    competence: 78,
    bendable: 25,
    toughness: 48,
    age: 39,
    experience: 12,
    blurb: 'Good hand. Occasionally looks the other way if the money is right.',
  },
  {
    id: 'ref-birch',
    name: 'Walter Birch',
    competence: 70,
    bendable: 55,
    toughness: 42,
    age: 51,
    experience: 22,
    blurb: 'Everybody has heard the rumours. Nobody has proved anything.',
  },
  {
    id: 'ref-cade',
    name: 'Jimmy Cade',
    competence: 62,
    bendable: 88,
    toughness: 40,
    age: 47,
    experience: 19,
    blurb: 'Expensive for a referee, and worth it if you want a specific finish.',
  },
  {
    id: 'ref-tibbs',
    name: 'Orville Tibbs',
    competence: 45,
    bendable: 30,
    toughness: 30,
    age: 63,
    experience: 28,
    blurb: 'Slow, half-blind, and cheap. It shows, every single week.',
  },
  {
    id: 'ref-grady',
    name: 'Marcus Grady',
    competence: 88,
    bendable: 8,
    toughness: 62,
    age: 41,
    experience: 15,
    blurb: 'Fast count when it should be fast. Never when it should not.',
  },
  {
    id: 'ref-poole',
    name: 'Dennis Poole',
    competence: 74,
    bendable: 40,
    toughness: 45,
    age: 36,
    experience: 9,
    blurb: 'Perfectly competent and entirely purchasable.',
  },
  {
    id: 'ref-santos',
    name: 'Rafael Santos',
    competence: 90,
    bendable: 10,
    toughness: 58,
    age: 45,
    experience: 20,
    blurb: 'Came up in the lucha system. Sees everything.',
  },
  {
    id: 'ref-whitfield',
    name: 'Norm Whitfield',
    competence: 40,
    bendable: 62,
    toughness: 35,
    age: 49,
    experience: 11,
    blurb: 'Bad at the job and available to the highest bidder.',
  },
  {
    id: 'ref-locke',
    name: 'Harriet Locke',
    competence: 86,
    bendable: 6,
    toughness: 52,
    age: 34,
    experience: 8,
    blurb: 'Will throw a match out rather than let it get silly.',
  },
  {
    id: 'ref-boyd',
    name: 'Chuck Boyd',
    competence: 58,
    bendable: 20,
    toughness: 68,
    age: 29,
    experience: 3,
    blurb: 'Enthusiastic, green, and frequently in the wrong place at the wrong time.',
  },
];

/**
 * Plain names for generated officials. Deliberately unglamorous — a referee
 * with a ring name is a wrestler, and this pool is not that.
 */
export const REFEREE_FIRST_NAMES = [
  'Al',
  'Bernie',
  'Carl',
  'Curtis',
  'Danny',
  'Dave',
  'Doug',
  'Frank',
  'Gene',
  'Gloria',
  'Hank',
  'Ivan',
  'Joan',
  'Keith',
  'Lenny',
  'Mel',
  'Nadia',
  'Otis',
  'Pat',
  'Ramona',
  'Ross',
  'Stan',
  'Terry',
  'Vince',
  'Wendell',
];

export const REFEREE_LAST_NAMES = [
  'Aldridge',
  'Brannigan',
  'Castellano',
  'Delaney',
  'Emmerich',
  'Farrow',
  'Gault',
  'Hendricks',
  'Iverson',
  'Jarrow',
  'Kaminski',
  'Lundquist',
  'Mahoney',
  'Novak',
  'Oakes',
  'Petrossian',
  'Quill',
  'Ruddick',
  'Sowerby',
  'Tremaine',
  'Underhill',
  'Vasquez',
  'Wheatley',
  'Yarborough',
];

/**
 * One-line character notes for generated officials, picked to match what
 * their numbers came out as. A generated referee with no blurb reads like a
 * database row, and the whole point is that they are people.
 */
export const REFEREE_BLURBS = {
  excellent: [
    'Quiet, quick, and always exactly where the finish is.',
    'Has never had a match get away from him.',
    'Trained under somebody good and it shows in the counts.',
  ],
  decent: [
    'Reliable. Nobody has ever complained about him twice.',
    'Knows the job, works it the same way every night.',
    'Unremarkable in the way an official is supposed to be.',
  ],
  poor: [
    'Means well. Gets there late.',
    'Learning on the job, in front of paying customers.',
    'Has a habit of watching the wrong corner.',
  ],
  crooked: [
    'Available, for a number.',
    'Has done favours before and will do them again.',
    'Counts as fast or as slow as the situation requires.',
  ],
} as const;
