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
    blurb: 'Thirty years in that shirt, never once missed a count, never once in the wrong place.',
  },
  {
    id: 'ref-dawkins',
    name: 'Ray Dawkins',
    competence: 84,
    bendable: 12,
    toughness: 50,
    age: 44,
    experience: 17,
    blurb: 'Solid, unglamorous, and always gets out of the way when it counts.',
  },
  {
    id: 'ref-mcnally',
    name: 'Sean McNally',
    competence: 78,
    bendable: 25,
    toughness: 48,
    age: 39,
    experience: 12,
    blurb: 'A good hand. Occasionally looks the other way when the money is right.',
  },
  {
    id: 'ref-birch',
    name: 'Walter Birch',
    competence: 70,
    bendable: 55,
    toughness: 42,
    age: 51,
    experience: 22,
    blurb: 'Everybody in this business has heard the rumors. Nobody has ever proved a single thing.',
  },
  {
    id: 'ref-cade',
    name: 'Jimmy Cade',
    competence: 62,
    bendable: 88,
    toughness: 40,
    age: 47,
    experience: 19,
    blurb: 'Expensive for an official, but worth every dollar if you need a very specific finish.',
  },
  {
    id: 'ref-tibbs',
    name: 'Orville Tibbs',
    competence: 45,
    bendable: 30,
    toughness: 30,
    age: 63,
    experience: 28,
    blurb: 'Slow, half-blind, and dirt cheap. And it shows, every single week.',
  },
  {
    id: 'ref-grady',
    name: 'Marcus Grady',
    competence: 88,
    bendable: 8,
    toughness: 62,
    age: 41,
    experience: 15,
    blurb: 'A fast count when it needs to be fast. Never once when it should not be.',
  },
  {
    id: 'ref-poole',
    name: 'Dennis Poole',
    competence: 74,
    bendable: 40,
    toughness: 45,
    age: 36,
    experience: 9,
    blurb: 'Perfectly competent, and entirely, unmistakably purchasable.',
  },
  {
    id: 'ref-santos',
    name: 'Rafael Santos',
    competence: 90,
    bendable: 10,
    toughness: 58,
    age: 45,
    experience: 20,
    blurb: 'Came up through the lucha system, and he sees absolutely everything out there.',
  },
  {
    id: 'ref-whitfield',
    name: 'Norm Whitfield',
    competence: 40,
    bendable: 62,
    toughness: 35,
    age: 49,
    experience: 11,
    blurb: 'Flat-out bad at the job, and available to whoever bids the highest.',
  },
  {
    id: 'ref-locke',
    name: 'Harriet Locke',
    competence: 86,
    bendable: 6,
    toughness: 52,
    age: 34,
    experience: 8,
    blurb: 'Will throw a match out cold rather than let it get out of hand.',
  },
  {
    id: 'ref-boyd',
    name: 'Chuck Boyd',
    competence: 58,
    bendable: 20,
    toughness: 68,
    age: 29,
    experience: 3,
    blurb: 'Enthusiastic, green as they come, and frequently in the wrong place at exactly the wrong time.',
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
    'Quiet, quick, and always exactly where the finish needs him to be.',
    'Has never once had a match get away from him.',
    'Trained under somebody genuinely good, and it shows in every count.',
  ],
  decent: [
    'Reliable. Nobody has ever complained about him twice.',
    'Knows the job cold and works it the exact same way every single night.',
    'Unremarkable in exactly the way a good official is supposed to be.',
  ],
  poor: [
    'Means well. Just gets there a beat too late.',
    'Learning on the job, live, in front of paying customers.',
    'Has a real habit of watching the wrong corner at the worst moment.',
  ],
  crooked: [
    'Available, for the right number.',
    'Has done favors before and will gladly do them again.',
    'Counts as fast or as slow as the situation happens to require.',
  ],
} as const;
