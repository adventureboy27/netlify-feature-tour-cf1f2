// Stipulation table, booking-game-design.md §9.
// "Booking a stipulation whose requirements aren't met is allowed but
// incurs a 'doesn't make sense' penalty of -8 rating and -5 morale" — see
// engine/sim/matchRating.ts's mismatchedStipulation term, fed by
// stipulationRequirementsMet() below.
//
// Three things a stipulation can carry beyond its numbers:
//   impliedRules   what the match *is* in rules terms (No-DQ turns DQs off)
//   finishWeights  how it has to end — you go through the table or it was
//                  not a tables match
//   isBlowoff      winning it resolves the rivalry that earned it (§12.5)
//
// violenceLevel drives hardcore saturation at 6 points each (§11.4), so the
// scale doubles as a budget: one flaming table is 30 points of the
// promotion's 100, against a counter that only sheds 8 a week.

import type { Stipulation, Wrestler } from '../engine/types';

export const STIPULATIONS: Stipulation[] = [
  {
    id: 'steelCage',
    name: 'Steel Cage',
    blurb: 'Walls up. No way out but through them.',
    ratingBonus: 6,
    violenceLevel: 2,
    injuryMult: 1.4,
    heatRequirement: 40,
    archetypeFit: [],
    impliedRules: { countOuts: 'none' },
    finishWeights: { countOut: 0, disqualification: 0.4 },
  },
  {
    id: 'ladder',
    name: 'Ladder Match',
    blurb: 'Whatever hangs above the ring settles it.',
    ratingBonus: 9,
    violenceLevel: 3,
    injuryMult: 2.0,
    avgStatRequirement: { stat: 'agility', min: 60 },
    archetypeFit: ['highFlyer'],
    impliedRules: { ruleStrictness: 'none' },
    finishWeights: { knockout: 2.2, submission: 0.2 },
  },
  {
    id: 'noDQ',
    name: 'No Disqualification',
    blurb: 'The rulebook goes out. Nothing else changes.',
    // DESIGN: split out of the old combined "Hardcore / No-DQ" entry. They
    // are different bookings — No-DQ removes a rule, hardcore promises
    // weapons. Fused, a booker who wanted a clean grudge match with no
    // count-outs had to pay a violence-4 saturation cost for a garbage
    // brawl they never asked for.
    ratingBonus: 4,
    violenceLevel: 2,
    injuryMult: 1.4,
    archetypeFit: [],
    impliedRules: { ruleStrictness: 'none', countOuts: 'none' },
    finishWeights: { disqualification: 0, countOut: 0, interference: 2.5 },
  },
  {
    id: 'hardcore',
    name: 'Hardcore',
    blurb: 'Weapons legal. Everywhere is the ring.',
    ratingBonus: 7,
    violenceLevel: 4,
    injuryMult: 1.9,
    archetypeFit: ['brawler'],
    impliedRules: { ruleStrictness: 'none', countOuts: 'none', falls: 'anyMeans' },
    finishWeights: { disqualification: 0, countOut: 0, knockout: 2.4, submission: 0.3 },
  },
  {
    id: 'streetFight',
    name: 'Street Fight',
    blurb: 'They came dressed to fight, not to wrestle.',
    ratingBonus: 6,
    violenceLevel: 4,
    injuryMult: 1.8,
    heatRequirement: 50,
    archetypeFit: ['brawler'],
    impliedRules: { ruleStrictness: 'none', countOuts: 'none' },
    finishWeights: { disqualification: 0, countOut: 0, knockout: 1.8 },
  },
  {
    id: 'tables',
    name: 'Tables Match',
    blurb: 'You lose when you go through one.',
    ratingBonus: 6,
    violenceLevel: 3,
    injuryMult: 1.7,
    heatRequirement: 30,
    archetypeFit: ['powerhouse'],
    impliedRules: { ruleStrictness: 'none', falls: 'knockout', countOuts: 'none' },
    // There is exactly one way to win, so the finish roll collapses onto it.
    finishWeights: {
      knockout: 6,
      cleanPin: 0,
      submission: 0,
      rollup: 0,
      disqualification: 0,
      countOut: 0,
      refereeStoppage: 0,
    },
    finishFlavor: {
      knockout: 'drove {loser} through the table in the corner',
      interference: 'sent {loser} through a table with help from outside',
      doubleKO: 'took {loser} through a table and went through it with them',
    },
  },
  {
    id: 'flamingTables',
    name: 'Flaming Tables',
    blurb: 'The table is on fire. Someone still goes through it.',
    // The most violent thing the game will book. Rated highest, and the
    // saturation cost is deliberately punishing: 30 points against a counter
    // that sheds 8 a week makes this a once-a-month card-topper, not a
    // weekly gimmick. Lean on it and every match on the show loses rating.
    ratingBonus: 13,
    violenceLevel: 5,
    injuryMult: 2.6,
    heatRequirement: 70,
    archetypeFit: ['brawler'],
    impliedRules: { ruleStrictness: 'none', falls: 'knockout', countOuts: 'none' },
    finishWeights: {
      knockout: 6,
      cleanPin: 0,
      submission: 0,
      rollup: 0,
      disqualification: 0,
      countOut: 0,
      refereeStoppage: 0,
      doubleKO: 2.5,
    },
    finishFlavor: {
      knockout: 'put {loser} through the burning table and the arena lost its mind',
      doubleKO: 'took {loser} through the fire and neither of them got up',
    },
    isBlowoff: true,
  },
  {
    id: 'casket',
    name: 'Casket Match',
    blurb: 'Win by shutting your opponent in and closing the lid.',
    ratingBonus: 8,
    violenceLevel: 2,
    injuryMult: 1.3,
    heatRequirement: 55,
    archetypeFit: ['monster'],
    impliedRules: { ruleStrictness: 'none', falls: 'knockout', countOuts: 'none' },
    finishWeights: {
      knockout: 5,
      cleanPin: 0,
      submission: 0,
      rollup: 0,
      disqualification: 0,
      countOut: 0,
      timeLimitDraw: 0,
      refereeStoppage: 0,
    },
    finishFlavor: {
      knockout: 'rolled {loser} into the casket and slammed the lid',
      interference: 'got {loser} into the casket while the referee was down',
    },
  },
  {
    id: 'lastManStanding',
    name: 'Last Man Standing',
    blurb: 'Ten count, no pins. Stay down and it is over.',
    ratingBonus: 8,
    violenceLevel: 4,
    injuryMult: 2.1,
    heatRequirement: 60,
    archetypeFit: ['powerhouse'],
    impliedRules: { ruleStrictness: 'none', falls: 'knockout', aim: 'lastStanding', countOuts: 'none' },
    finishWeights: { knockout: 5, cleanPin: 0, rollup: 0, submission: 0.2, disqualification: 0, countOut: 0 },
  },
  {
    id: 'ironMan',
    name: 'Iron Man',
    blurb: 'Most falls before the clock runs out.',
    // DESIGN: Iron Man's second requirement (time >= 30) lives on MatchRules,
    // not Stipulation — checked separately in stipulationRequirementsMet().
    ratingBonus: 10,
    violenceLevel: 1,
    injuryMult: 1.2,
    avgStatRequirement: { stat: 'stamina', min: 70 },
    archetypeFit: ['technician'],
    impliedRules: { aim: 'ironMan' },
    finishWeights: { timeLimitDraw: 2.5 },
  },
  {
    id: 'submissionMatch',
    name: 'Submission Match',
    blurb: 'Tap or pass out. Nothing else counts.',
    ratingBonus: 5,
    violenceLevel: 1,
    injuryMult: 1.3,
    avgStatRequirement: { stat: 'skill', min: 60 },
    archetypeFit: ['technician'],
    impliedRules: { falls: 'subsOnly', aim: 'submissionOnly' },
    finishWeights: { submission: 6, cleanPin: 0, rollup: 0, knockout: 0.4 },
  },
  {
    id: 'hairVsHair',
    name: 'Hair vs Hair',
    blurb: 'The loser is shaved bald in the ring.',
    ratingBonus: 11,
    violenceLevel: 2,
    injuryMult: 1.2,
    heatRequirement: 75,
    archetypeFit: [],
    isBlowoff: true,
  },
  {
    id: 'maskVsMask',
    name: 'Mask vs Mask',
    blurb: 'The loser unmasks and never wears it again.',
    // DESIGN: Mask vs Mask's "both masked" requirement isn't expressible as a
    // Stipulation field — checked separately in stipulationRequirementsMet().
    ratingBonus: 12,
    violenceLevel: 2,
    injuryMult: 1.2,
    heatRequirement: 75,
    archetypeFit: [],
    isBlowoff: true,
  },
  {
    id: 'loserLeaves',
    name: 'Loser Leaves',
    blurb: 'The loser is off television.',
    ratingBonus: 11,
    violenceLevel: 2,
    injuryMult: 1.3,
    heatRequirement: 80,
    archetypeFit: [],
    isBlowoff: true,
  },
  {
    id: 'battleRoyal',
    name: 'Battle Royal',
    blurb: 'Over the top rope, both feet on the floor.',
    ratingBonus: 4,
    violenceLevel: 2,
    injuryMult: 1.5,
    minParticipants: 8,
    archetypeFit: [],
    finishWeights: { knockout: 2, submission: 0, timeLimitDraw: 0 },
  },
  {
    id: 'squash',
    name: 'Squash',
    blurb: 'One-sided by design. Makes the winner, buries the loser.',
    ratingBonus: -6,
    violenceLevel: 1,
    injuryMult: 0.8,
    popGapRequirement: 35,
    archetypeFit: ['monster'],
    finishWeights: { cleanPin: 3, knockout: 2, timeLimitDraw: 0, rollup: 0.2 },
  },
];

