// The Zustand+immer store — the only place besides world.ts allowed to
// touch React state machinery. Every actual calculation it does is a call
// out to a pure engine/ function; this file just wires inputs/outputs and
// holds the mutable World.

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { rngFromSeed } from '../engine/rng';
import type { Rng } from '../engine/rng';
import type { Id, MatchRules, WorldSettings } from '../engine/types';
import { createInitialWorld, createEmptyCard, pairKey, type World } from './world';
import {
  findRivalry,
  createRivalry,
  applyHeatChange,
  decayRivalry,
  heatMultiplier,
} from '../engine/sim/rivalry';
import { defaultWorldSettings } from '../engine/world/settings';
import { stipulationById, stipulationRequirementsMet } from '../data/stipulations';
import { simulateMatch, type SimParticipant } from '../engine/sim/simulateMatch';
import {
  computeShowRating,
  ratingToStars,
  targetCompanyRatingForStars,
  stepCompanyRatingTowardTarget,
  TV_SLOT_WEIGHTS,
} from '../engine/economy/showRating';
import { computeAttendance, computeTicketPrice, computeGate } from '../engine/economy/attendance';
import { computeAppearanceFee, computeWeeklyExpenses, computeShowExpenseSplit } from '../engine/economy/payroll';
import {
  slotExpectedPopularities,
  saturationFromShow,
  accrueSaturation,
  decaySaturation,
} from '../engine/economy/cardPosition';

// DESIGN: the seeded RNG is intentionally not part of the immer-tracked
// World — it's a stream generator, not a value the UI ever reads or
// serializes. Re-seeded on newGame(); advances across resolveWeek() calls
// exactly like any other engine consumer of Rng.
let rng: Rng = rngFromSeed(defaultWorldSettings().seed);

// DESIGN (M2 scope): attendance/gate use neutral territory defaults
// (following 50, a 2,500-capacity venue, revenue mult 1.0) since
// Territory (M6) and arena tiers (§14, M5) don't exist yet. See
// engine/economy/attendance.ts's own DESIGN note.
const DEFAULT_TERRITORY_FOLLOWING = 50;
const DEFAULT_VENUE_CAPACITY = 2500;
const DEFAULT_TERRITORY_REVENUE_MULT = 1.0;

// §12.5 route 3 — "two wrestlers meeting three times in a short span".
const MEETINGS_TO_FORM_RIVALRY = 3;
// Scales a good match's rating into starting heat. Tuned so three four-star
// meetings open a feud around 30 heat — interested, a long way from a grudge.
const ORGANIC_RIVALRY_HEAT_SCALE = 0.25;

export interface GameStore {
  world: World | null;
  newGame: (settings?: WorldSettings) => void;
  setSegmentParticipant: (slot: number, wrestlerId: Id, side: number) => void;
  removeSegmentParticipant: (slot: number, wrestlerId: Id) => void;
  setSegmentRules: (slot: number, rules: Partial<MatchRules>) => void;
  setSegmentStipulation: (slot: number, stipulationId: Id | null) => void;
  resolveWeek: () => void;
}

