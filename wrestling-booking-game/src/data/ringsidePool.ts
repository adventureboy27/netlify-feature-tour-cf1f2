// The people at ringside who are not wrestling.
//
// Managers and referees are hired from a standing pool rather than generated
// per save, because both are recurring *characters* — the crooked official
// everybody knows is crooked, the mouthpiece who has made three careers.
// Twelve of each is enough that a long save keeps meeting new ones without
// making them a second roster to administrate.
//
// Managers price on what they do: a great talker who transforms a silent
// monster costs several times a warm body in a suit. Referees are cheap
// almost across the board — the expensive one is the one who will do what he
// is told.

import type { Manager, Referee } from '../engine/sim/ringside';

export const MANAGERS: Manager[] = [
  {
    id: 'mgr-cornelius',
    name: 'Cornelius Vance III',
    micWork: 92,
    presence: 78,
    deviousness: 70,
    feePerShow: 1400,
    blurb: 'Old money, silk handkerchief, and a client list going back decades.',
  },
  {
    id: 'mgr-mama',
    name: 'Mama Delacroix',
    micWork: 88,
    presence: 85,
    deviousness: 55,
    feePerShow: 1300,
    blurb: 'Nobody in the building will boo her. Everybody will boo whoever she brought.',
  },
  {
    id: 'mgr-slick',
    name: 'Slick Eddie Marlowe',
    micWork: 84,
    presence: 62,
    deviousness: 95,
    feePerShow: 1100,
    blurb: 'Has never seen a rulebook he could not misplace.',
  },
  {
    id: 'mgr-doctor',
    name: 'Doctor Erasmus Kane',
    micWork: 90,
    presence: 72,
    deviousness: 80,
    feePerShow: 1250,
    blurb: 'Speaks entirely in threats delivered very calmly.',
  },
  {
    id: 'mgr-sarge',
    name: 'Sergeant Buck Hollis',
    micWork: 71,
    presence: 80,
    deviousness: 40,
    feePerShow: 850,
    blurb: 'Shouts. Salutes. Has a folding chair and strong opinions.',
  },
  {
    id: 'mgr-duchess',
    name: 'The Duchess',
    micWork: 79,
    presence: 88,
    deviousness: 68,
    feePerShow: 1150,
    blurb: 'Says almost nothing and takes up the entire frame.',
  },
  {
    id: 'mgr-percy',
    name: 'Percy Nightingale',
    micWork: 86,
    presence: 55,
    deviousness: 62,
    feePerShow: 950,
    blurb: 'Insufferable, well-spoken, and generates heat by existing.',
  },
  {
    id: 'mgr-bruiser',
    name: 'Big Ted Kowalski',
    micWork: 48,
    presence: 84,
    deviousness: 75,
    feePerShow: 700,
    blurb: 'A former wrestler the size of a door. Not a talker.',
  },
  {
    id: 'mgr-oracle',
    name: 'The Oracle',
    micWork: 82,
    presence: 76,
    deviousness: 50,
    feePerShow: 1000,
    blurb: 'Speaks in prophecy. Half the crowd is genuinely unsettled.',
  },
  {
    id: 'mgr-agent',
    name: 'Marty Feldstein, Esq.',
    micWork: 75,
    presence: 45,
    deviousness: 88,
    feePerShow: 600,
    blurb: 'Waves contracts. Files complaints. Always at ringside for the finish.',
  },
  {
    id: 'mgr-queen',
    name: 'Scarlett Vane',
    micWork: 91,
    presence: 82,
    deviousness: 72,
    feePerShow: 1350,
    blurb: 'Runs her clients like a stable and everyone else like an obstacle.',
  },
  {
    id: 'mgr-rook',
    name: 'Danny "The Rook" Pell',
    micWork: 58,
    presence: 40,
    deviousness: 45,
    feePerShow: 300,
    blurb: 'Cheap, keen, and has not managed anybody who mattered yet.',
  },
];

export const REFEREES: Referee[] = [
  {
    id: 'ref-hollis',
    name: 'Earl Hollis',
    competence: 92,
    bendable: 5,
    feePerShow: 350,
    blurb: 'Thirty years, never missed a count, never been in the wrong place.',
  },
  {
    id: 'ref-dawkins',
    name: 'Ray Dawkins',
    competence: 84,
    bendable: 12,
    feePerShow: 280,
    blurb: 'Solid, unglamorous, gets out of the way.',
  },
  {
    id: 'ref-mcnally',
    name: 'Sean McNally',
    competence: 78,
    bendable: 25,
    feePerShow: 240,
    blurb: 'Good hand. Occasionally looks the other way if the money is right.',
  },
  {
    id: 'ref-birch',
    name: 'Walter Birch',
    competence: 70,
    bendable: 55,
    feePerShow: 220,
    blurb: 'Everybody has heard the rumours. Nobody has proved anything.',
  },
  {
    id: 'ref-cade',
    name: 'Jimmy Cade',
    competence: 62,
    bendable: 88,
    feePerShow: 500,
    blurb: 'Expensive for a referee, and worth it if you want a specific finish.',
  },
  {
    id: 'ref-tibbs',
    name: 'Orville Tibbs',
    competence: 55,
    bendable: 30,
    feePerShow: 150,
    blurb: 'Slow, half-blind, and cheap. It shows.',
  },
  {
    id: 'ref-grady',
    name: 'Marcus Grady',
    competence: 88,
    bendable: 8,
    feePerShow: 330,
    blurb: 'Fast count when it should be fast. Never when it should not.',
  },
  {
    id: 'ref-poole',
    name: 'Dennis Poole',
    competence: 74,
    bendable: 40,
    feePerShow: 250,
    blurb: 'Perfectly competent and entirely purchasable.',
  },
  {
    id: 'ref-santos',
    name: 'Rafael Santos',
    competence: 90,
    bendable: 10,
    feePerShow: 340,
    blurb: 'Came up in the lucha system. Sees everything.',
  },
  {
    id: 'ref-whitfield',
    name: 'Norm Whitfield',
    competence: 48,
    bendable: 62,
    feePerShow: 180,
    blurb: 'Bad at the job and available to the highest bidder.',
  },
  {
    id: 'ref-locke',
    name: 'Harriet Locke',
    competence: 86,
    bendable: 6,
    feePerShow: 320,
    blurb: 'Will throw a match out rather than let it get silly.',
  },
  {
    id: 'ref-boyd',
    name: 'Chuck Boyd',
    competence: 66,
    bendable: 20,
    feePerShow: 200,
    blurb: 'Enthusiastic. Frequently in the wrong place at the wrong time.',
  },
];

export function managerById(id: string): Manager | undefined {
  return MANAGERS.find((m) => m.id === id);
}

export function refereeById(id: string): Referee | undefined {
  return REFEREES.find((r) => r.id === id);
}

/** The cheapest official available, for a promotion that cannot afford choice. */
export function cheapestReferee(): Referee {
  return REFEREES.reduce((cheapest, r) => (r.feePerShow < cheapest.feePerShow ? r : cheapest));
}
