// Match simulation orchestrator — wires kayfabe -> win probability -> finish
// -> rating -> narrative into the single entry point callers use.

import type { Rng } from '../rng';
import { chance, weightedPick } from '../rng';
import type {
  Id,
  Wrestler,
  MatchRules,
  Stipulation,
  FinishType,
  RatingBreakdownEntry,
  MatchBeat,
  WorldSettings,
  Rivalry,
} from '../types';
import { shootRatingBonus, shootInjuryMultiplier, heatFromMatch, type HeatChange } from './rivalry';
import type { RingsideTotals } from './ringside';
import { ruleAdjustedWeights, kayfabeScore } from './kayfabe';
import { pairWinProbability, multiManWinProbabilities } from './winProbability';
import { rollFinish, isDrawFinish, isNonDecisiveFinish } from './finish';
import { computeMatchRating } from './matchRating';
import { generateBeats } from './narrative';
import { effectiveRules } from '../../data/stipulations';

export interface SimParticipant {
  wrestlerId: Id;
  side: number;
}

export interface SimulateMatchContext {
  rules: MatchRules;
  stipulation: Stipulation | null;
  requirementsMet: boolean;
  isPPV: boolean;
  matchLengthMinutes: number;
  settings: WorldSettings;

  /** Deck-stacking odds shifts in percentage points, keyed by side. Empty until M4. */
  deckStackingShiftsBySide?: Record<number, number>;
  /** Managers, referee and any guest referee at ringside (§10). */
  ringside?: RingsideTotals;
  titlePrestige?: number | null;
  /** The rivalry these two are in, if any — drives heat, bad blood, and injury risk. */
  rivalry?: Rivalry | null;
  hardcoreSaturation?: number;
  slotExpectedPopularity?: number | null;
  instructionModifier?: number;
  territoryFit?: number;
  pairChemistryBonus?: number;
  overexposurePenalty?: number;
}