export const useGameStore = create<GameStore>()(
  immer((set) => ({
    world: null,

    newGame: (settings = defaultWorldSettings()) => {
      rng = rngFromSeed(settings.seed);
      const world = createInitialWorld(rng, settings);
      set((state) => {
        state.world = world;
      });
    },

    setSegmentParticipant: (slot, wrestlerId, side) => {
      set((state) => {
        const segment = state.world?.currentCard[slot];
        if (!segment) return;
        // A wrestler occupies exactly one slot in a segment at a time.
        segment.participants = segment.participants.filter((p) => p.wrestlerId !== wrestlerId);
        segment.participants.push({ wrestlerId, side, role: 'competitor' });
      });
    },

    removeSegmentParticipant: (slot, wrestlerId) => {
      set((state) => {
        const segment = state.world?.currentCard[slot];
        if (!segment) return;
        segment.participants = segment.participants.filter((p) => p.wrestlerId !== wrestlerId);
      });
    },

    setSegmentRules: (slot, rules) => {
      set((state) => {
        const segment = state.world?.currentCard[slot];
        if (!segment) return;
        Object.assign(segment.rules, rules);
      });
    },

    setSegmentStipulation: (slot, stipulationId) => {
      set((state) => {
        const segment = state.world?.currentCard[slot];
        if (!segment) return;
        segment.stipulation = stipulationId;
      });
    },

    resolveWeek: () => {
      set((state) => {
        const world = state.world;
        if (!world) return;
        const wrestlerById = new Map(Object.values(world.wrestlers).map((w) => [w.id, w]));

        const segmentRatings: (number | null)[] = [];
        const segmentPopAvgs: { stars: number; avgPopularity: number }[] = [];
        const violenceLevels: number[] = [];
        let payroll = 0;

        // §11.4 jobberDrag: what each slot on this card is expected to deliver,
        // judged against the roster the player actually has.
        const slotExpectations = slotExpectedPopularities({
          rosterPopularities: world.promotion.rosterIds.map((id) => wrestlerById.get(id)?.popularity ?? 0),
          slotWeights: TV_SLOT_WEIGHTS.slice(0, world.currentCard.length),
          percentileMin: world.settings.slotExpectationPercentileMin,
          percentileMax: world.settings.slotExpectationPercentileMax,
        });

        world.currentCard.forEach((segment, i) => {
          const sides = new Set(segment.participants.map((p) => p.side));
          if (segment.participants.length < 2 || sides.size < 2) {
            segmentRatings.push(null);
            return;
          }

          const stipulation = segment.stipulation ? (stipulationById(segment.stipulation) ?? null) : null;
          const participantWrestlers = segment.participants.map((p) => wrestlerById.get(p.wrestlerId)!);
          const participantIds = participantWrestlers.map((w) => w.id);
          const rivalry = findRivalry(world.rivalries, participantIds) ?? null;

          const requirementsMet = stipulation
            ? stipulationRequirementsMet(stipulation, {
                participants: participantWrestlers,
                // Grudge stipulations are gated on the crowd heat these two
                // have actually built — booking Loser Leaves between two
                // strangers is allowed, and eats the -8 (§9).
                rivalryHeat: rivalry?.heat ?? 0,
                matchTimeLimitMinutes: segment.rules.timeLimit,
              })
            : true;

          const lengthMinutes = segment.rules.timeLimit > 0 ? segment.rules.timeLimit : world.settings.defaultMatchLength;
          const simParticipants: SimParticipant[] = segment.participants.map((p) => ({ wrestlerId: p.wrestlerId, side: p.side }));

          violenceLevels.push(stipulation?.violenceLevel ?? 0);

          const result = simulateMatch(rng, simParticipants, wrestlerById, {
            rules: segment.rules,
            stipulation,
            requirementsMet,
            isPPV: false,
            matchLengthMinutes: lengthMinutes,
            settings: world.settings,
            // Saturation is read at the level the promotion carried into the
            // show, so every segment on one card is judged against the same
            // number rather than each match penalising the next.
            hardcoreSaturation: world.promotion.hardcoreSaturation,
            slotExpectedPopularity: slotExpectations[i] ?? null,
            rivalry,
          });

          // Commit how the feud moved, and let a new one form organically.
          if (rivalry && result.heatChange) {
            const index = world.rivalries.findIndex((r) => r.id === rivalry.id);
            if (index >= 0) {
              world.rivalries[index] = applyHeatChange(rivalry, result.heatChange, world.week);
              if (result.heatChange.blowoffPopularityGain > 0) {
                for (const id of result.winnerWrestlerIds) {
                  const winner = world.wrestlers[id];
                  if (winner) {
                    winner.popularity = Math.min(100, winner.popularity + result.heatChange.blowoffPopularityGain);
                  }
                }
              }
            }
          } else if (!rivalry && participantIds.length === 2) {
            // §12.5 route 3: repeat matches make a rivalry on their own, "at
            // heat proportional to how good those matches were" — so three
            // dull meetings still make nothing.
            const key = pairKey(participantIds[0]!, participantIds[1]!);
            const meetings = (world.meetings[key] ?? 0) + 1;
            world.meetings[key] = meetings;

            if (meetings >= MEETINGS_TO_FORM_RIVALRY) {
              const startingHeat = result.rating * heatMultiplier(result.rating) * ORGANIC_RIVALRY_HEAT_SCALE;
              if (startingHeat > 0) {
                world.rivalries.push(
                  createRivalry(`rivalry-${world.nextId++}`, participantIds, 'worked', world.week, startingHeat),
                );
              }
            }
          }

          segment.result = {
            winnerSide: result.winnerSide,
            winnerWrestlerIds: result.winnerWrestlerIds,
            finish: result.finish,
            rating: result.rating,
            stars: result.stars,
            ratingBreakdown: result.ratingBreakdown,
            beats: result.beats,
            titleChanged: false,
            injuries: [],
          };

          segmentRatings.push(result.rating);
          const avgPop = participantWrestlers.reduce((sum, w) => sum + w.popularity, 0) / participantWrestlers.length;
          segmentPopAvgs.push({ stars: result.stars, avgPopularity: avgPop });

          for (const wrestler of participantWrestlers) {
            if (wrestler.contract) {
              payroll += computeAppearanceFee({
                contract: wrestler.contract,
                role: 'competitor',
                isMainEvent: i === world.currentCard.length - 1,
                isPPV: false,
              });
            }
          }
        });

        const slotWeights = TV_SLOT_WEIGHTS.slice(0, world.currentCard.length);
        const showRating = computeShowRating(segmentRatings, slotWeights);
        const showStars = ratingToStars(showRating);

        const ticketPrice = computeTicketPrice(
          segmentPopAvgs.length,
          world.settings.ticketPriceBase,
          world.settings.ticketPricePerSegment,
        );
        const attendance = computeAttendance({
          territoryFollowing: DEFAULT_TERRITORY_FOLLOWING,
          capacity: DEFAULT_VENUE_CAPACITY,
          companyRating: world.promotion.rating,
          championPopularity: 0,
          segments: segmentPopAvgs,
        });
        const gate = computeGate(attendance, ticketPrice, DEFAULT_TERRITORY_REVENUE_MULT);

        const weeklyExpenses = computeWeeklyExpenses(
          world.promotion.bankBalance,
          world.settings.weeklyExpenseRate,
          world.promotion.ownedTerritoryIds.length,
        );
        const { payable } = computeShowExpenseSplit(payroll + weeklyExpenses, gate, world.settings.expenseCapPctOfRevenue);

        world.promotion.bankBalance += gate - payable;

        // §11.4 weapons model: violence booked tonight accrues, then the week
        // sheds its decay. Lean on hardcore every week and the counter pegs,
        // taking up to -12 rating off every match until you lay off it.
        world.promotion.hardcoreSaturation = decaySaturation(
          accrueSaturation(
            world.promotion.hardcoreSaturation,
            saturationFromShow(violenceLevels, world.settings.hardcoreSaturationPerViolence),
          ),
          world.settings.hardcoreSaturationDecayPerWeek,
        );

        const target = targetCompanyRatingForStars(showStars);
        world.promotion.rating = stepCompanyRatingTowardTarget(
          world.promotion.rating,
          target,
          world.settings.ratingLadderStepPerWeek,
          false,
        );

        world.showHistory.push({
          id: `show-${world.week}`,
          promotionId: world.promotion.id,
          week: world.week,
          type: 'tvTaping',
          territoryId: world.promotion.homeTerritoryId,
          segments: world.currentCard,
          attendance,
          ticketPrice,
          gate,
          payroll: payable,
          showRating,
          showStars,
          broadcast: true,
        });

        world.week += 1;

        // Feuds nobody advanced this week go cold; the bad blood behind them
        // barely moves (§12.5).
        world.rivalries = world.rivalries.map((r) => decayRivalry(r, world.week, world.settings));

        world.currentCard = createEmptyCard(world.settings.segmentsPerTV);
      });
    },
  })),
);
