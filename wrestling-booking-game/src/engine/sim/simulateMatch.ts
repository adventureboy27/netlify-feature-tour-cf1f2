// Match simulation orchestrator — wires kayfabe -> win probability -> finish
// -> rating -> narrative into the single entry point callers use.

import type { Rng } from '../rng';
import { chance, clamp, weightedPick } from '../rng';
import type {
  Title,
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
import { rollBotch } from './ringcraft';
import { rollPyroBurn } from './pyro';
import { ratingToStars } from '../economy/showRating';
import { injuryProneness } from '../career/personality';
import type { RingsideTotals } from './ringside';
import { ruleAdjustedWeights, kayfabeScore } from './kayfabe';
import { pairWinProbability, multiManWinProbabilities } from './winProbability';
import { orderEliminations } from './battleRoyal';
import { rollFinish, isDrawFinish, isNonDecisiveFinish } from './finish';
import { computeMatchRating } from './matchRating';
import { paceEffect } from './pacing';
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
  /**
   * 0-1. What the owned ring/mat cuts off the odds of getting hurt tonight —
   * a real ring is a safer ring for everyone standing in it, not just the
   * two people wrestling, which is why this lives here rather than only in
   * store.ts's competitor-specific injury roll. See
   * engine/economy/production.ts's productionEffects().injuryReduction,
   * finally being read by something.
   */
  equipmentInjuryReduction?: number;
  /**
   * Did tonight's show fire pyro at all — the pyro rung or the pyro-charges
   * show extra. Nothing rolls unless this is true; see sim/pyro.ts.
   */
  pyroActive?: boolean;
  titlePrestige?: number | null;
  /** The rivalry these two are in, if any — drives heat, bad blood, and injury risk. */
  rivalry?: Rivalry | null;
  hardcoreSaturation?: number;
  slotExpectedPopularity?: number | null;
  instructionModifier?: number;
  territoryFit?: number;
  /** Rating points for suiting (or clashing with) the promotion's house style. */
  houseStyleFit?: number;
  /** Friends or enemies across the ring. See career/relationships.ts. */
  relationshipHeat?: number;
  /** Belts on the line, so the highlight can say what the match was for. */
  titles?: readonly Title[];
  /** True for the last match on the card — it earns a longer write-up. */
  isMainEvent?: boolean;
  /** First on the card, where a hot start is worth most. */
  isOpener?: boolean;
  /** How numb the crowd is to this pace, 0-100. */
  paceSaturation?: number;
  pairChemistryBonus?: number;
  overexposurePenalty?: number;
  staleGimmickPenalty?: number;
  signatureStipulationFit?: number;
  /** Every highlight-reel beat already spent tonight, shared across every match on the card. See narrative.ts's generateBeats. */
  usedBeats?: Set<string>;
}

export interface MatchSimResult {
  winnerSide: number | null; // null for a draw
  winnerWrestlerIds: Id[];
  finish: FinishType;
  rating: number;
  stars: number;
  ratingBreakdown: RatingBreakdownEntry[];
  /**
   * Whoever blew a spot, if anybody did. Named so the caller can charge it to
   * them; the write-up already carries the sentence. See sim/ringcraft.ts.
   */
  botchedById: Id | null;
  beats: MatchBeat[];
  /** Whoever the official caught in the act, so the office can act on it. */
  caughtManagerId?: string | null;
  winProbabilitiesBySide: Record<number, number>;
  /**
   * Combined injury multiplier for this match — the stipulation's, escalated
   * by any real animosity. Callers apply it when rolling injuries (M3); it is
   * surfaced here so a shoot rivalry's cost is computed in one place.
   */
  injuryMultiplier: number;
  /** Multipliers the aftermath applies to what the match cost the people in it. */
  healthCostMultiplier: number;
  energyCostMultiplier: number;
  /** Added to the promotion's counter for this pace. */
  paceSaturationAdded: number;
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

  // A ladder, a cage, a table are hardware, and cheap hardware is real risk
  // on top of the stipulation's own flat injuryMult — see data/stipulations.ts's
  // hardwareGearSensitive. Scales down as equipmentInjuryReduction climbs,
  // same as everything else in this stack, and never quite to nothing.
  const hardwareGearRisk = ctx.stipulation?.hardwareGearSensitive
    ? 1 + (1 - (ctx.equipmentInjuryReduction ?? 0)) * ctx.settings.hardwareGearRiskAtWorst
    : 1;

  const weights = ruleAdjustedWeights(rules, isLadderOrHighSpot, isMultiMan);

  const sideMembers = new Map<number, Wrestler[]>();
  const sideKayfabe = new Map<number, number>();
  for (const side of sides) {
    const members = participants.filter((p) => p.side === side).map((p) => wrestlerById.get(p.wrestlerId)!);
    sideMembers.set(side, members);
    sideKayfabe.set(side, mean(members.map((w) => kayfabeScore(w, weights))));
  }

