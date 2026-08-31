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
import type { Rng } from '../engine/rng';
import { pick } from '../engine/rng';

export const STIPULATIONS: Stipulation[] = [
  {
    id: 'steelCage',
    name: 'Steel Cage',
    blurb: 'The walls go up and the door locks. Nobody leaves until somebody climbs out.',
    ratingBonus: 6,
    violenceLevel: 2,
    injuryMult: 1.4,
    hardwareGearSensitive: true,
    gearFamilyId: 'steelCage',
    heatRequirement: 40,
    archetypeFit: [],
    impliedRules: { countOuts: 'none', aim: 'escape' },
    finishWeights: { countOut: 0, disqualification: 0.4, escape: 3 },
    finishFlavor: {
      cleanPin: 'planted {loser} for the three count with that cage still rattling on its hinges',
      submission: 'folded {loser} up in the corner of that cage and cranked the hold until the tap came',
      knockout: 'hammered {loser} into the chain-link until there was nothing left to give',
      escape: 'beat {loser} to the door and hit that arena floor first for the escape',
      equipmentFailure: 'was still working the lock with {loser} when a hinge went first, and neither of them ever got that door open clean',
    },
  },
  {
    id: 'ladder',
    name: 'Ladder Match',
    blurb: 'Climb for it. Whatever is hanging up there settles the whole thing.',
    ratingBonus: 9,
    violenceLevel: 3,
    injuryMult: 2.0,
    hardwareGearSensitive: true,
    gearFamilyId: 'ladder',
    avgStatRequirement: { stat: 'agility', min: 60 },
    archetypeFit: ['highFlyer'],
    impliedRules: { ruleStrictness: 'none' },
    finishWeights: { knockout: 2.2, submission: 0.2 },
    finishFlavor: {
      knockout: 'beat {loser} up the ladder and ripped the prize down off the hook to steal it',
      submission: 'caught {loser} at the peak of the ladder and simply would not let them come back down',
      equipmentFailure: 'had {loser} beat to the top when the ladder gave out from under both of them, and nobody ever got a hand on what was hanging up there',
    },
  },
  {
    id: 'noDQ',
    name: 'No Disqualification',
    blurb: 'Throw the rulebook out the window. Everything else stays exactly the same.',
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
    finishFlavor: {
      interference: 'let the cavalry run wild — {loser} never saw the finish coming through the pier-six brawl at ringside',
      knockout: 'found the opening No Disqualification promised and put {loser} away for good',
      cleanPin: 'cut through every excuse this stipulation offers and pinned {loser} clean anyway',
      submission: 'wrenched the hold on with no referee left to save {loser} from it',
    },
    // No rules to break, so no protection from breaking them.
    titleChangesOnDQ: true,
  },
  {
    id: 'hardcore',
    name: 'Hardcore',
    blurb: 'Weapons legal, everywhere. The whole building is the ring tonight.',
    ratingBonus: 7,
    violenceLevel: 4,
    injuryMult: 1.9,
    archetypeFit: ['brawler'],
    impliedRules: { ruleStrictness: 'none', countOuts: 'none', falls: 'anyMeans' },
    finishWeights: { disqualification: 0, countOut: 0, knockout: 2.4, submission: 0.3 },
    finishFlavor: {
      knockout: 'found a {weapon} when the moment called for it and put {loser} down for the count',
      submission: 'grabbed whatever was closest to force the tap out of {loser}',
    },
    // No rules to break, so no protection from breaking them.
    titleChangesOnDQ: true,
  },
  {
    id: 'streetFight',
    name: 'Street Fight',
    blurb: 'Forget wrestling — these two came dressed to fight.',
    ratingBonus: 6,
    violenceLevel: 4,
    injuryMult: 1.8,
    heatRequirement: 50,
    archetypeFit: ['brawler'],
    impliedRules: { ruleStrictness: 'none', countOuts: 'none' },
    finishWeights: { disqualification: 0, countOut: 0, knockout: 1.8 },
    finishFlavor: {
      knockout: 'dropped {loser} with a {weapon} that had no business anywhere near a wrestling ring',
    },
    // No rules to break, so no protection from breaking them.
    titleChangesOnDQ: true,
  },
  {
    id: 'tables',
    name: 'Tables Match',
    blurb: 'Simple as it sounds: go through a table, and this one is over.',
    ratingBonus: 6,
    violenceLevel: 3,
    injuryMult: 1.7,
    hardwareGearSensitive: true,
    gearFamilyId: 'tables',
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
      equipmentFailure: 'put {loser} through the table exactly like the stipulation called for, except the wood never gave — and there was no way to call that a finish',
    },
  },
  {
    id: 'flamingTables',
    name: 'Flaming Tables',
    blurb: 'The table is already on fire, and somebody is still going through it tonight.',
    // The most violent thing the game will book. Rated highest, and the
    // saturation cost is deliberately punishing: 30 points against a counter
    // that sheds 8 a week makes this a once-a-month card-topper, not a
    // weekly gimmick. Lean on it and every match on the show loses rating.
    ratingBonus: 13,
    violenceLevel: 5,
    injuryMult: 2.6,
    hardwareGearSensitive: true,
    gearFamilyId: 'tables',
    // Same family and tiers as a plain Tables Match, but this one is
    // actually on fire — the table does not come back from that the way a
    // table that just got broken does.
    gearWearMultiplier: 5,
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
      equipmentFailure: 'drove {loser} toward the fire right on schedule, except the table held under both of them, and the whole thing died right there',
    },
    isBlowoff: true,
  },
  {
    id: 'casket',
    name: 'Casket Match',
    blurb: 'Shut the lid on your opponent and that is the whole match, right there.',
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
    blurb: 'No pins, no submissions — just a ten count. Stay down and you lose.',
    ratingBonus: 8,
    violenceLevel: 4,
    injuryMult: 2.1,
    heatRequirement: 60,
    archetypeFit: ['powerhouse'],
    impliedRules: { ruleStrictness: 'none', falls: 'knockout', aim: 'lastStanding', countOuts: 'none' },
    finishWeights: { knockout: 5, cleanPin: 0, rollup: 0, submission: 0.2, disqualification: 0, countOut: 0 },
    finishFlavor: {
      knockout: 'left {loser} flat on the canvas as the referee counted all the way to ten with no answer',
      submission: 'battered the tap out of {loser} rather than wait on the count — same result, less patience',
    },
  },
  {
    id: 'ironMan',
    name: 'Iron Man',
    blurb: 'Whoever is ahead on falls when that clock hits zero wins it.',
    // DESIGN: Iron Man's second requirement (time >= 30) lives on MatchRules,
    // not Stipulation — checked separately in stipulationRequirementsMet().
    ratingBonus: 10,
    violenceLevel: 1,
    injuryMult: 1.2,
    avgStatRequirement: { stat: 'stamina', min: 70 },
    archetypeFit: ['technician'],
    impliedRules: { aim: 'ironMan' },
    finishWeights: { timeLimitDraw: 2.5 },
    finishFlavor: {
      // A genuine timeLimitDraw finish here really is a tie — winnerSide
      // stays null, same as any other draw. This only replaces the
      // GENERIC line ("the bell rang with both still standing"), which
      // reads like a standstill nobody was tracking. Iron Man's whole
      // premise is a running scorecard, so the draw gets described in
      // those terms instead — still honestly a tie, framed correctly.
      timeLimitDraw: 'battled {loser} dead even on the scorecard, and the final bell beat them both to a winner',
      cleanPin: 'banked the deciding fall on {loser} with time still on the board',
      submission: 'forced the deciding tap out of {loser} to seal the count',
    },
  },
  {
    id: 'submissionMatch',
    name: 'Submission Match',
    blurb: 'Tap out or pass out — there is no other way this one ends.',
    ratingBonus: 5,
    violenceLevel: 1,
    injuryMult: 1.3,
    avgStatRequirement: { stat: 'skill', min: 60 },
    archetypeFit: ['technician'],
    impliedRules: { falls: 'subsOnly', aim: 'submissionOnly' },
    finishWeights: { submission: 6, cleanPin: 0, rollup: 0, knockout: 0.4 },
    finishFlavor: {
      submission: 'buried the hold on {loser} until there was no answer left but the tap',
      knockout: 'wrenched {loser} clean past consciousness before the tap ever came — the referee had no call to make but one',
    },
  },
  {
    id: 'hairVsHair',
    name: 'Hair vs Hair',
    blurb: 'Lose, and the clippers come out right there in the ring.',
    ratingBonus: 11,
    violenceLevel: 2,
    injuryMult: 1.2,
    heatRequirement: 75,
    archetypeFit: [],
    finishFlavor: {
      cleanPin: 'pinned {loser} flat, and the clippers are already on their way to the ring',
      knockout: 'put {loser} away cold — the barber does not need them conscious for this part',
      submission: 'dragged the tap out of {loser} knowing exactly what is waiting at ringside',
    },
    isBlowoff: true,
  },
  {
    id: 'maskVsMask',
    name: 'Mask vs Mask',
    blurb: 'Lose, and that mask comes off for good tonight.',
    // DESIGN: Mask vs Mask's "both masked" requirement isn't expressible as a
    // Stipulation field — checked separately in stipulationRequirementsMet().
    ratingBonus: 12,
    violenceLevel: 2,
    injuryMult: 1.2,
    heatRequirement: 75,
    archetypeFit: [],
    finishFlavor: {
      cleanPin: 'pinned {loser} to the mat — and by the terms of the match, that mask comes off tonight',
      knockout: 'put {loser} down for good, and the unmasking starts the second the referee\'s hand hits three',
      submission: 'dragged the tap out of {loser}, and the mask goes with it',
    },
    isBlowoff: true,
  },
  {
    id: 'loserLeaves',
    name: 'Loser Leaves',
    blurb: 'Lose, and you are off this television for good.',
    ratingBonus: 11,
    violenceLevel: 2,
    injuryMult: 1.3,
    heatRequirement: 80,
    archetypeFit: [],
    finishFlavor: {
      cleanPin: 'pinned {loser} for the three count that ends their run here for good',
      knockout: 'put {loser} away cold — and by the stipulation, out the door right behind them',
      submission: 'forced the tap that sends {loser} out of the promotion for good',
    },
    isBlowoff: true,
  },
  {
    id: 'battleRoyal',
    name: 'Battle Royal',
    blurb: 'Over the top and both feet hit the floor. Last one in the ring wins it.',
    ratingBonus: 4,
    violenceLevel: 2,
    injuryMult: 1.5,
    minParticipants: 8,
    archetypeFit: [],
    finishWeights: { knockout: 2, submission: 0, timeLimitDraw: 0 },
    finishFlavor: {
      knockout: 'tossed {loser} over the top rope and out to the floor to end it',
    },
  },
  {
    id: 'squash',
    name: 'Squash',
    blurb: 'One-sided on purpose — built to make a star and bury an opponent.',
    ratingBonus: -6,
    violenceLevel: 1,
    injuryMult: 0.8,
    popGapRequirement: 35,
    archetypeFit: ['monster'],
    finishWeights: { cleanPin: 3, knockout: 2, timeLimitDraw: 0, rollup: 0.2 },
  },
  {
    id: 'arenaFloor',
    name: 'Arena Floor',
    blurb: 'No ring, no ropes — bare concrete and whatever barrier is still standing. Unlocked, never scheduled by choice from a cold start.',
    ratingBonus: 10,
    violenceLevel: 3,
    injuryMult: 2.3,
    archetypeFit: [],
    locked: true,
    finishWeights: { knockout: 1.6, submission: 0.3, cleanPin: 0.4, timeLimitDraw: 0 },
    finishFlavor: {
      knockout: 'flattened {loser} on the bare concrete with nothing underneath either of them but the floor',
      cleanPin: 'made the count for real, right there on the arena floor, with no mat to land soft on',
      submission: 'cranked {loser} into it on the cement with nowhere to go and no rope to reach for',
    },
  },
  {
    id: 'fallsCountAnywhere',
    name: 'Falls Count Anywhere',
    blurb: 'Wherever this one ends up, the count still works. Locked until the promotion has the standing to let a match leave the ring.',
    ratingBonus: 8,
    violenceLevel: 2,
    injuryMult: 1.6,
    heatRequirement: 45,
    archetypeFit: [],
    locked: true,
    impliedRules: { countOuts: 'none' },
    finishWeights: { countOut: 0, cleanPin: 2, knockout: 1.5, submission: 1, disqualification: 0.3 },
    finishFlavor: {
      cleanPin: 'chased {loser} out past the barricades and pinned them cold wherever the fight actually ended',
      knockout: 'finished it far from the ring, with nobody around to make a ten count matter',
      submission: 'dragged {loser} down somewhere the referee had to run to reach, and wrung the tap out right there',
    },
  },
  {
    id: 'blindfoldMatch',
    name: 'Blindfold Match',
    blurb: 'Both competitors go in unable to see a thing. Locked until the promotion has been around long enough to risk looking silly.',
    ratingBonus: -3,
    violenceLevel: 1,
    injuryMult: 1.1,
    archetypeFit: ['showman'],
    locked: true,
    finishWeights: { cleanPin: 2, rollup: 1, knockout: 0.3, submission: 0.2 },
    finishFlavor: {
      cleanPin: 'stumbled into {loser} by pure luck and somehow made the pin count',
      rollup: 'got tangled up with {loser} in the dark and came out the one with the shoulders down',
      knockout: 'swung blind and connected anyway, which is more than {loser} can say for their night',
    },
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
  /** Usable owned units of whatever data/matchProps.ts family this stipulation needs. Irrelevant when gearFamilyId is unset. */
  ownedGearUnits: number;
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
  if (stipulation.id === 'maskVsMask' && !ctx.participants.every((p) => p.masked)) return false;

  // You can't have a ladder match without a ladder. See data/matchProps.ts.
  if (stipulation.gearFamilyId && ctx.ownedGearUnits < (stipulation.minGearUnits ?? 1)) return false;

  return true;
}

