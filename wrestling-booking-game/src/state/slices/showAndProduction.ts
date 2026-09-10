// Where the show is staged, what it costs, and what it is built to line —
// the room, the residency, the touring rig, and the promo/confrontation
// slots that sit beside the match card.
//
// Split out of store.ts purely for navigability; every action here is
// unchanged from what it always did.

import type { StateCreator } from 'zustand';
import type { GameStore } from '../store';
import { wire } from '../../engine/world/wire';
import { venueById, fallbackVenue, VENUES } from '../../data/venues';
import { venueFitsTerritory } from '../../engine/world/territories';
import { prunedStands, standById } from '../../engine/economy/stands';
import { productionInRoom } from '../../engine/economy/venue';
import {
  breakLeaseCost,
  exposureLine,
  residencyDeposit,
  residencyHomeById,
  residencyTerms,
  signResidency,
} from '../../engine/economy/residency';
import { promoTopicById } from '../../data/promoTopics';
import { confrontationById } from '../../data/confrontations';
import { HAULAGE, haulageById, nextHaulage, ladderStatus } from '../../engine/economy/production';
import { nextCardSizeTier } from '../../data/cardSize';
import { productionAssetById } from '../../data/production';
import { newAssetCondition, repairAsset, repairCost } from '../../engine/economy/showBudget';
import { fireSaleEligible, fireSaleValue } from '../../engine/economy/fireSale';
import {
  newPropUnit,
  repairPropUnit as repairPropUnitCondition,
  propRepairCost,
  ownedUnitsForFamily,
} from '../../engine/economy/matchProps';
import { tierById as propTierById, familyById as propFamilyById } from '../../data/matchProps';

type ShowAndProductionSlice = Pick<
  GameStore,
  | 'setVenue'
  | 'toggleStand'
  | 'signResidency'
  | 'breakResidency'
  | 'setTerritory'
  | 'setPromo'
  | 'setConfrontation'
  | 'setTicketPrice'
  | 'toggleShowExtra'
  | 'buyRung'
  | 'buyHaulage'
  | 'buyCardSizeTier'
  | 'buyProductionAsset'
  | 'repairProductionAsset'
  | 'sellProductionAsset'
  | 'buyPropUnit'
  | 'repairPropUnit'
>;

export const createShowAndProductionSlice: StateCreator<
  GameStore,
  [['zustand/immer', never]],
  [],
  ShowAndProductionSlice
