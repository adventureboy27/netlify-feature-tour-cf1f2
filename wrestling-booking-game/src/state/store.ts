// The Zustand+immer store — the only place besides world.ts allowed to
// touch React state machinery. Every actual calculation it does is a call
// out to a pure engine/ function; this file just wires inputs/outputs and
// holds the mutable World.

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { rngFromSeed, rngFromState } from '../engine/rng';
import { saveGame, loadGame } from './persist';
import type { Rng } from '../engine/rng';
import type { Id, MatchRules, Promotion, TitleReignEndMethod, WorldSettings } from '../engine/types';
import {
  createInitialWorld,
  createEmptyCard,
  pairKey,
  styleProfileFor,
  rivalRosterSize,
  type World,
  type YearInReview,
} from './world';
import { createStartingTitles, awardTitle } from '../data/titles';
import type { PromotionArchetype } from '../data/promotionIdentity';
import {
  findRivalry,
  createRivalry,
  applyHeatChange,
  decayRivalry,
  heatMultiplier,
} from '../engine/sim/rivalry';
import { computeTvRatings, buildRatingsChart } from '../engine/world/tvRatings';
import { ringsideTotals, guestRefereeIsLegal } from '../engine/sim/ringside';
import { managerById, refereeById } from '../data/ringsidePool';
import { NETWORK_SHOWS } from '../data/networkShows';
import { rollTamperingAttempts } from '../engine/world/tampering';
import { deriveCareerStatus } from '../engine/career/status';
import { rollRetirement, rollComeback, retire, unretire, RETIREMENT_REASON_TEXT } from '../engine/career/retirement';
import { rollDeath } from '../engine/career/mortality';
import { annualInductions } from '../engine/career/hallOfFame';
import { graduateClass, graduateCount, workingPopulation } from '../engine/world/academy';
import { rollForNickname } from '../engine/generate/nickname';
import { rollWeeklyEvent, recordFired } from '../engine/events/scheduler';
import { resolveOption } from '../engine/events/apply';
import { CREATIVE_EVENTS, eventById } from '../data/events';
import { applyGimmickLook, stableColorsFrom } from '../engine/generate/gimmickLook';
import { GIMMICKS } from '../data/gimmicks';
import type { EventEffect, EventSubjects } from '../engine/events/types';
import type { Wrestler } from '../engine/types';
import { clamp, pick, chance } from '../engine/rng';
import { defaultWorldSettings } from '../engine/world/settings';
import { stipulationById, stipulationRequirementsMet } from '../data/stipulations';
import { simulateMatch, type SimParticipant } from '../engine/sim/simulateMatch';
import { houseStyleRatingBonus, violenceTolerancePenalty } from '../engine/sim/houseStyle';
import { computeAftermath, applyAftermath, restWeek } from '../engine/sim/aftermath';
import { runRivalShow, bookRivalCard, canWork, type RivalShow } from '../engine/world/rivalBooking';
import { rivalWeek, shouldFold } from '../engine/world/rivalEconomy';
import { publish } from '../engine/world/publication';
import { appraise, aiBid, settleAuction, playerBidAmount, type Bid, type PlayerBidLevel } from '../engine/world/auction';
import { recordTeamResult, disbandBrokenTeams, formTeams } from '../engine/world/tagTeams';
import { resolveTitleOutcomes, matchTitlePrestige, eligibleTitles } from '../engine/sim/titleMatch';
import {
  computeShowRating,
  ratingToStars,
  targetCompanyRatingForStars,
  stepCompanyRatingTowardTarget,
  TV_SLOT_WEIGHTS,
} from '../engine/economy/showRating';
import {
  computeShowCosts,
  computeAttendanceForShow,
  computeShowRevenue,
  attendanceRatingModifier,
  sumEffect,
  computeDemand,
  updateRecentShowQuality,
  newAssetCondition,
  wearAsset,
  assetEffectiveness,
  assetHasFailed,
  repairAsset,
  repairCost,
} from '../engine/economy/showBudget';
import { venueById, fallbackVenue } from '../data/venues';
import { productionAssetById, showExtraById } from '../data/production';
import { expireContracts, weeklyWageBill, createStandardContract, askingRate, renewalRate } from '../engine/economy/contracts';
import { driftEgo, targetEgo, contractDemand, clauseUpkeep } from '../engine/career/ego';
import { canSign, currentAskingRate } from '../engine/world/freeAgents';
import { computeWeeklyExpenses, computeShowExpenseSplit } from '../engine/economy/payroll';
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

// §12.5 route 3 — "two wrestlers meeting three times in a short span".
const MEETINGS_TO_FORM_RIVALRY = 3;
// Scales a good match's rating into starting heat. Tuned so three four-star
// meetings open a feud around 30 heat — interested, a long way from a grudge.
const ORGANIC_RIVALRY_HEAT_SCALE = 0.25;

export interface GameStore {
  world: World | null;
  newGame: (settings?: WorldSettings) => void;
  /** Resume the saved game, if there is one. Returns whether it loaded. */
  continueGame: () => boolean;
  /** Write the current world to local storage. Called after every week. */
  saveNow: () => boolean;
  setSegmentParticipant: (slot: number, wrestlerId: Id, side: number) => void;
  removeSegmentParticipant: (slot: number, wrestlerId: Id) => void;
  setSegmentRules: (slot: number, rules: Partial<MatchRules>) => void;
  setSegmentStipulation: (slot: number, stipulationId: Id | null) => void;
  /**
   * Let the office book whatever is still empty on the card. Not a shortcut
   * past the game — a way to run a filler week without hand-booking six
   * matches you do not care about.
   */
  autoFillCard: () => void;
  /** Put a belt on the line, or take it off. Two or more means title for title. */
  toggleSegmentTitle: (slot: number, titleId: Id) => void;
  resolveWeek: () => void;
  /** Answer the pending creative event. */
  chooseEventOption: (optionId: string) => void;
  dismissEventOutcome: () => void;
  /** Bid on a closed company's assets, or let them go. */
  bidOnAuction: (level: PlayerBidLevel) => void;
  /** Clear the fire-sale result once it has been read. */
  dismissAuctionResult: () => void;
  /** Clear the turn-of-the-year summary once it has been read. */
  dismissYearInReview: () => void;
  // Staging the show
  setVenue: (venueId: Id) => void;
  setTicketPrice: (price: number) => void;
  toggleShowExtra: (extraId: Id) => void;
  buyProductionAsset: (assetId: Id) => void;
  // Ringside
  setSegmentManager: (slot: number, managerId: Id | null, forSide: number) => void;
  setSegmentReferee: (slot: number, refereeId: Id | null) => void;
  setSegmentGuestReferee: (slot: number, wrestlerId: Id | null) => void;
  /** Name the company and pick its house style. Locked once you run a show. */
  setPromotionIdentity: (name: string, archetype: PromotionArchetype) => void;
  // Roster moves
  signFreeAgent: (wrestlerId: Id) => void;
  releaseWrestler: (wrestlerId: Id) => void;
  /** Send somebody out on their terms. They go to the Legacy wall, not the pool. */
  retireWrestler: (wrestlerId: Id) => void;
  /** Pay to put a worn rig back to new. */
  repairProductionAsset: (assetId: Id) => void;
  /** Meet a renewal demand in full, or refuse it and risk them walking. */
  answerRenewal: (wrestlerId: Id, accept: boolean) => void;
}