/** A stipulation's rules layered over the segment's, without mutating either (§9). */
export function effectiveRules<T extends object>(baseRules: T, stipulation: Stipulation | null): T {
  return stipulation?.impliedRules ? { ...baseRules, ...stipulation.impliedRules } : baseRules;
}

export type StipulationConsequence = 'shaveHead' | 'unmask' | 'release';

/**
 * What a blowoff stipulation actually costs the loser, beyond ending the
 * feud. `isBlowoff` alone only ever resolved the rivalry — nobody's hair
 * came off, no mask came off, nobody actually left. The caller applies this
 * to the loser only once, and only on a decisive finish (the same test
 * simulateMatch.ts already runs to decide whether a grudge stipulation
 * settled the story).
 */
export function stipulationConsequence(stipulationId: string | null): StipulationConsequence | null {
  switch (stipulationId) {
    case 'hairVsHair':
      return 'shaveHead';
    case 'maskVsMask':
      return 'unmask';
    case 'loserLeaves':
      return 'release';
    default:
      return null;
  }
}

const SHAVE_HEAD_LINES = [
  'The clippers came out ringside, and {name} sat there and took it — bald, on national television, exactly as advertised.',
  "There is no getting out of it now: {name}'s head is shaved clean, right there in the middle of that ring.",
  "{name} put the hair on the line and lost it — every last bit of it, gone under the clippers before the crowd even sat back down.",
];

const UNMASK_LINES = [
  'The mask comes off — {name} stands revealed in the middle of that ring, for the first time anybody in this business has ever seen it.',
  '{name} loses the mask for good tonight, and whatever face was underneath it is the only one this business gets from here on out.',
  'That mask is gone — {name} unmasks right there on the mat, and there is no putting it back on after tonight.',
];

const RELEASE_LINES = [
  '{name} loses this one and, by the letter of the stipulation, loses their spot on the roster with it — released, effective tonight.',
  'That is it for {name} around here. The terms were the terms, and the office is honoring them: gone, as of tonight.',
  '{name} paid the stipulation in full — out the door tonight, no matter what anybody in the front office might have wanted.',
];

/** The follow-through beat for a blowoff stipulation's real stake, once `stipulationConsequence` has fired. */
export function stipulationConsequenceLine(consequence: StipulationConsequence, rng: Rng, name: string): string {
  const pool =
    consequence === 'shaveHead' ? SHAVE_HEAD_LINES : consequence === 'unmask' ? UNMASK_LINES : RELEASE_LINES;
  return pick(rng, pool).replace(/\{name\}/g, name);
}
