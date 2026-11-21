// Homes — the rooms you take for a season, which are not the rooms you tour.
//
// This started out sharing the touring venue list and that was wrong. A
// residency is not "the civic theatre, but cheaper". It is one small building
// in one small town, running every week for the same few hundred people, and
// almost everything about it is different from renting a room for a night:
//
//   - **You will never sell out.** `localCrowd` is the number of human beings
//     in that town who will ever come to a wrestling show, and it is smaller
//     than the room. The Old Armory seats nine hundred and six hundred and
//     twenty people in Kesslerville would ever walk into it, so it is a hall
//     with two hundred and eighty empty chairs every week, on camera, forever.
//
//     These figures were first written far smaller — a town of three hundred
//     against a room of five hundred — and measured in a running save that was
//     not a hard choice, it was a slower way to go bankrupt: a residency folded
//     at week seven where the same company touring lasted to week twenty-five.
//     A "small city" has to be small relative to *this* economy, where a
//     startup on the road already draws nine hundred.
//   - **You cannot charge much.** `topTicket` is what the town will pay.
//     There is no executive box in a converted cinema in a mill town, and
//     pricing above what the place can bear does not raise the gate, it
//     empties the room.
//   - **Merch barely moves.** The same three hundred people, week after week.
//     They bought the shirt in March. They are not buying it again in June.
//   - **Nobody outside the town has heard of anybody.** This is the real
//     cost, and it is not on this page in dollars: a year in one room is a
//     year in which your roster does not get over anywhere, and the business
//     does not learn your name. You come out of it solvent and unknown.
//
// So the shape of the thing: a residency is a place to survive, not a place to
// grow. It is the right answer with a month of rent in the bank and the wrong
// answer with anything better than that — and it is deliberately attractive
// enough that finding out which you are is a real decision.
//
// Measured over a full year, from the game's own starting presets:
//
//   Sink or swim (24 on the payroll, one month of rent). Touring folds in
//   week 21. Four of these eight rooms carry it through the year — the
//   Starlite best at +$250,785 — and four fold faster than touring did. So a
//   residency is genuinely the survival move for a company with nothing, and
//   picking the wrong room is worse than not signing at all.
//
//   Territory days (a going concern). Touring makes $907,118 and finishes on a
//   company rating of 53 with the house grown from 740 to 1,100. The best
//   residency makes $422,293, finishes on 35, and watches the house fall from
//   731 to 300. Half the money and eighteen points of standing, which is the
//   arrangement working exactly as intended.

import type { Id } from '../engine/types';

export interface ResidencyHome {
  id: Id;
  name: string;
  /** The town. One small city, and you will get to know it very well. */
  town: string;
  /** Seats in the room. Larger than the crowd, which is the point. */
  capacity: number;
  /**
   * People in this town who will ever come. The hard ceiling on a house —
   * always under capacity, so a residency never sells out and the room never
   * looks full.
   */
  localCrowd: number;
  /** Flat, weekly, for the whole term. No load-in, no percentage, no surprise. */
  rentPerWeek: number;
  /** What this town will pay for a ticket. Above it, they stop coming. */
  topTicket: number;
  /** The same faces every week already own the shirt. Well under one. */
  merchMultiplier: number;
  /** In the same haul units as the production ladder. */
  productionCapacity: number;
  atmosphere: number;
  blurb: string;
}

export const RESIDENCY_HOMES: ResidencyHome[] = [
  {
    id: 'millTownArmory',
    name: 'The Old Armory',
    town: 'Kesslerville',
    capacity: 900,
    localCrowd: 620,
    rentPerWeek: 300,
    topTicket: 17,
    merchMultiplier: 0.45,
    productionCapacity: 7,
    atmosphere: 5,
    blurb: 'A mill town with absolutely nothing else going on a Thursday. Six hundred of them, week in and week out, like clockwork.',
  },
  {
    id: 'legionHall',
    name: 'Post 114 Legion Hall',
    town: 'Brackett',
    capacity: 620,
    localCrowd: 470,
    rentPerWeek: 190,
    topTicket: 14,
    merchMultiplier: 0.4,
    productionCapacity: 5,
    atmosphere: 7,
    blurb: 'Rows of folding chairs, a bar at the back, and the exact same faces in the exact same seats, every single week.',
  },
  {
    id: 'oldCinema',
    name: 'The Rialto',
    town: 'Fenmore',
    capacity: 1100,
    localCrowd: 700,
    rentPerWeek: 430,
    topTicket: 19,
    merchMultiplier: 0.5,
    // A cinema has a screen where the stage would go and no room to hang anything.
    productionCapacity: 4,
    atmosphere: 8,
    blurb: 'An old movie house that stopped showing movies years ago. Sloped floor, red seats, and genuinely wonderful sound.',
  },
  {
    id: 'grangeHall',
    name: 'The Grange Hall',
    town: 'Otter Fork',
    capacity: 520,
    localCrowd: 400,
    rentPerWeek: 120,
    topTicket: 12,
    merchMultiplier: 0.35,
    productionCapacity: 4,
    atmosphere: 6,
    blurb: 'The single cheapest room in the whole business. Bare boards, a woodstove, and four hundred dead-loyal regulars.',
  },
  {
    id: 'ballroom',
    name: 'The Starlite Ballroom',
    town: 'Vance City',
    capacity: 1600,
    localCrowd: 1000,
    rentPerWeek: 780,
    topTicket: 26,
    merchMultiplier: 0.6,
    productionCapacity: 9,
    atmosphere: 4,
    blurb: 'A real dance hall in a town with an actual downtown. The biggest room in this whole business that will do this.',
  },
  {
    id: 'stockBarn',
    name: 'The Stock Barn',
    town: 'Halloway',
    capacity: 1400,
    localCrowd: 800,
    rentPerWeek: 380,
    topTicket: 15,
    merchMultiplier: 0.45,
    productionCapacity: 11,
    // Concrete, corrugated iron, and cattle three days a week.
    atmosphere: 1,
    blurb: 'Rodeo the rest of the year. Absolutely enormous, freezing cold, and it smells exactly like it sounds.',
  },
  {
    id: 'seasideHall',
    name: 'The Pier Pavilion',
    town: 'Cold Harbor',
    capacity: 800,
    localCrowd: 390,
    rentPerWeek: 230,
    topTicket: 22,
    // A tourist town: a smaller crowd with more money, and half of it leaves in September.
    merchMultiplier: 0.75,
    productionCapacity: 6,
    atmosphere: 6,
    blurb: 'A vacation town completely out of season. Fewer people than anywhere else on this list, and they actually spend.',
  },
  {
    id: 'unionSocial',
    name: 'The Ironworkers’ Social Club',
    town: 'Deshler',
    capacity: 760,
    localCrowd: 590,
    rentPerWeek: 265,
    topTicket: 16,
    merchMultiplier: 0.4,
    productionCapacity: 6,
    atmosphere: 9,
    blurb: 'The single loudest six hundred people you will ever work in front of, no contest.',
  },
];

export function residencyHomeById(id: Id): ResidencyHome | undefined {
  return RESIDENCY_HOMES.find((h) => h.id === id);
}
