// What a company puts in a deal that is not money.
//
// The clause ladder (career/ego.ts) is about *rights* — who can be booked to
// lose, who can refuse a finish, what a release costs. Perks are the other
// kind of thing a contract carries: how somebody travels, where they get
// changed, who looks after their body. They are lifestyle, and in this
// business lifestyle is status.
//
// Which is the whole reason they are interesting rather than a shopping list.
// A private locker room is a cheap perk that makes one man happy and tells
// twenty-five other people what the office thinks of them. A jet is enormously
// expensive, genuinely useful — somebody who is not sleeping on a bus works
// better — and the single loudest thing you can say about a roster's pecking
// order. Every perk here has a real mechanical effect and most of them have a
// price the person receiving it never pays.
//
// ---------------------------------------------------------------------------
// Nothing here goes in a first contract
//
// `renewalOnly` is on every perk that carries status, and it is not a balance
// dial — it is the fiction. You do not hand a jet to somebody you have just
// signed and have never worked with. These are things a company gives to
// people it already has, which makes them a lever for keeping somebody rather
// than for landing them, and keeps a bidding war about money and rights.

import type { CareerStatus } from '../engine/types';

export type PerkId =
  | 'privateJet'
  | 'roadCrew'
  | 'companyApartment'
  | 'familyOnTheRoad'
  | 'privateLockerRoom'
  | 'personalTrainer'
  | 'personalChef'
  | 'documentaryCrew';

/**
 * The standing ladder, for gating. Deliberately coarse — the question a perk
 * asks is "are they somebody yet", not which of eleven labels they carry.
 */
export const STANDING: Record<CareerStatus, number> = {
  trainee: 0,
  rookie: 1,
  prospect: 2,
  enhancement: 1,
  journeyman: 2,
  midcarder: 3,
  gatekeeper: 3,
  upperCard: 4,
  mainEventer: 5,
  draw: 6,
  veteran: 4,
  fallenStar: 3,
  retired: 0,
  hallOfFamer: 6,
  legend: 6,
};

export interface Perk {
  id: PerkId;
  name: string;
  blurb: string;
  /** What the office is actually agreeing to, said plainly. */
  cost: string;
  /** Every week, whether they work or not. */
  weeklyCost: number;
  minAge: number;
  minYearsPro: number;
  minStanding: number;
  /** Never in a first contract with this company. */
  renewalOnly: boolean;
  /** What it does for the person who has it, per week. */
  moraleGain: number;
  /**
   * ...and what it does to everybody else on the roster, per week. The point
   * of the status perks: somebody has to see it.
   */
  lockerRoomCost: number;
  /** Fatigue debt cleared per week on top of the usual recovery. */
  fatigueRelief: number;
  /** Health recovered per week on top of the usual. */
  recovery: number;
  /** Popularity drift per week. */
  exposure: number;
  /**
   * How much this shuts somebody off from the room's mood, 0-1.
   *
   * Only the perks that physically separate somebody have it, and the private
   * locker room is the whole point: a door that shuts is exactly how a booker
   * quarantines a Poison, and it works in both directions — they catch less of
   * everybody else's week and everybody else catches less of theirs. It is a
   * real trade rather than a straight upgrade, because the same door is the
   * loudest thing on this list and the room resents it accordingly.
   */
  moodInsulation: number;
}

