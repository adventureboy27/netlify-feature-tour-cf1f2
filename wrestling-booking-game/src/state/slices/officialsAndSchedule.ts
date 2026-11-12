// Officials — who is assigned to a segment, who is signed, who spreads
// across the card — and the weekly schedule pattern shows run on.
//
// Split out of store.ts purely for navigability; every action here is
// unchanged from what it always did.

import type { StateCreator } from 'zustand';
import { rngFromSeed } from '../../engine/rng';
import type { GameStore } from '../store';
import type { Id } from '../../engine/types';
import { createRefereeContract, currentRefereeAskingRate, signedReferees, spreadOfficials } from '../../engine/sim/referees';
import { defaultShowName, resizeSchedule, scheduleOf } from '../../engine/world/schedule';

type OfficialsAndScheduleSlice = Pick<
  GameStore,
  | 'setSegmentManager'
  | 'setSegmentReferee'
  | 'setSegmentGuestReferee'
  | 'setDefaultReferee'
  | 'setShowsPerWeek'
  | 'setPPVCadence'
  | 'renameShow'
  | 'toggleShowOnDay'
  | 'setShowDay'
  | 'spreadOfficialsAcrossCard'
  | 'signReferee'
  | 'releaseReferee'
>;

export const createOfficialsAndScheduleSlice: StateCreator<
  GameStore,
  [['zustand/immer', never]],
  [],
  OfficialsAndScheduleSlice
