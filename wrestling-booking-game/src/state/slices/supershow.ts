// The joint show (§16): proposing one, signing off on the card the other
// office sends back, striking a match, and running the night.
//
// Split out of store.ts purely for navigability; every action here is
// unchanged from what it always did.

import type { StateCreator } from 'zustand';
import { rng, type GameStore } from '../store';
import { clamp } from '../../engine/rng';
import { settleSupershow, supershowRoster } from '../storeHelpers';
import { wire } from '../../engine/world/wire';
import { grudgeAgainst } from '../../engine/world/grudges';
import { openingOffer, respondToOffer, supershowPurse } from '../../engine/world/supershow';
import { draftSupershow } from '../../engine/world/supershowRun';
import { strikeMatch } from '../../engine/world/supershowCard';

type SupershowSlice = Pick<
  GameStore,
  'proposeSupershow' | 'answerSupershow' | 'strikeSupershowMatch' | 'runSupershowNight' | 'dismissSupershowResult'
>;

export const createSupershowSlice: StateCreator<GameStore, [['zustand/immer', never]], [], SupershowSlice> = (
  set,
) => ({
  proposeSupershow: (partnerId) => {
    set((state) => {
      const world = state.world;
      if (!world || world.pendingSupershow || world.lastSupershow) return;
      const cooldown = world.settings.supershowProposalCooldownWeeks;
      if (
        world.lastSupershowApproachWeek !== null &&
        world.week - world.lastSupershowApproachWeek < cooldown
      ) {
        return;
      }
      const partner = world.rivals.find((r) => r.id === partnerId);
      if (!partner || partner.closedWeek !== null || partner.rosterIds.length < 4) return;

      world.lastSupershowApproachWeek = world.week;

      // The standing gap, plus whatever they are still carrying from the
      // last time you worked together. Until now only the first half
      // existed, so a company you buried nine-nil last November sat down
      // with you in May as though nothing had happened.
      const resentment = clamp(
        (partner.rating - world.promotion.rating) / 2 +
          (grudgeAgainst(world.grudges, partner.id)?.resentment ?? 0),
        0,
        100,
      );
      const draft = openingOffer(
        world.promotion,
        partner,
        world.promotion.homeTerritoryId,
        world.week,
        world.settings,
      );
      const reply = respondToOffer(rng, draft, world.promotion, partner, resentment, world.settings);

      if (reply.kind === 'refused') {
        // Asking and being turned down is itself a story, and being turned
        // down in the trades is worse than being turned down on the phone.
        world.weeklyNews.push(
          wire(
            'story',
            reply.publicly
              ? `${partner.name} turned down a joint show with ${world.promotion.name}, and made sure it was heard. ${reply.because}`
              : `${partner.name} passed on a joint show. ${reply.because}`,
            world.week,
            reply.publicly ? 'lead' : 'minor',
          ),
        );
        return;
      }

      const deal = reply.deal;
      const estimate = supershowPurse(
        world.promotion,
        partner,
        deal,
        Math.round(deal.cardSize / 2),
        Math.round(deal.cardSize / 4),
        world.settings,
      );
      world.pendingSupershow = {
        deal,
        partnerName: partner.name,
        pitch:
          reply.kind === 'countered'
            ? reply.because
            : `${partner.name} are in. Their terms are your terms.`,
        estimatedNet: estimate.playerNet,
        expiresWeek: world.week + world.settings.supershowOfferWeeks,
      };
      world.weeklyNews.push(
        wire(
          'story',
          reply.kind === 'countered'
            ? `${partner.name} will run with you, on their own terms. ${reply.because}`
            : `${partner.name} have agreed to a joint pay-per-view.`,
          world.week,
          'lead',
        ),
      );
    });
  },

  answerSupershow: (accept) => {
    set((state) => {
      const world = state.world;
      const offer = world?.pendingSupershow;
      if (!world || !offer) return;
      world.pendingSupershow = null;

      if (!accept) {
        // Turning down a joint show is remembered. They asked once.
        world.weeklyNews.push(
          wire('story', `${world.promotion.name} passed on the joint show with ${offer.partnerName}.`, world.week, 'minor'),
        );
        return;
      }

      const partner = world.rivals.find((r) => r.id === offer.deal.partnerId);
      if (!partner || partner.closedWeek !== null) return;

      // Signing the deal does not run the show. It produces a card, with the
      // other office's refusals already on it, and then §16's other
      // negotiation starts. See engine/world/supershowCard.ts.
      const booking = draftSupershow(rng, {
        player: world.promotion,
        partner,
        deal: offer.deal,
        playerRoster: supershowRoster(world, world.promotion.rosterIds),
        partnerRoster: supershowRoster(world, partner.rosterIds),
        titles: world.titles,
        stables: world.stables,
        territories: world.territories,
        week: world.week,
        settings: world.settings,
        resentment: grudgeAgainst(world.grudges, partner.id)?.resentment ?? 0,
      });
      if (!booking) return;

      world.pendingSupershowCard = booking;

      const theirs = booking.card.struck.filter((m) => m.struckBy === partner.id).length;
      world.weeklyNews.push(
        wire(
          'story',
          theirs > 0
            ? `${partner.name} signed the joint show and sent a card back with ${theirs} of your matches crossed off.`
            : `${partner.name} signed the joint show and took the card as it was written.`,
          world.week,
          'lead',
        ),
      );
    });
  },

  strikeSupershowMatch: (matchId) => {
    set((state) => {
      const world = state.world;
      const booking = world?.pendingSupershowCard;
      if (!world || !booking) return;
      const match = booking.card.matches.find((m) => m.id === matchId);
      if (!match) return;
      booking.card = strikeMatch(
        booking.card,
        matchId,
        world.promotion.id,
        `${world.promotion.name} will not run it.`,
      );
    });
  },

  runSupershowNight: () => {
    set((state) => {
      if (!state.world) return;
      settleSupershow(state.world, rng);
    });
  },

  dismissSupershowResult: () => {
    set((state) => {
      if (state.world) state.world.lastSupershow = null;
    });
  },
});