export const PERKS: readonly Perk[] = [
  {
    id: 'privateJet',
    name: 'Private jet',
    blurb: 'They stop living on a bus. Everybody finds out within a week.',
    cost: 'Ruinous, and the locker room will talk about nothing else.',
    weeklyCost: 2200,
    // The one perk that is genuinely only for the top of the business. A
    // twenty-six-year-old upper-carder does not get a plane.
    minAge: 30,
    minYearsPro: 8,
    minStanding: 5,
    renewalOnly: true,
    moraleGain: 0.9,
    lockerRoomCost: 0.28,
    fatigueRelief: 2.2,
    recovery: 0.4,
    exposure: 0,
    moodInsulation: 0,
  },
  {
    id: 'roadCrew',
    name: 'Own road crew',
    blurb: 'Somebody else drives, carries the bags, and books the rooms.',
    cost: 'A small payroll of its own, quietly.',
    weeklyCost: 700,
    minAge: 28,
    minYearsPro: 6,
    minStanding: 4,
    renewalOnly: true,
    moraleGain: 0.4,
    lockerRoomCost: 0.1,
    fatigueRelief: 1.2,
    recovery: 0.2,
    exposure: 0,
    moodInsulation: 0,
  },
  {
    id: 'companyApartment',
    name: 'Company apartment',
    blurb: 'Somewhere to live that is not a motel off the interstate.',
    cost: 'Rent, every week, in a town they might not stay in.',
    weeklyCost: 450,
    minAge: 23,
    minYearsPro: 2,
    minStanding: 2,
    renewalOnly: true,
    moraleGain: 0.5,
    // Nobody resents somebody having a flat.
    lockerRoomCost: 0,
    fatigueRelief: 0.4,
    recovery: 0.3,
    exposure: 0,
    moodInsulation: 0,
  },
  {
    id: 'familyOnTheRoad',
    name: 'Family travel',
    blurb: 'Their people come with them instead of waving them off.',
    cost: 'Every trip costs what several trips used to.',
    weeklyCost: 600,
    minAge: 26,
    minYearsPro: 4,
    minStanding: 3,
    renewalOnly: true,
    moraleGain: 0.8,
    lockerRoomCost: 0.05,
    fatigueRelief: 0,
    recovery: 0.2,
    exposure: 0,
    moodInsulation: 0,
  },
  {
    id: 'privateLockerRoom',
    name: 'Private locker room',
    blurb: 'A door that shuts. Cheap to give and enormously loud.',
    cost: 'Almost nothing in money. Everybody else notices immediately.',
    // The cheapest thing on this list and the most expensive one to give.
    weeklyCost: 120,
    minAge: 27,
    minYearsPro: 5,
    minStanding: 4,
    renewalOnly: true,
    moraleGain: 0.7,
    lockerRoomCost: 0.35,
    fatigueRelief: 0.2,
    recovery: 0,
    exposure: 0,
    // The reason to give one to somebody nobody can stand. Most of the room's
    // mood stops at the door — theirs included, which is the whole trade.
    moodInsulation: 0.7,
  },
  {
    id: 'personalTrainer',
    name: 'Personal trainer',
    blurb: 'Somebody whose whole job is keeping this one body working.',
    cost: 'A wage for somebody who never appears on a card.',
    weeklyCost: 550,
    minAge: 25,
    minYearsPro: 3,
    minStanding: 3,
    renewalOnly: true,
    moraleGain: 0.3,
    lockerRoomCost: 0.08,
    fatigueRelief: 0.6,
    recovery: 1.1,
    exposure: 0,
    moodInsulation: 0,
  },
  {
    id: 'personalChef',
    name: 'Nutritionist',
    blurb: 'They stop eating gas station food four nights a week.',
    cost: 'Modest, and it buys a body that lasts longer.',
    weeklyCost: 320,
    minAge: 24,
    minYearsPro: 2,
    minStanding: 2,
    renewalOnly: true,
    moraleGain: 0.2,
    lockerRoomCost: 0.05,
    fatigueRelief: 0.3,
    recovery: 0.7,
    exposure: 0,
    moodInsulation: 0,
  },
  {
    id: 'documentaryCrew',
    name: 'Documentary crew',
    blurb: 'A camera follows them everywhere. It gets them over. It also grates.',
    cost: 'A crew on the payroll, and a locker room being filmed all year.',
    weeklyCost: 800,
    minAge: 25,
    minYearsPro: 4,
    minStanding: 4,
    renewalOnly: true,
    moraleGain: 0.35,
    // The only one where the resentment is the *point* rather than a side
    // effect: everybody else is scenery in somebody's film.
    lockerRoomCost: 0.3,
    fatigueRelief: -0.4,
    recovery: 0,
    exposure: 0.18,
    moodInsulation: 0,
  },
];

export function perkById(id: PerkId): Perk | undefined {
  return PERKS.find((perk) => perk.id === id);
}