/**
 * Move a championship, and write the lineage on both sides of it: the old
 * champion's reign closes, the new one's opens. Shared by the player's show
 * and by every rival's, so a belt changing hands means the same thing
 * wherever it happens.
 */
function commitTitleChange(world: World, titleIndex: number, newHolderIds: Id[]): void {
  const title = world.titles[titleIndex];
  if (!title) return;

  const previousHolders = [...title.currentHolderIds];
  world.titles[titleIndex] = awardTitle(title, newHolderIds, world.week);

  for (const id of previousHolders) {
    const open = world.wrestlers[id]?.titleReigns.find((r) => r.titleId === title.id && r.endWeek === null);
    if (open) {
      open.endWeek = world.week;
      open.endMethod = 'lostMatch';
    }
  }

  for (const id of newHolderIds) {
    const champion = world.wrestlers[id];
    if (!champion) continue;
    champion.titleReigns.push({
      titleId: title.id,
      holderIds: [...newHolderIds],
      wonFromIds: previousHolders.length > 0 ? previousHolders : null,
      wonByMethod: 'match',
      startWeek: world.week,
      endWeek: null,
      endMethod: null,
    });
    // Winning a belt is the single biggest thing that happens to somebody's
    // standing, and the crowd reacts accordingly.
    champion.momentum = clamp(champion.momentum + world.settings.titleWinMomentum, 0, 100);
    champion.popularity = clamp(champion.popularity + world.settings.titleWinPopularity, 0, 100);
  }
}


/**
 * Close a company down and put everything it owned on the block. The lot is
 * one package — contracts, belts and whatever was in the account — because a
 * dead promotion being swallowed whole is an event, and its roster being
 * quietly redistributed is not.
 */
function closePromotion(world: World, promotion: Promotion): void {
  promotion.closedWeek = world.week;

  const roster = promotion.rosterIds.map((id) => world.wrestlers[id]).filter((w): w is Wrestler => Boolean(w));
  const titles = world.titles.filter((t) => t.promotionId === promotion.id);
  const cash = Math.max(0, promotion.bankBalance);

  world.pendingAuction = {
    openedWeek: world.week,
    lot: {
      fromPromotionId: promotion.id,
      fromPromotionName: promotion.name,
      wrestlerIds: roster.map((w) => w.id),
      titleIds: titles.map((t) => t.id),
      cash,
      appraisal: appraise(roster, titles, cash, world.settings),
    },
  };
}

/**
 * Settle the fire sale. The player's bid comes in as a level; everybody still
 * open bids for themselves. Whoever wins absorbs the roster and the belts —
 * lineage and all — and pays for the privilege.
 */
