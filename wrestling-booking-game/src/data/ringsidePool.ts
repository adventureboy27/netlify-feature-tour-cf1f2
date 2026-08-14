// The people at ringside who are not wrestling.
//
// Managers are hired from a standing pool rather than generated per save,
// because a mouthpiece is a recurring *character* — the one who has made
// three careers, the one who talks his client into a beating every week.
// Twelve is enough that a long save keeps meeting new ones without making
// them a second roster to administrate.
//
// Managers price on what they do: a great talker who transforms a silent
// monster costs several times a warm body in a suit. They are paid per
// appearance, which is what separates them from the officials — referees are
// signed to weekly contracts and live in data/refereePool.ts.

import type { Manager } from '../engine/sim/ringside';

// Managers are older than the people they manage, and deliberately so: this
// is a job you get to by having been a wrestler already or by having talked
// for a living long enough to be good at it. The youngest here is 46 against a
// roster averaging around thirty, which is what makes a manager dying a
// different kind of event from a wrestler dying.
export const MANAGERS: Manager[] = [
  {
    id: 'mgr-cornelius',
    name: 'Cornelius Vance III',
    micWork: 92,
    presence: 78,
    deviousness: 70,
    negotiation: 88,
    protection: 0,
    feePerShow: 1400,
    age: 71,
    blurb: 'Old money, silk handkerchief, and a client list going back decades.',
  },
  {
    id: 'mgr-mama',
    name: 'Mama Delacroix',
    micWork: 88,
    presence: 85,
    deviousness: 55,
    negotiation: 54,
    protection: 0,
    feePerShow: 1300,
    age: 58,
    blurb: 'Nobody in the building will boo her. Everybody will boo whoever she brought.',
  },
  {
    id: 'mgr-slick',
    name: 'Slick Eddie Marlowe',
    micWork: 84,
    presence: 62,
    deviousness: 95,
    negotiation: 72,
    protection: 15,
    feePerShow: 1100,
    age: 64,
    blurb: 'Has never seen a rulebook he could not misplace.',
  },
  {
    id: 'mgr-doctor',
    name: 'Doctor Erasmus Kane',
    micWork: 90,
    presence: 72,
    deviousness: 80,
    negotiation: 41,
    protection: 85,
    feePerShow: 1250,
    age: 49,
    blurb: 'Speaks entirely in threats delivered very calmly.',
  },
  {
    id: 'mgr-sarge',
    name: 'Sergeant Buck Hollis',
    micWork: 71,
    presence: 80,
    deviousness: 40,
    negotiation: 66,
    protection: 0,
    feePerShow: 850,
    age: 52,
    blurb: 'Shouts. Salutes. Has a folding chair and strong opinions.',
  },
  {
    id: 'mgr-duchess',
    name: 'The Duchess',
    micWork: 79,
    presence: 88,
    deviousness: 68,
    negotiation: 95,
    protection: 10,
    feePerShow: 1150,
    age: 55,
    blurb: 'Says almost nothing and takes up the entire frame.',
  },
  {
    id: 'mgr-percy',
    name: 'Percy Nightingale',
    micWork: 86,
    presence: 55,
    deviousness: 62,
    negotiation: 60,
    protection: 70,
    feePerShow: 950,
    age: 67,
    blurb: 'Insufferable, well-spoken, and generates heat by existing.',
  },
  {
    id: 'mgr-bruiser',
    name: 'Big Ted Kowalski',
    micWork: 48,
    presence: 84,
    deviousness: 75,
    negotiation: 35,
    protection: 90,
    feePerShow: 700,
    age: 47,
    blurb: 'A former wrestler the size of a door. Not a talker.',
  },
  {
    id: 'mgr-oracle',
    name: 'The Oracle',
    micWork: 82,
    presence: 76,
    deviousness: 50,
    negotiation: 79,
    protection: 0,
    feePerShow: 1000,
    age: 61,
    blurb: 'Speaks in prophecy. Half the crowd is genuinely unsettled.',
  },
  {
    id: 'mgr-agent',
    name: 'Marty Feldstein, Esq.',
    micWork: 75,
    presence: 45,
    deviousness: 88,
    negotiation: 48,
    protection: 25,
    feePerShow: 600,
    age: 63,
    blurb: 'Waves contracts. Files complaints. Always at ringside for the finish.',
  },
  {
    id: 'mgr-queen',
    name: 'Scarlett Vane',
    micWork: 91,
    presence: 82,
    deviousness: 72,
    negotiation: 84,
    protection: 0,
    feePerShow: 1350,
    age: 46,
    blurb: 'Runs her clients like a stable and everyone else like an obstacle.',
  },
  {
    id: 'mgr-rook',
    name: 'Danny "The Rook" Pell',
    micWork: 58,
    presence: 40,
    deviousness: 45,
    negotiation: 57,
    protection: 60,
    feePerShow: 300,
    age: 74,
    blurb: 'Cheap, keen, and has not managed anybody who mattered yet.',
  },
];

export function managerById(id: string): Manager | undefined {
  return MANAGERS.find((m) => m.id === id);
}


