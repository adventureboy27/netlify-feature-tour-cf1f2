// The creative event engine's player-facing side, and the weather call.
//
// Split out of store.ts purely for navigability; every action here is
// unchanged from what it always did.

import type { StateCreator } from 'zustand';
import { rng, type GameStore } from '../store';
import { applyEffect } from '../storeHelpers';
import { eventById } from '../../data/events';
import { resolveOption } from '../../engine/events/apply';
import { substitute } from '../../engine/events/scheduler';
import { pick, clamp } from '../../engine/rng';
import type { EventSubjects } from '../../engine/events/types';
import { clampMorale } from '../../engine/career/morale';
import { gradeFromLength, severityOf } from '../../engine/sim/casualties';
import { recordInjury } from '../../engine/career/theBody';
import { resolveContractRaid, type ContractRaidOptionId } from '../../engine/world/contractRaid';
import { wire } from '../../engine/world/wire';
import { addGrudge, grudgeAgainst } from '../../engine/world/grudges';

type EventsSlice = Pick<
  GameStore,
  | 'chooseEventOption'
  | 'dismissEventOutcome'
  | 'dismissMandateOutcome'
  | 'dismissYearInReview'
  | 'answerWeatherCall'
  | 'answerRingCall'
  | 'answerTruckCall'
  | 'answerNoShowCall'
  | 'answerRivalMove'
  | 'answerConfrontationCall'
  | 'answerContractRaid'
>;

