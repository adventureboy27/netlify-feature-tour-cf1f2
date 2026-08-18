// Money changing hands outside of a night's gate: a folded rival's assets,
// the broadcast deal, sponsors, and the bidding war for a star.
//
// Split out of store.ts purely for navigability; every action here is
// unchanged from what it always did.

import type { StateCreator } from 'zustand';
import { rng, type GameStore } from '../store';
import { resolveAuction, settleBiddingWar } from '../storeHelpers';

type BusinessDealsSlice = Pick<
  GameStore,
  | 'bidOnAuction'
  | 'dismissAuctionResult'
  | 'answerBroadcastOffer'
  | 'signSponsor'
  | 'dropSponsor'
  | 'answerBiddingInvitation'
  | 'submitBid'
  | 'dismissBiddingResult'
>;

export const createBusinessDealsSlice: StateCreator<GameStore, [['zustand/immer', never]], [], BusinessDealsSlice> = (
  set,
) => ({
  bidOnAuction: (level) => {
    set((state) => {
      if (state.world?.pendingAuction) resolveAuction(state.world, rng, level);
    });
  },

  dismissAuctionResult: () => {
    set((state) => {
      if (state.world) state.world.lastAuction = null;
    });
  },

  answerBroadcastOffer: (accept) => {
    set((state) => {
      const world = state.world;
      if (!world?.pendingBroadcastOffer) return;
      if (accept) {
        world.broadcastDealId = world.pendingBroadcastOffer;
        // A new deal starts clean; whatever the last one was unhappy about
        // is not this one's business.
        world.breachWeeks = {};
      }
      world.pendingBroadcastOffer = null;
      world.weeksAtRating = 0;
    });
  },

  signSponsor: (sponsorId) => {
    set((state) => {
      const world = state.world;
      if (!world || world.sponsorIds.includes(sponsorId)) return;
      if (!world.pendingSponsorOffers.includes(sponsorId)) return;
      world.sponsorIds.push(sponsorId);
      world.pendingSponsorOffers = world.pendingSponsorOffers.filter((id) => id !== sponsorId);
    });
  },

  dropSponsor: (sponsorId) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      world.sponsorIds = world.sponsorIds.filter((id) => id !== sponsorId);
      delete world.breachWeeks[sponsorId];
    });
  },

  answerBiddingInvitation: (join) => {
    set((state) => {
      const world = state.world;
      const war = world?.pendingBiddingWar;
      if (!world || !war || war.stage !== 'invited' || war.playerIn !== null) return;
      war.playerIn = join;
      if (join) {
        war.stage = 'bidding';
        return;
      }
      // Out is out. The auction happens anyway and the booker reads about it.
      settleBiddingWar(world, rng, null);
    });
  },

  submitBid: (offer) => {
    set((state) => {
      const world = state.world;
      const war = world?.pendingBiddingWar;
      if (!world || !war || war.stage !== 'bidding' || !war.playerIn) return;
      // You cannot offer a bonus you do not have. Everything else about the
      // bid is allowed to be a mistake — §0 says the game does not warn.
      if (offer.signingBonus > world.promotion.bankBalance) return;
      settleBiddingWar(world, rng, {
        ...offer,
        promotionId: world.promotion.id,
        promotionName: world.promotion.name,
      });
    });
  },

  dismissBiddingResult: () => {
    set((state) => {
      if (state.world) state.world.lastBiddingWar = null;
    });
  },
});
