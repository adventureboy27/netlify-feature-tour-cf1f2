// The Crucible: answering the invitation, running the field, and the
// permanent record it leaves behind.
//
// Split out of store.ts purely for navigability; every action here is
// unchanged from what it always did.

import type { StateCreator } from 'zustand';
import { rng, type GameStore } from '../store';
import { clamp } from '../../engine/rng';
import { wire } from '../../engine/world/wire';
import { creditPay } from '../../engine/career/ledger';
import { ledgerOf } from '../../engine/career/ledgerAccess';
import { canWork } from '../../engine/world/rivalBooking';
import {
  willEnter,
  slotsPerPromotion,
  cupEntrantsFrom,
  crownAura,
  crownSurge,
  crownWinsBefore,
  crownsFor,
  fieldIsBigEnough,
  fieldLine,
  CUP_NAME,
  CUP_TROPHY,
} from '../../engine/world/cup';
import { runCup, cupStandingFor } from '../../engine/world/cupRun';
import type { Id, Wrestler } from '../../engine/types';

type CupSlice = Pick<GameStore, 'answerCupEntry' | 'dismissCupResult'>;

export const createCupSlice: StateCreator<GameStore, [['zustand/immer', never]], [], CupSlice> = (set) => ({
  answerCupEntry: (enter) => {
    set((state) => {
      const world = state.world;
      const invite = world?.pendingCupEntry;
      if (!world || !invite) return;
      world.pendingCupEntry = null;
      world.lastCupYear = invite.year;

      // Everybody who can afford it and is worth a look buys in. The player
      // is just one more entry — a company that sits out simply is not there,
      // and the tournament happens without them.
      const others = world.rivals.filter(
        (r) => r.closedWeek === null && willEnter(r, world.settings),
      );
      const paying = enter ? [world.promotion, ...others] : others;
      if (!fieldIsBigEnough(paying.length, world.settings)) {
        // Refunded rather than pocketed: they never ran the thing.
        world.weeklyNews.push(
          wire('story', fieldLine(paying.length, 0, world.settings), world.week, 'minor'),
        );
        return;
      }

      const slots = slotsPerPromotion(paying.length, world.settings);
      const rosterOf = (ids: readonly Id[]) =>
        ids.map((id) => world.wrestlers[id]).filter((w): w is Wrestler => Boolean(w));

      const field = paying.map((promotion) => ({
        promotion,
        entrants: cupEntrantsFrom(
          rosterOf(promotion.rosterIds),
          slots,
          (w) => canWork(w, world.settings, world.week),
        ),
      }));

      // The fee leaves the bank whether the night goes well or badly. That
      // is what makes it a gamble rather than a free roll.
      if (enter) world.promotion.bankBalance -= invite.fee;

      const year = world.settings.startingYear + Math.floor(world.week / 52);
      const result = runCup(rng, {
        field,
        slotsEach: slots,
        week: world.week,
        year,
        settings: world.settings,
      });
      if (!result) return;

      world.lastCup = result;

      // What the night took out of anybody who worked it more than once.
      // A single-night bracket is meant to be a body decision as much as a
      // booking one, and it was charging nothing at all — the three
      // functions for it were written, tested and never called.
      //
      // §0: it comes off their health, so it gets a sentence.
      const worn: string[] = [];
      for (const { wrestlerId, cost } of result.wornOut) {
        const person = world.wrestlers[wrestlerId];
        if (!person || person.deceased) continue;
        person.health = clamp(person.health - cost, 0, 100);
        if (world.promotion.rosterIds.includes(wrestlerId)) worn.push(person.name);
      }
      if (worn.length > 0) {
        world.weeklyNews.push(
          wire(
            'misfortune',
            worn.length === 1
              ? `${worn[0]} went to the well more than once in one night at ${CUP_NAME}, and is feeling every bit of it.`
              : `${worn.slice(0, -1).join(', ')} and ${worn[worn.length - 1]} all worked more than once in a night at ${CUP_NAME}. That is a week of ice baths.`,
            world.week,
            'normal',
          ),
        );
      }

      // Half the pot to the winner's company, half to the winner. Exactly as
      // split, and both halves are real money in real hands.
      const winnerCompany =
        result.winnerPromotionId === world.promotion.id
          ? world.promotion
          : world.rivals.find((r) => r.id === result.winnerPromotionId);
      if (winnerCompany) winnerCompany.bankBalance += result.purse.companyShare;

      const champion = world.wrestlers[result.winnerId];
      if (champion) {
        creditPay(ledgerOf(champion), result.purse.wrestlerShare);

        // The road to superstardom. The crown aura is standing the crowd
        // hands over and it leaves when the crown does; this is the wrestler
        // themselves coming back different, and it is permanent. It stacks
        // for a repeat winner, which is the whole reason to want it twice.
        // Scaled by how many times they have taken it before. It still
        // stacks — that is the reason to want it twice — but each one moves
        // them less, so a three-time winner is confirmed rather than capped.
        const surge = crownSurge(world.settings, crownWinsBefore(world.cupHistory, champion.id));
        champion.popularity = clamp(
          champion.popularity + surge.popularity + crownAura(world.settings),
          0,
          100,
        );
        champion.skill = clamp(champion.skill + surge.skill, 0, 100);
        champion.charisma = clamp(champion.charisma + surge.charisma, 0, 100);
        champion.stamina = clamp(champion.stamina + surge.stamina, 0, 100);
        champion.attitude = clamp(champion.attitude + surge.attitude, 0, 100);
        champion.momentum = clamp(champion.momentum + surge.momentum, 0, 100);
      }

      // How far everybody got, in standing.
      for (const person of field.flatMap((f) => f.entrants)) {
        const swing = cupStandingFor(result, person.id, world.settings);
        const live = world.wrestlers[person.id];
        if (live) live.popularity = clamp(live.popularity + swing, 0, 100);
      }

      // The crown changes hands, and the old holder loses the aura with it.
      const previous = world.crown;
      if (previous && previous.wrestlerId !== result.winnerId) {
        const dethroned = world.wrestlers[previous.wrestlerId];
        if (dethroned) {
          dethroned.popularity = clamp(
            dethroned.popularity - crownAura(world.settings),
            0,
            100,
          );
        }
      }
      world.crown = result.reign;
      world.cupHistory.push(result.reign);

      // Say it out loud when somebody does it more than once — that is the
      // difference between a good year and a career.
      const crowns = crownsFor(world.cupHistory, result.winnerId).length;
      if (crowns > 1) {
        world.weeklyNews.push(
          wire(
            'story',
            `${result.winnerName} has now won ${CUP_NAME} ${crowns} times.`,
            world.week,
            'lead',
          ),
        );
      }

      world.weeklyNews.push(
        wire('story', fieldLine(paying.length, slots, world.settings), world.week, 'minor'),
      );
      world.weeklyNews.push(wire('story', result.line, world.week, 'lead'));
      world.weeklyNews.push(
        wire(
          'story',
          `${result.winnerName} takes $${result.purse.wrestlerShare.toLocaleString()} and ${CUP_TROPHY} for the year. ` +
            `${result.winnerPromotionName} take the other $${result.purse.companyShare.toLocaleString()}.`,
          world.week,
          'lead',
        ),
      );
    });
  },

  dismissCupResult: () => {
    set((state) => {
      if (state.world) state.world.lastCup = null;
    });
  },
});