export interface MatchSimResult {
  winnerSide: number | null; // null for a draw
  winnerWrestlerIds: Id[];
  finish: FinishType;
  rating: number;
  stars: number;
  ratingBreakdown: RatingBreakdownEntry[];
  beats: MatchBeat[];
  winProbabilitiesBySide: Record<number, number>;
  /**
   * Combined injury multiplier for this match — the stipulation's, escalated
   * by any real animosity. Callers apply it when rolling injuries (M3); it is
   * surfaced here so a shoot rivalry's cost is computed in one place.
   */
  injuryMultiplier: number;
  /** How the rivalry moved, if these two were in one. Caller commits it. */
  heatChange: HeatChange | null;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function simulateMatch(
  rng: Rng,
  participants: SimParticipant[],
  wrestlerById: Map<Id, Wrestler>,
  ctx: SimulateMatchContext,
): MatchSimResult {
  const sides = [...new Set(participants.map((p) => p.side))].sort((a, b) => a - b);
  const isMultiMan = sides.length > 2;
  const isLadderOrHighSpot = ctx.stipulation?.id === 'ladder';

  // §9: a stipulation carries its own rules. Picking No-DQ *is* turning
  // disqualifications off — the player doesn't also have to find the switch.
  // Layered here rather than written back to the card so the booking stays
  // whatever the player typed if they later drop the stipulation.
  const rules = effectiveRules(ctx.rules, ctx.stipulation);
  const rivalry = ctx.rivalry ?? null;

  const weights = ruleAdjustedWeights(rules, isLadderOrHighSpot, isMultiMan);

  const sideMembers = new Map<number, Wrestler[]>();
  const sideKayfabe = new Map<number, number>();
  for (const side of sides) {
    const members = participants.filter((p) => p.side === side).map((p) => wrestlerById.get(p.wrestlerId)!);
    sideMembers.set(side, members);
    sideKayfabe.set(side, mean(members.map((w) => kayfabeScore(w, weights))));
  }

  const stackingShifts = ctx.deckStackingShiftsBySide ?? {};
  const winProbabilitiesBySide: Record<number, number> = {};
  let winnerSide: number;

  if (sides.length === 2) {
    const [a, b] = sides as [number, number];
    const p = pairWinProbability(
      sideKayfabe.get(a)!,
      sideKayfabe.get(b)!,
      stackingShifts[a] ?? 0,
      ctx.settings.oddsClampMin,
      ctx.settings.oddsClampMax,
    );
    winProbabilitiesBySide[a] = p;
    winProbabilitiesBySide[b] = 1 - p;
    winnerSide = chance(rng, p) ? a : b;
  } else {
    const scores = sides.map((s) => sideKayfabe.get(s)!);
    const shifts = sides.map((s) => stackingShifts[s] ?? 0);
    const probs = multiManWinProbabilities(scores, shifts);
    sides.forEach((s, i) => (winProbabilitiesBySide[s] = probs[i]!));
    winnerSide = weightedPick(rng, sides.map((s, i) => [s, probs[i]!] as const));
  }

  const winnerProbability = winProbabilitiesBySide[winnerSide]!;
  const isUpset = winnerProbability < 0.5;
  const winnerMembers = sideMembers.get(winnerSide)!;
  const loserMembers = sides.filter((s) => s !== winnerSide).flatMap((s) => sideMembers.get(s)!);
  const winnerIsTechnician = winnerMembers.some((w) => w.archetype === 'technician');

  const finish = rollFinish(rng, {
    rules,
    violenceLevel: ctx.stipulation?.violenceLevel ?? 0,
    winnerIsTechnician,
    isUpset,
    isCloselyMatched: Math.abs(winnerProbability - 0.5) < 0.1,
    finishWeights: ctx.stipulation?.finishWeights,
    injuryMultiplier: (ctx.stipulation?.injuryMult ?? 1) * shootInjuryMultiplier(rivalry ?? undefined, ctx.settings),
    // A crooked or incompetent official makes a screwy finish likelier; a
    // manager at ringside makes interference likelier still.
    ringsideWeights: ctx.ringside
      ? { screwy: ctx.ringside.screwyFinishWeight, interference: ctx.ringside.interferenceWeight }
      : undefined,
  });
  const draw = isDrawFinish(finish);

  const allParticipants = sides.flatMap((s) => sideMembers.get(s)!);
  const { rating, stars, breakdown } = computeMatchRating(rng, {
    participants: allParticipants,
    winProbability: winnerProbability,
    isPPV: ctx.isPPV,
    stipulation: ctx.stipulation,
    requirementsMet: ctx.requirementsMet,
    matchLengthMinutes: ctx.matchLengthMinutes,
    simVariance: ctx.settings.simVariance,
    finish,
    titlePrestige: ctx.titlePrestige ?? null,
    rivalryHeat: rivalry && rivalry.resolvedWeek === null ? rivalry.heat : 0,
    shootHeatBonus: shootRatingBonus(rivalry ?? undefined, ctx.settings),
    hardcoreSaturation: ctx.hardcoreSaturation ?? 0,
    slotExpectedPopularity: ctx.slotExpectedPopularity ?? null,
    instructionModifier: (ctx.instructionModifier ?? 0) + (ctx.ringside?.ratingBonus ?? 0),
    territoryFit: ctx.territoryFit ?? 0,
    pairChemistryBonus: ctx.pairChemistryBonus ?? 0,
    overexposurePenalty: ctx.overexposurePenalty ?? 0,
  });

  const beats = generateBeats(rng, { winnerMembers, loserMembers, finish, stars, stipulation: ctx.stipulation });

  // A grudge stipulation settled decisively is the blowoff — the feud ends
  // and the winner banks the heat as popularity (§12.5). A screwjob finish in
  // the same match settles nothing, so the rivalry rolls on hotter.
  const isDecisiveBlowoff = Boolean(ctx.stipulation?.isBlowoff) && !draw && !isNonDecisiveFinish(finish);

  const heatChange =
    rivalry && rivalry.resolvedWeek === null
      ? heatFromMatch(rivalry, { segmentRating: rating, finish, isDecisiveBlowoff, settings: ctx.settings })
      : null;

  return {
    winnerSide: draw ? null : winnerSide,
    winnerWrestlerIds: draw ? [] : winnerMembers.map((w) => w.id),
    finish,
    rating,
    stars,
    ratingBreakdown: breakdown,
    beats,
    winProbabilitiesBySide,
    injuryMultiplier: (ctx.stipulation?.injuryMult ?? 1) * shootInjuryMultiplier(rivalry ?? undefined, ctx.settings),
    heatChange,
  };
}