> = (set) => ({
  setVenue: (venueId) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      // A signed term is a signed term. Changing rooms means breaking it.
      if (world.residency) return;
      world.showSetup.venueId = venueId;

      // A room that will not take a stand must not go on charging for it.
      // The bug this prevents: booking a bar in the VFW hall, moving to the
      // casino, and paying nine hundred a week for a bar that never opened.
      const venue = venueById(venueId) ?? fallbackVenue();
      world.showSetup.standIds = prunedStands(world.showSetup.standIds, {
        gimmickMerchMultiplier: 1,
        prestige: world.promotion.rating,
        identity: world.promotion.identity,
        venue,
        rigInRoom: productionInRoom(world.productionRungs, venue),
        settings: world.settings,
      });
    });
  },

  toggleStand: (standId) => {
    set((state) => {
      const world = state.world;
      if (!world || !standById(standId)) return;
      world.showSetup.standIds = world.showSetup.standIds.includes(standId)
        ? world.showSetup.standIds.filter((id) => id !== standId)
        : [...world.showSetup.standIds, standId];
    });
  },

  signResidency: (homeId, weeks) => {
    set((state) => {
      const world = state.world;
      if (!world || world.residency) return;

      // No rating gate: a legion hall in Brackett will take anybody's money.
      // A big company signing one is a mistake, not an impossibility, and
      // the game does not stop anybody making it (§0).
      const home = residencyHomeById(homeId);
      if (!home) return;

      const term = residencyTerms(world.settings).find((t) => t.weeks === weeks);
      if (!term) return;

      const deposit = residencyDeposit(home, term, world.settings);
      if (world.promotion.bankBalance < deposit) return;

      world.promotion.bankBalance -= deposit;
      world.residency = signResidency(home, term, world.week);
      world.weeklyNews.push(
        wire(
          'signing',
          `${world.promotion.name} has officially locked down the ${home.name} in ${home.town} for ${term.label.toLowerCase()}. ` +
            `${exposureLine(world.residency)} The trucks are staying parked in the yard.`,
          world.week,
        ),
      );
    });
  },

  breakResidency: () => {
    set((state) => {
      const world = state.world;
      if (!world?.residency) return;

      const owed = breakLeaseCost(world.residency, world.settings);
      const { homeName, town } = world.residency;
      world.promotion.bankBalance -= owed;
      world.residency = null;
      world.weeklyNews.push(
        wire(
          'signing',
          `${world.promotion.name} has bought its way clean out of the ${homeName} in ${town} — cost a hard $${owed.toLocaleString()} just to be let out the door.`,
          world.week,
        ),
      );
    });
  },

  setTerritory: (territoryId) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      world.showSetup.territoryId = territoryId;

      // A building bigger than the town cannot be run there. Rather than
      // refuse the move, drop to the biggest room the market can hold —
      // the player picked where to go, and the venue follows.
      const town = world.territories.find((t) => t.id === territoryId);
      const venue = venueById(world.showSetup.venueId);
      if (town && venue && !venueFitsTerritory(venue.capacity, town.capacity)) {
        const fits = VENUES.filter(
          (v) => world.promotion.rating >= v.minCompanyRating && venueFitsTerritory(v.capacity, town.capacity),
        );
        world.showSetup.venueId = (fits[fits.length - 1] ?? fallbackVenue()).id;
      }
    });
  },

  setPromo: (slot, cast) => {
    set((state) => {
      const promo = state.world?.currentPromos[slot];
      if (!promo) return;
      if (cast.topicId !== undefined) {
        promo.promoTopicId = cast.topicId;
        // A topic that needs nobody should not keep a stale target around.
        const topic = cast.topicId ? promoTopicById(cast.topicId) : undefined;
        if (topic && !topic.needsTarget) promo.promoTargetId = null;
      }
      if (cast.speakerId !== undefined) promo.promoSpeakerId = cast.speakerId;
      if (cast.targetId !== undefined) promo.promoTargetId = cast.targetId;
      if (cast.mouthpieceId !== undefined) promo.promoMouthpieceId = cast.mouthpieceId;
    });
  },

  setConfrontation: (slot, cast) => {
    set((state) => {
      const segment = state.world?.currentPromos[slot];
      if (!segment) return;

      if (cast.confrontationId !== undefined) {
        segment.confrontationId = cast.confrontationId;
        if (cast.confrontationId) {
          segment.kind = 'confrontation';
          // A promo's target is the obvious person to carry over.
          segment.confrontationOppositeId ??= segment.promoTargetId ?? null;
          segment.confrontationVenue ??= confrontationById(cast.confrontationId)?.venues[0] ?? 'ring';
          segment.promoTopicId = null;
        } else {
          // Back to being a promo, and nothing stale left behind.
          segment.kind = 'promo';
          segment.confrontationOppositeId = null;
          segment.confrontationThirdId = null;
          segment.confrontationResult = null;
        }
      }
      if (cast.venue !== undefined) segment.confrontationVenue = cast.venue;
      if (cast.speakerId !== undefined) segment.promoSpeakerId = cast.speakerId;
      if (cast.oppositeId !== undefined) segment.confrontationOppositeId = cast.oppositeId;
      if (cast.thirdId !== undefined) segment.confrontationThirdId = cast.thirdId;
    });
  },

  setTicketPrice: (price) => {
    set((state) => {
      if (state.world) state.world.showSetup.ticketPrice = Math.max(1, Math.round(price));
    });
  },

  toggleShowExtra: (extraId) => {
    set((state) => {
      const setup = state.world?.showSetup;
      if (!setup) return;
      setup.extraIds = setup.extraIds.includes(extraId)
        ? setup.extraIds.filter((id) => id !== extraId)
        : [...setup.extraIds, extraId];
    });
  },

  buyRung: (rungId) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const truck = haulageById(world.haulageId) ?? HAULAGE[0]!;
      const status = ladderStatus(world.productionRungs, truck, world.promotion.bankBalance);
      const here = status.find((r) => r.rung.id === rungId);
      // The ladder decides. Rung order, truck space and money are all checked
      // in one place (economy/production.ts) so the UI and the store can
      // never disagree about what is buyable.
      if (!here || here.blocked !== null) return;

      world.promotion.bankBalance -= here.rung.cost;
      world.productionRungs.push(here.rung.id);
      world.weeklyNews.push(
        wire(
          'story',
          `${world.promotion.name} just pulled the trigger on a ${here.rung.name.toLowerCase()}. ${here.rung.blurb}`,
          world.week,
          'minor',
        ),
      );
    });
  },

  buyHaulage: (haulageId) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const next = nextHaulage(world.haulageId);
      // One rung at a time, and only upwards — you cannot skip from a pickup
      // to a fleet, and you cannot sell the semi back for a pickup.
      if (!next || next.id !== haulageId) return;
      if (world.promotion.bankBalance < next.cost) return;

      world.promotion.bankBalance -= next.cost;
      world.haulageId = next.id;
      world.weeklyNews.push(
        wire('story', `${world.promotion.name} are rolling on a brand-new ${next.name.toLowerCase()} now. ${next.blurb}`, world.week, 'minor'),
      );
    });
  },

  buyCardSizeTier: (tierId) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const next = nextCardSizeTier(world.cardSizeTierId);
      // One tier at a time, upwards only — same shape as buyHaulage.
      if (!next || next.id !== tierId) return;
      if (world.promotion.bankBalance < next.cost) return;

      world.promotion.bankBalance -= next.cost;
      world.cardSizeTierId = next.id;
      // Takes hold from the next card built, same as every other purchase —
      // this week's card was already dealt.
      world.weeklyNews.push(
        wire('story', `${world.promotion.name} just bought their way onto a ${next.name.toLowerCase()}. ${next.blurb}`, world.week, 'minor'),
      );
    });
  },

  buyProductionAsset: (assetId) => {
    set((state) => {
      const world = state.world;
      const asset = productionAssetById(assetId);
      if (!world || !asset) return;
      if (world.ownedAssetIds.includes(assetId)) return;
      // No warnings (§0) — but you cannot spend money you do not have.
      if (world.promotion.bankBalance < asset.cost) return;
      world.promotion.bankBalance -= asset.cost;
      world.ownedAssetIds.push(assetId);
      world.assetConditions.push(newAssetCondition(assetId));
    });
  },

  repairProductionAsset: (assetId) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const asset = productionAssetById(assetId);
      const index = world.assetConditions.findIndex((c) => c.assetId === assetId);
      if (!asset || index < 0) return;
      const cost = repairCost(world.assetConditions[index]!, asset.cost, world.settings);
      if (cost <= 0 || world.promotion.bankBalance < cost) return;
      world.promotion.bankBalance -= cost;
      world.assetConditions[index] = repairAsset(world.assetConditions[index]!);
    });
  },

  sellProductionAsset: (assetId) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      // A genuine last resort, not a normal way to raise cash — see
      // economy/fireSale.ts. Only on the table while an active loan means
      // things are already bad, same gate the buyout offer uses.
      if (!world.settings.fireSaleEnabled) return;
      if (!world.activeLoan) return;
      const asset = productionAssetById(assetId);
      if (!asset || !world.ownedAssetIds.includes(assetId)) return;
      if (!fireSaleEligible(asset)) return;

      const index = world.assetConditions.findIndex((c) => c.assetId === assetId);
      const condition = index >= 0 ? world.assetConditions[index] : undefined;
      const value = fireSaleValue(asset, condition, world.settings);

      world.promotion.bankBalance += value;
      world.ownedAssetIds = world.ownedAssetIds.filter((id) => id !== assetId);
      if (index >= 0) world.assetConditions.splice(index, 1);
      world.weeklyNews.push(
        wire('story', `${world.promotion.name} sold off the ${asset.name.toLowerCase()} just to keep the lights on — a hard call, but a necessary one.`, world.week, 'minor'),
      );
    });
  },

  // Match hardware — a ladder, a cage, a table. Countable, multi-unit,
  // consumable in a way the production ladder above is not. See
  // engine/economy/matchProps.ts and data/matchProps.ts.
  buyPropUnit: (tierId) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const tier = propTierById(tierId);
      if (!tier) return;
      const family = propFamilyById(tier.familyId);
      if (!family) return;
      // No warnings (§0) — but the family cap and the bank balance are both hard limits.
      if (ownedUnitsForFamily(world.ownedPropUnits, family.id).length >= family.maxUnitsOwned) return;
      if (world.promotion.bankBalance < tier.cost) return;
      world.promotion.bankBalance -= tier.cost;
      world.ownedPropUnits.push(newPropUnit(`prop-${world.nextId++}`, family.id, tier.id));
    });
  },

  repairPropUnit: (unitId) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const index = world.ownedPropUnits.findIndex((u) => u.id === unitId);
      if (index < 0) return;
      const unit = world.ownedPropUnits[index]!;
      const tier = propTierById(unit.tierId);
      if (!tier) return;
      const cost = propRepairCost(unit, tier, world.settings);
      if (cost <= 0 || world.promotion.bankBalance < cost) return;
      world.promotion.bankBalance -= cost;
      world.ownedPropUnits[index] = repairPropUnitCondition(unit);
    });
  },
});