export function stipulationById(id: string): Stipulation | undefined {
  return STIPULATIONS.find((s) => s.id === id);
}

/** Grudge stipulations — the ones §12.5 lets a rivalry cash itself out in. */
export function blowoffStipulations(): Stipulation[] {
  return STIPULATIONS.filter((s) => s.isBlowoff);
}

export interface StipulationCheckContext {
  participants: Wrestler[];
  rivalryHeat: number;
  matchTimeLimitMinutes: number; // 0 = no limit
}

/** §9: "Booking a stipulation whose requirements aren't met is allowed but incurs a penalty." */
export function stipulationRequirementsMet(stipulation: Stipulation, ctx: StipulationCheckContext): boolean {
  if (stipulation.heatRequirement !== undefined && ctx.rivalryHeat < stipulation.heatRequirement) return false;

  if (stipulation.avgStatRequirement) {
    const avg = ctx.participants.reduce((sum, p) => sum + p[stipulation.avgStatRequirement!.stat], 0) / ctx.participants.length;
    if (avg < stipulation.avgStatRequirement.min) return false;
  }

  if (stipulation.minParticipants !== undefined && ctx.participants.length < stipulation.minParticipants) return false;

  if (stipulation.popGapRequirement !== undefined) {
    const pops = ctx.participants.map((p) => p.popularity);
    const gap = Math.max(...pops) - Math.min(...pops);
    if (gap < stipulation.popGapRequirement) return false;
  }

  if (stipulation.id === 'ironMan' && ctx.matchTimeLimitMinutes < 30) return false;
  if (stipulation.id === 'maskVsMask' && !ctx.participants.every((p) => p.appearance.mask !== 0)) return false;

  return true;
}

/** A stipulation's rules layered over the segment's, without mutating either (§9). */
export function effectiveRules<T extends object>(baseRules: T, stipulation: Stipulation | null): T {
  return stipulation?.impliedRules ? { ...baseRules, ...stipulation.impliedRules } : baseRules;
}