  // What the booker stacked, plus what is standing at ringside. A manager
  // helps his man and costs the other — see sim/ringside.ts. Folded in here
  // rather than applied separately so both go through the same clamp: the sim
  // picks the winner (§0) and nothing is allowed to make a match a formality.
  // Did anybody's corner actually pull their attention tonight?
  //
  // Rolled rather than applied flat, so a manager at ringside is a threat
  // that occasionally lands rather than a permanent tax nobody can see. See
  // sim/ringside.ts.
  const distracted: Record<number, number> = {};
  let distractedName: string | null = null;
  for (const key of Object.keys(ctx.ringside?.distractionChance ?? {})) {
    const side = Number(key);
    const odds = ctx.ringside?.distractionChance?.[side] ?? 0;
    if (odds <= 0 || !chance(rng, odds)) continue;
    distracted[side] = -(ctx.ringside?.distractionPenalty?.[side] ?? 0);
    distractedName = ctx.ringside?.distractionBy?.[side] ?? distractedName;
  }

  const ringsideShifts = ctx.ringside?.winShift ?? {};
  const booked = ctx.deckStackingShiftsBySide ?? {};
  const stackingShifts: Record<number, number> = {};
  for (const side of new Set(
    [...Object.keys(booked), ...Object.keys(ringsideShifts), ...Object.keys(distracted)].map(Number),
  )) {
    stackingShifts[side] = (booked[side] ?? 0) + (ringsideShifts[side] ?? 0) + (distracted[side] ?? 0);
  }
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

  // The manager gets caught.
  //
  // Rolled here, before anything derives from who won, so the members, the
  // rating and the write-up all agree about it. Only against the side that
  // was going to win: a corner that cheated its man to a loss has already
  // been punished by the scoreboard.
  //
  // The client eats the disqualification and the manager walks away having
  // cost somebody else a match, which is exactly the shape of the job.
  let caughtManager: string | null = null;
  let caughtManagerId: string | null = null;
  const cornerRisk = ctx.ringside?.caughtRisk?.[winnerSide] ?? 0;
  if (cornerRisk > 0 && sides.length === 2 && rng.next() < cornerRisk) {
    caughtManager = ctx.ringside?.caughtBy?.[winnerSide] ?? null;
    caughtManagerId = ctx.ringside?.caughtById?.[winnerSide] ?? null;
    winnerSide = sides.find((sd) => sd !== winnerSide) ?? winnerSide;
  }

  const winnerProbability = winProbabilitiesBySide[winnerSide]!;
  const isUpset = winnerProbability < 0.5;
  const winnerMembers = sideMembers.get(winnerSide)!;
  const loserMembers = sides.filter((s) => s !== winnerSide).flatMap((s) => sideMembers.get(s)!);
  const winnerIsTechnician = winnerMembers.some((w) => w.archetype === 'technician');

  // Battle royal only: ordering dressing on the winner already decided
  // above — never overrides winnerSide, only decides what order everybody
  // else went out in, so the highlight reel can read like a battle royal
  // instead of an instant multi-way roll with extra bodies in it. See
  // sim/battleRoyal.ts.
  const eliminationOrder =
    isMultiMan && ctx.stipulation?.id === 'battleRoyal'
      ? orderEliminations(rng, sides, winnerSide, winProbabilitiesBySide)
      : null;
  const eliminatedInOrder = eliminationOrder?.slice(0, -1).map((s) => sideMembers.get(s)!.map((w) => w.name)) ?? undefined;

  // What the pace is worth here, and what it costs. Worked out once and used
  // by the finish roll, the rating and the aftermath — the same call has to
  // move all three or it is not a real lever.
  const pace = paceEffect({
    pace: rules.pace,
    participants: sides.flatMap((s) => sideMembers.get(s)!),
    isMainEvent: ctx.isMainEvent ?? false,
    isOpener: ctx.isOpener ?? false,
    saturation: ctx.paceSaturation ?? 0,
    settings: ctx.settings,
  });

  const finish: FinishType = caughtManager
    ? // Nothing else it can be. The official saw it.
      'disqualification'
    : rollFinish(rng, {
    rules,
    violenceLevel: ctx.stipulation?.violenceLevel ?? 0,
    winnerIsTechnician,
    isUpset,
    isCloselyMatched: Math.abs(winnerProbability - 0.5) < 0.1,
    finishWeights: ctx.stipulation?.finishWeights,
    injuryMultiplier:
      (ctx.stipulation?.injuryMult ?? 1) *
      shootInjuryMultiplier(rivalry ?? undefined, ctx.settings) *
      // Nobody to stop it when it goes wrong.
      (ctx.ringside?.injuryMultiplier ?? 1) *
      // And what the booker asked them to go out and do.
      pace.injuryMultiplier *
      // A better ring is a safer ring, for everyone in it.
      (1 - (ctx.equipmentInjuryReduction ?? 0)) *
      // The ladder itself, the cage itself, the table itself.
      hardwareGearRisk,
    // A crooked or incompetent official makes a screwy finish likelier; a
    // manager at ringside makes interference likelier still.
    ringsideWeights: ctx.ringside
      ? {
          screwy: ctx.ringside.screwyFinishWeight,
          interference: ctx.ringside.interferenceWeight,
          decisive: ctx.ringside.decisiveFinishWeight,
          hasOfficial: ctx.ringside.hasOfficial,
        }
      : undefined,
      });
  const draw = isDrawFinish(finish);

