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
import { computeTvRatings } from '../engine/world/tvRatings';
import { rollTamperingAttempts } from '../engine/world/tampering';
import { deriveCareerStatus } from '../engine/career/status';
import { rollWeeklyEvent, recordFired } from '../engine/events/scheduler';
import { resolveOption } from '../engine/events/apply';
import { CREATIVE_EVENTS, eventById } from '../data/events';
import { applyGimmickLook, stableColorsFrom } from '../engine/generate/gimmickLook';
import { GIMMICKS } from '../data/gimmicks';
import type { EventEffect, EventSubjects } from '../engine/events/types';
import type { Wrestler } from '../engine/types';
import { clamp, pick } from '../engine/rng';
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
  /** Answer the pending creative event. */
  chooseEventOption: (optionId: string) => void;
  dismissEventOutcome: () => void;
}

/**
 * Apply one event effect to the world. The event library can only express
 * effects this understands, which is what keeps the library pure data.
 */
function applyEffect(world: World, effect: EventEffect): void {
  const at = (id: Id): Wrestler | undefined => world.wrestlers[id];
  const bump = (value: number, delta: number) => clamp(value + delta, 0, 100);

  switch (effect.kind) {
    case 'morale': {
      const w = at(effect.wrestlerId);
      if (w) w.morale = bump(w.morale, effect.delta);
      break;
    }
    case 'rosterMorale':
      for (const id of world.promotion.rosterIds) {
        const w = at(id);
        if (w) w.morale = bump(w.morale, effect.delta);
      }
      break;
    case 'popularity': {
      const w = at(effect.wrestlerId);
      if (w) {
        w.popularity = bump(w.popularity, effect.delta);
        if (w.popularity > w.careerHighPopularity) {
          w.careerHighPopularity = w.popularity;
          w.careerHighWeek = world.week;
        }
      }
      break;
    }
    case 'momentum': {
      const w = at(effect.wrestlerId);
      if (w) w.momentum = bump(w.momentum, effect.delta);
      break;
    }
    case 'health': {
      const w = at(effect.wrestlerId);
      if (w) w.health = bump(w.health, effect.delta);
      break;
    }
    case 'money':
      world.promotion.bankBalance += effect.delta;
      break;
    case 'companyRating':
      world.promotion.rating = bump(world.promotion.rating, effect.delta);
      break;
    case 'bookingCredibility':
      world.promotion.bookingCredibility = bump(world.promotion.bookingCredibility, effect.delta);
      break;
    case 'reputation':
      world.promotion.reputation = bump(world.promotion.reputation, effect.delta);
      break;
    case 'shootHeat':
    case 'crowdHeat': {
      const existing = findRivalry(world.rivalries, effect.wrestlerIds);
      if (existing) {
        const index = world.rivalries.findIndex((r) => r.id === existing.id);
        const field = effect.kind === 'shootHeat' ? 'shootHeat' : 'heat';
        world.rivalries[index] = { ...existing, [field]: bump(existing[field], effect.delta) };
      } else if (effect.delta > 0) {
        world.rivalries.push(
          createRivalry(
            `rivalry-${world.nextId++}`,
            effect.wrestlerIds,
            effect.kind === 'shootHeat' ? 'shoot' : 'worked',
            world.week,
            effect.delta,
          ),
        );
      }
      break;
    }
    case 'gimmickChange': {
      const w = at(effect.wrestlerId);
      if (w) {
        // The look follows the character — that's the whole point of granting
        // the request rather than making the player dress them.
        const next = pick(rng, GIMMICKS.filter((g) => g.id !== w.gimmick.id));
        w.gimmick = next;
        w.appearance = applyGimmickLook(w.appearance, next, rng);
        w.gimmickFreshness = 100;
      }
      break;
    }
    case 'alignmentTurn': {
      const w = at(effect.wrestlerId);
      if (w) {
        w.alignment = effect.toward === 'heel' ? -Math.abs(w.alignment || 40) : Math.abs(w.alignment || 40);
        w.crowdReaction = w.alignment;
      }
      break;
    }
    case 'contractRate': {
      const w = at(effect.wrestlerId);
      if (w?.contract) w.contract.weeklyRate = Math.round(w.contract.weeklyRate * effect.multiplier);
      break;
    }
    case 'release': {
      world.promotion.rosterIds = world.promotion.rosterIds.filter((id) => id !== effect.wrestlerId);
      const w = at(effect.wrestlerId);
      if (w) {
        w.promotionId = null;
        w.contract = null;
      }
      break;
    }
    case 'injury': {
      const w = at(effect.wrestlerId);
      if (w) {
        w.health = bump(w.health, -35);
        w.injury = {
          severity: 'moderate',
          description: 'Injured',
          sufferedWeek: world.week,
          totalWeeks: effect.weeks,
          weeksRemaining: effect.weeks,
          permanentStatLoss: {},
          earlyReturnWeeksUsed: 0,
        };
      }
      break;
    }
    case 'formStable': {
      const founder = at(effect.memberIds[0]!);
      if (!founder) break;
      world.stables.push({
        id: `stable-${world.nextId++}`,
        name: `${founder.name}'s ${effect.name === 'faction' ? 'Faction' : 'Team'}`,
        kind: effect.memberIds.length > 2 ? 'stable' : 'tagTeam',
        memberIds: [...effect.memberIds],
        leaderId: founder.id,
        colors: stableColorsFrom(founder),
        unifiedLook: true,
        formedWeek: world.week,
        disbandedWeek: null,
        record: { wins: 0, losses: 0, draws: 0 },
      });
      break;
    }
  }
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

        // Rivals were on opposite you tonight. Their show quality moves with
        // their standing plus a weekly wobble, so a hot rival takes audience
        // off you even when your own show was fine.
        const tvResults = computeTvRatings(
          [
            { promotionId: world.promotion.id, showRating, companyRating: world.promotion.rating, broadcast: true },
            ...world.rivals.map((rival) => ({
              promotionId: rival.id,
              showRating: clamp(rival.rating + (rng.next() * 30 - 15), 0, 100),
              companyRating: rival.rating,
              broadcast: true,
            })),
          ],
          world.settings,
        );
        world.tvHistory.unshift({ week: world.week, results: tvResults });
        world.tvHistory = world.tvHistory.slice(0, 52);

        world.week += 1;

        // Feuds nobody advanced this week go cold; the bad blood behind them
        // barely moves (§12.5).
        world.rivalries = world.rivalries.map((r) => decayRivalry(r, world.week, world.settings));

        // Career standing is derived, so it moves on its own as a save runs.
        const roster = world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean);
        const rosterPeak = roster.reduce((max, w) => Math.max(max, w.popularity), 0);
        const careerCtx = {
          currentYear: world.settings.startingYear + Math.floor(world.week / 52),
          rosterPeakPopularity: rosterPeak,
          settings: world.settings,
        };
        for (const w of roster) w.careerStatus = deriveCareerStatus(w, careerCtx);

        // Rival bookers come calling.
        world.tamperingOffers = rollTamperingAttempts(rng, {
          roster,
          statusOf: (w) => w.careerStatus,
          rivals: world.rivals,
          currentWeek: world.week,
          settings: world.settings,
        });

        // And the office brings you one story a week, at most.
        const event = rollWeeklyEvent(rng, {
          week: world.week,
          library: CREATIVE_EVENTS,
          history: world.eventHistory,
          roster,
          statusOf: (w) => w.careerStatus,
          promotion: world.promotion,
          rivals: world.rivals,
          settings: world.settings,
        });
        if (event) {
          world.pendingEvent = event;
          world.eventHistory = recordFired(world.eventHistory, event, world.week);
        }

        world.currentCard = createEmptyCard(world.settings.segmentsPerTV);
      });
    },

    chooseEventOption: (optionId) => {
      set((state) => {
        const world = state.world;
        const pending = world?.pendingEvent;
        if (!world || !pending) return;

        const event = eventById(pending.eventId);
        if (!event) {
          world.pendingEvent = null;
          return;
        }

        const subjects: EventSubjects = {
          primary: pending.subjects.primaryId ? world.wrestlers[pending.subjects.primaryId] : undefined,
          secondary: pending.subjects.secondaryId ? world.wrestlers[pending.subjects.secondaryId] : undefined,
          promotion: world.promotion,
          rival: world.rivals.find((r) => r.id === pending.subjects.rivalId),
        };

        const outcome = resolveOption(rng, event, optionId, subjects, world.settings);
        for (const effect of outcome.effects) applyEffect(world, effect);

        world.pendingEvent = null;
        world.lastEventOutcome = { title: pending.title, summary: outcome.summary };
      });
    },

    dismissEventOutcome: () => {
      set((state) => {
        if (state.world) state.world.lastEventOutcome = null;
      });
    },
  })),
);