function resolveAuction(world: World, playerLevel: PlayerBidLevel): void {
  const pending = world.pendingAuction;
  if (!pending) return;
  const { lot } = pending;

  const incoming = lot.wrestlerIds.map((id) => world.wrestlers[id]).filter((w): w is Wrestler => Boolean(w));
  const bidders = world.rivals.filter((r) => r.closedWeek === null && r.id !== lot.fromPromotionId);

  const bids: Bid[] = bidders.map((rival) => ({
    promotionId: rival.id,
    amount: aiBid(rng, rival, lot, incoming, world.settings),
  }));

  const playerAmount = playerBidAmount(playerLevel, lot, world.settings);
  // You cannot bid money you do not have. Bidding the house is allowed;
  // bidding somebody else's is not.
  const affordable = Math.min(playerAmount, Math.max(0, world.promotion.bankBalance));
  if (affordable > 0 && !world.folded) {
    bids.push({ promotionId: world.promotion.id, amount: affordable });
  }

  const standingOf = (id: Id) =>
    id === world.promotion.id ? world.promotion.rating : (world.rivals.find((r) => r.id === id)?.rating ?? 0);
  const result = settleAuction(bids, lot, world.settings, standingOf);

  const winner =
    result.winnerId === world.promotion.id
      ? world.promotion
      : world.rivals.find((r) => r.id === result.winnerId);

  if (winner) {
    winner.bankBalance -= result.winningBid;
    // The cash in the dead company's account comes with the lot.
    winner.bankBalance += lot.cash;

    for (const w of incoming) {
      w.promotionId = winner.id;
      // Deals carry over as they were — the new owner inherits the contract,
      // including whatever it costs them.
      if (!w.contract) w.contract = createStandardContract(w, world.settings, world.settings.startingYear);
      winner.rosterIds.push(w.id);
    }

    for (const title of world.titles) {
      if (!lot.titleIds.includes(title.id)) continue;
      // The belt keeps its name and every reign in its history. It is being
      // defended somewhere else now, that is all.
      title.promotionId = winner.id;
      winner.titleIds.push(title.id);
    }
  } else {
    // Nobody met the reserve. The contracts lapse and everyone is loose.
    for (const w of incoming) {
      w.promotionId = null;
      w.contract = null;
      world.freeAgents.push({
        wrestlerId: w.id,
        reason: 'released',
        askingRate: askingRate(w, world.settings),
        weeksUnsigned: 0,
      });
    }
  }

  const dead = world.rivals.find((r) => r.id === lot.fromPromotionId);
  if (dead) {
    dead.rosterIds = [];
    dead.titleIds = [];
    dead.bankBalance = 0;
  }

  world.lastAuction = {
    lot,
    result,
    wonByName: winner?.name ?? 'Nobody',
  };
  world.pendingAuction = null;
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
  immer((set, get) => ({
    world: null,

    newGame: (settings = defaultWorldSettings()) => {
      rng = rngFromSeed(settings.seed);
      const world = createInitialWorld(rng, settings);
      set((state) => {
        state.world = world;
      });
      saveGame(world, rng.state?.() ?? 0);
    },

    continueGame: () => {
      const file = loadGame();
      if (!file) return false;
      // Pick the RNG stream back up where the save left it, so reloading a
      // game does not replay the same week's luck.
      rng = rngFromState(file.rngState);
      set((state) => {
        state.world = file.world;
      });
      return true;
    },

    saveNow: () => {
      const world = get().world;
      return world ? saveGame(world, rng.state?.() ?? 0) : false;
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

    autoFillCard: () => {
      set((state) => {
        const world = state.world;
        if (!world || world.folded) return;

        const alreadyBooked = new Set(world.currentCard.flatMap((s) => s.participants.map((p) => p.wrestlerId)));
        const available = world.promotion.rosterIds
          .map((id) => world.wrestlers[id])
          .filter((w): w is Wrestler => Boolean(w) && !alreadyBooked.has(w!.id) && canWork(w!, world.settings));

        const emptySlots = world.currentCard
          .map((segment, index) => ({ segment, index }))
          .filter(({ segment }) => new Set(segment.participants.map((p) => p.side)).size < 2);
        if (emptySlots.length === 0 || available.length < 2) return;

        // Same AI that books the rival cards, pointed at your roster — so the
        // office's idea of a card is exactly as good as the competition's.
        const card = bookRivalCard(rng, {
          promotion: world.promotion,
          available,
          titles: world.titles,
          stables: world.stables,
          week: world.week,
          settings: { ...world.settings, segmentsPerTV: emptySlots.length },
        });

        card.matches.forEach((match, i) => {
          const target = emptySlots[i];
          if (!target) return;
          const segment = world.currentCard[target.index]!;
          segment.participants = match.sides.flatMap((members, side) =>
            members.map((w) => ({ wrestlerId: w.id, side, role: 'competitor' as const })),
          );
          segment.titleIds = match.titleIds ?? [];
        });
      });
    },

    toggleSegmentTitle: (slot, titleId) => {
      set((state) => {
        const segment = state.world?.currentCard[slot];
        if (!segment) return;
        const index = segment.titleIds.indexOf(titleId);
        if (index >= 0) segment.titleIds.splice(index, 1);
        else segment.titleIds.push(titleId);
      });
    },

    resolveWeek: () => {
      set((state) => {
        const world = state.world;
        if (!world || world.folded) return;

        // An auction you never answered goes ahead without you. The business
        // does not wait for a booker to make up their mind.
        if (world.pendingAuction) resolveAuction(world, 'pass');
        const wrestlerById = new Map(Object.values(world.wrestlers).map((w) => [w.id, w]));

        const segmentRatings: (number | null)[] = [];
        // Who actually wrestled tonight — everybody else gets the week off.
        const worked = new Set<Id>();
        const segmentPopAvgs: { stars: number; avgPopularity: number }[] = [];
        const violenceLevels: number[] = [];
        let ringsideCost = 0;
        let payroll = 0; // set below from the wage bill

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

          // Belts booked into this match. A champion whose title is not here
          // is working a non-title match and cannot lose it tonight.
          // Re-checked at bell time rather than trusted from the card: the
          // champion may have been pulled off the match after the belt was
          // added to it, and a belt nobody in the match holds is not on the line.
          const titlesOnTheLine = eligibleTitles(
            segment.titleIds
              .map((id) => world.titles.find((t) => t.id === id))
              .filter((t): t is NonNullable<typeof t> => Boolean(t)),
            {
              participants: segment.participants.map((p) => ({
                wrestler: wrestlerById.get(p.wrestlerId)!,
                side: p.side,
              })),
              promotionId: world.promotion.id,
            },
          );

          // Everyone at ringside who is not wrestling (§10). A guest referee
          // replaces the assigned official rather than joining them.
          const guestReferee = segment.guestRefereeId ? wrestlerById.get(segment.guestRefereeId) : undefined;
          const ringside = ringsideTotals({
            managers: (segment.managerIds ?? [])
              .map((m) => ({ manager: managerById(m.managerId), client: participantWrestlers[m.forSide] }))
              .filter((m): m is { manager: NonNullable<typeof m.manager>; client: Wrestler } =>
                Boolean(m.manager && m.client),
              ),
            referee: segment.refereeId ? (refereeById(segment.refereeId) ?? null) : null,
            guestReferee: guestReferee && guestRefereeIsLegal(guestReferee.id, participantIds) ? guestReferee : null,
            settings: world.settings,
          });
          ringsideCost += ringside.cost;

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
            titlePrestige: matchTitlePrestige(titlesOnTheLine, world.settings),
            // What the company is known for. A card full of people who suit
            // the house rates a little higher here than it would anywhere
            // else, and a card full of people who don't rates a little lower.
            houseStyleFit: houseStyleRatingBonus(participantWrestlers, world.promotion.identity, world.settings),
            rivalry,
            ringside,
          });

          // A stretcher job actually puts somebody out — that is what makes
          // the finish worth fearing rather than just worth fewer points.
          if (result.finish === 'injuryStoppage') {
            const hurt = participantWrestlers.find((p) => !result.winnerWrestlerIds.includes(p.id));
            if (hurt && !hurt.injury) {
              const weeks = Math.max(1, Math.round(2 + rng.next() * 8 * result.injuryMultiplier));
              hurt.health = clamp(hurt.health - 30, 0, 100);
              hurt.injury = {
                severity: weeks >= 10 ? 'severe' : weeks >= 5 ? 'moderate' : 'minor',
                description: 'Hurt in the ring',
                sufferedWeek: world.week,
                totalWeeks: weeks,
                weeksRemaining: weeks,
                permanentStatLoss: {},
                earlyReturnWeeksUsed: 0,
              };
            }
          }

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

          // Belts move here, and only here.
          let titleChanged = false;
          const outcomes = resolveTitleOutcomes({
            titles: titlesOnTheLine,
            winnerIds: result.winnerWrestlerIds,
            finish: result.finish,
            stipulation,
            matchRating: result.rating,
            settings: world.settings,
          });

          for (const outcome of outcomes) {
            const index = world.titles.findIndex((t) => t.id === outcome.titleId);
            if (index < 0) continue;
            const title = world.titles[index]!;
            title.prestige = outcome.prestige;
            if (!outcome.changed || !outcome.newHolderIds) continue;

            titleChanged = true;
            commitTitleChange(world, index, outcome.newHolderIds);
          }

          segment.result = {
            winnerSide: result.winnerSide,
            winnerWrestlerIds: result.winnerWrestlerIds,
            finish: result.finish,
            rating: result.rating,
            stars: result.stars,
            ratingBreakdown: result.ratingBreakdown,
            beats: result.beats,
            titleChanged,
            injuries: [],
          };

          // What the match did to the people in it: records, momentum, the
          // popularity a good match is worth, and the physical cost.
          const changes = computeAftermath({
            participants: participantWrestlers,
            winnerIds: result.winnerWrestlerIds,
            finish: result.finish,
            rating: result.rating,
            stipulation,
            isMainEvent: i === world.currentCard.length - 1,
            settings: world.settings,
          });
          for (const change of changes) {
            const w = world.wrestlers[change.wrestlerId];
            if (w) applyAftermath(w, change, world.settings);
            worked.add(change.wrestlerId);
          }

          // If both sides were intact teams, the result goes on their records.
          const sideTeams = [0, 1].map((side) => {
            const members = segment.participants.filter((p) => p.side === side).map((p) => p.wrestlerId);
            if (members.length !== 2) return undefined;
            return world.stables.find(
              (t) =>
                t.kind === 'tagTeam' &&
                t.disbandedWeek === null &&
                t.memberIds.length === 2 &&
                members.every((id) => t.memberIds.includes(id)),
            );
          });
          if (sideTeams[0] && sideTeams[1]) {
            const winningSide = result.winnerSide;
            sideTeams.forEach((team, side) => {
              if (!team) return;
              recordTeamResult(team, winningSide === null ? 'draw' : winningSide === side ? 'win' : 'loss');
            });
          }

          segmentRatings.push(result.rating);
          const avgPop = participantWrestlers.reduce((sum, w) => sum + w.popularity, 0) / participantWrestlers.length;
          segmentPopAvgs.push({ stars: result.stars, avgPopularity: avgPop });


        });

        const slotWeights = TV_SLOT_WEIGHTS.slice(0, world.currentCard.length);
        const inRingRating = computeShowRating(segmentRatings, slotWeights);

        // ---- staging the show -------------------------------------------
        const venue = venueById(world.showSetup.venueId) ?? fallbackVenue();
        const ownedAssets = world.ownedAssetIds
          .map((id) => productionAssetById(id))
          .filter((a): a is NonNullable<typeof a> => Boolean(a))
          // A rig you cannot hang in this building does nothing tonight.
          .filter((a) => !a.minVenueCapacity || venue.capacity >= a.minVenueCapacity)
          // Worn gear delivers less; failed gear is scenery.
          .map((asset) => {
            const state = world.assetConditions.find((c) => c.assetId === asset.id);
            const effectiveness = state ? assetEffectiveness(state, world.settings) : 1;
            if (effectiveness >= 1) return asset;
            const scaled = { ...asset, effects: { ...asset.effects } };
            for (const key of Object.keys(scaled.effects) as (keyof typeof scaled.effects)[]) {
              const value = scaled.effects[key];
              if (value === undefined) continue;
              // Multiplier-shaped effects decay toward 1, additive toward 0.
              scaled.effects[key] = key.endsWith('Multiplier') ? 1 + (value - 1) * effectiveness : value * effectiveness;
            }
            return scaled;
          })
          .filter((asset) => {
            const state = world.assetConditions.find((c) => c.assetId === asset.id);
            return !state || !assetHasFailed(state, world.settings);
          });
        const extras = world.showSetup.extraIds
          .map((id) => showExtraById(id))
          .filter((e): e is NonNullable<typeof e> => Boolean(e))
          .filter((e) => !e.requiresAsset || world.ownedAssetIds.includes(e.requiresAsset));

        const production = [...ownedAssets, ...extras];
        const ticketPrice = world.showSetup.ticketPrice;

        // Demand is what the promotion has earned: its standing, plus how
        // good the card the player actually built is.
        const cardStrength = segmentPopAvgs.length
          ? segmentPopAvgs.reduce((sum, s) => sum + s.avgPopularity, 0) / segmentPopAvgs.length
          : 0;
        // What you have been putting on drives this, not what you are called.
        const demand = computeDemand(
          world.promotion.rating,
          world.promotion.recentShowQuality,
          cardStrength,
          world.settings,
        );

        const attendance = computeAttendanceForShow({
          venue,
          ticketPrice,
          demand,
          attendanceMultiplier: sumEffect(production, 'attendanceMultiplier', 'multiply'),
          settings: world.settings,
        });

        const revenue = computeShowRevenue({
          attendance,
          ticketPrice,
          merchMultiplier: sumEffect(production, 'merchMultiplier', 'multiply'),
          revenuePerHead: sumEffect(production, 'revenuePerHead'),
          averagePopularity: cardStrength,
          settings: world.settings,
        });

        const showCosts = computeShowCosts({
          venue,
          ownedAssets,
          extras,
          rosterSize: world.promotion.rosterIds.length,
          settings: world.settings,
        });

        const gate = revenue.gate;

        const weeklyExpenses = computeWeeklyExpenses(
          world.promotion.bankBalance,
          world.settings.weeklyExpenseRate,
          world.promotion.ownedTerritoryIds.length,
        );
        // A guaranteed weekly deal is paid every week, booked or not — that
        // is what "two years, flat rate" means. §14's 50% expense cap applies
        // to *show* expenses, not to wages: capping the wage bill made the
        // bank rise every week no matter what, because the overflow was
        // silently discarded.
        payroll = weeklyWageBill(world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean));
        const { payable: showPayable } = computeShowExpenseSplit(
          showCosts.total,
          revenue.total,
          world.settings.expenseCapPctOfRevenue,
        );
        // Clauses you agreed to have a weekly price of their own.
        const clauseBill = world.promotion.rosterIds.reduce((sum, id) => {
          const member = world.wrestlers[id];
          return member ? sum + clauseUpkeep(member, world.settings) : sum;
        }, 0);
        const totalOut = payroll + weeklyExpenses + showPayable + ringsideCost + clauseBill;

        world.promotion.bankBalance += revenue.total - totalOut;

        // Staging feeds back into how the show itself was received: the
        // production, and whether the building looked full on camera.
        const productionRating =
          sumEffect(production, 'showRating') +
          (venue.prestige / 100) * world.settings.venuePrestigeRatingWeight +
          attendanceRatingModifier(attendance, venue.capacity, world.settings) +
          // Run past what this room will take and they do not come back for
          // it — the deathmatch crowd's ceiling is not the old-school one's.
          violenceTolerancePenalty(violenceLevels, world.promotion.identity, world.settings);
        for (const effect of production) {
          if (effect.effects.rosterMorale) {
            for (const id of world.promotion.rosterIds) {
              const member = world.wrestlers[id];
              if (member) member.morale = clamp(member.morale + effect.effects.rosterMorale, 0, 100);
            }
          }
          if (effect.effects.reputation) {
            world.promotion.reputation = clamp(world.promotion.reputation + effect.effects.reputation, 0, 100);
          }
        }

        // What happened in the ring, plus how the night was staged. Staging
        // modifies a show; it cannot manufacture one, so a card with nothing
        // booked rates zero no matter how good the building looked.
        const showRating = segmentPopAvgs.length === 0 ? 0 : clamp(inRingRating + productionRating, 0, 100);
        const showStars = ratingToStars(showRating);

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

        // Tonight goes into the running average, which is what decides how
        // many people turn up next week. A night of draws and count-outs
        // empties the building a fortnight from now.
        world.promotion.recentShowQuality = updateRecentShowQuality(
          world.promotion.recentShowQuality,
          showRating,
          world.settings,
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
          payroll,
          venueId: venue.id,
          venueCapacity: venue.capacity,
          merch: revenue.merch,
          otherRevenue: revenue.other,
          showCosts: showCosts.total,
          showRating,
          showStars,
          broadcast: true,
        });

        // ---- the rest of the business runs its week --------------------
        // Every rival books and runs its own card through the same simulation,
        // so their belts move, their people get made, and the show quality
        // opposite you is something that actually happened.
        const rivalShows = new Map<Id, RivalShow>();
        for (const rival of world.rivals) {
          if (rival.closedWeek !== null) continue;
          const available = rival.rosterIds
            .map((id) => world.wrestlers[id])
            .filter((w): w is Wrestler => Boolean(w) && canWork(w!, world.settings));

          const show = runRivalShow(rng, {
            promotion: rival,
            available,
            titles: world.titles,
            stables: world.stables,
            week: world.week,
            settings: world.settings,
          });
          if (!show) continue;
          rivalShows.set(rival.id, show);

          for (const match of show.matches) {
            for (const change of match.aftermath) {
              const w = world.wrestlers[change.wrestlerId];
              if (w) applyAftermath(w, change, world.settings);
              worked.add(change.wrestlerId);
            }
            // A tag match is on the teams' records, not only the wrestlers'.
            if (match.teamIds) {
              match.teamIds.forEach((teamId, side) => {
                const team = world.stables.find((t) => t.id === teamId);
                if (!team) return;
                recordTeamResult(
                  team,
                  match.winnerSide === null ? 'draw' : match.winnerSide === side ? 'win' : 'loss',
                );
              });
            }
            for (const outcome of match.titleOutcomes) {
              const index = world.titles.findIndex((t) => t.id === outcome.titleId);
              if (index < 0) continue;
              world.titles[index]!.prestige = outcome.prestige;
              if (!outcome.changed || !outcome.newHolderIds) continue;
              commitTitleChange(world, index, outcome.newHolderIds);
            }
          }

          // Their standing moves on their own results, on the same ladder the
          // player climbs — nobody is handed a rating here.
          rival.recentShowQuality = updateRecentShowQuality(
            rival.recentShowQuality,
            show.showRating,
            world.settings,
          );
          rival.rating = stepCompanyRatingTowardTarget(
            rival.rating,
            targetCompanyRatingForStars(show.showStars),
            world.settings.ratingLadderStepPerWeek,
            false,
          );
        }

        // Their books. Rivals only make money on a week they ran a show, and
        // a company too thin to run one is bleeding with nothing coming in —
        // which is exactly how a promotion dies in real life.
        for (const rival of world.rivals) {
          if (rival.closedWeek !== null) continue;
          const theirRoster = rival.rosterIds.map((id) => world.wrestlers[id]).filter((w): w is Wrestler => Boolean(w));
          const books = rivalWeek(rival, theirRoster, world.settings);
          const net = rivalShows.has(rival.id) ? books.net : -books.costs;
          rival.bankBalance = Math.round(rival.bankBalance + net);

          if (rival.bankBalance < 0) rival.weeksInTheRed += 1;
          else rival.weeksInTheRed = 0;

          const stillOpen = 1 + world.rivals.filter((r) => r.closedWeek === null).length;
          const failing = {
            weeksInTheRed: rival.weeksInTheRed,
            bankBalance: rival.bankBalance,
            companiesOpen: stillOpen,
            settings: world.settings,
          };

          if (!world.pendingAuction && shouldFold(failing)) {
            closePromotion(world, rival);
          } else if (
            rival.weeksInTheRed > world.settings.rivalBankruptcyGraceWeeks &&
            rival.bankBalance < 0
          ) {
            // They should be gone, but the business cannot spare them — or
            // another fire sale is already on the table. Somebody with money
            // steps in rather than letting the debt run to infinity.
            rival.bankBalance = world.settings.rivalBailoutCash;
            rival.weeksInTheRed = 0;
          }
        }

        // Rivals were on opposite you tonight, with the shows they actually
        // ran — so a hot rival takes audience off you even when your own show
        // was fine, and a promotion in decline stops being a threat.
        const tvResults = computeTvRatings(
          [
            { promotionId: world.promotion.id, showRating, companyRating: world.promotion.rating, broadcast: true },
            ...world.rivals.map((rival) => ({
              promotionId: rival.id,
              showRating: rivalShows.get(rival.id)?.showRating ?? 0,
              companyRating: rival.rating,
              // A promotion too thin to put on a card — or closed for good —
              // is dark this week.
              broadcast: rivalShows.has(rival.id),
            })),
          ],
          world.settings,
        );
        world.rivalShows = [...rivalShows.values()];
        world.tvHistory.unshift({ week: world.week, results: tvResults });
        world.tvHistory = world.tvHistory.slice(0, 52);

        // Where wrestling landed against the rest of television this week.
        const chartRows = buildRatingsChart({
          wrestling: tvResults,
          playerPromotionId: world.promotion.id,
          promotionName: (id) =>
            id === world.promotion.id
              ? world.promotion.name
              : (world.rivals.find((r) => r.id === id)?.name ?? id),
          networkShows: NETWORK_SHOWS,
          next: () => rng.next(),
        });
        world.ratingsChart.unshift({ week: world.week, rows: chartRows });
        world.ratingsChart = world.ratingsChart.slice(0, 52);

        world.week += 1;

        // Feuds nobody advanced this week go cold; the bad blood behind them
        // barely moves (§12.5).
        world.rivalries = world.rivalries.map((r) => decayRivalry(r, world.week, world.settings));

        // A show's worth of wear on everything that was hauled out tonight.
        world.assetConditions = world.assetConditions.map((state) => wearAsset(state, world.settings));

        // Injuries count down whether or not you booked around them.
        for (const id of world.promotion.rosterIds) {
          const member = world.wrestlers[id];
          if (!member?.injury) continue;
          member.injury.weeksRemaining -= 1;
          if (member.injury.weeksRemaining <= 0) member.injury = null;
        }

        // Deals run down whether or not anybody was booked.
        const expired = expireContracts(world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean));
        if (world.signingBanWeeks > 0) world.signingBanWeeks -= 1;

        // Recovery and momentum decay, for everybody in the business — the
        // world does not hold still for the people you did not book.
        for (const w of Object.values(world.wrestlers)) {
          if (w.deceased || w.careerStatus === 'retired') continue;
          restWeek(w, worked.has(w.id), world.settings);
        }

        // Career standing is derived, so it moves on its own as a save runs.
        const roster = world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean);
        const rosterPeak = roster.reduce((max, w) => Math.max(max, w.popularity), 0);
        const careerCtx = {
          currentYear: world.settings.startingYear + Math.floor(world.week / 52),
          rosterPeakPopularity: rosterPeak,
          settings: world.settings,
        };
        for (const w of roster) w.careerStatus = deriveCareerStatus(w, careerCtx);

        // A nickname is earned, not assigned — see engine/generate/nickname.ts.
        // Rolled across everyone in the world so a free agent can turn up
        // already carrying one.
        const takenNicknames = new Set(
          Object.values(world.wrestlers)
            .map((w) => w.nickname)
            .filter((n): n is string => Boolean(n)),
        );
        for (const w of Object.values(world.wrestlers)) {
          const earned = rollForNickname(rng, w, takenNicknames, careerCtx);
          if (earned) {
            w.nickname = earned;
            takenNicknames.add(earned);
          }
        }

        // Ego chases what they have become. Build somebody and they notice.
        const egoCtx = { rosterPeakPopularity: rosterPeak, currentWeek: world.week, settings: world.settings };
        for (const w of roster) {
          w.ego = driftEgo(w.ego, targetEgo(w, w.careerStatus, egoCtx), world.settings);
        }

        // A deal that ran down comes back as a demand, not as a departure.
        for (const id of expired) {
          const member = world.wrestlers[id];
          if (!member || world.pendingRenewals.some((r) => r.wrestlerId === id)) continue;
          world.pendingRenewals.push({
            wrestlerId: id,
            demand: contractDemand(member, renewalRate(member, world.settings), member.careerStatus, world.settings),
            openedWeek: world.week,
          });
        }

        // This week's sheet becomes last week's, so the next issue can show
        // which way everybody moved.
        world.lastPublication = publish({
          currentWeek: world.week,
          titles: world.titles,
          wrestlers: Object.values(world.wrestlers),
          stables: world.stables,
          settings: world.settings,
        });

        // ---- the turn of the year ---------------------------------------
        // Everything that happens on a scale of years happens here, once:
        // birthdays, retirements, comebacks, deaths, the schools, the hall.
        if (world.week % 52 === 0) {
          const year = careerCtx.currentYear;
          const notices: YearInReview = {
            year,
            retirements: [],
            comebacks: [],
            passings: [],
            graduates: [],
            inductions: [],
            vacatedTitleIds: [],
          };

          const leaveTheBusiness = (id: Id, method: TitleReignEndMethod) => {
            // A champion who is gone cannot carry a belt. It goes vacant, and
            // the lineage records why.
            for (const title of world.titles) {
              if (title.vacant || !title.currentHolderIds.includes(id)) continue;
              const last = title.history[title.history.length - 1];
              if (last && last.endWeek === null) {
                last.endWeek = world.week;
                last.endMethod = method;
              }
              title.vacant = true;
              title.currentHolderIds = [];
              notices.vacatedTitleIds.push(title.id);
            }
            for (const w of Object.values(world.wrestlers)) {
              const open = w.id === id ? w.titleReigns.find((r) => r.endWeek === null) : undefined;
              if (open) {
                open.endWeek = world.week;
                open.endMethod = method;
              }
            }
            world.promotion.rosterIds = world.promotion.rosterIds.filter((rosterId) => rosterId !== id);
            for (const rival of world.rivals) {
              rival.rosterIds = rival.rosterIds.filter((rosterId) => rosterId !== id);
            }
            world.freeAgents = world.freeAgents.filter((agent) => agent.wrestlerId !== id);
            world.pendingRenewals = world.pendingRenewals.filter((r) => r.wrestlerId !== id);
          };

          for (const w of Object.values(world.wrestlers)) {
            if (w.deceased || w.role !== 'wrestler') continue;
            w.age += 1;

            const passing = rollDeath(rng, w, world.week, world.settings);
            if (passing) {
              w.deceased = passing;
              world.memoriam.push(passing);
              notices.passings.push(passing);
              leaveTheBusiness(w.id, 'died');
              continue;
            }

            if (w.careerStatus === 'retired') {
              const back = rollComeback(rng, w, {
                currentYear: year,
                rivalries: world.rivalries,
                settings: world.settings,
              });
              if (back.returning) {
                unretire(w, world.settings);
                notices.comebacks.push({
                  wrestlerId: w.id,
                  overId: back.over?.participantIds.find((id) => id !== w.id) ?? null,
                });
                // They come back unsigned. Somebody has to want them.
                world.freeAgents.push({
                  wrestlerId: w.id,
                  reason: 'returning',
                  askingRate: askingRate(w, world.settings),
                  weeksUnsigned: 0,
                });
              }
              continue;
            }

            const call = rollRetirement(rng, w, careerCtx);
            if (call.retiring) {
              retire(w);
              notices.retirements.push({ wrestlerId: w.id, reason: RETIREMENT_REASON_TEXT[call.reason] });
              leaveTheBusiness(w.id, 'retired');
            }
          }

          // The hall considers everybody who is finished, not just your people.
          const hofCtx = { currentWeek: world.week, currentYear: year, settings: world.settings };
          for (const entry of annualInductions(Object.values(world.wrestlers), hofCtx)) {
            const inductee = world.wrestlers[entry.wrestlerId];
            if (!inductee) continue;
            inductee.hallOfFameWeek = world.week;
            if (!inductee.deceased) inductee.careerStatus = 'hallOfFamer';
            world.hallOfFame.push(entry);
            notices.inductions.push(entry);
          }

          // And the schools make up some of the difference.
          const everyone = Object.values(world.wrestlers);
          const intake = graduateClass(
            rng,
            graduateCount(rng, workingPopulation(everyone), world.settings),
            year,
            world.settings,
            everyone.map((w) => w.appearance),
          );
          for (const graduate of intake.wrestlers) world.wrestlers[graduate.id] = graduate;
          world.freeAgents.push(...intake.freeAgents);
          notices.graduates = intake.wrestlers.map((w) => w.id);

          // A partnership does not survive one of them retiring, dying, or
          // signing somewhere else.
          disbandBrokenTeams(world.stables, world.week, (memberIds) => {
            const people = memberIds.map((id) => world.wrestlers[id]);
            if (people.some((w) => !w || w.deceased || w.careerStatus === 'retired')) return false;
            const first = people[0]!.promotionId;
            return first !== null && people.every((w) => w!.promotionId === first);
          });

          // New teams to replace the ones that broke up. A tag division that
          // only ever loses teams is a tag division that ends up empty.
          const takenNames = new Set(world.stables.map((t) => t.name));
          for (const company of [world.promotion, ...world.rivals]) {
            if (company.closedWeek !== null) continue;
            const intact = world.stables.filter(
              (t) =>
                t.kind === 'tagTeam' &&
                t.disbandedWeek === null &&
                t.memberIds.every((id) => company.rosterIds.includes(id)),
            ).length;
            const wanted = world.settings.tagTeamsPerPromotion - intact;
            if (wanted <= 0) continue;

            const spokenFor = new Set(
              world.stables.filter((t) => t.disbandedWeek === null).flatMap((t) => t.memberIds),
            );
            const free = company.rosterIds
              .map((id) => world.wrestlers[id])
              .filter((w): w is Wrestler => Boolean(w) && !spokenFor.has(w!.id) && !w!.deceased);

            const formed = formTeams(
              rng,
              free,
              company.id,
              { taken: takenNames, week: world.week, count: wanted },
              () => `${company.id}-team-${world.nextId++}`,
            );
            for (const team of formed) takenNames.add(team.name);
            world.stables.push(...formed);
          }

          // Rivals replace the people they lost. They shop in the same pool
          // the player does, so a promotion that leaves talent sitting there
          // will watch somebody else sign it.
          for (const rival of world.rivals) {
            if (rival.closedWeek !== null) continue;
            const target = rivalRosterSize(rival.rating, world.settings);
            let short = target - rival.rosterIds.length;
            while (short > 0 && world.freeAgents.length > 0) {
              const index = Math.floor(rng.next() * world.freeAgents.length);
              const agent = world.freeAgents[index]!;
              const signing = world.wrestlers[agent.wrestlerId];
              world.freeAgents.splice(index, 1);
              if (!signing || signing.deceased || signing.careerStatus === 'retired') continue;
              signing.promotionId = rival.id;
              signing.contract = createStandardContract(signing, world.settings, year);
              rival.rosterIds.push(signing.id);
              short -= 1;
            }
          }

          world.yearInReview = notices;
        }

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

        // ---- can you still pay for this? -------------------------------
        // The grace period is real: one bad month is survivable, a run of
        // them is not. Nothing is hidden — the office screen counts it down.
        if (world.promotion.bankBalance < 0) {
          world.weeksInTheRed += 1;
          if (world.weeksInTheRed > world.settings.bankruptcyGraceWeeks) {
            world.folded = {
              week: world.week,
              reason: 'The money ran out. Creditors closed the promotion.',
            };
            // Everyone still under contract is loose in the business.
            for (const id of world.promotion.rosterIds) {
              const w = world.wrestlers[id];
              if (!w) continue;
              w.promotionId = null;
              w.contract = null;
              world.freeAgents.push({
                wrestlerId: id,
                reason: 'released',
                askingRate: askingRate(w, world.settings),
                weeksUnsigned: 0,
              });
            }
            world.promotion.rosterIds = [];
          }
        } else {
          world.weeksInTheRed = 0;
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

    // DESIGN: what kind of company you are is the first real decision, and it
    // renames your belts — so it is open until the first show goes out and
    // shut for good afterwards. A promotion that changes what it stands for
    // every week does not stand for anything.
    retireWrestler: (wrestlerId) => {
      set((state) => {
        const world = state.world;
        const w = world?.wrestlers[wrestlerId];
        if (!world || !w || w.careerStatus === 'retired') return;

        // Belts do not retire with their holder.
        for (const title of world.titles) {
          if (title.vacant || !title.currentHolderIds.includes(wrestlerId)) continue;
          const last = title.history[title.history.length - 1];
          if (last && last.endWeek === null) {
            last.endWeek = world.week;
            last.endMethod = 'retired';
          }
          title.vacant = true;
          title.currentHolderIds = [];
        }
        const open = w.titleReigns.find((r) => r.endWeek === null);
        if (open) {
          open.endWeek = world.week;
          open.endMethod = 'retired';
        }

        retire(w);
        world.promotion.rosterIds = world.promotion.rosterIds.filter((id) => id !== wrestlerId);
        world.freeAgents = world.freeAgents.filter((agent) => agent.wrestlerId !== wrestlerId);
        world.pendingRenewals = world.pendingRenewals.filter((r) => r.wrestlerId !== wrestlerId);
      });
    },

    setPromotionIdentity: (name, archetype) => {
      set((state) => {
        const world = state.world;
        if (!world || world.showHistory.length > 0) return;

        world.promotion.name = name.trim() || world.promotion.name;
        world.promotion.identity = archetype;
        world.promotion.styleProfile = styleProfileFor(archetype);

        // Rename in place rather than rebuilding: the opening champions were
        // crowned at week one and a rename must not vacate their belts.
        const renamed = createStartingTitles(world.promotion.id, world.promotion.name, archetype);
        const own = world.titles.filter((t) => t.promotionId === world.promotion.id);
        own.forEach((title, i) => {
          const fresh = renamed[i];
          if (!fresh) return;
          title.name = fresh.name;
          title.blurb = fresh.blurb;
          title.tier = fresh.tier;
          title.prestige = fresh.prestige;
          title.colorway = fresh.colorway;
          title.signatureStipulationId = fresh.signatureStipulationId;
        });
      });
    },

    bidOnAuction: (level) => {
      set((state) => {
        if (state.world?.pendingAuction) resolveAuction(state.world, level);
      });
    },

    dismissAuctionResult: () => {
      set((state) => {
        if (state.world) state.world.lastAuction = null;
      });
    },

    dismissYearInReview: () => {
      set((state) => {
        if (state.world) state.world.yearInReview = null;
      });
    },

    setVenue: (venueId) => {
      set((state) => {
        if (state.world) state.world.showSetup.venueId = venueId;
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

    setSegmentManager: (slot, managerId, forSide) => {
      set((state) => {
        const segment = state.world?.currentCard[slot];
        if (!segment) return;
        const others = (segment.managerIds ?? []).filter((m) => m.forSide !== forSide);
        segment.managerIds = managerId ? [...others, { managerId, forSide }] : others;
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

    signFreeAgent: (wrestlerId) => {
      set((state) => {
        const world = state.world;
        if (!world) return;
        const wrestler = world.wrestlers[wrestlerId];
        const agent = world.freeAgents.find((a) => a.wrestlerId === wrestlerId);
        if (!wrestler || !agent) return;
        if (!canSign(wrestler, world.promotion.bankBalance, world.signingBanWeeks, world.settings)) return;

        wrestler.promotionId = world.promotion.id;
        wrestler.contract = {
          ...createStandardContract(wrestler, world.settings, world.settings.startingYear),
          weeklyRate: currentAskingRate(agent, world.settings),
        };
        world.promotion.rosterIds.push(wrestlerId);
        world.freeAgents = world.freeAgents.filter((a) => a.wrestlerId !== wrestlerId);
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

    answerRenewal: (wrestlerId, accept) => {
      set((state) => {
        const world = state.world;
        if (!world) return;
        const index = world.pendingRenewals.findIndex((r) => r.wrestlerId === wrestlerId);
        const offer = world.pendingRenewals[index];
        const member = world.wrestlers[wrestlerId];
        if (index < 0 || !offer || !member) return;

        world.pendingRenewals.splice(index, 1);

        if (accept) {
          // You paid what they asked, clauses and all. The clauses are the
          // part that will hurt later.
          member.contract = {
            ...createStandardContract(member, world.settings, world.settings.startingYear),
            weeklyRate: offer.demand.weeklyRate,
            clauses: [...offer.demand.clauses],
          };
          member.morale = clamp(member.morale + 10, 0, 100);
          return;
        }

        // Refused. They might take a plain deal anyway, or they might go.
        member.morale = clamp(member.morale - 15, 0, 100);
        if (chance(rng, offer.demand.walkRisk)) {
          world.promotion.rosterIds = world.promotion.rosterIds.filter((id) => id !== wrestlerId);
          member.promotionId = null;
          member.contract = null;
          world.freeAgents.push({
            wrestlerId,
            reason: 'contractExpired',
            askingRate: offer.demand.weeklyRate,
            weeksUnsigned: 0,
          });
        } else {
          member.contract = createStandardContract(member, world.settings, world.settings.startingYear);
        }
      });
    },

    releaseWrestler: (wrestlerId) => {
      set((state) => {
        const world = state.world;
        if (!world) return;
        const wrestler = world.wrestlers[wrestlerId];
        if (!wrestler) return;
        wrestler.promotionId = null;
        wrestler.contract = null;
        world.promotion.rosterIds = world.promotion.rosterIds.filter((id) => id !== wrestlerId);
        // They do not vanish — they go back into the pool, where a rival can
        // pick them up and you can watch them do it.
        world.freeAgents.push({
          wrestlerId,
          reason: 'released',
          askingRate: askingRate(wrestler, world.settings),
          weeksUnsigned: 0,
        });
      });
    },
  })),
);
