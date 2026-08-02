// Match simulation orchestrator — wires kayfabe -> win probability -> finish
// -> rating -> narrative into the single entry point callers use.

import type { Rng } from '../rng';
import { chance, weightedPick } from '../rng';
import type { Id, Wrestler, MatchRules, Stipulation, FinishType, RatingBreakdownEntry, MatchBeat, WorldSettings } from '../types';
import { ruleAdjustedWeights, kayfabeScore } from './kayfabe';
import { pairWinProbability, multiManWinProbabilities } from './winProbability';
import { rollFinish, isDrawFinish } from './finish';
import { computeMatchRating } from './matchRating';
import { generateBeats } from './narrative';

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
  titlePrestige?: number | null;
  rivalryHeat?: number;
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

  const weights = ruleAdjustedWeights(ctx.rules, isLadderOrHighSpot, isMultiMan);

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
    rules: ctx.rules,
    violenceLevel: ctx.stipulation?.violenceLevel ?? 0,
    winnerIsTechnician,
    isUpset,
    isCloselyMatched: Math.abs(winnerProbability - 0.5) < 0.1,
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
    titlePrestige: ctx.titlePrestige ?? null,
    rivalryHeat: ctx.rivalryHeat ?? 0,
    hardcoreSaturation: ctx.hardcoreSaturation ?? 0,
    slotExpectedPopularity: ctx.slotExpectedPopularity ?? null,
    instructionModifier: ctx.instructionModifier ?? 0,
    territoryFit: ctx.territoryFit ?? 0,
    pairChemistryBonus: ctx.pairChemistryBonus ?? 0,
    overexposurePenalty: ctx.overexposurePenalty ?? 0,
  });

  const beats = generateBeats(rng, { winnerMembers, loserMembers, finish, stars });

  return {
    winnerSide: draw ? null : winnerSide,
    winnerWrestlerIds: draw ? [] : winnerMembers.map((w) => w.id),
    finish,
    rating,
    stars,
    ratingBreakdown: breakdown,
    beats,
    winProbabilitiesBySide,
  };
}