  const allParticipants = sides.flatMap((s) => sideMembers.get(s)!);
  const { rating, stars, breakdown } = computeMatchRating(rng, {
    participants: allParticipants,
    settings: ctx.settings,
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
    paceBonus: pace.ratingBonus,
    paceCeiling: pace.ratingCeiling,
    territoryFit: ctx.territoryFit ?? 0,
    houseStyleFit: ctx.houseStyleFit ?? 0,
    relationshipHeat: ctx.relationshipHeat ?? 0,
    pairChemistryBonus: ctx.pairChemistryBonus ?? 0,
    overexposurePenalty: ctx.overexposurePenalty ?? 0,
    staleGimmickPenalty: ctx.staleGimmickPenalty ?? 0,
    signatureStipulationFit: ctx.signatureStipulationFit ?? 0,
  });

  // Did somebody lose their place out there. Rolled after the rating because
  // it is a thing that happened *in* the match rather than a property of the
  // people in it — and it is charged to the match, said out loud, and
  // occasionally hurts whoever blew it. See sim/ringcraft.ts.
  const botch = rollBotch(rng, allParticipants, ctx.matchLengthMinutes, ctx.settings);
  const botchBeat: MatchBeat[] = botch
    ? [{ kind: 'botch' as const, significant: true, text: botch.text }]
    : [];

  // The entrance pyro, if this show fired any. Same shape as a botch — its
  // own roll, its own line, and it only ever fires at all when the show
  // actually lit the fuse. See sim/pyro.ts.
  const pyroBurn = rollPyroBurn(
    rng,
    allParticipants,
    ctx.pyroActive ?? false,
    ctx.equipmentInjuryReduction ?? 0,
    ctx.settings,
  );
  const pyroBurnBeat: MatchBeat[] = pyroBurn
    ? [{ kind: 'pyroBurn' as const, significant: true, text: pyroBurn.text }]
    : [];

  const finalRating = clamp(rating - (botch?.ratingCost ?? 0) - (pyroBurn?.ratingCost ?? 0), 3, 100);
  const finalStars = ratingToStars(finalRating);

  // §0: a result that flipped with no sentence explaining it reads as the sim
  // glitching. Whoever got caught is named, at the top of the highlights.
  // A distraction that swung a match and said nothing would be the same
  // invisible tax in a different shape. When it lands, it is in the write-up.
  const distractionBeat: MatchBeat[] = distractedName
    ? [
        {
          kind: 'interference' as const,
          significant: true,
          text: `${distractedName} pulled the attention at ringside at exactly the wrong moment.`,
        },
      ]
    : [];

  const cornerBeat: MatchBeat[] = caughtManager
    ? [
        {
          kind: 'finish' as const,
          significant: true,
          text: `${caughtManager} was caught in the act at ringside, and the referee called for the bell.`,
        },
      ]
    : [];

  const beats = generateBeats(
    rng,
    {
      winnerMembers,
      loserMembers,
      finish,
      stars,
      rating,
      stipulation: ctx.stipulation,
      titles: ctx.titles,
      shootHeat: rivalry?.shootHeat ?? 0,
      isMainEvent: ctx.isMainEvent ?? false,
      eliminatedInOrder,
    },
    ctx.usedBeats,
  );

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
    rating: finalRating,
    stars: finalStars,
    ratingBreakdown: breakdown,
    beats: [...cornerBeat, ...distractionBeat, ...botchBeat, ...pyroBurnBeat, ...beats],
    /** Who blew a spot, if anybody did. The caller decides what it costs them. */
    botchedById: botch?.workerId ?? null,
    caughtManagerId,
    winProbabilitiesBySide,
    injuryMultiplier:
      (ctx.stipulation?.injuryMult ?? 1) *
      shootInjuryMultiplier(rivalry ?? undefined, ctx.settings) *
      // Nobody to stop it when it goes wrong.
      (ctx.ringside?.injuryMultiplier ?? 1) *
      pace.injuryMultiplier *
      // A spot that went wrong badly enough to hurt somebody.
      (botch?.hurtSomebody ? ctx.settings.botchInjuryMultiplier : 1) *
      // The pyro caught somebody badly enough to leave a mark.
      (pyroBurn?.hurtSomebody ? ctx.settings.pyroBurnInjuryMultiplier : 1) *
      // And some bodies simply break more than others. See the Made Of Glass
      // trait in career/personality.ts — this is where it has teeth.
      Math.max(...allParticipants.map((p) => injuryProneness(p))) *
      // A better ring is a safer ring, for everyone in it.
      (1 - (ctx.equipmentInjuryReduction ?? 0)) *
      // The ladder itself, the cage itself, the table itself.
      hardwareGearRisk,
    // What the night takes out of them, and how numb the crowd now is to
    // being shown this.
    healthCostMultiplier: pace.healthCostMultiplier,
    energyCostMultiplier: pace.energyCostMultiplier,
    paceSaturationAdded: pace.saturationAdded,
    heatChange,
  };
}
