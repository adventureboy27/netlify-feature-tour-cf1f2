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
import { pick } from '../../engine/rng';
import type { EventSubjects } from '../../engine/events/types';

type EventsSlice = Pick<
  GameStore,
  | 'chooseEventOption'
  | 'dismissEventOutcome'
  | 'dismissMandateOutcome'
  | 'dismissYearInReview'
  | 'answerWeatherCall'
  | 'answerNoShowCall'
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

  answerNoShowCall: (choice) => {
    set((state) => {
      const world = state.world;
      if (!world?.pendingNoShowCall) return;
      world.noShowChoice = choice;
    });
    get().resolveWeek();
  },
});
