// Championships: introducing one, retiring or bringing one back, editing
// what it is called or defended under, answering for a hurt champion, and
// the contract perks a wrestler can earn.
//
// Split out of store.ts purely for navigability; every action here is
// unchanged from what it always did.

import type { StateCreator } from 'zustand';
import { rng, type GameStore } from '../store';
import { closeReign, stripTitle, commitTitleChange } from '../storeHelpers';
import { wire } from '../../engine/world/wire';
import { createStartingTitles } from '../../data/titles';
import { championInjuryOptions } from '../../engine/world/titleDefence';
import { availablePerks } from '../../engine/economy/perks';
import { pick } from '../../engine/rng';
import type { Wrestler } from '../../engine/types';

type TitlesSlice = Pick<
  GameStore,
  | 'createTitle'
  | 'retireTitle'
  | 'editTitle'
  | 'unretireTitle'
  | 'answerChampionCall'
  | 'answerTitleMemorial'
  | 'setPerk'
>;

export const createTitlesSlice: StateCreator<GameStore, [['zustand/immer', never]], [], TitlesSlice> = (set) => ({
  createTitle: (blueprint) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const [belt] = createStartingTitles(world.promotion.id, world.promotion.name, world.promotion.identity, [
        blueprint,
      ]);
      if (!belt) return;
      // Ids are positional within a batch, so a mid-run belt has to take one
      // nothing else has ever used — including belts that were retired.
      belt.id = `${world.promotion.id}-title-${world.week}-${world.titles.length}`;
      belt.lastDefendedWeek = world.week;
      world.titles.push(belt);
      world.promotion.titleIds.push(belt.id);
      world.weeklyNews.push(
        wire('title', `${world.promotion.name} has introduced the ${belt.name}. It is vacant.`, world.week, 'lead'),
      );
    });
  },

  retireTitle: (titleId) => {
    set((state) => {
      const world = state.world;
      const title = world?.titles.find((t) => t.id === titleId);
      if (!world || !title || title.retiredWeek) return;

      // Whoever is carrying it stops being champion — but the lineage says
      // the belt was retired, not that they lost it, because they did not.
      const holders = title.currentHolderIds
        .map((id) => world.wrestlers[id]?.name)
        .filter(Boolean)
        .join(' & ');
      if (!title.vacant) closeReign(world, title, 'titleRetired');
      title.vacant = true;
      title.currentHolderIds = [];
      title.interimHolderIds = [];
      title.interimSinceWeek = null;
      title.retiredWeek = world.week;
      world.promotion.titleIds = world.promotion.titleIds.filter((id) => id !== titleId);

      world.weeklyNews.push(
        wire(
          'title',
          holders
            ? `The ${title.name} has been retired. ${holders} was the last to hold it.`
            : `The ${title.name} has been retired.`,
          world.week,
          'lead',
        ),
      );
    });
  },

  editTitle: (titleId, patch) => {
    set((state) => {
      const world = state.world;
      const title = world?.titles.find((t) => t.id === titleId);
      if (!world || !title) return;

      const renamed = patch.name?.trim();
      if (renamed && renamed !== title.name) {
        world.weeklyNews.push(
          wire('title', `The ${title.name} is now the ${renamed}.`, world.week, 'normal'),
        );
        title.name = renamed;
      }
      if (patch.blurb !== undefined) title.blurb = patch.blurb.trim() || title.blurb;
      if (patch.signatureStipulationId !== undefined) {
        title.signatureStipulationId = patch.signatureStipulationId;
      }
    });
  },

  unretireTitle: (titleId) => {
    set((state) => {
      const world = state.world;
      const title = world?.titles.find((t) => t.id === titleId);
      if (!world || !title || !title.retiredWeek) return;
      title.retiredWeek = null;
      title.vacant = true;
      title.currentHolderIds = [];
      // The clock starts again from today rather than from whenever it was
      // last defended, which might be twenty years ago.
      title.lastDefendedWeek = world.week;
      if (!world.promotion.titleIds.includes(title.id)) world.promotion.titleIds.push(title.id);

      const previous = title.history[title.history.length - 1];
      const lastHolder = previous?.holderIds.map((id) => world.wrestlers[id]?.name).filter(Boolean).join(' & ');
      world.weeklyNews.push(
        wire(
          'title',
          lastHolder
            ? `The ${title.name} is back. It has not been defended since ${lastHolder} held it, and it is vacant.`
            : `The ${title.name} is back, and vacant.`,
          world.week,
          'lead',
        ),
      );
    });
  },

  answerChampionCall: (choice, interimHolderId) => {
    set((state) => {
      const world = state.world;
      const call = world?.pendingChampionCall;
      if (!world || !call) return;
      const title = world.titles.find((t) => t.id === call.titleId);
      if (!title || title.vacant) {
        world.pendingChampionCall = null;
        return;
      }

      // A team-held belt has one option however it is asked for. Enforced
      // here rather than only in the UI, so the rule is the rule.
      const options = championInjuryOptions(title);
      const settled = options.some((o) => o.id === choice) ? choice : 'vacate';

      if (settled === 'vacate') {
        stripTitle(world, title, 'vacatedByBooker');
        world.weeklyNews.push(
          wire(
            'title',
            `The ${title.name} is vacant. ${call.championName} could not defend it and the company would not let it sit.`,
            world.week,
            'lead',
          ),
        );
      } else if (settled === 'defendAnyway') {
        // The only route by which an injured wrestler gets on a card at
        // all. They were told what it costs; casualties.ts charges it.
        for (const id of title.currentHolderIds) {
          const person = world.wrestlers[id];
          if (person?.injury) person.clearedToWorkHurt = true;
        }
        // The clock does not stop for an injury. Clearing them to work is
        // a decision to keep defending, so it had better be defended.
        world.weeklyNews.push(
          wire(
            'title',
            `${call.championName} will defend the ${title.name} hurt. ${call.injuryText}, and the company is letting it happen.`,
            world.week,
            'lead',
          ),
        );
      } else if (settled === 'interim' && interimHolderId) {
        const interim = world.wrestlers[interimHolderId];
        if (!interim) return;
        title.interimHolderIds = [interimHolderId];
        title.interimSinceWeek = world.week;
        // An interim reign is a reign — it goes on the record, and the
        // unification is what decides whether it stays there.
        interim.titleReigns.push({
          titleId: title.id,
          promotionId: title.promotionId,
          holderIds: [interimHolderId],
          holderAges: [interim.age],
          wonFromIds: null,
          wonByMethod: 'awarded',
          startWeek: world.week,
          endWeek: null,
          endMethod: null,
        });
        world.weeklyNews.push(
          wire(
            'title',
            `${interim.name} is the interim ${title.name}. ${call.championName} keeps the real one, and when they are fit the two of them settle it in one match.`,
            world.week,
            'lead',
          ),
        );
      }

      world.pendingChampionCall = null;
    });
  },

  answerTitleMemorial: (choice) => {
    set((state) => {
      const world = state.world;
      const memorial = world?.pendingTitleMemorial;
      if (!world || !memorial) return;
      const title = world.titles.find((t) => t.id === memorial.titleId);
      if (!title || title.vacant) {
        world.pendingTitleMemorial = null;
        return;
      }

      if (choice === 'retire') {
        closeReign(world, title, 'titleRetired');
        title.vacant = true;
        title.currentHolderIds = [];
        title.interimHolderIds = [];
        title.interimSinceWeek = null;
        title.retiredWeek = world.week;
        world.promotion.titleIds = world.promotion.titleIds.filter((id) => id !== title.id);
        world.weeklyNews.push(
          wire('title', `The ${title.name} has been retired. ${memorial.championName} was the last to hold it.`, world.week, 'lead'),
        );
      } else if (choice === 'passToSuccessor') {
        const candidates = world.promotion.rosterIds
          .map((id) => world.wrestlers[id])
          .filter((w): w is Wrestler => Boolean(w && w.id !== memorial.championId));
        const successor = candidates.length > 0 ? pick(rng, candidates) : null;
        if (successor) {
          const titleIndex = world.titles.findIndex((t) => t.id === title.id);
          commitTitleChange(world, titleIndex, [successor.id]);
          world.weeklyNews.push(
            wire(
              'title',
              `${successor.name} has been named ${title.name} in the wake of ${memorial.championName}'s death. The office made the call rather than leave it empty.`,
              world.week,
              'lead',
            ),
          );
        } else {
          stripTitle(world, title, 'vacatedByBooker');
          world.weeklyNews.push(
            wire('title', `The ${title.name} is vacant. There was nobody left to hand it to.`, world.week, 'lead'),
          );
        }
      } else {
        stripTitle(world, title, 'vacatedByBooker');
        world.weeklyNews.push(
          wire(
            'title',
            `The ${title.name} is vacant. ${memorial.championName} died holding it, and the company would not leave it sitting.`,
            world.week,
            'lead',
          ),
        );
      }

      world.pendingTitleMemorial = null;
    });
  },

  setPerk: (wrestlerId, perkId, on) => {
    let outcome: { ok: boolean; reason: string | null } = { ok: false, reason: 'Nobody by that name.' };
    set((state) => {
      const world = state.world;
      if (!world || !world.settings.perksEnabled) return;
      const wrestler = world.wrestlers[wrestlerId];
      if (!wrestler?.contract || wrestler.promotionId !== world.promotion.id) return;

      const contract = wrestler.contract;
      if (!contract.perks) contract.perks = [];
      if (!on) {
        contract.perks = contract.perks.filter((id) => id !== perkId);
        outcome = { ok: true, reason: null };
        return;
      }
      // Everything here is renewal-only, and somebody on your roster is by
      // definition somebody you already have — so this is a renewal.
      const year = world.settings.startingYear + Math.floor(world.week / 52);
      const allowed = availablePerks(wrestler, { currentYear: year, isRenewal: true });
      if (!allowed.some((perk) => perk.id === perkId)) {
        outcome = { ok: false, reason: 'They have not earned that yet.' };
        return;
      }
      if (!contract.perks.includes(perkId)) contract.perks.push(perkId);
      outcome = { ok: true, reason: null };
    });
    return outcome;
  },
});