> = (set) => ({
  setSegmentManager: (slot, managerId, forSide, seat = 0) => {
    set((state) => {
      const segment = state.world?.currentCard[slot];
      if (!segment) return;
      const all = segment.managerIds ?? [];
      const inCorner = all.filter((m) => m.forSide === forSide);
      const elsewhere = all.filter((m) => m.forSide !== forSide);

      // A corner is a short list rather than a single slot: seat 0 is the
      // mouthpiece, seat 1 the muscle. Two men in one corner is the whole
      // point — one pulls the official and the other uses the seconds.
      const kept = inCorner.filter((_, i) => i !== seat);
      const rebuilt = managerId
        ? [...inCorner.slice(0, seat).filter(Boolean), { managerId, forSide }, ...inCorner.slice(seat + 1)]
        : kept;

      // Nobody stands in two corners at once, and nobody stands in the same
      // corner twice.
      const seen = new Set<Id>();
      const deduped = rebuilt.filter((m) => {
        if (seen.has(m.managerId)) return false;
        seen.add(m.managerId);
        return true;
      });

      segment.managerIds = [
        ...elsewhere.filter((m) => !deduped.some((d) => d.managerId === m.managerId)),
        ...deduped.slice(0, state.world!.settings.cornerSeats),
      ];
    });
  },

  setSegmentReferee: (slot, refereeId) => {
    set((state) => {
      const segment = state.world?.currentCard[slot];
      if (!segment) return;
      segment.refereeId = refereeId;
      // An assigned official and a guest in the shirt are alternatives.
      if (refereeId) segment.guestRefereeId = null;
    });
  },

  setSegmentGuestReferee: (slot, wrestlerId) => {
    set((state) => {
      const segment = state.world?.currentCard[slot];
      if (!segment) return;
      segment.guestRefereeId = wrestlerId;
      if (wrestlerId) segment.refereeId = null;
    });
  },

  setDefaultReferee: (refereeId) => {
    set((state) => {
      if (!state.world) return;
      state.world.defaultRefereeId = refereeId;
    });
  },

  setShowsPerWeek: (count) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      // A named show that survives a trim keeps its name — the pattern is a
      // fixture list the company has announced, not a queue to be rebuilt.
      world.promotion.schedule = resizeSchedule(
        scheduleOf(world.promotion, world.settings),
        count,
        world.promotion.name,
        rngFromSeed(`${world.settings.seed}-schedule-${world.week}-${count}`),
        world.settings,
      );
    });
  },

  setPPVCadence: (cadence) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      world.promotion.schedule = { ...scheduleOf(world.promotion, world.settings), ppvCadence: cadence };
    });
  },

  renameShow: (showId, name) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const schedule = scheduleOf(world.promotion, world.settings);
      world.promotion.schedule = {
        ...schedule,
        shows: schedule.shows.map((show) => (show.id === showId ? { ...show, name: trimmed } : show)),
      };
    });
  },

  toggleShowOnDay: (day) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const schedule = scheduleOf(world.promotion, world.settings);
      const existing = schedule.shows.find((show) => show.day === day);

      if (existing) {
        // The televised night is the one the booker builds a card for. Losing
        // it by tapping a square would quietly take the company off the air,
        // so that one has to be moved rather than deleted.
        if (existing.televised) return;
        world.promotion.schedule = {
          ...schedule,
          shows: schedule.shows.filter((show) => show.id !== existing.id),
        };
        return;
      }

      if (schedule.shows.length >= world.settings.scheduleMaxShows) return;

      world.promotion.schedule = {
        ...schedule,
        shows: [
          ...schedule.shows,
          {
            // NOT `show-N`: the seeded pattern numbers its shows by position
            // (`show-0`, `show-1`, ...) and `nextId` collided with those, so
            // a night added by hand could share an id with an existing show
            // — and removing either one then removed both.
            id: `night-${world.nextId++}`,
            name: defaultShowName(
              world.promotion.name,
              day,
              schedule.shows.length,
              rngFromSeed(`${world.settings.seed}-night-${day}-${world.week}`),
              new Set(schedule.shows.map((s) => s.name)),
            ),
            day,
            televised: false,
          },
        ],
      };
    });
  },

  setShowDay: (showId, day) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const schedule = scheduleOf(world.promotion, world.settings);
      // Two shows on one night is one show. Whoever was already there swaps
      // onto the night the mover came from, so the pattern stays a week.
      const mover = schedule.shows.find((show) => show.id === showId);
      if (!mover) return;
      const occupant = schedule.shows.find((show) => show.day === day && show.id !== showId);
      world.promotion.schedule = {
        ...schedule,
        shows: schedule.shows.map((show) => {
          if (show.id === showId) return { ...show, day };
          if (occupant && show.id === occupant.id) return { ...show, day: mover.day };
          return show;
        }),
      };
    });
  },

  spreadOfficialsAcrossCard: () => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const crew = signedReferees(world.referees, world.promotion.id);
      // Spread across the matches that exist, not the empty slots. Counting
      // slots put the best official on a main event that had nobody in it
      // and left him working eight matches a year.
      const booked = world.currentCard
        .map((segment, slot) => ({ segment, slot }))
        .filter(({ segment }) => new Set(segment.participants.map((p) => p.side)).size >= 2);
      const assignments = spreadOfficials(crew, booked.length);
      booked.forEach(({ segment }, i) => {
        // A match with a guest referee booked into it is a booking
        // decision, not an oversight — leave those alone.
        if (segment.guestRefereeId) return;
        segment.refereeId = assignments[i] ?? null;
      });
    });
  },

  signReferee: (refereeId) => {
    let outcome: { ok: boolean; reason: string | null } = { ok: false, reason: 'No game in progress.' };
    set((state) => {
      const world = state.world;
      if (!world) return;
      const referee = world.referees.find((r) => r.id === refereeId);
      if (!referee) {
        outcome = { ok: false, reason: 'Nobody by that name is licensed.' };
        return;
      }
      if (referee.promotionId) {
        outcome = { ok: false, reason: 'Already working for somebody.' };
        return;
      }
      const rate = currentRefereeAskingRate(referee, world.settings);
      // Same affordability test the wrestlers get: a deal you cannot
      // service for a season is a deal you cannot make.
      if (rate * world.settings.contractAffordabilityWeeks > world.promotion.bankBalance) {
        outcome = { ok: false, reason: 'You cannot service that wage.' };
        return;
      }
      referee.promotionId = world.promotion.id;
      referee.contract = createRefereeContract(
        referee,
        world.settings,
        world.settings.startingYear + Math.floor(world.week / 52),
      );
      referee.weeksUnsigned = 0;
      // First official through the door takes the card by default, so a
      // promotion is never one signing away from still having nobody.
      if (!world.defaultRefereeId) world.defaultRefereeId = referee.id;
      outcome = { ok: true, reason: null };
    });
    return outcome;
  },

  releaseReferee: (refereeId) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const referee = world.referees.find((r) => r.id === refereeId);
      if (!referee || referee.promotionId !== world.promotion.id) return;
      referee.promotionId = null;
      referee.contract = null;
      referee.weeksUnsigned = 0;
      if (world.defaultRefereeId === refereeId) world.defaultRefereeId = null;
      // Any match he was booked for reverts to the card's official.
      for (const segment of world.currentCard) {
        if (segment.refereeId === refereeId) segment.refereeId = null;
      }
    });
  },
});