export const createEventsSlice: StateCreator<GameStore, [['zustand/immer', never]], [], EventsSlice> = (
  set,
  get,
) => ({
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

      const outcome = resolveOption(rng, event, pending.currentNodeId, optionId, subjects, world.settings);
      for (const effect of outcome.effects) applyEffect(world, rng, effect);

      // Terminal: same as every event before branching existed.
      if (!outcome.next) {
        world.pendingEvent = null;
        world.lastEventOutcome = { title: pending.title, summary: outcome.summary! };
        return;
      }

      // Not terminal: the chosen option opened a follow-up. Advance to it
      // rather than closing the conversation, and remember what was just
      // said and picked so the scrollback can show it.
      const node = event.nodes?.[outcome.next];
      if (!node) {
        // Malformed content (a `next` with no matching node) shouldn't hang
        // a conversation the player can never get out of.
        world.pendingEvent = null;
        world.lastEventOutcome = {
          title: pending.title,
          summary: outcome.summary ?? 'It went a way nobody expected.',
        };
        return;
      }

      const chosen = pending.options.find((o) => o.id === optionId);
      world.pendingEvent = {
        ...pending,
        body: substitute(pick(rng, node.body), subjects),
        speaker: node.speaker,
        options: node.options.map((o) => ({ id: o.id, label: o.label, gains: o.gains, costs: o.costs })),
        currentNodeId: node.id,
        history: [
          ...pending.history,
          { nodeId: pending.currentNodeId, body: pending.body, choiceId: optionId, choiceLabel: chosen?.label ?? optionId },
        ],
      };
    });
  },

  dismissEventOutcome: () => {
    set((state) => {
      if (state.world) state.world.lastEventOutcome = null;
    });
  },

  dismissMandateOutcome: () => {
    set((state) => {
      if (state.world) state.world.lastMandateOutcome = null;
    });
  },

  dismissYearInReview: () => {
    set((state) => {
      if (state.world) state.world.yearInReview = null;
    });
  },

  answerWeatherCall: (choice) => {
    set((state) => {
      const world = state.world;
      if (!world?.pendingWeatherCall) return;
      world.weatherChoice = choice;
    });
    // Answering *is* running the show. The week was held open waiting for
    // this, so it resolves the moment the booker decides rather than making
    // them press the same button twice.
    get().resolveWeek();
  },

  answerRingCall: (choice) => {
    set((state) => {
      const world = state.world;
      if (!world?.pendingRingCall) return;
      world.ringCallChoice = choice;
    });
    get().resolveWeek();
  },

  answerTruckCall: (choice) => {
    set((state) => {
      const world = state.world;
      if (!world?.pendingTruckCall) return;
      world.truckCallChoice = choice;
    });
    get().resolveWeek();
  },

  answerContractRaid: (choice: ContractRaidOptionId) => {
    set((state) => {
      const world = state.world;
      const call = world?.pendingContractRaid;
      if (!world || !call) return;

      const outcome = resolveContractRaid(choice, world.settings);
      world.promotion.bankBalance += outcome.moneyDelta;
      for (const id of world.promotion.rosterIds) {
        const w = world.wrestlers[id];
        if (w) w.morale = clampMorale(w.morale + outcome.moraleDelta, world.settings);
      }
      world.promotion.reputation = clamp(world.promotion.reputation + outcome.reputationDelta, 0, 100);

      if (outcome.grudgeDelta > 0) {
        const remembered = addGrudge(
          grudgeAgainst(world.grudges, call.rivalId),
          call.rivalId,
          outcome.grudgeDelta,
          `You went right back after them for raiding your contracts.`,
          world.week,
        );
        world.grudges = world.grudges.filter((g) => g.promotionId !== call.rivalId);
        if (remembered) world.grudges.push(remembered);
      }

      world.weeklyNews.push(wire('contract', outcome.line, world.week, 'normal'));
      world.pendingContractRaid = null;
    });
  },

  answerNoShowCall: (choice) => {
    set((state) => {
      const world = state.world;
      if (!world?.pendingNoShowCall) return;
      world.noShowChoice = choice;
    });
    get().resolveWeek();
  },

  answerRivalMove: (choice) => {
    set((state) => {
      const world = state.world;
      const move = world?.pendingRivalMove;
      if (!world || !move) return;

      if (choice === 'statement') {
        world.promotion.rating = clamp(world.promotion.rating + 2, 0, 100);
        world.promotion.reputation = clamp(world.promotion.reputation - 1, 0, 100);
      } else if (choice === 'counterMove') {
        world.promotion.bankBalance -= 8000;
        world.promotion.reputation = clamp(world.promotion.reputation + 3, 0, 100);
      } else {
        for (const id of world.promotion.rosterIds) {
          const w = world.wrestlers[id];
          if (w) w.morale = clampMorale(w.morale - 2, world.settings);
        }
      }

      world.pendingRivalMove = null;
    });
  },

  answerConfrontationCall: (choice) => {
    set((state) => {
      const world = state.world;
      const call = world?.pendingConfrontationCall;
      if (!world || !call) return;
      const hurt = world.wrestlers[call.wrestlerId];
      if (!hurt) {
        world.pendingConfrontationCall = null;
        return;
      }

      if (choice === 'letItHappen') {
        if (!hurt.injury) {
          const grade = gradeFromLength(call.weeks, world.settings);
          hurt.injury = {
            severity: severityOf(grade, world.settings),
            grade,
            description: call.twistLabel,
            sufferedWeek: world.week,
            totalWeeks: call.weeks,
            weeksRemaining: call.weeks,
            permanentStatLoss: {},
            earlyReturnWeeksUsed: 0,
          };
          hurt.injuryHistory = recordInjury(
            hurt.injuryHistory ?? [],
            hurt.injury,
            world.settings.startingYear + Math.floor(world.week / 52),
          );
          hurt.health = clamp(hurt.health - world.settings.casualtyHealthCost, 0, 100);
        }
        world.rivalries = world.rivalries.map((r) =>
          r.participantIds.includes(call.wrestlerId) ? { ...r, heat: clamp(r.heat + 8, 0, 100) } : r,
        );
      } else {
        world.promotion.bookingCredibility = clamp(world.promotion.bookingCredibility - 3, 0, 100);
        world.promotion.reputation = clamp(world.promotion.reputation + 2, 0, 100);
      }

      world.pendingConfrontationCall = null;
    });
  },
});
