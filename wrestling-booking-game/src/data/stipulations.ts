// Stipulation table, booking-game-design.md §9.
// "Booking a stipulation whose requirements aren't met is allowed but
// incurs a 'doesn't make sense' penalty of -8 rating and -5 morale" — see
// engine/sim/matchRating.ts's mismatchedStipulation term, fed by
// stipulationRequirementsMet() below.

import type { Stipulation, Wrestler } from '../engine/types';

export const STIPULATIONS: Stipulation[] = [
  { id: 'steelCage', name: 'Steel Cage', ratingBonus: 6, violenceLevel: 2, injuryMult: 1.4, heatRequirement: 40, archetypeFit: [] },
  { id: 'ladder', name: 'Ladder Match', ratingBonus: 9, violenceLevel: 3, injuryMult: 2.0, avgStatRequirement: { stat: 'agility', min: 60 }, archetypeFit: ['highFlyer'] },
  { id: 'hardcore', name: 'Hardcore / No-DQ', ratingBonus: 7, violenceLevel: 4, injuryMult: 1.9, archetypeFit: ['brawler'] },
  { id: 'streetFight', name: 'Street Fight', ratingBonus: 6, violenceLevel: 4, injuryMult: 1.8, heatRequirement: 50, archetypeFit: ['brawler'] },
  { id: 'lastManStanding', name: 'Last Man Standing', ratingBonus: 8, violenceLevel: 4, injuryMult: 2.1, heatRequirement: 60, archetypeFit: ['powerhouse'] },
  // DESIGN: Iron Man's second requirement (time >= 30) lives on MatchRules,
  // not Stipulation — checked separately in stipulationRequirementsMet().
  { id: 'ironMan', name: 'Iron Man', ratingBonus: 10, violenceLevel: 1, injuryMult: 1.2, avgStatRequirement: { stat: 'stamina', min: 70 }, archetypeFit: ['technician'] },
  { id: 'submissionMatch', name: 'Submission Match', ratingBonus: 5, violenceLevel: 1, injuryMult: 1.3, avgStatRequirement: { stat: 'skill', min: 60 }, archetypeFit: ['technician'] },
  { id: 'hairVsHair', name: 'Hair vs Hair', ratingBonus: 11, violenceLevel: 2, injuryMult: 1.2, heatRequirement: 75, archetypeFit: [] },
  // DESIGN: Mask vs Mask's "both masked" requirement isn't expressible as a
  // Stipulation field — checked separately in stipulationRequirementsMet().
  { id: 'maskVsMask', name: 'Mask vs Mask', ratingBonus: 12, violenceLevel: 2, injuryMult: 1.2, heatRequirement: 75, archetypeFit: [] },
  { id: 'loserLeaves', name: 'Loser Leaves', ratingBonus: 11, violenceLevel: 2, injuryMult: 1.3, heatRequirement: 80, archetypeFit: [] },
  { id: 'battleRoyal', name: 'Battle Royal', ratingBonus: 4, violenceLevel: 2, injuryMult: 1.5, minParticipants: 8, archetypeFit: [] },
  { id: 'squash', name: 'Squash', ratingBonus: -6, violenceLevel: 1, injuryMult: 0.8, popGapRequirement: 35, archetypeFit: ['monster'] },
];

export function stipulationById(id: string): Stipulation | undefined {
  return STIPULATIONS.find((s) => s.id === id);
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
