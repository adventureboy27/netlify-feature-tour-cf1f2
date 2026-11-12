// How a match is worked — the pace the booker calls for.
//
// The lever this adds is not "make the match better". Every pace is the right
// call somewhere and the wrong call somewhere else, and which is which
// depends on things the player already knows: who is in it, where it is on
// the card, and how much they have left in the tank.
//
//   SPRINT is the hot opener. Short, quick, gets a crowd going, and costs
//   almost nothing physically. It also has a low ceiling — you cannot have a
//   classic in six minutes — so calling for one in a main event tells a
//   paying crowd their main event was an afterthought.
//
//   STANDARD is the default and has no opinion about anything.
//
//   SLOW BUILD is the one that separates workers from bodies. Its payoff
//   scales off ring skill: put two craftsmen in there and it is the best
//   thing on the card, put two brawlers in there and the building sits on
//   its hands. The riskiest call and the highest ceiling for a good roster.
//
//   ALL OUT is the blow-away. The biggest rating on offer, and it costs
//   health, energy and a real chance somebody does not come out of it right.
//   It is also the one the crowd gets numb to: doing it every week is how a
//   promotion runs out of ways to escalate.

import type { PaceId } from '../engine/types';

export type { PaceId };

export interface Pace {
  id: PaceId;
  name: string;
  blurb: string;
  /** Flat rating swing before anything situational. */
  ratingBonus: number;
  /**
   * How much of the rating rides on ring skill. Above zero means good
   * workers gain and poor ones lose — the whole point of slow build.
   */
  skillWeight: number;
  /** Ceiling on what this pace can ever produce. Sprints do not go five stars. */
  ratingCeiling: number;
  /** Multipliers on what the match takes out of the people in it. */
  healthCostMultiplier: number;
  energyCostMultiplier: number;
  injuryMultiplier: number;
  /**
   * Penalty when this pace is called for the main event. A crowd that sat
   * through a card expecting a blow-off does not want six minutes.
   */
  mainEventPenalty: number;
  /** Bonus when it opens the show, where a hot start is worth most. */
  openerBonus: number;
  /**
   * Penalty everywhere that is not the opener.
   *
   * Sprint needs this or it is free rating: its only other cost is a ceiling,
   * and a ceiling is inert on a roster whose matches do not approach it. A
   * card of six sprints should feel like a card of six sprints.
   */
  offSpotPenalty: number;
  /** How much crowds tire of seeing it. Feeds the same saturation idea as hardcore. */
  saturationPerUse: number;
}

export const PACES: Pace[] = [
  {
    id: 'sprint',
    name: 'Sprint',
    blurb: 'Short, fast, and over before anybody sits down. Cheap on the body.',
    ratingBonus: 2,
    skillWeight: 0,
    ratingCeiling: 52,
    healthCostMultiplier: 0.55,
    energyCostMultiplier: 0.6,
    injuryMultiplier: 0.6,
    mainEventPenalty: 14,
    openerBonus: 7,
    offSpotPenalty: 5,
    saturationPerUse: 0,
  },
  {
    id: 'standard',
    name: 'Standard',
    blurb: 'Work it the way you always work it.',
    ratingBonus: 0,
    skillWeight: 0,
    ratingCeiling: 100,
    healthCostMultiplier: 1,
    energyCostMultiplier: 1,
    injuryMultiplier: 1,
    mainEventPenalty: 0,
    openerBonus: 0,
    offSpotPenalty: 0,
    saturationPerUse: 0,
  },
  {
    id: 'slowBuild',
    name: 'Slow build',
    blurb: 'Let it breathe. Wonderful with workers, agony without them.',
    ratingBonus: -3,
    skillWeight: 30,
    ratingCeiling: 100,
    healthCostMultiplier: 0.8,
    energyCostMultiplier: 0.9,
    injuryMultiplier: 0.75,
    mainEventPenalty: 0,
    openerBonus: -4,
    offSpotPenalty: 0,
    saturationPerUse: 0,
  },
  {
    id: 'allOut',
    name: 'All out',
    blurb: 'Everything they have. The best match on the card, and it costs.',
    ratingBonus: 11,
    skillWeight: 6,
    ratingCeiling: 100,
    healthCostMultiplier: 1.9,
    energyCostMultiplier: 1.6,
    injuryMultiplier: 1.8,
    mainEventPenalty: 0,
    openerBonus: -2,
    offSpotPenalty: 0,
    // Per match, so one blow-away a week is sustainable and a card of six is
    // not. Decay is 7 a week — the arithmetic is the design.
    saturationPerUse: 8,
  },
];

export function paceById(id: PaceId): Pace {
  return PACES.find((p) => p.id === id) ?? PACES[1]!;
}

export const DEFAULT_PACE: PaceId = 'standard';
