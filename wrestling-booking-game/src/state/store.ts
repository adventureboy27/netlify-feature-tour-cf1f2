// The Zustand+immer store — the only place besides world.ts allowed to
// touch React state machinery. Every actual calculation it does is a call
// out to a pure engine/ function; this file just wires inputs/outputs and
// holds the mutable World.

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { rngFromSeed, rngFromState } from '../engine/rng';
import { saveGame, loadGame, exportSave, importSave } from './persist';
import {
  exportRoster,
  parseRoster,
  applyRosterEntry,
  serializeRoster,
} from '../engine/world/roster-io';
import { generateWrestlers } from '../engine/generate/wrestler';
import type { Rng } from '../engine/rng';
import type {
  Appearance,
  FinishType,
  Id,
  MatchRules,
  Promotion,
  Segment,
  SegmentResult,
  RefereeMissRecord,
  Title,
  TitleBlueprint,
  TitleReignEndMethod,
  WorldSettings,
} from '../engine/types';
import {
  createInitialWorld,
  createEmptyCard,
  createEmptyPromoSlots,
  pairKey,
  styleProfileFor,
  rivalRosterSize,
  type World,
  type YearInReview,
} from './world';
import { createStartingTitles, awardTitle, isActiveTitle } from '../data/titles';
import type { PromotionArchetype } from '../data/promotionIdentity';
import {
  findRivalry,
  createRivalry,
  applyHeatChange,
  decayRivalry,
  heatMultiplier,
} from '../engine/sim/rivalry';
import { computeTvRatings, buildRatingsChart } from '../engine/world/tvRatings';
import {
  ringsideTotals,
  guestRefereeIsLegal,
  refereeAgenda,
  guestRefereeHealthCost,
} from '../engine/sim/ringside';
import { managerById as hiredManagerById } from '../data/ringsidePool';
import { refereeMissById } from '../data/refereeMisses';
import {
  canChangeRole,
  refereeFromWrestler,
  managerFromWrestler,
  learnOnTheJob,
  type TransitionRole,
} from '../engine/career/transition';
import type { Manager } from '../engine/sim/ringside';
import { evaluateTrade, tradeLine } from '../engine/world/trades';
import { decayPaceSaturation } from '../engine/sim/pacing';
import { resolveConfrontation } from '../engine/sim/confrontation';
import { factionEgoDrift, factionHeat, factionStanding } from '../engine/world/faction';
import { demandsDelivered, deliveryBonus, fanDemands } from '../engine/world/fanDemand';
import { deliveredTo, moraleContext, weeklyMorale } from '../engine/career/morale';
import { callTheMatch } from '../engine/sim/commentary';
import { isAlly, isEnemy } from '../engine/career/relationships';
import {
  canSignSecretly,
  canWalkOut,
  isFree,
  revealImpact,
  rollExposure,
  rollRetention,
  secretSigningAppeal,
  secretWeeklyCost,
  stillSecret,
  weeksUntilFree,
} from '../engine/world/secretSigning';
import { confrontationById } from '../data/confrontations';
import {
  injuryFromMisfortune,
  pickReplacement,
  rollMisfortune,
  type Misfortune,
  type Replacement,
} from '../engine/world/misfortune';
import {
  ageGimmick,
  memoryFromRoster,
  overexposurePenalty,
  recallBookings,
  staleGimmickPenalty,
} from '../engine/sim/freshness';
import {
  wire,
  teamSplitLine,
  teamFormedLine,
  rivalSigningLine,
  deathLine,
  retirementLine,
  comebackLine,
  inductionLine,
  debutLine,
} from '../engine/world/wire';
import {
  exitTerms,
  guaranteedShareFor,
  wantsOut,
  canBeSigned,
  refusalCost,
} from '../engine/economy/termination';

/**
 * A manager by id, from the standing pool or from your own roster.
 *
 * One lookup so no caller has to know which kind it got. A wrestler in a suit
 * is a Manager record like any other; the only difference is that his fee is
 * zero, because he is already on the payroll.
 */
function findManager(world: World, id: Id): Manager | undefined {
  return hiredManagerById(id) ?? world.staffManagers.find((m) => m.id === id);
}
import {
  officialFor,
  workedMatch,
  rollRefereeMiss,
  nameTheVictim,
  applyNightToReputation,
  tickRefereeWeek,
  tickRefereePool,
  refereeWageBill,
  createRefereeContract,
  currentRefereeAskingRate,
  signedReferees,
  spreadOfficials,
  isAvailable as refereeIsAvailable,
} from '../engine/sim/referees';
import { NETWORK_SHOWS } from '../data/networkShows';
import { rollTamperingAttempts } from '../engine/world/tampering';
import { deriveCareerStatus } from '../engine/career/status';
import { rollRetirement, rollComeback, retire, unretire, RETIREMENT_REASON_TEXT } from '../engine/career/retirement';
import { rollDeath, DEATH_CAUSE_TEXT } from '../engine/career/mortality';
import { annualInductions } from '../engine/career/hallOfFame';
import { decideAwards, awardEffects, emptyYearRecord, noteMatch, noteTeamResult } from '../engine/career/awards';
import { rollIncident, type Incident, type IncidentContext } from '../engine/sim/incidents';
import {
  rollCasualty,
  stoppageCasualty,
  injuryFrom,
  outFor,
  type Casualty,
} from '../engine/sim/casualties';
import { causesFor } from '../data/casualties';
import { isPPVWeek, ppvNameForWeek, segmentsForWeek, computeBuys, computeBuyRevenue } from '../engine/world/calendar';
import { resolvePromo, promoIsValid, promoShowContribution, promoEnergyCost } from '../engine/sim/promo';
import { promoTopicById, type PromoTopicId } from '../data/promoTopics';
import {
  broadcastBreaches,
  sponsorBreaches,
  broadcastOffer,
  availableSponsors,
  weeklyBroadcastIncome,
  shouldWalk,
} from '../engine/economy/broadcast';
import { broadcasterById, bestBroadcasterFor } from '../data/broadcasters';
import { sponsorById } from '../data/sponsors';
import {
  issueMandate,
  mandateMet,
  mandateExpired,
  resolveMandate,
  isFired,
} from '../engine/world/mandates';
import {
  followingOf,
  followingGain,
  followingDecay,
  territoryFit,
  readCardTraits,
  isInvasion,
  invasionDamage,
  claimsTerritory,
  strongestTerritory,
  venueFitsTerritory,
} from '../engine/world/territories';
import { graduateClass, graduateCount, workingPopulation } from '../engine/world/academy';
import { rollForNickname } from '../engine/generate/nickname';
import {
  checkRename,
  checkRestyle,
  namesInUse,
  repackage,
  RENAME_REJECTION_TEXT,
} from '../engine/generate/repackage';
import { rollWeeklyEvent, recordFired } from '../engine/events/scheduler';
import { resolveOption } from '../engine/events/apply';
import { CREATIVE_EVENTS, eventById } from '../data/events';
import { applyGimmickLook, stableColorsFrom } from '../engine/generate/gimmickLook';
import { GIMMICKS } from '../data/gimmicks';
import type { EventEffect, EventSubjects } from '../engine/events/types';
import type { Wrestler } from '../engine/types';
import { clamp, pick, chance, randInt } from '../engine/rng';
import { defaultWorldSettings } from '../engine/world/settings';
import { stipulationById, stipulationRequirementsMet } from '../data/stipulations';
import { simulateMatch, type SimParticipant } from '../engine/sim/simulateMatch';
import { houseStyleRatingBonus, violenceTolerancePenalty } from '../engine/sim/houseStyle';
import { computeAftermath, applyAftermath, restWeek } from '../engine/sim/aftermath';
import { runRivalShow, bookRivalCard, canWork, type RivalShow } from '../engine/world/rivalBooking';
import { rivalWeek, shouldFold } from '../engine/world/rivalEconomy';
import { publishPositions } from '../engine/world/publication';
import { generateFanReaction, crowdVerdict } from '../engine/world/fanReaction';
import { appraise, aiBid, settleAuction, playerBidAmount, type Bid, type PlayerBidLevel } from '../engine/world/auction';
import {
  recordTeamResult,
  disbandBrokenTeams,
  formTeams,
  canFormTeam,
  createTeam,
} from '../engine/world/tagTeams';
import {
  resolveTitleOutcomes,
  matchTitlePrestige,
  eligibleTitles,
  signatureStipulationFit,
} from '../engine/sim/titleMatch';
import type { ChampionInjuryChoice } from '../engine/world/titleDefence';
import {
  championInjuryOptions,
  defenceStatus,
  isTeamHeld,
  isUnificationMatch,
  needsUnification,
  workingHurtRisk,
} from '../engine/world/titleDefence';
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
  priceRatio,
  priceGoodwill,
  priceReaction,
  updateRecentShowQuality,
  newAssetCondition,
  wearAsset,
  assetEffectiveness,
  assetHasFailed,
  repairAsset,
  repairCost,
} from '../engine/economy/showBudget';
import { VENUES, venueById, fallbackVenue } from '../data/venues';
import { productionAssetById, showExtraById } from '../data/production';
import {
  expireContracts,
  weeklyWageBill,
  createStandardContract,
  askingRate,
  renewalRate,
  STARTING_CONTRACT_WEEKS,
} from '../engine/economy/contracts';
import { driftEgo, targetEgo, contractDemand, clauseUpkeep } from '../engine/career/ego';
import { canSign, currentAskingRate } from '../engine/world/freeAgents';
import {
  computeWeeklyExpenses,
  computeShowExpenseSplit,
  computeAppearanceFee,
  computeDownsideGuarantee,
} from '../engine/economy/payroll';
import { nightModifiers, memoriamFor, cancellationCost, holidayForWeek, seasonForWeek } from '../engine/world/seasons';
import type { WeatherCallOptionId } from '../data/weatherCalls';
import {
  weatherCallFrom,
  resolveWeatherCall,
  hasCallLines,
  carriedWeather,
  type WeatherCall,
} from '../engine/world/weatherCall';
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
  /** The whole save as text, for the player to keep. */
  exportSaveFile: () => string | null;
  /** Replace the running game with one from a file. */
  importSaveFile: (raw: string) => { ok: boolean; error?: string };
  /** This roster as a portable file — no ids, no world state. */
  exportRosterFile: () => string | null;
  /**
   * Bring wrestlers in from a file. They arrive as free agents rather than
   * signed, so importing somebody else's roster is a talent pool to sign from
   * and not an instant thirty-man locker room.
   */
  importRosterFile: (raw: string) => { added: number; problems: string[] };
  setSegmentParticipant: (slot: number, wrestlerId: Id, side: number) => void;
  removeSegmentParticipant: (slot: number, wrestlerId: Id) => void;
  setSegmentRules: (slot: number, rules: Partial<MatchRules>) => void;
  /** Cast a promo slot: who is talking, about what, and to whom. */
  setPromo: (
    slot: number,
    cast: { topicId?: string | null; speakerId?: Id | null; targetId?: Id | null; mouthpieceId?: Id | null },
  ) => void;
  /**
   * Turn a talking slot into a confrontation, or back into a promo. The two
   * share the card's talking budget on purpose: time on the microphone is
   * finite, so a confrontation costs a promo.
   */
  setConfrontation: (
    slot: number,
    cast: {
      confrontationId?: Id | null;
      venue?: 'ring' | 'backstage';
      speakerId?: Id | null;
      oppositeId?: Id | null;
      thirdId?: Id | null;
    },
  ) => void;
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
  /** Clear the owner's verdict on the last mandate once it has been read. */
  dismissMandateOutcome: () => void;
  /** Sign the network currently on the table, or turn them down. */
  answerBroadcastOffer: (accept: boolean) => void;
  /** Take a sponsor's money, and their conditions with it. */
  signSponsor: (sponsorId: string) => void;
  /** Let one go before they walk. */
  dropSponsor: (sponsorId: string) => void;
  // Staging the show
  setVenue: (venueId: Id) => void;
  /** Where you are running this week. */
  setTerritory: (territoryId: Id) => void;
  setTicketPrice: (price: number) => void;
  toggleShowExtra: (extraId: Id) => void;
  buyProductionAsset: (assetId: Id) => void;
  // Ringside
  setSegmentManager: (slot: number, managerId: Id | null, forSide: number) => void;
  setSegmentReferee: (slot: number, refereeId: Id | null) => void;
  setSegmentGuestReferee: (slot: number, wrestlerId: Id | null) => void;
  /** The official who works every match nobody else was named for. */
  setDefaultReferee: (refereeId: Id | null) => void;
  /** Put an official under contract. Cheap, weekly, and never with creative control. */
  signReferee: (refereeId: Id) => { ok: boolean; reason: string | null };
  /** Let one go. He goes straight back into the pool for anybody to sign. */
  releaseReferee: (refereeId: Id) => void;
  /** Share the card out across the crew, best official on the main event. */
  spreadOfficialsAcrossCard: () => void;
  /**
   * Move somebody between the ring, the shirt and the suit. Reversible, but
   * they owe a year in the job before they can move again.
   */
  changeRole: (wrestlerId: Id, role: TransitionRole) => { ok: boolean; reason: string | null };
  /** Name the company and pick its house style. Locked once you run a show. */
  setPromotionIdentity: (name: string, archetype: PromotionArchetype) => void;
  // Roster moves
  signFreeAgent: (wrestlerId: Id) => void;
  /**
   * End a deal early. You pay whatever was guaranteed and they walk free the
   * same day — the worst exit on both counts, and meant to be.
   */
  releaseWrestler: (wrestlerId: Id) => { ok: boolean; reason: string | null; cost: number };
  /**
   * Answer somebody who has asked out. Granting it costs nothing and puts
   * them on ninety days; refusing keeps them, and costs them morale every
   * week you make them stay.
   */
  answerReleaseRequest: (wrestlerId: Id, grant: boolean) => void;
  answerWeatherCall: (choice: WeatherCallOptionId) => void;
  /**
   * Decide what happens to a hurt champion's belt. `interimHolderId` is only
   * read for the 'interim' choice — who the booker is putting the interim
   * version on.
   */
  answerChampionCall: (choice: ChampionInjuryChoice, interimHolderId?: Id) => void;
  /** Create a championship mid-run. It starts vacant, like any new belt. */
  /**
   * Sign somebody who works for a rival, without telling anybody. They stay
   * on the rival's roster and keep appearing on the rival's shows until the
   * booker uses them.
   */
  signSecretly: (wrestlerId: Id) => { ok: boolean; reason: string | null };
  /** Walk them out. The whole thing exists for this moment. */
  revealSecretSigning: (wrestlerId: Id) => void;
  /** Change your mind. They stay where they are and the money stops. */
  tearUpSecretSigning: (wrestlerId: Id) => void;
  createTitle: (blueprint: TitleBlueprint) => void;
  /**
   * Retire a championship. It keeps its entire lineage and stays on the
   * records; it simply stops being defended. Reversible.
   */
  retireTitle: (titleId: Id) => void;
  /** Bring a retired championship back. It returns vacant. */
  unretireTitle: (titleId: Id) => void;
  /**
   * Rename or re-describe a belt, or change what it is traditionally defended
   * under. Everything else about it is fixed once it has a lineage: the
   * division is locked at creation by §3.1, and the tier decides who can
   * challenge and what the belt is worth, so moving it under a reign would
   * rewrite history rather than change the future.
   */
  editTitle: (titleId: Id, patch: { name?: string; blurb?: string; signatureStipulationId?: Id | null }) => void;
  /** Send somebody out on their terms. They go to the Legacy wall, not the pool. */
  retireWrestler: (wrestlerId: Id) => void;
  /**
   * Change what somebody is called and what they look like. Rejected — and
   * says why — if the new name or look would read as somebody else already in
   * the business.
   */
  repackageWrestler: (
    wrestlerId: Id,
    change: { name?: string; nickname?: string | null; appearance?: Appearance },
  ) => { ok: boolean; reason: string | null };
  /** Put two of your people together as a tag team. Empty name = let the announcers pick. */
  formTagTeam: (aId: Id, bId: Id, name?: string) => void;
  /** Split a team up. Any tag belts they were carrying go vacant. */
  disbandTagTeam: (teamId: Id) => void;
  /** Pay to put a worn rig back to new. */
  repairProductionAsset: (assetId: Id) => void;
  /** Meet a renewal demand in full, or refuse it and risk them walking. */
  answerRenewal: (wrestlerId: Id, accept: boolean) => void;
  /**
   * Offer somebody to a rival. The contract goes with them, which is the
   * whole point — a deal you regret is a thing you can try to make somebody
   * else's problem, and they can see you doing it.
   */
  proposeTrade: (
    outgoingId: Id,
    rivalId: Id,
    incomingId: Id | null,
    cashFromYou: number,
  ) => { accepted: boolean; reason: string };
}

/**
 * Pull somebody out of everything this week's card has them booked into.
 *
 * Shared by trades and role changes: whatever the reason they are no longer
 * available, a card still holding their name would resolve a match with a
 * wrestler who does not work here.
 */
function dropFromCard(world: World, wrestlerId: Id): void {
  for (const segment of [...world.currentCard, ...world.currentPromos]) {
    segment.participants = segment.participants.filter((p) => p.wrestlerId !== wrestlerId);
    if (segment.guestRefereeId === wrestlerId) segment.guestRefereeId = null;
    segment.managerIds = (segment.managerIds ?? []).filter((m) => m.managerId !== `mgr-of-${wrestlerId}`);
    if (segment.promoSpeakerId === wrestlerId) segment.promoSpeakerId = null;
    if (segment.promoTargetId === wrestlerId) segment.promoTargetId = null;
  }
}

/**
 * Take somebody out of the business entirely — dead or retired.
 *
 * Hoisted to module scope when deaths and retirements moved from an annual
 * roll to a weekly one. Returns the belts it had to vacate so the year-end
 * digest can still list them.
 */
/**
 * The night, rebuilt from a forecast the booker has just answered. The
 * holiday is looked up again because it is a fact about the date, but the
 * weather is carried rather than re-rolled.
 */
function carriedNight(week: number, call: WeatherCall) {
  const holiday = holidayForWeek(week);
  return {
    season: seasonForWeek(week),
    holiday,
    weather: carriedWeather(call),
    draw: holiday?.draw ?? 1,
    merch: holiday?.merch ?? 1,
    cancelled: false,
  };
}

/**
 * Close the reign a lineage is currently showing for a belt, with a reason.
 * Shared by every path that takes a title off somebody without a pin.
 */
function closeReign(world: World, title: Title, method: TitleReignEndMethod): void {
  const last = title.history[title.history.length - 1];
  if (last && last.endWeek === null) {
    last.endWeek = world.week;
    last.endMethod = method;
  }
  for (const id of title.currentHolderIds) {
    const open = world.wrestlers[id]?.titleReigns.find((r) => r.endWeek === null);
    if (open) {
      open.endWeek = world.week;
      open.endMethod = method;
    }
  }
}

/** Take a belt back off whoever has it and leave it vacant. */
function stripTitle(world: World, title: Title, method: TitleReignEndMethod): void {
  closeReign(world, title, method);
  title.vacant = true;
  title.currentHolderIds = [];
  title.interimHolderIds = [];
  title.interimSinceWeek = null;
  title.lastDefendedWeek = world.week;
}

/**
 * The unification is over. The loser's claim ends — recorded as 'unified'
 * rather than a loss, because for whichever of them was the interim it never
 * was the real belt.
 */
function closeInterimClaim(world: World, title: Title, winnerIds: readonly Id[]): void {
  const winners = new Set(winnerIds);
  const losers = [...title.currentHolderIds, ...title.interimHolderIds].filter((id) => !winners.has(id));
  for (const id of losers) {
    const open = world.wrestlers[id]?.titleReigns.find((r) => r.endWeek === null);
    if (open) {
      open.endWeek = world.week;
      open.endMethod = 'unified';
    }
  }
  title.interimHolderIds = [];
  title.interimSinceWeek = null;
}

/**
 * Run one confrontation slot and apply everything it did.
 *
 * Returns the segment's contribution to the show, or null when the slot was
 * not filled in properly. Lives beside the promo loop rather than inside it
 * because a confrontation touches more of the world than a promo does — heat,
 * real animosity, an alignment, and occasionally somebody's ribs.
 */
function resolveConfrontationSlot(
  world: World,
  slot: Segment,
  wrestlerById: Map<Id, Wrestler>,
  rng: Rng,
): number | null {
  const speaker = slot.promoSpeakerId ? wrestlerById.get(slot.promoSpeakerId) : undefined;
  const opposite = slot.confrontationOppositeId ? wrestlerById.get(slot.confrontationOppositeId) : undefined;
  const third = slot.confrontationThirdId ? wrestlerById.get(slot.confrontationThirdId) : undefined;
  if (!slot.confrontationId || !speaker || !opposite || speaker.id === opposite.id) {
    slot.confrontationResult = null;
    return null;
  }

  const rivalry = findRivalry(world.rivalries, [speaker.id, opposite.id]);
  const outcome = resolveConfrontation(rng, {
    definitionId: slot.confrontationId,
    venue: slot.confrontationVenue ?? 'ring',
    speaker,
    opposite,
    third: third ?? null,
    existingHeat: rivalry?.heat ?? 0,
    settings: world.settings,
  });
  if (!outcome) {
    slot.confrontationResult = null;
    return null;
  }

  // A confrontation is the deliberate way to start a feud, so it makes one
  // where there was not one — that is the whole point of booking it. Routed
  // through the same closed effect set promos use, so a confrontation can
  // only do things the game can already do.
  const pair = [speaker.id, opposite.id];
  if (outcome.heat !== 0) applyEffect(world, { kind: 'crowdHeat', wrestlerIds: pair, delta: outcome.heat });
  if (outcome.shootHeat !== 0) {
    applyEffect(world, { kind: 'shootHeat', wrestlerIds: pair, delta: outcome.shootHeat });
  }

  // Whoever won the exchange got the night; whoever lost it paid for being
  // out there. A segment you came second in is worse than one you missed.
  const winner = outcome.wonBy ? wrestlerById.get(outcome.wonBy) : undefined;
  const loser = outcome.wonBy
    ? outcome.wonBy === speaker.id
      ? opposite
      : speaker
    : undefined;
  if (winner) {
    winner.momentum = clamp(winner.momentum + world.settings.confrontationWinMomentum, 0, 100);
    winner.popularity = clamp(winner.popularity + world.settings.confrontationWinPopularity, 0, 100);
  }
  if (loser) {
    loser.momentum = clamp(loser.momentum - world.settings.confrontationLossMomentum, 0, 100);
  }

  // A booked turn moves the speaker. The crowd gets a vote on which way.
  if (outcome.alignmentShift !== 0) {
    speaker.alignment = clamp(
      speaker.alignment + (speaker.alignment >= 0 ? -1 : 1) * outcome.alignmentShift,
      -100,
      100,
    );
  }

  // Talking is work, and a confrontation that goes physical is more of it.
  speaker.energy = clamp(speaker.energy - world.settings.confrontationEnergyCost, 0, 100);
  opposite.energy = clamp(opposite.energy - world.settings.confrontationEnergyCost, 0, 100);

  // Nothing happens to a person off-screen. If somebody got hurt in a
  // corridor, the results page says who and how.
  if (outcome.casualty) {
    const hurt = wrestlerById.get(outcome.casualty.wrestlerId);
    if (hurt && !hurt.injury) {
      hurt.injury = {
        severity: outcome.casualty.weeks >= 4 ? 'moderate' : 'minor',
        description: outcome.twistLabel,
        sufferedWeek: world.week,
        totalWeeks: outcome.casualty.weeks,
        weeksRemaining: outcome.casualty.weeks,
        permanentStatLoss: {},
        earlyReturnWeeksUsed: 0,
      };
      hurt.health = clamp(hurt.health - world.settings.casualtyHealthCost, 0, 100);
    }
  }

  slot.confrontationResult = {
    quality: outcome.quality,
    text: outcome.text,
    twistLabel: outcome.twistLabel,
    wonByName: winner?.name ?? null,
  };
  return promoShowContribution(outcome.quality, world.settings);
}

function leaveTheBusiness(world: World, id: Id, method: TitleReignEndMethod): Id[] {
  const vacated: Id[] = [];

  // A belt split between a hurt champion and an interim has to be resolved
  // before anything else, because whichever of them is leaving changes what
  // happens to the other. Without this the interim claim outlives the person
  // holding it: `needsUnification` stays true against somebody who is off
  // every roster, so the belt can never be defended again and the defence
  // clock quietly strips it. A soft-lock that reads as a bug.
  for (const title of world.titles) {
    if (!title.interimHolderIds.includes(id) && !title.currentHolderIds.includes(id)) continue;
    if (title.interimHolderIds.length === 0) continue;

    if (title.interimHolderIds.includes(id)) {
      // The stand-in is gone. There is nobody left to settle it with, so the
      // champion who never lost it is simply the champion.
      const champion = title.currentHolderIds.map((h) => world.wrestlers[h]?.name).filter(Boolean).join(' & ');
      title.interimHolderIds = [];
      title.interimSinceWeek = null;
      if (champion) {
        world.weeklyNews.push(
          wire(
            'title',
            `There is no unification to book for the ${title.name} any more. ${champion} is the champion, undisputed by default.`,
            world.week,
            'normal',
          ),
        );
      }
    } else {
      // The champion is gone and the stand-in is still here. An interim
      // champion is exactly the person who should inherit it — that is what
      // the belt was crowned for — so they get it outright rather than the
      // company vacating a title somebody is already carrying.
      const [heir] = title.interimHolderIds;
      const heirName = heir ? world.wrestlers[heir]?.name : undefined;
      if (heir && heirName) {
        const last = title.history[title.history.length - 1];
        if (last && last.endWeek === null) {
          last.endWeek = world.week;
          last.endMethod = method;
        }
        title.currentHolderIds = [heir];
        title.interimHolderIds = [];
        title.interimSinceWeek = null;
        title.vacant = false;
        title.reignStartWeek = world.week;
        world.weeklyNews.push(
          wire(
            'title',
            `${heirName} is no longer the interim ${title.name}. With the champion gone there is nothing left to settle, and the belt is theirs.`,
            world.week,
            'lead',
          ),
        );
      }
    }
  }

  // A champion who is gone cannot carry a belt. It goes vacant, and the
  // lineage records why.
  for (const title of world.titles) {
    if (title.vacant || !title.currentHolderIds.includes(id)) continue;
    const last = title.history[title.history.length - 1];
    if (last && last.endWeek === null) {
      last.endWeek = world.week;
      last.endMethod = method;
    }
    title.vacant = true;
    title.currentHolderIds = [];
    vacated.push(title.id);
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
  world.releaseRequests = world.releaseRequests.filter((r) => r.wrestlerId !== id);
  return vacated;
}

/**
 * Take somebody off the roster, whichever exit it was.
 *
 * One function so every departure does the same four things: off the roster,
 * contract torn up, into the free-agent pool with whatever restriction the
 * exit carries, and — the part that matters — a sentence saying what
 * happened. A wrestler must never just be absent from the list one week.
 */
function letThemGo(world: World, wrestler: Wrestler, terms: ReturnType<typeof exitTerms>): void {
  wrestler.promotionId = null;
  wrestler.contract = null;
  wrestler.noCompeteWeeks = terms.noCompeteWeeks;
  // A departure ends any second career too — you cannot referee for a company
  // you no longer work for.
  wrestler.role = 'wrestler';
  world.promotion.rosterIds = world.promotion.rosterIds.filter((id) => id !== wrestler.id);
  world.releaseRequests = world.releaseRequests.filter((r) => r.wrestlerId !== wrestler.id);
  // And off this week's card. Cutting somebody on the Tuesday used to leave
  // them booked in Monday's main event.
  dropFromCard(world, wrestler.id);

  const asOfficial = world.referees.find((r) => r.wrestlerId === wrestler.id);
  if (asOfficial) asOfficial.promotionId = null;
  if (world.defaultRefereeId === asOfficial?.id) world.defaultRefereeId = null;
  world.staffManagers = world.staffManagers.filter((m) => m.wrestlerId !== wrestler.id);

  // They do not vanish — they go back into the pool, where a rival can pick
  // them up and you can watch them do it.
  world.freeAgents.push({
    wrestlerId: wrestler.id,
    reason: 'released',
    askingRate: askingRate(wrestler, world.settings),
    weeksUnsigned: 0,
  });
  world.weeklyNews.push(wire('departure', terms.text, world.week));
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
  const holderAges = newHolderIds.map((id) => world.wrestlers[id]?.age ?? 0);
  world.titles[titleIndex] = awardTitle(title, newHolderIds, world.week, holderAges);

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
      promotionId: title.promotionId,
      holderIds: [...newHolderIds],
      holderAges,
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
        w.health = bump(w.health, -world.settings.casualtyHealthCost);
        // A named cause rather than a generic "Injured" — CLAUDE.md, nothing
        // happens to a person off-screen. The event or incident that caused
        // this already carries the sentence explaining it; this makes sure
        // the roster card agrees with the story.
        const cause = pick(rng, causesFor('competitor', 0));
        w.injury = {
          severity:
            effect.weeks >= world.settings.injurySevereWeeks
              ? 'severe'
              : effect.weeks >= world.settings.injuryModerateWeeks
                ? 'moderate'
                : 'minor',
          description: cause?.label ?? 'Injured',
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
    case 'disbandStable': {
      // Marked as broken up rather than deleted — the tag division's history
      // is the point of keeping teams around at all.
      const team = world.stables.find((t) => t.id === effect.stableId);
      if (team && team.disbandedWeek === null) team.disbandedWeek = world.week;
      break;
    }
  }
}

/**
 * Everything an incident is allowed to know about a match that just finished.
 *
 * Built here rather than in the engine because it is the one place that can
 * see the whole world at once — who is in which stable, who cannot stand whom,
 * and who was left off the card and could therefore walk through the curtain.
 */
function incidentContextFor(
  world: World,
  match: {
    competitors: { wrestler: Wrestler; side: number }[];
    winnerIds: Id[];
    finish: FinishType;
    rating: number;
    isMainEvent: boolean;
    titleIds: Id[];
    titleChanged: boolean;
    managers?: { id: Id; name: string; forSide: number }[];
    hasReferee?: boolean;
    availableReturns?: Wrestler[];
  },
): IncidentContext {
  const inMatch = new Set(match.competitors.map((c) => c.wrestler.id));
  const rivalry = findRivalry(world.rivalries, [...inMatch]);
  const title = match.titleIds.map((id) => world.titles.find((t) => t.id === id)).find(Boolean);

  const enemies: [Id, Id][] = world.relationships
    .filter((r) => r.type === 'enemy' && inMatch.has(r.aId) && inMatch.has(r.bId))
    .map((r) => [r.aId, r.bId]);

  return {
    week: world.week,
    isMainEvent: match.isMainEvent,
    rating: match.rating,
    finish: match.finish,
    titleOnTheLine: match.titleIds.length > 0,
    titleChanged: match.titleChanged,
    titleName: title?.name ?? null,
    competitors: match.competitors,
    winnerIds: match.winnerIds,
    loserIds: match.competitors.map((c) => c.wrestler.id).filter((id) => !match.winnerIds.includes(id)),
    managers: match.managers ?? [],
    hasReferee: match.hasReferee ?? false,
    groups: world.stables
      .filter((t) => t.disbandedWeek === null && t.memberIds.filter((id) => inMatch.has(id)).length >= 2)
      .map((t) => ({ id: t.id, name: t.name, memberIds: [...t.memberIds] })),
    enemies,
    heat: rivalry?.heat ?? 0,
    shootHeat: rivalry?.shootHeat ?? 0,
    availableReturns: match.availableReturns ?? [],
    settings: world.settings,
  };
}

/**
 * Who could walk through the curtain during this match.
 *
 * Off the card and fit to work is not enough — they also need a reason to be
 * out there, which means live heat with somebody in the match. Without that
 * condition a run-in was eligible in almost every main event in the business
 * and swamped every other incident.
 */
function couldTurnUp(
  world: World,
  promotionId: Id,
  booked: ReadonlySet<Id>,
  againstIds: readonly Id[],
): Wrestler[] {
  const company = promotionId === world.promotion.id ? world.promotion : world.rivals.find((r) => r.id === promotionId);
  if (!company) return [];
  const hasSomethingToSettle = (id: Id) =>
    world.rivalries.some(
      (r) => r.resolvedWeek === null && r.participantIds.includes(id) && r.participantIds.some((p) => againstIds.includes(p)),
    );
  return company.rosterIds
    .map((id) => world.wrestlers[id])
    .filter(
      (w): w is Wrestler =>
        Boolean(w) &&
        !booked.has(w!.id) &&
        !w!.injury &&
        !w!.deceased &&
        w!.careerStatus !== 'retired' &&
        hasSomethingToSettle(w!.id),
    );
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

    exportSaveFile: () => {
      const world = get().world;
      return world ? exportSave(world, rng.state?.() ?? 0) : null;
    },

    importSaveFile: (raw) => {
      const result = importSave(raw);
      if ('error' in result) return { ok: false, error: result.error };
      // Resume the stream where the save left it, so an imported game carries
      // on rolling rather than replaying weeks it already played.
      rng = rngFromState(result.file.rngState);
      set((state) => {
        state.world = result.file.world;
      });
      saveGame(result.file.world, result.file.rngState);
      return { ok: true };
    },

    exportRosterFile: () => {
      const world = get().world;
      if (!world) return null;
      const roster = world.promotion.rosterIds
        .map((id) => world.wrestlers[id])
        .filter((w): w is Wrestler => Boolean(w));
      return serializeRoster(exportRoster(roster, world.promotion.name));
    },

    importRosterFile: (raw) => {
      const parsed = parseRoster(raw);
      if (parsed.entries.length === 0) return { added: 0, problems: parsed.problems };

      const problems = [...parsed.problems];
      let added = 0;
      set((state) => {
        const world = state.world;
        if (!world) return;

        // Generation runs first and the file overwrites what it names, so a
        // sparse entry still produces somebody complete. Names are checked
        // against the whole business, not just this roster — an import must
        // not put two people with the same name in the world.
        const taken = new Set(Object.values(world.wrestlers).map((w) => w.name.trim().toLowerCase()));
        const generated = generateWrestlers(rng, parsed.entries.length, {
          currentYear: world.settings.startingYear + Math.floor(world.week / 52),
          existingAppearances: Object.values(world.wrestlers).map((w) => w.appearance),
          existingNames: taken,
        });

        parsed.entries.forEach((entry, index) => {
          const base = generated[index];
          if (!base) return;
          if (taken.has(entry.name.trim().toLowerCase())) {
            problems.push(`${entry.name} is already working somewhere. Skipped.`);
            return;
          }
          const wrestler = applyRosterEntry(base, entry);
          taken.add(wrestler.name.trim().toLowerCase());
          world.wrestlers[wrestler.id] = wrestler;
          world.freeAgents.push({
            wrestlerId: wrestler.id,
            reason: 'released',
            askingRate: askingRate(wrestler, world.settings),
            weeksUnsigned: 0,
          });
          added += 1;
        });
      });

      const world = get().world;
      if (world) saveGame(world, rng.state?.() ?? 0);
      return { added, problems };
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
        // Two ways a save ends: the bank, and the owner.
        if (!world || world.folded || world.fired) return;

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
          // Without this the office books the same six matches every week and
          // walks the company into the ground on repetition alone.
          memory: recallBookings(world.showHistory, world.week, world.settings),
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

        // The office names an official for the card if the player has not.
        // Per-match assignments are left alone — deciding which referee gets
        // the main event is the interesting half of the job and Fill the card
        // should not do it for you.
        const availableOfficials = signedReferees(world.referees, world.promotion.id).filter(refereeIsAvailable);
        if (!world.defaultRefereeId || !availableOfficials.some((r) => r.id === world.defaultRefereeId)) {
          world.defaultRefereeId = availableOfficials[0]?.id ?? null;
        }
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
        // Two ways a save ends: the bank, and the owner.
        if (!world || world.folded || world.fired) return;

        // An auction you never answered goes ahead without you. The business
        // does not wait for a booker to make up their mind.
        if (world.pendingAuction) resolveAuction(world, 'pass');
        const wrestlerById = new Map(Object.values(world.wrestlers).map((w) => [w.id, w]));

        // Tonight is either television or the show everything has been built
        // towards. Decided here, once, and read by everything below.
        const isPPV = isPPVWeek(world.week, world.settings);
        const ppvName = ppvNameForWeek(world.week, world.promotion.ppvCalendar, world.settings);

        const segmentRatings: (number | null)[] = [];
        // Who actually wrestled tonight — everybody else gets the week off.
        const worked = new Set<Id>();
        // Who is on the card at all, so an incident knows who is *not* and
        // could therefore come through the curtain.
        const bookedTonight = new Set<Id>(world.currentCard.flatMap((s) => s.participants.map((p) => p.wrestlerId)));
        const weeklyIncidents: { promotionId: Id; promotionName: string; incident: Incident }[] = [];
        /** Which town each promotion worked this week. Everywhere else decays. */
        const ranThisWeek = new Map<Id, Id>();
        /** Heat on the feuds that actually paid off tonight — what buys are built on. */
        const heatOnTheCard: number[] = [];
        /** How many matches were officiated by a wrestler. The room keeps count. */
        let guestRefereeUses = 0;
        /** Officials who worked tonight, and how many calls each one blew. */
        const refereesUsed = new Set<Id>();
        const refereeMissesTonight = new Map<Id, number>();
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

        // ---- the town, the date and the sky ------------------------------
        // Rolled before a single match is simulated, because one outcome of
        // the roll is that there is no show to simulate. A card that never
        // happened has no results, no injuries and no title changes — the
        // rent and the crew are owed all the same.
        const territory =
          world.territories.find((t) => t.id === world.showSetup.territoryId) ?? world.territories[0]!;
        const homeFollowing = followingOf(territory, world.promotion.id);
        // A severe forecast is the one thing in the game that stops the
        // clock, and it stops it because running the show *is* the decision.
        // The roll is carried on the pending call rather than re-rolled when
        // the player answers — their choice must not be able to change
        // whether the storm was ever going to arrive.
        const carried = world.pendingWeatherCall?.week === world.week ? world.pendingWeatherCall : null;
        const night = carried
          ? carriedNight(world.week, carried)
          : nightModifiers(rng, world.week, territory, world.settings);

        if (!carried && night.weather?.severity === 'severe' && hasCallLines(night.weather.event.id)) {
          const call = weatherCallFrom(
            rng,
            night.weather,
            world.week,
            territory.id,
            territory.name,
            world.settings,
          );
          if (call) {
            world.pendingWeatherCall = call;
            world.weatherChoice = null;
            return; // nothing resolves until the booker answers
          }
        }

        // A call that is still open holds the week, however many times the
        // player presses the button. Without this, resolving again while the
        // forecast sat unanswered ran the show as if nothing had been asked.
        if (carried && !world.weatherChoice) return;

        const choice = carried ? world.weatherChoice : null;
        const callOutcome =
          carried && choice
            ? resolveWeatherCall(carried, choice, world.settings, night.weather?.draw ?? 1)
            : null;
        const memoriam = world.pendingMemoriam;
        const nightDraw =
          (callOutcome ? callOutcome.draw : night.draw) * (memoriam ? memoriam.draw : 1);
        const showIsOff = callOutcome ? !callOutcome.ran : night.cancelled;

        // ---- the week everybody else had ---------------------------------
        // Rolled before the card resolves, because some of it decides who is
        // actually in the building. Most weeks this is empty.
        const misfortunes: Misfortune[] = [];
        const misfortuneNews: { text: string; lead: boolean }[] = [];
        for (const person of world.promotion.rosterIds.map((id) => world.wrestlers[id])) {
          if (!person) continue;
          const misfortune = rollMisfortune(rng, person, world.settings);
          if (!misfortune) continue;
          misfortunes.push(misfortune);

          if (misfortune.kind !== 'absence') {
            person.injury = injuryFromMisfortune(misfortune, world.week, person.injury);
            person.health = clamp(person.health - world.settings.casualtyHealthCost, 0, 100);
            person.career.longestInjuryWeeks = Math.max(
              person.career.longestInjuryWeeks,
              person.injury.totalWeeks,
            );
            // Whatever the booker had cleared them for, this is not it.
            person.clearedToWorkHurt = false;
          }

          // Filed further down, after the week ticks over. The wire keeps
          // only items dated at or after the current week, so anything
          // pushed before the increment is silently dropped as last week's
          // news — which is exactly what happened the first time this was
          // written.
          misfortuneNews.push({
            text:
              misfortune.kind === 'absence'
                ? misfortune.text
                : `${misfortune.text} ${misfortune.wrestlerName} is ${outFor(misfortune.weeks ?? 1, world.settings)}.`,
            lead: misfortune.attacked || (misfortune.weeks ?? 0) >= 8,
          });
        }

        // Anybody who will not be in the building tonight. A fresh injury
        // keeps you out just as surely as a blown tyre does.
        const missingTonight = new Map(
          misfortunes.filter((m) => m.kind !== 'aggravation').map((m) => [m.wrestlerId, m]),
        );

        // The office fills the hole. Somebody has to go out there, and who it
        // is was nobody's plan — which is the whole appeal.
        const standIns: Replacement[] = [];
        if (!showIsOff) {
          for (const segment of world.currentCard) {
            for (const role of segment.participants) {
              const missed = missingTonight.get(role.wrestlerId);
              if (!missed) continue;
              const absent = world.wrestlers[role.wrestlerId];
              if (!absent) continue;
              const bookedNow = new Set(
                world.currentCard.flatMap((seg) => seg.participants.map((p) => p.wrestlerId)),
              );
              const available = world.promotion.rosterIds
                .map((id) => world.wrestlers[id])
                .filter(
                  (w): w is Wrestler =>
                    Boolean(w) && !bookedNow.has(w!.id) && !missingTonight.has(w!.id) && canWork(w!, world.settings),
                );
              const standIn = pickReplacement(rng, absent, available, world.settings);
              if (!standIn) {
                // Nobody left. The match comes off rather than going on a man
                // short, and the results page says why.
                segment.participants = segment.participants.filter((p) => p.wrestlerId !== role.wrestlerId);
                continue;
              }
              role.wrestlerId = standIn.id;
              standIns.push({
                absentId: absent.id,
                absentName: absent.name,
                replacementId: standIn.id,
                replacementName: standIn.name,
              });
            }
          }
        }

        // What the crowd has been shown lately, read once before tonight is
        // added to the record — so the six matches on this card are judged
        // against the same memory rather than each one penalising the next.
        const bookingMemory = recallBookings(world.showHistory, world.week, world.settings);

        // What the audience was asking for before tonight. Read once, before
        // the card runs, so the show is judged against what they wanted
        // rather than against what it turned out you did.
        const askedFor = fanDemands({
          wrestlers: Object.values(world.wrestlers).filter((w): w is Wrestler => Boolean(w)),
          playerRosterIds: world.promotion.rosterIds,
          titles: world.titles,
          rivalries: world.rivalries,
          memory: bookingMemory,
          currentWeek: world.week,
          playerPromotionId: world.promotion.id,
          settings: world.settings,
        });

        // How full the houses have been. Tonight's gate is not counted until
        // every match has run, so the honest thing the announcers can know at
        // bell time is what the last one drew.
        const lastHouse = world.showHistory[world.showHistory.length - 1] ?? null;
        const houseShare = lastHouse && lastHouse.venueCapacity > 0
          ? lastHouse.attendance / lastHouse.venueCapacity
          : 0.5;
        const crowdMood: 'hot' | 'warm' | 'flat' =
          houseShare >= world.settings.commentaryHotHouseShare
            ? 'hot'
            : houseShare <= world.settings.commentaryFlatHouseShare
              ? 'flat'
              : 'warm';

        // What the colour man has already said tonight. Shared across every
        // match on the card so one observation is not made about four of
        // them — measured, "the official is losing this one" turned up in
        // four of six matches on the same show.
        const saidTonight = new Set<string>();

        if (!night.cancelled) world.currentCard.forEach((segment, i) => {
          const sides = new Set(segment.participants.map((p) => p.side));
          if (segment.participants.length < 2 || sides.size < 2) {
            segmentRatings.push(null);
            return;
          }

          const stipulation = segment.stipulation ? (stipulationById(segment.stipulation) ?? null) : null;
          const participantWrestlers = segment.participants.map((p) => wrestlerById.get(p.wrestlerId)!);
          const participantIds = participantWrestlers.map((w) => w.id);
          const rivalry = findRivalry(world.rivalries, participantIds) ?? null;
          if (rivalry) heatOnTheCard.push(rivalry.heat);
          // Read before the bell, because the match is about to change both:
          // somebody hurt tonight is a different story from somebody who
          // limped in, and the champion changes the moment the belt does.
          const hurtBeforeTheBell = participantWrestlers.find((w) => w.injury)?.name ?? null;

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
              stipulationId: segment.stipulation,
            },
          );

          // Who is defending, captured now — commitTitleChange rewrites the
          // holder in place, so after the finish there is no way back to it.
          const beltBefore = titlesOnTheLine[0] ?? null;
          const championBefore = beltBefore && !beltBefore.vacant
            ? (world.wrestlers[beltBefore.currentHolderIds[0] ?? '']?.name ?? null)
            : null;
          const championWeeksBefore = beltBefore ? Math.max(0, world.week - beltBefore.reignStartWeek) : 0;

          // Everyone at ringside who is not wrestling (§10). A guest referee
          // replaces the assigned official rather than joining them.
          // Somebody has to count. If the booker named nobody, the office
          // hands the shirt to whoever is around — and that person has their
          // own opinions about who should win.
          // Who is counting: the official booked for this match, else the one
          // named for the whole card. Both must be signed here, fit, and on
          // the payroll — officialFor is the single place that decides.
          const assignedReferee = officialFor(
            segment.refereeId,
            world.defaultRefereeId,
            world.referees,
            world.promotion.id,
          );

          let draftedReferee: Wrestler | undefined;
          if (!assignedReferee && !segment.guestRefereeId) {
            const spare = world.promotion.rosterIds
              .map((id) => world.wrestlers[id])
              .filter(
                (w): w is Wrestler =>
                  Boolean(w) &&
                  !participantIds.includes(w!.id) &&
                  !w!.injury &&
                  !w!.deceased &&
                  // Your own official is not "one of the boys" — if he is
                  // working tonight he is already counting somewhere.
                  w!.role === 'wrestler',
              );
            if (spare.length > 0) draftedReferee = pick(rng, spare);
          }
          const guestReferee = segment.guestRefereeId
            ? wrestlerById.get(segment.guestRefereeId)
            : draftedReferee;
          const ringside = ringsideTotals({
            managers: (segment.managerIds ?? [])
              .map((m) => ({ manager: findManager(world, m.managerId), client: participantWrestlers[m.forSide] }))
              .filter((m): m is { manager: NonNullable<typeof m.manager>; client: Wrestler } =>
                Boolean(m.manager && m.client),
              ),
            referee: assignedReferee,
            guestReferee: guestReferee && guestRefereeIsLegal(guestReferee.id, participantIds) ? guestReferee : null,
            guestWasDrafted: Boolean(draftedReferee),
            settings: world.settings,
          });
          // Managers are paid per appearance. Officials are not paid here at
          // all any more — they are on the payroll, a weekly wage against a
          // signed contract, earned whether they work or not.
          ringsideCost += ringside.cost;
          if (assignedReferee) refereesUsed.add(assignedReferee.id);

          // What the wrestler in the shirt is actually out there to do. Never
          // a coin flip — see refereeAgenda.
          const officiatingWrestler =
            guestReferee && guestRefereeIsLegal(guestReferee.id, participantIds) ? guestReferee : null;
          const agenda = officiatingWrestler
            ? refereeAgenda({
                guest: officiatingWrestler,
                competitors: segment.participants.map((p) => ({
                  wrestler: wrestlerById.get(p.wrestlerId)!,
                  side: p.side,
                })),
                rivalIds: world.rivalries
                  .filter((r) => r.resolvedWeek === null && r.participantIds.includes(officiatingWrestler.id))
                  .flatMap((r) => r.participantIds.filter((id) => id !== officiatingWrestler.id)),
                friendIds: world.relationships
                  .filter(
                    (r) =>
                      (r.type === 'friend' || r.type === 'mentor' || r.type === 'protege') &&
                      (r.aId === officiatingWrestler.id || r.bId === officiatingWrestler.id),
                  )
                  .map((r) => (r.aId === officiatingWrestler.id ? r.bId : r.aId)),
                enemyIds: world.relationships
                  .filter((r) => r.type === 'enemy' && (r.aId === officiatingWrestler.id || r.bId === officiatingWrestler.id))
                  .map((r) => (r.aId === officiatingWrestler.id ? r.bId : r.aId)),
                settings: world.settings,
              })
            : null;

          const result = simulateMatch(rng, simParticipants, wrestlerById, {
            rules: segment.rules,
            stipulation,
            requirementsMet,
            isPPV,
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
            titles: titlesOnTheLine,
            isMainEvent: i === world.currentCard.length - 1,
            isOpener: i === 0,
            // How numb the crowd already is to being shown this, carried in
            // at the level the promotion opened the show with — so every
            // match on one card is judged against the same number.
            paceSaturation: world.paceSaturation[segment.rules.pace] ?? 0,
            // What the crowd has already been shown. Read once for the whole
            // card, before tonight is added to it, so the six matches on one
            // show are judged against the same memory rather than each one
            // penalising the next.
            overexposurePenalty: overexposurePenalty(segment, bookingMemory, world.settings),
            staleGimmickPenalty: staleGimmickPenalty(participantWrestlers, world.settings),
            // A deathmatch title in a normal match is a broken promise, and
            // the crowd is entitled to notice.
            signatureStipulationFit: signatureStipulationFit(
              titlesOnTheLine,
              segment.stipulation,
              world.settings,
            ),
            rivalry,
            ringside,
            // The thumb on the scale. The [8%, 92%] clamp still applies, so
            // the most agenda anybody can have is a heavy lean — the sim
            // still picks the winner.
            deckStackingShiftsBySide:
              agenda && agenda.favoursSide !== null ? { [agenda.favoursSide]: agenda.shift } : undefined,
          });

          // Standing in the middle of a fight without a wrestler's licence to
          // defend yourself has a price, and it is not always paid.
          if (officiatingWrestler) {
            const cost = guestRefereeHealthCost(
              officiatingWrestler,
              stipulation?.violenceLevel ?? 0,
              world.settings,
            );
            officiatingWrestler.health = clamp(officiatingWrestler.health - cost, 0, 100);

            // And the room notices being officiated by one of their own —
            // more so when it happened because nobody would pay for a real
            // official.
            const annoyance = draftedReferee
              ? world.settings.draftedRefereeMoraleCost
              : world.settings.guestRefereeMoraleCost;
            for (const competitor of participantWrestlers) {
              competitor.morale = clamp(competitor.morale - annoyance, 0, 100);
            }
            guestRefereeUses += 1;
          }

          // ---- what the official missed ----------------------------------
          // The rule about nothing happening off-screen applies to
          // officiating too. A cheap referee is not a hidden multiplier on a
          // finish table — he is a man who did not see the foot on the rope,
          // and the write-up says so by name.
          const misses: RefereeMissRecord[] = [];
          if (assignedReferee) {
            // Fatigue is applied before the roll, so the sixth match of the
            // night is judged on what is left of him rather than on what he
            // was when the doors opened.
            workedMatch(assignedReferee, world.settings);
            const sideSizes = new Map<number, number>();
            for (const p of segment.participants) sideSizes.set(p.side, (sideSizes.get(p.side) ?? 0) + 1);

            const miss = rollRefereeMiss(rng, {
              referee: assignedReferee,
              competitorIds: participantIds,
              hasTags: [...sideSizes.values()].some((n) => n > 1),
              hadInterference: result.finish === 'interference' || result.finish === 'disqualification',
              settings: world.settings,
            });

            if (miss) {
              const victim = miss.victimId ? wrestlerById.get(miss.victimId) : null;
              misses.push(nameTheVictim(miss, victim?.name ?? null));
              // A blown call costs the match on the night and costs the
              // wrestler it went against real morale — which is exactly why
              // signing the cheapest official in the business is a way to
              // make somebody's life miserable on purpose. Scaled by how bad
              // it was: a slow count is untidy, a three-count on a shoulder
              // that was clearly up is a different thing entirely.
              const severity = refereeMissById(miss.missId)?.severity ?? 0.5;
              result.rating = clamp(result.rating - world.settings.refereeMissRatingPenalty * severity, 0, 100);
              result.stars = ratingToStars(result.rating);
              if (victim) {
                victim.morale = clamp(
                  victim.morale - world.settings.refereeMissVictimMorale * severity,
                  0,
                  100,
                );
              }
            }
            refereeMissesTonight.set(
              assignedReferee.id,
              (refereeMissesTonight.get(assignedReferee.id) ?? 0) + (miss ? 1 : 0),
            );
          }

          // ---- who got hurt, and what the write-up says ------------------
          // CLAUDE.md: nothing happens to a person off-screen. Every one of
          // these carries the sentence explaining it; there is no path here
          // that puts somebody on the shelf silently.
          const hurtTonight: Casualty[] = [];
          const violence = stipulation?.violenceLevel ?? 0;

          const putOut = (casualty: Casualty) => {
            const person = world.wrestlers[casualty.personId];
            if (person) {
              person.health = clamp(person.health - world.settings.casualtyHealthCost, 0, 100);
              person.career.longestInjuryWeeks = Math.max(person.career.longestInjuryWeeks, casualty.weeks);
              // Somebody working hurt keeps whichever is worse. A champion
              // sent out on a bad knee who tears something else does not get
              // to swap a six-week injury for a two-week one.
              const existing = person.injury;
              const next = injuryFrom(casualty, world.week);
              person.injury = existing && existing.weeksRemaining > next.weeksRemaining ? existing : next;
              // Whatever the arrangement was, it is over — the booker cleared
              // them for the injury they had, not for this one.
              person.clearedToWorkHurt = false;
            }
            hurtTonight.push(casualty);
          };

          // A stretcher job actually puts somebody out — that is what makes
          // the finish worth fearing rather than just worth fewer points.
          if (result.finish === 'injuryStoppage') {
            const hurt = participantWrestlers.find((p) => !result.winnerWrestlerIds.includes(p.id));
            if (hurt && !hurt.injury) {
              putOut(
                stoppageCasualty(rng, {
                  personId: hurt.id,
                  name: hurt.name,
                  role: 'competitor',
                  violenceLevel: violence,
                  injuryMultiplier: result.injuryMultiplier,
                  toughness: hurt.toughness,
                  settings: world.settings,
                }),
              );
            }
          }

          // And everybody else who was out there. A wrestler is in the match,
          // an official is in the way, a manager is at ringside asking for it.
          for (const person of participantWrestlers) {
            // Already hurt and not cleared means they should not be out here
            // at all. Already hurt *and* cleared is the champion the booker
            // sent out anyway, and the whole point of that decision is that
            // it can go badly — so they roll, at much worse odds.
            if (person.injury && !person.clearedToWorkHurt) continue;
            const casualty = rollCasualty(rng, {
              personId: person.id,
              name: person.name,
              role: 'competitor',
              violenceLevel: violence,
              injuryMultiplier: result.injuryMultiplier * workingHurtRisk(person, world.settings),
              toughness: person.toughness,
              settings: world.settings,
            });
            if (casualty) putOut(casualty);
          }

          if (officiatingWrestler && !officiatingWrestler.injury) {
            const casualty = rollCasualty(rng, {
              personId: officiatingWrestler.id,
              name: officiatingWrestler.name,
              role: 'guestReferee',
              violenceLevel: violence,
              injuryMultiplier: result.injuryMultiplier,
              toughness: officiatingWrestler.toughness,
              settings: world.settings,
            });
            if (casualty) putOut(casualty);
          }

          // An official is signed talent now, so he goes on the shelf like
          // anybody else — and the promotion that carried one referee finds
          // out what that was worth. Managers are still per-appearance hires,
          // so their injuries are reported but not tracked.
          if (assignedReferee && !assignedReferee.injury) {
            const casualty = rollCasualty(rng, {
              personId: assignedReferee.id,
              name: assignedReferee.name,
              role: 'referee',
              violenceLevel: violence,
              injuryMultiplier: result.injuryMultiplier,
              toughness: assignedReferee.toughness,
              settings: world.settings,
            });
            if (casualty) {
              assignedReferee.injury = injuryFrom(casualty, world.week);
              // One of your own in the shirt is the same person as the
              // wrestler. Hurting the official has to hurt him too, or a
              // converted man would be quietly immortal.
              const asWrestler = assignedReferee.wrestlerId
                ? world.wrestlers[assignedReferee.wrestlerId]
                : null;
              if (asWrestler) {
                asWrestler.injury = assignedReferee.injury;
                asWrestler.health = clamp(asWrestler.health - world.settings.casualtyHealthCost, 0, 100);
              }
              hurtTonight.push(casualty);
            }
          }
          for (const assignment of segment.managerIds ?? []) {
            const manager = findManager(world, assignment.managerId);
            if (!manager) continue;
            const casualty = rollCasualty(rng, {
              personId: manager.id,
              name: manager.name,
              role: 'manager',
              violenceLevel: violence,
              injuryMultiplier: result.injuryMultiplier,
              toughness: 40,
              settings: world.settings,
            });
            if (casualty) hurtTonight.push(casualty);
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
            // It was on the line, so the clock resets whoever walked out with
            // it. Defending successfully is a defence.
            title.lastDefendedWeek = world.week;

            // A unification settles a split belt: whoever wins holds the only
            // version of it, and the interim claim ends here.
            if (isUnificationMatch(title, participantIds)) {
              const winners = outcome.newHolderIds ?? result.winnerWrestlerIds;
              closeInterimClaim(world, title, winners);
              titleChanged = true;
              commitTitleChange(world, index, winners);
              continue;
            }

            if (!outcome.changed || !outcome.newHolderIds) continue;

            titleChanged = true;
            commitTitleChange(world, index, outcome.newHolderIds);
          }

          // Something nobody booked. Rolled after the finish is settled and
          // reading it, never deciding it — see engine/sim/incidents.ts.
          const incident = rollIncident(
            rng,
            incidentContextFor(world, {
              competitors: segment.participants.map((p) => ({
                wrestler: wrestlerById.get(p.wrestlerId)!,
                side: p.side,
              })),
              winnerIds: result.winnerWrestlerIds,
              finish: result.finish,
              rating: result.rating,
              isMainEvent: i === world.currentCard.length - 1,
              titleIds: titlesOnTheLine.map((t) => t.id),
              titleChanged,
              managers: (segment.managerIds ?? [])
                .map((m) => ({ manager: findManager(world, m.managerId), forSide: m.forSide }))
                .filter((m): m is { manager: NonNullable<typeof m.manager>; forSide: number } => Boolean(m.manager))
                .map((m) => ({ id: m.manager.id, name: m.manager.name, forSide: m.forSide })),
              hasReferee: Boolean(assignedReferee) && !segment.guestRefereeId,
              availableReturns: couldTurnUp(world, world.promotion.id, bookedTonight, participantIds),
            }),
          );
          if (incident) {
            for (const effect of incident.effects) applyEffect(world, effect);
            weeklyIncidents.push({
              promotionId: world.promotion.id,
              promotionName: world.promotion.name,
              incident,
            });
          }

          const injuriesTonight = hurtTonight.map((casualty) => ({
            wrestlerId: casualty.personId,
            name: casualty.name,
            role: casualty.role,
            text: casualty.text,
            outFor: outFor(casualty.weeks, world.settings),
          }));

          // ---- the call ---------------------------------------------------
          //
          // Built here rather than in simulateMatch because half of what the
          // two of them talk about does not exist until now: who got hurt,
          // what the official missed, whether the belt moved, what nobody
          // booked. The player's card only — a rival's show is a result in a
          // newspaper, and nobody has a broadcast of somebody else's night.
          const sideAIds = segment.participants.filter((p) => p.side === 0).map((p) => p.wrestlerId);
          const sideAMembers = sideAIds.map((id) => wrestlerById.get(id)!).filter(Boolean);
          const sideBMembers = segment.participants
            .filter((p) => p.side !== 0)
            .map((p) => wrestlerById.get(p.wrestlerId)!)
            .filter(Boolean);
          const winnerProbability =
            result.winnerSide === null ? 1 : (result.winProbabilitiesBySide[result.winnerSide] ?? 1);
          const call =
            world.settings.commentaryEnabled && world.promotion.commentaryTeam && sideAMembers.length > 0 && sideBMembers.length > 0
              ? callTheMatch(rngFromSeed(`${world.settings.seed}-call-${world.week}-${i}`), {
                  team: world.promotion.commentaryTeam,
                  sideA: sideAMembers,
                  sideB: sideBMembers,
                  winningSide: result.winnerSide === null ? null : result.winnerSide === 0 ? 'a' : 'b',
                  managers: (segment.managerIds ?? [])
                    .map((m) => ({
                      manager: findManager(world, m.managerId),
                      client: participantWrestlers[m.forSide],
                    }))
                    .filter((m) => Boolean(m.manager))
                    .map((m) => ({
                      name: m.manager!.name,
                      clientName: m.client?.name ?? sideAMembers[0]!.name,
                      devious: m.manager!.deviousness >= world.settings.commentaryDeviousManager,
                    })),
                  refereeName: assignedReferee?.name ?? null,
                  guestRefereeName: officiatingWrestler?.name ?? null,
                  // Only what he actually missed, in the words the write-up
                  // already uses. A colour man who invents a blown call is
                  // exactly the thing this whole module refuses to do.
                  refereeMiss: misses[0]?.text ?? null,
                  titles: titlesOnTheLine,
                  championName: championBefore,
                  championWeeks: championWeeksBefore,
                  titleChanged,
                  stipulationName: stipulation?.name ?? null,
                  shootHeat: rivalry?.shootHeat ?? 0,
                  isMainEvent: i === world.currentCard.length - 1,
                  finish: result.finish,
                  rating: result.rating,
                  beats: result.beats,
                  injuries: injuriesTonight.map((casualty) => ({ name: casualty.name, text: casualty.text })),
                  hurtComingIn: hurtBeforeTheBell,
                  incidentText: incident?.headline ?? null,
                  crowd: crowdMood,
                  upset: winnerProbability <= world.settings.commentaryUpsetProbability,
                  saidTonight,
                  settings: world.settings,
                })
              : undefined;

          segment.result = {
            winnerSide: result.winnerSide,
            winnerWrestlerIds: result.winnerWrestlerIds,
            finish: result.finish,
            rating: result.rating,
            stars: result.stars,
            ratingBreakdown: result.ratingBreakdown,
            beats: result.beats,
            titleChanged,
            injuries: injuriesTonight,
            refereeMisses: misses,
            // Printed beside the match on the card and in the results, the
            // way a boxing bout names its referee before the bell.
            officialName: assignedReferee?.name ?? (officiatingWrestler ? `${officiatingWrestler.name} (guest)` : null),
            incident,
            commentary: call,
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
            healthCostMultiplier: result.healthCostMultiplier,
            energyCostMultiplier: result.energyCostMultiplier,
            settings: world.settings,
          });
          for (const change of changes) {
            const w = world.wrestlers[change.wrestlerId];
            if (w) applyAftermath(w, change, world.settings, result.rating);
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
              const outcome = winningSide === null ? 'draw' : winningSide === side ? 'win' : 'loss';
              recordTeamResult(team, outcome);
              noteTeamResult(world.yearRecord, team.id, outcome);
            });
          }

          // And against the year, for the awards in December.
          noteMatch(world.yearRecord, {
            wrestlerIds: participantIds,
            rating: result.rating,
            week: world.week,
            promotionName: world.promotion.name,
          });

          // Calling for the same blow-away every week is how a promotion
          // runs out of ways to escalate.
          if (result.paceSaturationAdded > 0) {
            world.paceSaturation[segment.rules.pace] = clamp(
              (world.paceSaturation[segment.rules.pace] ?? 0) + result.paceSaturationAdded,
              0,
              100,
            );
          }

          segmentRatings.push(result.rating);
          const avgPop = participantWrestlers.reduce((sum, w) => sum + w.popularity, 0) / participantWrestlers.length;
          segmentPopAvgs.push({ stars: result.stars, avgPopularity: avgPop });


        });

        // ---- the talking ------------------------------------------------
        // Promo slots sit alongside the card rather than inside it (§9), so
        // they are resolved here, after the matches, and contribute to the
        // show on their own smaller scale.
        let promoRating = 0;
        for (const slot of world.currentPromos) {
          // A talking slot can be a promo or a confrontation. The budget is
          // shared on purpose — time on the microphone is finite.
          if (slot.kind === 'confrontation') {
            const outcome = resolveConfrontationSlot(world, slot, wrestlerById, rng);
            if (outcome !== null) promoRating += outcome;
            continue;
          }

          const speaker = slot.promoSpeakerId ? wrestlerById.get(slot.promoSpeakerId) : undefined;
          const topicId = slot.promoTopicId as PromoTopicId | null;
          const target = slot.promoTargetId ? wrestlerById.get(slot.promoTargetId) : undefined;
          const holdsTitle = Boolean(
            speaker && world.titles.some((t) => t.promotionId === world.promotion.id && t.currentHolderIds.includes(speaker.id)),
          );
          if (!topicId || !promoIsValid(topicId, speaker ?? null, target ?? null, holdsTitle)) {
            slot.promoResult = null;
            continue;
          }

          const mouthpiece = slot.promoMouthpieceId ? findManager(world, slot.promoMouthpieceId) : undefined;
          const rivalry = target ? findRivalry(world.rivalries, [speaker!.id, target.id]) : null;

          const promo = resolvePromo(rng, {
            speaker: speaker!,
            target: target ?? null,
            mouthpieceCharisma: mouthpiece?.micWork ?? null,
            topicId,
            existingHeat: rivalry?.heat ?? 0,
            settings: world.settings,
          });

          for (const effect of promo.effects) applyEffect(world, effect);
          promoRating += promoShowContribution(promo.quality, world.settings);

          // Talking is work. Doing it on a night you also wrestle costs more.
          const alsoWrestling = world.currentCard.some((segment) =>
            segment.participants.some((p) => p.wrestlerId === speaker!.id),
          );
          speaker!.energy = clamp(
            speaker!.energy - promoEnergyCost(alsoWrestling, world.settings),
            0,
            100,
          );

          // Two topics reach the map rather than the roster, so they are
          // applied here where the territories live.
          const townIndex = world.territories.findIndex((t) => t.id === world.showSetup.territoryId);
          if (townIndex >= 0) {
            const town = world.territories[townIndex]!;
            const swing = (promo.quality / 100) * world.settings.promoFollowingGain;
            if (topicId === 'advertise') {
              town.following[world.promotion.id] = clamp(
                followingOf(town, world.promotion.id) + swing,
                0,
                100,
              );
            }
            if (topicId === 'invasionPromo' && town.ownerPromotionId && town.ownerPromotionId !== world.promotion.id) {
              const holder = town.ownerPromotionId;
              town.following[holder] = clamp(followingOf(town, holder) - swing, 0, 100);
            }
          }

          slot.promoResult = { quality: promo.quality, text: promo.text };
          worked.add(speaker!.id);
        }

        // What the night did to the officials' standing. An official builds a
        // reputation over years of clean matches and loses it in one bad main
        // event, which is why the misses cost far more than the clean nights
        // return.
        for (const refereeId of refereesUsed) {
          const referee = world.referees.find((r) => r.id === refereeId);
          if (!referee) continue;
          applyNightToReputation(referee, refereeMissesTonight.get(refereeId) ?? 0, world.settings);
          // A converted wrestler is still learning the job. This is what the
          // year of commitment actually buys, and it is the only way any
          // official's competence ever moves.
          for (let i = 0; i < referee.matchesTonight; i++) learnOnTheJob(referee, world.settings);
        }

        const slotWeights = TV_SLOT_WEIGHTS.slice(0, world.currentCard.length);
        const inRingRating = computeShowRating(segmentRatings, slotWeights);

        // Did you give them what they were asking for? Judged on what was
        // booked rather than on how it went: the crowd asked for a match,
        // not for a result, and giving them the match and having it go badly
        // is a different failure from never giving it to them at all.
        const delivered = demandsDelivered(
          askedFor,
          world.currentCard
            .filter((segment) => segment.participants.length >= 2)
            .map((segment) => ({
              participantIds: segment.participants.map((p) => p.wrestlerId),
              titleIds: segment.titleIds,
            })),
        );
        const demandBonus = deliveryBonus(delivered, world.settings);
        for (const demand of delivered) {
          world.weeklyNews.push(
            wire(
              'misfortune',
              demand.kind === 'enoughOfHim'
                ? `Giving everybody a week off from ${demand.text.split(' has been')[0]} went down well. People noticed the change.`
                : `They had been asking for it, and they got it. ${demand.text}`,
              world.week + 1,
              'minor',
            ),
          );
        }

        // ---- where we are running ----------------------------------------
        // The town has an opinion about the card, and a memory of how over
        // this promotion is here. Both were read at the top of the week,
        // before the card was simulated, because the weather gets a vote on
        // whether the card happens at all.
        const townFit = territoryFit(
          territory,
          readCardTraits(
            world.currentCard
              .filter((segment) => segment.result !== null)
              .map((segment) => ({
                participants: segment.participants
                  .map((p) => wrestlerById.get(p.wrestlerId))
                  .filter((w): w is Wrestler => Boolean(w)),
                violenceLevel: segment.stipulation
                  ? (stipulationById(segment.stipulation)?.violenceLevel ?? 0)
                  : 0,
                lengthMinutes:
                  segment.rules.timeLimit > 0 ? segment.rules.timeLimit : world.settings.defaultMatchLength,
              })),
            world.settings,
          ),
          world.settings,
        );

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
        // Weighted by where people are on the card, exactly as the show
        // rating is. A flat mean meant the opener counted as much as the main
        // event, so adding an undercard match of two enhancement hands
        // actively lowered how many tickets the show sold — depth ate its own
        // gate, and a deep roster was self-defeating before payroll was even
        // considered. People come for the top of the card.
        const cardStrength = segmentPopAvgs.length
          ? segmentPopAvgs.reduce((sum, s, i) => sum + s.avgPopularity * (slotWeights[i] ?? 1), 0) /
            segmentPopAvgs.reduce((sum, _s, i) => sum + (slotWeights[i] ?? 1), 0)
          : 0;
        // What you have been putting on drives this, not what you are called.
        const demand = computeDemand(
          world.promotion.rating,
          world.promotion.recentShowQuality,
          cardStrength,
          world.settings,
          homeFollowing,
        );

        const attendance = showIsOff
          ? 0
          : computeAttendanceForShow({
              venue,
              ticketPrice,
              demand,
              attendanceMultiplier:
                sumEffect(production, 'attendanceMultiplier', 'multiply') * nightDraw,
              // The regulars in this town are the floor under a bad night.
              territoryFollowing: homeFollowing,
              settings: world.settings,
            });

        // Who was actually out there tonight — the gimmicks that moved shirts
        // and the people owed a slice of them.
        const onTheCard = [
          ...new Set(world.currentCard.flatMap((seg) => seg.participants.map((p) => p.wrestlerId))),
        ]
          .map((id) => world.wrestlers[id])
          .filter((w): w is Wrestler => Boolean(w));

        const gimmickMerch =
          onTheCard.length === 0
            ? 1
            : onTheCard.reduce((sum, w) => sum + (w.gimmick.merchMultiplier ?? 1), 0) /
              onTheCard.length;

        const merchCutShare = onTheCard.reduce(
          (share, w) =>
            share +
            (w.contract?.clauses.includes('merchandiseCut') ? world.settings.clauseMerchandiseCut : 0),
          0,
        );

        const revenue = computeShowRevenue({
          attendance,
          ticketPrice,
          merchMultiplier: sumEffect(production, 'merchMultiplier', 'multiply'),
          gimmickMerchMultiplier: gimmickMerch * night.merch,
          merchCutShare,
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

        // What a ticket is worth here. A sell-out in the small town is not the
        // same money as a sell-out in the metro.
        const gate = Math.round(revenue.gate * territory.revenueMult);

        const weeklyExpenses = computeWeeklyExpenses(
          world.promotion.bankBalance,
          world.settings.weeklyExpenseRate,
          world.promotion.ownedTerritoryIds.length,
        );
        // Pay splits in two. The retainer is what everybody draws for being
        // under contract at all, booked or not — that is what "two years,
        // flat rate" means, and it is the price of carrying depth. The
        // appearance money is only paid to the people who actually worked
        // tonight, which is what makes a thirty-five person roster against a
        // fourteen-person card affordable rather than suicidal.
        //
        // §14's 50% expense cap applies to *show* expenses, not to wages:
        // capping the wage bill made the bank rise every week no matter what,
        // because the overflow was silently discarded.
        const signed = world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean);
        const mainEventIds = new Set(
          (world.currentCard[world.currentCard.length - 1]?.participants ?? []).map((p) => p.wrestlerId),
        );
        const nightsWork = signed.reduce((sum, member) => {
          if (!member.contract) return sum;
          // Somebody who sat at home collects nothing extra, unless their deal
          // says otherwise — which is the whole point of a downside guarantee.
          if (!worked.has(member.id)) return sum + computeDownsideGuarantee(member.contract);
          return (
            sum +
            computeAppearanceFee({
              contract: member.contract,
              role: 'competitor',
              isMainEvent: mainEventIds.has(member.id),
              isPPV,
            })
          );
        }, 0);
        payroll =
          weeklyWageBill(signed) +
          Math.round(nightsWork) +
          // Officials are on the payroll like everybody else — a weekly wage
          // whether they worked the card or sat at home. Carrying four of
          // them is a real line on the budget; it is just a much smaller one
          // than carrying a fifth wrestler.
          refereeWageBill(world.referees, world.promotion.id);
        // A show that never happened still costs most of what it was going to.
        // The building was booked, the crew was called and the trucks went out
        // before anybody looked at the sky — that is what makes the venue a
        // bet rather than a purchase. The 50% expense cap is against revenue,
        // which on a cancelled night is nothing, so the cap is skipped: it
        // exists to stop a show eating its own gate, not to make a washout
        // free.
        const { payable: showPayable } = callOutcome
          ? {
              payable:
                Math.round(showCosts.total * callOutcome.costShare) + callOutcome.extraCost,
            }
          : night.cancelled
            ? { payable: cancellationCost(showCosts.total, world.settings) }
            : computeShowExpenseSplit(showCosts.total, revenue.total, world.settings.expenseCapPctOfRevenue);
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
        const showRating =
          segmentPopAvgs.length === 0
            ? 0
            : clamp(inRingRating + productionRating + townFit + promoRating + demandBonus, 0, 100);
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

        // ---- what the night did to the map ------------------------------
        // Following is earned here and nowhere else. Everything the player
        // does in a town — the card, the price, the building — comes out as
        // one number: how many of them come back next time.
        //
        // The price half of that used to be a lie in this comment: it moved
        // tonight's headcount and was then forgotten, which made gouging free
        // for any promotion whose draw exceeded its building. It is real now.
        const ratioPaid = priceRatio(ticketPrice, demand, world.settings);
        const goodwill = priceGoodwill(ratioPaid, world.settings);
        const reaction = priceReaction(ratioPaid, world.settings);
        const homeIndex = world.territories.findIndex((t) => t.id === territory.id);
        if (homeIndex >= 0) {
          const town = world.territories[homeIndex]!;
          town.following[world.promotion.id] = clamp(
            followingOf(town, world.promotion.id) +
              followingGain(showStars, world.settings) +
              goodwill +
              (callOutcome ? callOutcome.following : 0),
            0,
            100,
          );

          // Running somebody else's town costs them. This is how a promotion
          // is pushed off the map, and it is not subtle.
          if (isInvasion(town, world.promotion.id)) {
            const holder = town.ownerPromotionId!;
            town.following[holder] = clamp(
              followingOf(town, holder) - invasionDamage(showStars, world.settings),
              0,
              100,
            );
          }

          // And the house claims the town, if it was the biggest anybody has
          // ever drawn here.
          const record = world.attendanceRecords[town.id];
          if (claimsTerritory(record, attendance, world.settings)) {
            world.attendanceRecords[town.id] = {
              territoryId: town.id,
              promotionId: world.promotion.id,
              attendance,
              week: world.week,
            };
            town.ownerPromotionId = world.promotion.id;
          }
          ranThisWeek.set(world.promotion.id, town.id);
          // Where you ran is where you are from, as far as the owner is
          // concerned — "run a show in my home town" is checked against this.
          world.promotion.homeTerritoryId = town.id;
          world.bestAttendanceThisMandate = Math.max(world.bestAttendanceThisMandate, attendance);
        }

        // ---- what the night sold ----------------------------------------
        // Buys are the first money in this game not capped by the room you
        // rented: they come from how badly people wanted to see it, which is
        // mostly the feuds they paid in advance to watch finish.
        const buys = isPPV
          ? computeBuys({
              showRating,
              companyRating: world.promotion.rating,
              heatOnTheCard,
              settings: world.settings,
            })
          : 0;
        const buyRevenue = computeBuyRevenue(buys, world.settings);
        world.promotion.bankBalance += buyRevenue;

                // Tonight goes into the running average, which is what decides how
        // many people turn up next week. A night of draws and count-outs
        // empties the building a fortnight from now.
        world.promotion.recentShowQuality = updateRecentShowQuality(
          world.promotion.recentShowQuality,
          showRating,
          world.settings,
        );

        const target = targetCompanyRatingForStars(showStars, world.settings);
        world.promotion.rating = stepCompanyRatingTowardTarget(
          world.promotion.rating,
          target,
          world.settings.ratingLadderStepPerWeek,
          // A pay-per-view moves the ladder twice as fast, in either
          // direction. It is the night people judge you on.
          isPPV,
          world.settings.ratingLadderFallMultiplier,
        );

        world.showHistory.push({
          standIns: standIns.map((swap) => ({
            absentName: swap.absentName,
            replacementName: swap.replacementName,
            reason: missingTonight.get(swap.absentId)?.text ?? 'They never made the building.',
          })),
          id: `show-${world.week}`,
          promotionId: world.promotion.id,
          week: world.week,
          type: isPPV ? 'ppv' : 'tvTaping',
          name: ppvName,
          // Where it actually ran, which is not the same as where the
          // promotion is based. This recorded homeTerritoryId regardless, so
          // every show on the road filed itself under the wrong town.
          territoryId: territory.id,
          // Talking slots that actually happened. A confrontation carries its
          // own result, so filtering on promoResult alone dropped every one of
          // them out of the record and off the results page.
          segments: [
            ...world.currentCard,
            ...world.currentPromos.filter((slot) => slot.promoResult || slot.confrontationResult),
          ],
          attendance,
          ticketPrice,
          gate,
          payroll,
          venueId: venue.id,
          venueCapacity: venue.capacity,
          merch: revenue.merch,
          buys,
          buyRevenue,
          otherRevenue: revenue.other,
          showCosts: showCosts.total,
          showRating,
          showStars,
          broadcast: true,
          priceReaction: reaction,
        });

        // ---- what the fans made of it -----------------------------------
        // Generated from the show that actually happened: the best and worst
        // matches on it, and anything that changed hands.
        const ratedSegments = world.currentCard
          .map((segment) => ({ segment, result: segment.result }))
          .filter((entry): entry is { segment: Segment; result: SegmentResult } => Boolean(entry.result));

        const describe = (entry: { segment: Segment; result: SegmentResult } | undefined) => {
          if (!entry) return null;
          const everyone = entry.segment.participants.map((p) => p.wrestlerId);
          // A draw has no winner, and "the winner" is not a name a fan would
          // type. Fall back to whoever was in it, so the feed always names
          // real people.
          const winnerId = entry.result.winnerWrestlerIds[0] ?? everyone[0];
          const loserId = everyone.find((id) => id !== winnerId) ?? everyone[1];
          const nameOf = (id: Id | undefined) => (id ? world.wrestlers[id]?.name : undefined);
          return {
            rating: entry.result.rating,
            winnerName: nameOf(winnerId) ?? 'whoever that was',
            loserName: nameOf(loserId) ?? 'whoever that was',
          };
        };

        const byRating = [...ratedSegments].sort((a, b) => b.result.rating - a.result.rating);
        const titleChanges = ratedSegments
          .filter((entry) => entry.result.titleChanged)
          .flatMap((entry) =>
            entry.segment.titleIds
              .map((id) => world.titles.find((t) => t.id === id))
              .filter((title): title is NonNullable<typeof title> => Boolean(title))
              .map((title) => ({
                titleName: title.name,
                championName: title.currentHolderIds.map((id) => world.wrestlers[id]?.name).filter(Boolean).join(' & '),
              })),
          );

        if (ratedSegments.length > 0) {
          world.lastFanReaction = {
            week: world.week,
            verdict: crowdVerdict(showRating),
            tweets: generateFanReaction(rng, {
              showRating,
              promotionName: world.promotion.name,
              bestMatch: describe(byRating[0]),
              worstMatch: describe(byRating[byRating.length - 1]),
              titleChanges,
              settings: world.settings,
            }),
          };
        }

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
            memory: memoryFromRoster(available),
          });
          if (!show) continue;
          rivalShows.set(rival.id, show);

          // Rivals tour too. They run where they are most over, and a company
          // that is over nowhere yet takes whatever is unclaimed — which is
          // what gradually spreads seven promotions across twelve towns
          // instead of stacking them all in the biggest market.
          const strongest = strongestTerritory(world.territories, rival.id);
          const unclaimed = world.territories.filter((t) => t.ownerPromotionId === null);
          const home =
            strongest && followingOf(strongest, rival.id) > 0
              ? strongest
              : (unclaimed.length > 0 ? pick(rng, unclaimed) : strongest);
          if (home) {
            ranThisWeek.set(rival.id, home.id);
            const index = world.territories.findIndex((t) => t.id === home.id);
            const town = world.territories[index]!;
            town.following[rival.id] = clamp(
              followingOf(town, rival.id) + followingGain(show.showStars, world.settings),
              0,
              100,
            );
            if (isInvasion(town, rival.id)) {
              const holder = town.ownerPromotionId!;
              town.following[holder] = clamp(
                followingOf(town, holder) - invasionDamage(show.showStars, world.settings),
                0,
                100,
              );
            }
            // A rival's house is estimated from how over they are — they do
            // not have a venue or a ticket price, and inventing one would be
            // a second, disagreeing economy.
            const rivalHouse = Math.round(
              (followingOf(town, rival.id) / 100) * town.capacity * world.settings.rivalHouseShare,
            );
            const record = world.attendanceRecords[town.id];
            if (claimsTerritory(record, rivalHouse, world.settings)) {
              world.attendanceRecords[town.id] = {
                territoryId: town.id,
                promotionId: rival.id,
                attendance: rivalHouse,
                week: world.week,
              };
              town.ownerPromotionId = rival.id;
            }
          }

          for (const match of show.matches) {
            for (const change of match.aftermath) {
              const w = world.wrestlers[change.wrestlerId];
              if (w) applyAftermath(w, change, world.settings, match.rating);
              worked.add(change.wrestlerId);
            }
            // A tag match is on the teams' records, not only the wrestlers'.
            if (match.teamIds) {
              match.teamIds.forEach((teamId, side) => {
                const team = world.stables.find((t) => t.id === teamId);
                if (!team) return;
                const outcome = match.winnerSide === null ? 'draw' : match.winnerSide === side ? 'win' : 'loss';
                recordTeamResult(team, outcome);
                noteTeamResult(world.yearRecord, team.id, outcome);
              });
            }

            // Match of the Year can happen on somebody else's show. That is
            // the point of the rest of the business existing.
            noteMatch(world.yearRecord, {
              wrestlerIds: match.participantIds,
              rating: match.rating,
              week: world.week,
              promotionName: rival.name,
            });

            // And so can a turn. Only their main event, though — the player
            // hears about the top of somebody else's card, not all of it.
            if (match === show.matches[show.matches.length - 1]) {
              const rivalBooked = new Set(show.matches.flatMap((m) => m.participantIds));
              const incident = rollIncident(
                rng,
                incidentContextFor(world, {
                  competitors: match.participantIds
                    .map((id, index) => ({ wrestler: world.wrestlers[id]!, side: match.sides[index] ?? index }))
                    .filter((c) => Boolean(c.wrestler)),
                  winnerIds: match.winnerIds,
                  finish: match.finish,
                  rating: match.rating,
                  isMainEvent: true,
                  titleIds: match.titleOutcomes.map((o) => o.titleId),
                  titleChanged: match.titleOutcomes.some((o) => o.changed),
                  hasReferee: true,
                  availableReturns: couldTurnUp(world, rival.id, rivalBooked, match.participantIds),
                }),
              );
              if (incident) {
                for (const effect of incident.effects) applyEffect(world, effect);
                weeklyIncidents.push({ promotionId: rival.id, promotionName: rival.name, incident });
              }
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
            targetCompanyRatingForStars(show.showStars, world.settings),
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
        // Eleven towns in twelve forget you a little every week. This is the
        // whole reason a schedule is a decision: find the one big market and
        // live there, and the rest of the map quietly stops knowing who you
        // are.
        for (const town of world.territories) {
          for (const company of [world.promotion, ...world.rivals]) {
            if (ranThisWeek.get(company.id) === town.id) continue;
            const current = followingOf(town, company.id);
            if (current <= 0) continue;
            town.following[company.id] = Math.max(0, current - followingDecay(world.settings));
          }
        }

        world.rivalShows = [...rivalShows.values()];
        world.lastIncidents = weeklyIncidents;
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

        // Everything that happened to somebody away from a ring this week,
        // dated to the week the player is about to read.
        for (const item of misfortuneNews) {
          world.weeklyNews.push(wire('misfortune', item.text, world.week + 1, item.lead ? 'lead' : 'minor'));
        }

        world.week += 1;

        // Feuds nobody advanced this week go cold; the bad blood behind them
        // barely moves (§12.5).
        world.rivalries = world.rivalries.map((r) => decayRivalry(r, world.week, world.settings));

        // A show's worth of wear on everything that was hauled out tonight.
        world.assetConditions = world.assetConditions.map((state) =>
          wearAsset(state, {
            ...world.settings,
            // A night spent hauling gear through a storm ages it faster than
            // an ordinary one.
            assetWearPerShow: world.settings.assetWearPerShow + (callOutcome?.extraWear ?? 0),
          }),
        );

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

        // ---- who wants out, and who is still sitting out ------------------
        // A release request is never a surprise: morale is on the roster card
        // for weeks before it gets here, so this is the consequence of
        // something the player watched happen.
        // Keep anything the player did since the last report — firing
        // somebody on a Tuesday has to appear in Monday's write-up, not
        // vanish because the show ran. Only the *previous* report's items go.
        world.weeklyNews = world.weeklyNews.filter((item) => item.week >= world.week);

        // ---- what the sky did, and who the night was for -----------------
        // Nothing happens off-screen: if the weather moved the gate, or the
        // date did, or the show was called off entirely, the paper says so.
        //
        // Pushed here rather than where the night was rolled, because the
        // week has ticked over by now and the line above drops anything
        // stamped with a week earlier than the current one. Every other piece
        // of weekly news is filed after the increment for the same reason.
        if (callOutcome) {
          // What the call turned out to be worth. Always a lead — the booker
          // made a decision and is owed the result of it in plain words.
          world.weeklyNews.push(wire('weather', callOutcome.line, world.week, 'lead'));

          // Running into a storm can cost somebody. Nothing happens to a
          // person off-screen, so this says who and how, in the paper, the
          // same week it happened.
          if (callOutcome.injuryRisk > 0 && chance(rng, callOutcome.injuryRisk)) {
            const candidates = [...worked]
              .map((id) => world.wrestlers[id])
              .filter((w) => Boolean(w) && !w!.injury && !w!.deceased)
              .map((w) => w!);
            const unlucky = candidates.length ? pick(rng, candidates) : null;
            if (unlucky) {
              const weeks = randInt(rng, 1, world.settings.weatherInjuryMaxWeeks);
              unlucky.health = clamp(unlucky.health - world.settings.casualtyHealthCost, 0, 100);
              unlucky.career.longestInjuryWeeks = Math.max(unlucky.career.longestInjuryWeeks, weeks);
              unlucky.injury = {
                severity: 'minor',
                description: 'Hurt getting to the building',
                sufferedWeek: world.week,
                totalWeeks: weeks,
                weeksRemaining: weeks,
                permanentStatLoss: {},
                earlyReturnWeeksUsed: 0,
              };
              world.weeklyNews.push(
                wire(
                  'departure',
                  `${unlucky.name} went over on the ice in the loading bay carrying his own bag in and is out for ${weeks} ${weeks === 1 ? 'week' : 'weeks'}. Nothing to do with the match.`,
                  world.week,
                  'normal',
                ),
              );
            }
          }
          world.pendingWeatherCall = null;
          world.weatherChoice = null;
        } else if (night.weather) {
          const loud = night.weather.severity === 'catastrophe' || night.weather.severity === 'severe';
          world.weeklyNews.push(wire('weather', night.weather.line, world.week, loud ? 'lead' : 'minor'));
        }
        if (night.holiday && !night.cancelled) {
          world.weeklyNews.push(
            wire('weather', `${night.holiday.name}. ${night.holiday.blurb}`, world.week, 'minor'),
          );
        }
        if (memoriam) {
          world.weeklyNews.push(wire('death', memoriam.line, world.week, 'lead'));
          world.pendingMemoriam = null;
        }
        // ---- how the room feels about the booker -------------------------
        //
        // Morale used to move only when something happened *to* somebody — an
        // event fired, an award landed, a referee blew a call. You could main
        // event a man for a year or leave him off forty cards running and it
        // made no difference at all. This is the week's read on how each of
        // them was actually used, and it carries the sentence explaining
        // itself, because the roster card has to be able to answer "why".
        const rewarded = deliveredTo(delivered);
        const lastSeenWeek = new Map<Id, number>();
        for (const past of world.showHistory) {
          for (const segment of past.segments) {
            for (const p of segment.participants) {
              if (p.role !== 'competitor') continue;
              lastSeenWeek.set(p.wrestlerId, Math.max(lastSeenWeek.get(p.wrestlerId) ?? 0, past.week));
            }
          }
        }
        const alliesOf = new Map<Id, Set<Id>>();
        const enemiesOf = new Map<Id, Set<Id>>();
        for (const relationship of world.relationships) {
          const bucket = isAlly(relationship) ? alliesOf : isEnemy(relationship) ? enemiesOf : null;
          if (!bucket) continue;
          const { aId, bId } = relationship;
          if (!bucket.has(aId)) bucket.set(aId, new Set());
          if (!bucket.has(bId)) bucket.set(bId, new Set());
          bucket.get(aId)!.add(bId);
          bucket.get(bId)!.add(aId);
        }
        const noneSet: ReadonlySet<Id> = new Set();
        const moraleShow = world.showHistory[world.showHistory.length - 1] ?? null;
        for (const id of world.promotion.rosterIds) {
          const member = world.wrestlers[id];
          if (!member || member.deceased) continue;
          const report = weeklyMorale(
            member,
            moraleContext(member, moraleShow, {
              popularityOf: (other) => world.wrestlers[other]?.popularity ?? 0,
              alliesOf: (who) => alliesOf.get(who) ?? noneSet,
              enemiesOf: (who) => enemiesOf.get(who) ?? noneSet,
              beltsHeldBy: (who) =>
                world.titles.filter((t) => !t.vacant && t.currentHolderIds.includes(who)).length,
              weeksIdle: world.week - (lastSeenWeek.get(id) ?? 0),
              companyRating: world.promotion.rating,
              deliveredTo: rewarded,
            }),
            world.settings,
          );
          member.morale = clamp(member.morale + report.delta, 0, 100);
          member.moraleLastDelta = report.delta;
          member.moraleNote = report.reasons[0]?.text ?? null;
        }

        for (const id of world.promotion.rosterIds) {
          const member = world.wrestlers[id];
          if (!member || member.deceased) continue;
          if (world.releaseRequests.some((r) => r.wrestlerId === id)) {
            // Still waiting on an answer, and getting unhappier about it.
            member.morale = clamp(member.morale - refusalCost(world.settings), 0, 100);
            continue;
          }
          if (wantsOut(member, world.settings) && chance(rng, world.settings.releaseRequestChance)) {
            world.releaseRequests.push({ wrestlerId: id, openedWeek: world.week });
            world.weeklyNews.push(
              wire(
                'departure',
                `${member.name} has asked to be let out of his contract. He says he will walk away from the money.`,
                world.week,
              ),
            );
          }
        }

        // Ninety days, counted down for everybody in the business.
        for (const person of Object.values(world.wrestlers)) {
          if ((person.noCompeteWeeks ?? 0) > 0) {
            person.noCompeteWeeks = (person.noCompeteWeeks ?? 0) - 1;
            if (person.noCompeteWeeks === 0) {
              world.weeklyNews.push(
                wire(
                  'departure',
                  `${person.name} is out of his ninety days and can sign anywhere.`,
                  world.week,
                  'minor',
                ),
              );
            }
          }
        }

        // ---- the championships ------------------------------------------
        // A belt nobody puts on the line is a belt the card is not being
        // built toward. The company takes it back, and — CLAUDE.md, nothing
        // happens to anybody off-screen — says which belt, off whom, and why.
        for (const title of world.titles) {
          if (title.promotionId !== world.promotion.id || !isActiveTitle(title)) continue;
          const status = defenceStatus(title, world.week, world.settings);
          if (status === 'overdue') {
            const names = title.currentHolderIds
              .map((id) => world.wrestlers[id]?.name)
              .filter(Boolean)
              .join(' & ');
            stripTitle(world, title, 'strippedUndefended');
            world.weeklyNews.push(
              wire(
                'title',
                `The ${title.name} has been stripped from ${names || 'its champion'}. It went undefended too long and the company took it back. It is vacant.`,
                world.week,
                'lead',
              ),
            );
          } else if (status === 'finalWarning') {
            world.weeklyNews.push(
              wire(
                'title',
                `The ${title.name} has to be defended this week or the company vacates it.`,
                world.week,
                'lead',
              ),
            );
          }
        }

        // A decision left to rot decides itself. The belt vacates and the
        // player is told that their not answering is what did it.
        const call = world.pendingChampionCall;
        if (call && world.week - call.raisedWeek >= world.settings.championInjuryGraceWeeks) {
          const title = world.titles.find((t) => t.id === call.titleId);
          if (title && !title.vacant) {
            stripTitle(world, title, 'vacatedByBooker');
            world.weeklyNews.push(
              wire(
                'title',
                `Nobody made a call on the ${title.name} while ${call.championName} sat hurt, so the company vacated it.`,
                world.week,
                'lead',
              ),
            );
          }
          world.pendingChampionCall = null;
        }

        // A champion who got hurt tonight is a decision, not a footnote.
        // Only one call is open at a time; a second hurt champion waits until
        // the first is answered rather than stacking up unread.
        if (!world.pendingChampionCall) {
          for (const title of world.titles) {
            if (title.promotionId !== world.promotion.id || title.vacant) continue;
            if (!isActiveTitle(title) || needsUnification(title)) continue;
            const hurt = title.currentHolderIds
              .map((id) => world.wrestlers[id])
              .find((w) => w?.injury && !w.clearedToWorkHurt);
            if (!hurt?.injury) continue;
            world.pendingChampionCall = {
              titleId: title.id,
              titleName: title.name,
              championIds: [...title.currentHolderIds],
              championName: hurt.name,
              injuryText: hurt.injury.description,
              outFor: `${hurt.injury.weeksRemaining} ${hurt.injury.weeksRemaining === 1 ? 'week' : 'weeks'}`,
              raisedWeek: world.week,
              teamHeld: isTeamHeld(title),
            };
            break;
          }
        }

        // Somebody the booker cleared to work hurt is only cleared while they
        // are hurt. Healing ends the arrangement rather than leaving a flag
        // set that would quietly apply to a future injury.
        for (const person of Object.values(world.wrestlers)) {
          if (person.clearedToWorkHurt && !person.injury) person.clearedToWorkHurt = false;
        }

        // ---- what the group does to the people in it ---------------------
        // Being in the faction that is running the place is very good for a
        // career and very bad for a locker room. The ego inflation is the
        // cost of the angle, and it is what eventually turns it into a
        // problem — the same way it did in life.
        for (const faction of world.stables) {
          if (faction.disbandedWeek !== null || faction.memberIds.length < 2) continue;
          const members = faction.memberIds.map((id) => world.wrestlers[id]).filter(Boolean);
          if (!members.some((m) => world.promotion.rosterIds.includes(m!.id))) continue;

          const heat = factionHeat(faction, world.wrestlers, world.settings);
          const standing = factionStanding(
            heat,
            faction.memberIds.length,
            world.promotion.rating,
            world.settings,
          );
          const drift = factionEgoDrift(standing, world.settings);
          if (drift === 0) continue;
          for (const member of members) {
            if (member) member.ego = clamp(member.ego + drift, 0, 100);
          }
        }

        // A crowd forgets. Whatever the player has not leaned on lately goes
        // back to being effective.
        for (const key of Object.keys(world.paceSaturation)) {
          world.paceSaturation[key] = decayPaceSaturation(world.paceSaturation[key] ?? 0, world.settings);
        }

        // ---- the deals nobody knows about --------------------------------
        //
        // Nobody works for two companies. A handshake costs nothing and buys
        // nothing except being first in the door the hour his old deal runs
        // out — and every week it sits there is a week his own office might
        // hear about it and simply re-sign him. Once the ink is on he is
        // yours, on your payroll, and off everybody's radar; from that moment
        // the only thing that matters is how fast you walk him out.
        const lost: string[] = [];
        for (const signing of world.secretSignings) {
          const person = world.wrestlers[signing.wrestlerId];
          if (!person) {
            lost.push(signing.wrestlerId);
            continue;
          }

          // Somebody who leaves the business takes it with them. Their own
          // system files the write-up for the retirement or the death; this
          // only has to stop pretending the agreement still exists.
          if (person.deceased || person.careerStatus === 'retired') {
            lost.push(signing.wrestlerId);
            continue;
          }

          if (!isFree(signing, world.week)) {
            // Still under contract to them. Nothing is owed and nothing has
            // happened — except that somebody might have talked.
            const holder = world.rivals.find((r) => r.id === signing.fromPromotionId);
            if (rollRetention(rng, signing, person, holder?.rating ?? 0, world.settings)) {
              lost.push(signing.wrestlerId);
              // A rival that re-signs somebody announces it, so this is
              // ordinary news the player would have seen either way. What
              // they know and nobody else does is what it cost them.
              if (person.contract) {
                person.contract.weeksRemaining = STARTING_CONTRACT_WEEKS;
                person.contract.totalWeeks = STARTING_CONTRACT_WEEKS;
              }
              world.weeklyNews.push(
                wire(
                  'signing',
                  `${signing.fromPromotionName} have tied ${person.name} down to a new deal. Somebody there heard he had been talking to people and got in first.`,
                  world.week,
                  'normal',
                ),
              );
            }
            continue;
          }

          if (signing.signedWeek === null) {
            // The hour it lapsed. He comes off their books and onto yours,
            // and not one person outside this office is told.
            signing.signedWeek = world.week;
            const holder = world.rivals.find((r) => r.id === signing.fromPromotionId);
            if (holder) holder.rosterIds = holder.rosterIds.filter((id) => id !== person.id);
            person.promotionId = world.promotion.id;
            person.contract = {
              ...createStandardContract(
                person,
                world.settings,
                world.settings.startingYear + Math.floor(world.week / 52),
              ),
              weeklyRate: signing.weeklyRate,
            };
            // Deliberately no wire item, and deliberately not added to
            // promotion.rosterIds: he cannot be booked, because as far as the
            // world is concerned he is not here. The walkout is what puts him
            // on the roster. See revealSecretSigning.
            continue;
          }

          // Signed, paid, and still not on television. This is the expensive
          // part, and it is meant to be.
          world.promotion.bankBalance -= signing.weeklyRate;
          if (rollExposure(rng, signing, world.week, world.settings)) {
            signing.blownWeek = world.week;
            world.weeklyNews.push(
              wire(
                'signing',
                `The sheets have worked out where ${person.name} went. He has not been on a ${signing.fromPromotionName} show since his deal ran out and somebody finally asked why. Whatever you were saving him for, it is not a surprise now.`,
                world.week,
                'lead',
              ),
            );
          }
        }
        if (lost.length > 0) {
          const dropped = new Set(lost);
          world.secretSignings = world.secretSignings.filter((s2) => !dropped.has(s2.wrestlerId));
        }

        // Every deal in the business runs down, not only yours. This is what
        // makes somebody quietly available in the first place — without it
        // nobody outside your own company is ever within reach.
        const spokenFor = new Set(world.secretSignings.map((s2) => s2.wrestlerId));
        for (const rival of world.rivals) {
          const roster = rival.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean);
          for (const id of expireContracts(roster)) {
            // Their own office does the obvious thing, unless somebody got
            // there first — in which case the lapse is the whole point and
            // the block above will collect him next week.
            if (spokenFor.has(id)) continue;
            const person = world.wrestlers[id];
            if (!person?.contract) continue;
            person.contract.weeksRemaining = STARTING_CONTRACT_WEEKS;
            person.contract.totalWeeks = STARTING_CONTRACT_WEEKS;
          }
        }

        // Who was actually in front of a crowd this week — the player's card
        // and every rival's, so a rival's ace wears out on the same clock the
        // player's does.
        const workedThisWeek = new Set<string>([
          ...world.currentCard.flatMap((segment) =>
            segment.participants.filter((p) => p.role === 'competitor').map((p) => p.wrestlerId),
          ),
          ...world.rivalShows.flatMap((show) => show.matches.flatMap((m) => m.participantIds)),
        ]);

        // And an act wears out. Everybody in the business ages their gimmick,
        // not just the player's roster, so a rival's ace goes stale on the
        // same clock — but working is what does most of the damage, so the
        // people who were on this week lose more than the people who were not.
        for (const person of Object.values(world.wrestlers)) {
          if (person.deceased || person.careerStatus === 'retired') continue;
          ageGimmick(person, workedThisWeek.has(person.id), world.settings);
        }

        // ---- who left the business this week -----------------------------
        // These used to be rolled once a year, which produced fifty-one quiet
        // weeks and one December in which six people retired, three died and
        // every tag team split up on the same night. Weekly rolls at a
        // fifty-second of the annual odds spread the same number of events
        // across the year, so the wire has something real on it most weeks
        // and nothing lands as a batch.
        const perWeek = 1 / 52;
        const careerYearNow = world.settings.startingYear + Math.floor(world.week / 52);
        const yearCtx = {
          currentYear: careerYearNow,
          rosterPeakPopularity: world.promotion.rosterIds.reduce(
            (max, id) => Math.max(max, world.wrestlers[id]?.popularity ?? 0),
            0,
          ),
          settings: world.settings,
        };

        for (const person of Object.values(world.wrestlers)) {
          if (person.deceased) continue;

          if (chance(rng, perWeek)) {
            const passing = rollDeath(rng, person, world.week, world.settings);
            if (passing) {
              person.deceased = passing;
              world.memoriam.push(passing);
              world.thisYear.passings.push(passing);
              // The prose, not the enum. "died at 25. accident" was the bug
              // this audit found — the rule is that it says how it happened.
              world.weeklyNews.push(
                deathLine(person.name, person.age, `${DEATH_CAUSE_TEXT[passing.cause]}.`, world.week),
              );
              // The business runs a tribute for its own. Applied rather than
              // offered — a promotion does not decide whether to ring ten
              // bells for somebody who was on the card last week.
              if (world.promotion.rosterIds.includes(person.id)) {
                world.pendingMemoriam = memoriamFor(
                  person.id,
                  person.name,
                  world.promotion.name,
                  world.settings,
                );
              }
              leaveTheBusiness(world, person.id, 'died');
              continue;
            }
          }

          if (person.role !== 'wrestler') continue;

          if (person.careerStatus === 'retired') {
            if (!chance(rng, perWeek)) continue;
            const back = rollComeback(rng, person, {
              currentYear: careerYearNow,
              rivalries: world.rivalries,
              settings: world.settings,
            });
            if (back.returning) {
              unretire(person, world.settings);
              world.thisYear.comebacks.push({
                wrestlerId: person.id,
                overId: back.over?.participantIds.find((id) => id !== person.id) ?? null,
              });
              world.weeklyNews.push(comebackLine(person.name, world.week));
              // They come back unsigned. Somebody has to want them.
              world.freeAgents.push({
                wrestlerId: person.id,
                reason: 'returning',
                askingRate: askingRate(person, world.settings),
                weeksUnsigned: 0,
              });
            }
            continue;
          }

          if (!chance(rng, perWeek)) continue;
          const call = rollRetirement(rng, person, yearCtx);
          if (call.retiring) {
            retire(person);
            const reason = RETIREMENT_REASON_TEXT[call.reason];
            world.thisYear.retirements.push({ wrestlerId: person.id, reason });
            world.weeklyNews.push(retirementLine(person.name, reason, world.week));
            leaveTheBusiness(world, person.id, 'retired');
          }
        }

        // A partnership does not survive one of them retiring, dying or
        // signing somewhere else — and it should be said the week it breaks,
        // not the following December.
        const splitThisWeek = disbandBrokenTeams(world.stables, world.week, (memberIds) => {
          const people = memberIds.map((id) => world.wrestlers[id]);
          if (people.some((p) => !p || p.deceased || p.careerStatus === 'retired')) return false;
          const first = people[0]!.promotionId;
          return first !== null && people.every((p) => p!.promotionId === first);
        });
        for (const teamId of splitThisWeek) {
          const team = world.stables.find((t) => t.id === teamId);
          if (!team) continue;
          const names = team.memberIds.map((id) => world.wrestlers[id]?.name).filter(Boolean) as string[];
          if (names.length > 0) world.weeklyNews.push(teamSplitLine(team.name, names, world.week));
        }

        // Rivals replace the people they lost, the week they lose them. They
        // shop in the same pool the player does, so a promotion that leaves
        // talent sitting there will watch somebody else sign it — and now
        // finds out the week it happens rather than the following December.
        for (const rival of world.rivals) {
          if (rival.closedWeek !== null) continue;
          const target = rivalRosterSize(rival.rating, world.settings);
          let short = target - rival.rosterIds.length;
          // One signing a week each. A rival that refilled a whole roster in
          // an afternoon read as a batch job, not as a competitor.
          if (short <= 0) continue;
          const index = Math.floor(rng.next() * world.freeAgents.length);
          const agent = world.freeAgents[index];
          const signing = agent ? world.wrestlers[agent.wrestlerId] : undefined;
          if (!signing || signing.deceased || signing.careerStatus === 'retired') continue;
          // Nobody can be signed while they are sitting out a negotiated
          // release. The ninety days binds the whole business, which is the
          // point of trading a payout for it.
          if (!canBeSigned(signing)) continue;
          world.freeAgents.splice(index, 1);
          signing.promotionId = rival.id;
          signing.contract = createStandardContract(
            signing,
            world.settings,
            world.settings.startingYear + Math.floor(world.week / 52),
          );
          rival.rosterIds.push(signing.id);
          // You released him; you get to watch somebody else sign him.
          world.weeklyNews.push(rivalSigningLine(signing.name, rival.name, world.week));
          short -= 1;
        }

        // ---- the officials' week ----------------------------------------
        // They rest, they heal, their deals run down, and the ones you left
        // sitting in the pool get signed by somebody else. Every one of those
        // is reported: an official disappearing off the assignment list
        // without a word is exactly the off-screen change the rule forbids.
        // One wire, one place. These used to be written to a second list
        // that only the office tab read, so the same fact lived twice and
        // could diverge.
        const official = (line: string) => {
          world.weeklyNews.push(wire('official', line, world.week, 'minor'));
        };
        for (const referee of world.referees) {
          const wasHurt = Boolean(referee.injury);
          const employer = referee.promotionId;

          // One of your own in the shirt is one person with one body. His
          // injury lives on the wrestler and is mirrored here, or it would
          // count down twice and heal in half the time.
          const asWrestler = referee.wrestlerId ? world.wrestlers[referee.wrestlerId] : null;
          if (asWrestler) {
            // Rest is the same as anybody's; the injury and the name are the
            // wrestler's, mirrored rather than tracked separately.
            referee.matchesTonight = 0;
            referee.sharpness = clamp(referee.sharpness + world.settings.refereeSharpnessRecoveryPerWeek, 0, 100);
            referee.injury = asWrestler.injury;
            referee.name = asWrestler.name;
            // Death and retirement take them out of the shirt as well as out
            // of the ring. Anything else leaves a ghost officiating.
            if (asWrestler.deceased || asWrestler.careerStatus === 'retired') {
              referee.promotionId = null;
              if (world.defaultRefereeId === referee.id) world.defaultRefereeId = null;
            }
            continue;
          }

          tickRefereeWeek(referee, world.settings);

          if (wasHurt && !referee.injury && employer === world.promotion.id) {
            official(`${referee.name} has been cleared and is available for assignment again.`);
          }
          if (referee.contract && referee.contract.weeksRemaining <= 0) {
            referee.contract = null;
            referee.promotionId = null;
            referee.weeksUnsigned = 0;
            if (employer === world.promotion.id) {
              official(`${referee.name}'s contract has run out. He is back in the pool and anybody can sign him.`);
              if (world.defaultRefereeId === referee.id) world.defaultRefereeId = null;
            }
          }
        }

        const refereePool = tickRefereePool(rng, {
          referees: world.referees,
          playerPromotionId: world.promotion.id,
          rivalDemand: Math.min(1, world.rivals.filter((r) => !r.closedWeek).length / 4),
          settings: world.settings,
        });
        const hiringRivals = world.rivals.filter((r) => !r.closedWeek);
        for (const id of refereePool.signedAway) {
          const referee = world.referees.find((r) => r.id === id);
          // Whichever company got there first. Always handing them to the
          // same rival made one promotion look like it was hoarding shirts.
          const employer = hiringRivals.length > 0 ? pick(rng, hiringRivals) : null;
          if (!referee || !employer) continue;
          referee.promotionId = employer.id;
          referee.contract = createRefereeContract(referee, world.settings, world.settings.startingYear + Math.floor(world.week / 52));
          official(`${employer.name} have signed ${referee.name} to work their shows.`);
        }
        world.referees.push(...refereePool.newcomers);
        for (const newcomer of refereePool.newcomers) {
          official(`${newcomer.name} is licensed and looking for work. ${newcomer.blurb}`);
        }

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
        world.lastPublication = publishPositions({
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
            awards: [],
          };

          // ---- the awards night ------------------------------------------
          // Handed out first, on the year as it actually finished — before
          // anybody retires, dies or ages out of it. A wrestler who retires
          // in December still won Wrestler of the Year in December.
          const liveTeams = world.stables
            .filter((t) => t.kind === 'tagTeam' && t.disbandedWeek === null)
            .map((t) => ({ id: t.id, name: t.name, memberIds: t.memberIds }));
          // Stamped with the year the record covers, not the one starting —
          // at week 52 the calendar has already ticked over, and these are
          // awards for the twelve months that just finished.
          const awards = decideAwards({
            year: world.yearRecord.year,
            wrestlers: Object.values(world.wrestlers),
            record: world.yearRecord,
            teams: liveTeams,
            settings: world.settings,
          });
          for (const winner of awards) {
            for (const effect of awardEffects(winner, world.settings)) {
              const w = world.wrestlers[effect.wrestlerId];
              if (!w) continue;
              w.popularity = clamp(w.popularity + effect.popularity, 0, 100);
              w.momentum = clamp(w.momentum + effect.momentum, -100, 100);
              w.morale = clamp(w.morale + effect.morale, 0, 100);
            }
            world.awardHistory.push(winner);
          }
          notices.awards = awards;


          // Birthdays are the one thing here that genuinely is annual.
          // Deaths, retirements and comebacks moved to the weekly loop above.
          for (const w of Object.values(world.wrestlers)) {
            if (w.deceased) continue;
            w.age += 1;
          }

          // Drain what the year actually did to people into the digest.
          notices.passings = [...world.thisYear.passings];
          notices.retirements = [...world.thisYear.retirements];
          notices.comebacks = [...world.thisYear.comebacks];
          world.thisYear = { passings: [], retirements: [], comebacks: [] };

          // The hall considers everybody who is finished, not just your people.
          const hofCtx = { currentWeek: world.week, currentYear: year, settings: world.settings };
          for (const entry of annualInductions(Object.values(world.wrestlers), hofCtx)) {
            const inductee = world.wrestlers[entry.wrestlerId];
            if (!inductee) continue;
            inductee.hallOfFameWeek = world.week;
            if (!inductee.deceased) inductee.careerStatus = 'hallOfFamer';
            world.hallOfFame.push(entry);
            notices.inductions.push(entry);
            world.weeklyNews.push(inductionLine(inductee.name, world.week));
          }

          // And the schools make up some of the difference.
          const everyone = Object.values(world.wrestlers);
          const intake = graduateClass(
            rng,
            graduateCount(rng, workingPopulation(everyone), world.settings),
            year,
            world.settings,
            everyone.map((w) => w.appearance),
            new Set(everyone.map((w) => w.name.trim().toLowerCase())),
          );
          for (const graduate of intake.wrestlers) world.wrestlers[graduate.id] = graduate;
          world.freeAgents.push(...intake.freeAgents);
          notices.graduates = intake.wrestlers.map((w) => w.id);
          if (intake.wrestlers.length > 0) {
            world.weeklyNews.push(debutLine(intake.wrestlers.map((w) => w.name), world.week));
          }

          // Broken partnerships are cleared weekly now — see above.

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
            for (const team of formed) {
              takenNames.add(team.name);
              const names = team.memberIds.map((id) => world.wrestlers[id]?.name).filter(Boolean) as string[];
              if (names.length > 0) world.weeklyNews.push(teamFormedLine(team.name, names, world.week));
            }
            world.stables.push(...formed);
          }

          // A new year starts with a clean sheet. Opened last, once everybody
          // who retired has gone and everybody out of the schools has arrived,
          // so a wrestler who debuts in January is measured from their debut
          // rather than starting the year off the books.
          world.yearRecord = emptyYearRecord(world.yearRecord.year + 1, Object.values(world.wrestlers));

          world.yearInReview = notices;
        }

        // ---- television and sponsors ------------------------------------
        // Money that arrives whether or not anybody bought a ticket, and
        // leaves the moment you stop being the company they signed.
        const recentShows = world.showHistory.slice(-4);
        // What the slot actually did this week. The network is buying
        // eyeballs, so this is the number their money follows.
        const tvRatingThisWeek =
          world.tvHistory[0]?.results.find((r) => r.promotionId === world.promotion.id)?.rating ?? 0;

        const businessSnapshot = {
          companyRating: world.promotion.rating,
          tvRating: tvRatingThisWeek,
          hardcoreSaturation: world.promotion.hardcoreSaturation,
          averageAttendance:
            recentShows.length === 0
              ? 0
              : recentShows.reduce((sum, show) => sum + show.attendance, 0) / recentShows.length,
          topStarPopularity: world.promotion.rosterIds.reduce(
            (best, id) => Math.max(best, world.wrestlers[id]?.popularity ?? 0),
            0,
          ),
          showsThisMonth: recentShows.length,
          ppvsThisQuarter: world.showHistory.slice(-13).filter((show) => show.type === 'ppv').length,
        };

        const currentDeal = world.broadcastDealId ? broadcasterById(world.broadcastDealId) : undefined;
        const signedSponsors = world.sponsorIds
          .map((id) => sponsorById(id))
          .filter((s): s is NonNullable<typeof s> => Boolean(s));

        world.promotion.bankBalance += weeklyBroadcastIncome(
          currentDeal ?? null,
          signedSponsors,
          tvRatingThisWeek,
          world.settings,
        );

        // A rating held is what a network believes, so the counter resets the
        // moment it slips below the bar for the next tier up.
        const nextTier = bestBroadcasterFor(world.promotion.rating);
        world.weeksAtRating =
          nextTier && (!currentDeal || nextTier.tier > currentDeal.tier) ? world.weeksAtRating + 1 : 0;

        world.lastDealsLost = [];

        // Every paymaster gets the same grace: four weeks of a broken
        // condition, then they are gone.
        const checkPaymaster = (key: string, name: string, breaches: { text: string }[], drop: () => void) => {
          if (breaches.length === 0) {
            delete world.breachWeeks[key];
            return;
          }
          const weeks = (world.breachWeeks[key] ?? 0) + 1;
          world.breachWeeks[key] = weeks;
          if (shouldWalk(weeks, world.settings)) {
            world.lastDealsLost.push({ name, reason: breaches[0]!.text });
            delete world.breachWeeks[key];
            drop();
          }
        };

        if (currentDeal) {
          checkPaymaster(
            currentDeal.id,
            currentDeal.name,
            broadcastBreaches(currentDeal, businessSnapshot),
            () => {
              world.broadcastDealId = null;
            },
          );
        }
        for (const sponsor of signedSponsors) {
          checkPaymaster(sponsor.id, sponsor.name, sponsorBreaches(sponsor, businessSnapshot), () => {
            world.sponsorIds = world.sponsorIds.filter((id) => id !== sponsor.id);
          });
        }

        // And who is offering. Both are answered by the player, not taken
        // automatically — a national deal you cannot honour is worse than no
        // deal at all, and that has to be the booker's call.
        const offer = broadcastOffer(
          world.promotion.rating,
          world.weeksAtRating,
          world.broadcastDealId,
          world.settings,
        );
        world.pendingBroadcastOffer = offer?.id ?? null;
        world.pendingSponsorOffers = availableSponsors(
          world.promotion.rating,
          world.sponsorIds,
          businessSnapshot,
          world.settings,
        ).map((s) => s.id);

        // ---- the owner ---------------------------------------------------
        // Checked after everything else, so a mandate met on tonight's show
        // counts tonight rather than next week.
        const mandateCtx = () => ({
          week: world.week,
          promotion: world.promotion,
          personality: world.promotion.ownerPersonality,
          roster: world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean),
          available: world.freeAgents
            .map((agent) => world.wrestlers[agent.wrestlerId])
            .filter((w): w is Wrestler => Boolean(w)),
          titles: world.titles,
          territories: world.territories,
          payroll,
          bestAttendanceSince: world.bestAttendanceThisMandate,
          // The biggest room they could rent, in the biggest market they could
          // reach. Nobody is asked for more people than that.
          reachableHouse: Math.min(
            Math.max(...VENUES.filter((v) => world.promotion.rating >= v.minCompanyRating).map((v) => v.capacity), 0),
            Math.max(...world.territories.map((t) => t.capacity)),
          ),
          settings: world.settings,
        });

        if (world.settings.ownerMandatesEnabled && !world.fired) {
          if (world.mandate) {
            const met = mandateMet(world.mandate, mandateCtx());
            // Delivering early ends it early — there is no reason to make the
            // player sit on a finished job for three more weeks.
            if (met || mandateExpired(world.mandate.deadlineWeek, world.week)) {
              const outcome = resolveMandate(met, world.settings);
              world.promotion.bankBalance += outcome.money;
              world.promotion.rating = clamp(world.promotion.rating + outcome.ratingDelta, 0, 100);
              if (outcome.strike) world.mandateStrikes += 1;
              world.lastMandateOutcome = {
                description: world.mandate.description,
                met,
                verdict: outcome.verdict,
              };
              world.mandate = null;
              world.bestAttendanceThisMandate = 0;

              if (isFired(world.mandateStrikes, world.settings)) {
                world.fired = {
                  week: world.week,
                  reason: 'Three mandates missed. The owner made good on the threat.',
                };
              }
            }
          } else if (world.week % world.settings.ownerMandatesEveryWeeks === 0) {
            world.mandate = issueMandate(rng, mandateCtx());
          }
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

        world.currentCard = createEmptyCard(segmentsForWeek(world.week, world.settings));
        world.currentPromos = createEmptyPromoSlots(world.settings.promoSlotsPerCard);
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
    formTagTeam: (aId, bId, name) => {
      set((state) => {
        const world = state.world;
        // Two ways a save ends: the bank, and the owner.
        if (!world || world.folded || world.fired) return;

        const a = world.wrestlers[aId];
        const b = world.wrestlers[bId];
        const rosterIds = new Set(world.promotion.rosterIds);
        if (!canFormTeam(a, b, world.stables, rosterIds, name).ok || !a || !b) return;

        const taken = new Set(world.stables.filter((t) => t.disbandedWeek === null).map((t) => t.name));
        world.stables.push(
          createTeam(rng, a, b, world.week, `${world.promotion.id}-team-${world.nextId++}`, taken, name),
        );
      });
    },

    disbandTagTeam: (teamId) => {
      set((state) => {
        const world = state.world;
        const team = world?.stables.find((t) => t.id === teamId && t.disbandedWeek === null);
        if (!world || !team) return;

        // A team that has split cannot defend the tag titles. The belts go
        // vacant with the split on the record, which is how it goes.
        for (const title of world.titles) {
          if (title.vacant || title.tier !== 'tag') continue;
          if (!team.memberIds.every((id) => title.currentHolderIds.includes(id))) continue;

          const last = title.history[title.history.length - 1];
          if (last && last.endWeek === null) {
            last.endWeek = world.week;
            last.endMethod = 'vacatedByBooker';
          }
          for (const id of title.currentHolderIds) {
            const open = world.wrestlers[id]?.titleReigns.find((r) => r.titleId === title.id && r.endWeek === null);
            if (open) {
              open.endWeek = world.week;
              open.endMethod = 'vacatedByBooker';
            }
          }
          title.vacant = true;
          title.currentHolderIds = [];
        }

        team.disbandedWeek = world.week;
      });
    },

    repackageWrestler: (wrestlerId, change) => {
      const world = get().world;
      const w = world?.wrestlers[wrestlerId];
      if (!world || !w) return { ok: false, reason: 'Nobody by that name.' };

      // Checked before the write, so a rejected repackage changes nothing.
      const everybody = Object.values(world.wrestlers);
      if (change.name !== undefined) {
        const check = checkRename(change.name, w.name, namesInUse(everybody), world.settings);
        if (!check.ok) return { ok: false, reason: RENAME_REJECTION_TEXT[check.reason!] };
      }
      if (change.appearance) {
        const look = checkRestyle(change.appearance, wrestlerId, everybody);
        if (!look.ok) {
          const clash = look.clashesWith ? world.wrestlers[look.clashesWith]?.name : null;
          return {
            ok: false,
            reason: clash
              ? `Too close to how ${clash} already looks. Change more than a couple of things.`
              : 'Too close to how somebody else already looks.',
          };
        }
      }

      set((state) => {
        const draft = state.world;
        const target = draft?.wrestlers[wrestlerId];
        if (!draft || !target) return;
        repackage(target, change, draft.week);
      });
      const after = get().world;
      if (after) saveGame(after, rng.state?.() ?? 0);
      return { ok: true, reason: null };
    },

    retireWrestler: (wrestlerId) => {
      set((state) => {
        const world = state.world;
        const w = world?.wrestlers[wrestlerId];
        if (!world || !w || w.careerStatus === 'retired') return;

        // Belts do not retire with their holder. This used to be its own copy
        // of the vacating logic, which is how it drifted: leaveTheBusiness
        // learned to resolve a split belt's interim claim and this path did
        // not, so retiring an interim champion by hand left a claim on a title
        // for somebody who was gone — and a belt owing a unification nobody
        // can turn up for can never be defended again.
        retire(w);
        leaveTheBusiness(world, wrestlerId, 'retired');
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

    setVenue: (venueId) => {
      set((state) => {
        if (state.world) state.world.showSetup.venueId = venueId;
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

    setDefaultReferee: (refereeId) => {
      set((state) => {
        if (!state.world) return;
        state.world.defaultRefereeId = refereeId;
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

    changeRole: (wrestlerId, role) => {
      let outcome: { ok: boolean; reason: string | null } = { ok: false, reason: 'No game in progress.' };
      set((state) => {
        const world = state.world;
        if (!world) return;
        const person = world.wrestlers[wrestlerId];
        if (!person || person.promotionId !== world.promotion.id) {
          outcome = { ok: false, reason: 'They do not work for you.' };
          return;
        }

        const check = canChangeRole(person, role, world.week, world.settings);
        if (!check.ok) {
          outcome = { ok: false, reason: check.reason };
          return;
        }

        const currentYear = world.settings.startingYear + Math.floor(world.week / 52);

        // Coming out of whatever they were doing. The officiating record is
        // kept rather than deleted — a man who spent two years learning the
        // job does not forget it because he wrestled a season — it just stops
        // being available to book.
        const existingReferee = world.referees.find((r) => r.wrestlerId === wrestlerId);
        if (existingReferee) existingReferee.promotionId = null;
        if (world.defaultRefereeId === existingReferee?.id) world.defaultRefereeId = null;

        person.role = role;
        person.roleSinceWeek = world.week;

        if (role === 'referee') {
          if (existingReferee) {
            existingReferee.promotionId = world.promotion.id;
            existingReferee.name = person.name;
            existingReferee.injury = person.injury;
          } else {
            world.referees.push(refereeFromWrestler(person, currentYear, world.settings));
          }
        }

        if (role === 'manager' && !world.staffManagers.some((m) => m.wrestlerId === wrestlerId)) {
          world.staffManagers.push(managerFromWrestler(person));
        }

        // Whatever they were booked into this week, they are not doing it now.
        for (const segment of [...world.currentCard, ...world.currentPromos]) {
          segment.participants = segment.participants.filter((p) => p.wrestlerId !== wrestlerId);
          if (segment.guestRefereeId === wrestlerId) segment.guestRefereeId = null;
          if (role !== 'manager') {
            segment.managerIds = (segment.managerIds ?? []).filter(
              (m) => m.managerId !== `mgr-of-${wrestlerId}`,
            );
          }
          if (role !== 'referee' && segment.refereeId === existingReferee?.id) segment.refereeId = null;
        }

        outcome = { ok: true, reason: null };
      });
      return outcome;
    },

    proposeTrade: (outgoingId, rivalId, incomingId, cashFromYou) => {
      let verdict = { accepted: false, reason: 'No game in progress.' };
      set((state) => {
        const world = state.world;
        if (!world) return;
        const outgoing = world.wrestlers[outgoingId];
        const rival = world.rivals.find((r) => r.id === rivalId);
        const incoming = incomingId ? world.wrestlers[incomingId] : null;
        if (!outgoing || !rival || outgoing.promotionId !== world.promotion.id) {
          verdict = { accepted: false, reason: 'That deal does not exist.' };
          return;
        }
        if (incoming && incoming.promotionId !== rival.id) {
          verdict = { accepted: false, reason: 'He does not work for them.' };
          return;
        }
        if (cashFromYou > world.promotion.bankBalance) {
          verdict = { accepted: false, reason: 'You do not have that.' };
          return;
        }

        const answer = evaluateTrade({
          offer: { outgoing, incoming: incoming ?? null, cashFromYou },
          them: rival,
          theirRosterSize: rival.rosterIds.length,
          targetRosterSize: rivalRosterSize(rival.rating, world.settings),
          settings: world.settings,
        });

        if (!answer.accepted) {
          // They will not take the call again for a while, so the player
          // cannot simply re-ask every week until the dice land.
          world.tradeRefusals[rivalId] = world.week;
          verdict = { accepted: false, reason: answer.reason };
          return;
        }

        // Done. Both contracts travel with their wrestlers untouched — that
        // is what makes a bad deal a real thing to be rid of.
        world.promotion.rosterIds = world.promotion.rosterIds.filter((id) => id !== outgoingId);
        rival.rosterIds.push(outgoingId);
        outgoing.promotionId = rival.id;
        outgoing.morale = clamp(outgoing.morale - world.settings.tradeMoraleCost, 0, 100);
        dropFromCard(world, outgoingId);

        if (incoming) {
          rival.rosterIds = rival.rosterIds.filter((id) => id !== incoming.id);
          world.promotion.rosterIds.push(incoming.id);
          incoming.promotionId = world.promotion.id;
          incoming.morale = clamp(incoming.morale - world.settings.tradeMoraleCost, 0, 100);
        }

        world.promotion.bankBalance -= cashFromYou;
        rival.bankBalance += cashFromYou;

        world.weeklyNews.push(
          wire(
            'signing',
            tradeLine(outgoing.name, incoming?.name ?? null, world.promotion.name, rival.name, cashFromYou),
            world.week,
          ),
        );
        verdict = { accepted: true, reason: answer.reason };
      });
      return verdict;
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
          outcome = { ok: false, reason: 'He is already working for somebody.' };
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

    signFreeAgent: (wrestlerId) => {
      set((state) => {
        const world = state.world;
        if (!world) return;
        const wrestler = world.wrestlers[wrestlerId];
        const agent = world.freeAgents.find((a) => a.wrestlerId === wrestlerId);
        if (!wrestler || !agent) return;
        if (!canSign(wrestler, world.promotion.bankBalance, world.signingBanWeeks, world.settings)) return;
        // Ninety days means ninety days, including for the company he just
        // left. This is the thing the player traded a payout for.
        if (!canBeSigned(wrestler)) return;

        wrestler.promotionId = world.promotion.id;
        wrestler.contract = {
          ...createStandardContract(wrestler, world.settings, world.settings.startingYear),
          weeklyRate: currentAskingRate(agent, world.settings),
          // Somebody with a big opinion of themselves demands guarantees to
          // sign, not only to re-sign. Attaching this at renewal alone meant
          // a star could sit on the roster for years on a deal you could tear
          // up for nothing, which is not what signing a star is.
          guaranteedPct: guaranteedShareFor(wrestler.ego, world.settings),
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
            // Guaranteed money is what the top of the card asks for and
            // nobody else gets. It is also what makes re-signing a star a
            // commitment rather than a line item — from here, cutting him
            // costs the rest of the paper.
            guaranteedPct: guaranteedShareFor(member.ego, world.settings),
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
      let outcome = { ok: false, reason: 'No game in progress.' as string | null, cost: 0 };
      set((state) => {
        const world = state.world;
        if (!world) return;
        const wrestler = world.wrestlers[wrestlerId];
        if (!wrestler) return;

        const terms = exitTerms(wrestler, 'fired', world.settings, world.promotion.name);
        // You cannot cut somebody you cannot afford to pay off. This is the
        // whole weight of guaranteed money: a deal you regret is a deal you
        // are stuck inside until you can fund the way out.
        if (terms.severance > world.promotion.bankBalance) {
          outcome = {
            ok: false,
            reason: 'You cannot cover what is guaranteed on that deal.',
            cost: terms.severance,
          };
          return;
        }

        world.promotion.bankBalance -= terms.severance;
        letThemGo(world, wrestler, terms);
        outcome = { ok: true, reason: null, cost: terms.severance };
      });
      return outcome;
    },

    signSecretly: (wrestlerId) => {
      let outcome: { ok: boolean; reason: string | null } = { ok: false, reason: 'No world.' };
      set((state) => {
        const world = state.world;
        const person = world?.wrestlers[wrestlerId];
        if (!world || !person) return;

        if (!canSignSecretly(person, world.promotion.id, world.settings)) {
          outcome = {
            ok: false,
            reason: 'There is nothing to talk about. He is not out of contract any time soon.',
          };
          return;
        }
        if (world.secretSignings.some((s2) => s2.wrestlerId === wrestlerId)) {
          outcome = { ok: false, reason: 'You already have an understanding with him.' };
          return;
        }
        const cost = secretWeeklyCost(person, world.settings);
        // Nothing is paid today — nothing is signed today. But you do not
        // shake on a number you cannot cover when it comes due.
        if (world.promotion.bankBalance < cost * world.settings.secretSigningProofWeeks) {
          outcome = { ok: false, reason: 'You cannot cover what you would be promising him.' };
          return;
        }
        // Whether they go for it at all. A happy man in a good spot mostly
        // does not, which is why the list of who *would* is the interesting
        // half of the screen.
        if (!chance(rng, secretSigningAppeal(person, world.settings))) {
          outcome = { ok: false, reason: `${person.name} turned it down, and now knows you asked.` };
          // They know. That is a real cost of trying.
          person.morale = clamp(person.morale - world.settings.secretSigningRefusalMorale, 0, 100);
          return;
        }

        const rival = world.rivals.find((r) => r.id === person.promotionId);
        world.secretSignings.push({
          wrestlerId,
          wrestlerName: person.name,
          fromPromotionId: person.promotionId!,
          fromPromotionName: rival?.name ?? 'somewhere else',
          agreedWeek: world.week,
          // What was shaken on: the week his deal runs out. He works every
          // date they have booked him for between now and then.
          freeWeek: world.week + weeksUntilFree(person),
          weeklyRate: cost,
          signedWeek: null,
          blownWeek: null,
        });
        outcome = { ok: true, reason: null };
        // Deliberately no wire item. Nothing has happened yet — that is the
        // entire point.
      });
      return outcome;
    },

    revealSecretSigning: (wrestlerId) => {
      set((state) => {
        const world = state.world;
        const index = world?.secretSignings.findIndex((s2) => s2.wrestlerId === wrestlerId) ?? -1;
        if (!world || index < 0) return;
        const signing = world.secretSignings[index]!;
        const person = world.wrestlers[wrestlerId];
        if (!person) return;
        // He cannot walk out on your show while he is still working theirs.
        // The whole thing rests on this: no man is under two contracts.
        if (!canWalkOut(signing)) return;

        const impact = revealImpact(signing, person, world.week, world.settings);
        const wasSecret = stillSecret(signing);

        // He has been yours since his old deal lapsed. This is the moment the
        // rest of the world finds out — which is also the moment he becomes
        // somebody you can book.
        for (const rival of world.rivals) {
          rival.rosterIds = rival.rosterIds.filter((id) => id !== wrestlerId);
        }
        person.promotionId = world.promotion.id;
        if (!world.promotion.rosterIds.includes(wrestlerId)) world.promotion.rosterIds.push(wrestlerId);
        world.secretSignings.splice(index, 1);

        // The pop. A reveal nobody saw coming is worth several times a
        // signing announcement; one the sheets already printed is worth a
        // fraction of it.
        person.momentum = clamp(person.momentum + impact * world.settings.revealMomentumPerImpact, 0, 100);
        person.popularity = clamp(person.popularity + impact * world.settings.revealPopularityPerImpact, 0, 100);
        world.promotion.rating = clamp(
          world.promotion.rating + impact * world.settings.revealCompanyRatingPerImpact,
          0,
          100,
        );
        const victim = world.rivals.find((r) => r.id === signing.fromPromotionId);
        if (victim) {
          victim.rating = clamp(victim.rating - impact * world.settings.revealRivalRatingPerImpact, 0, 100);
        }

        const sinceFree = Math.max(0, world.week - signing.freeWeek);
        world.weeklyNews.push(
          wire(
            'signing',
            !wasSecret
              ? `${person.name} finally turned up for ${world.promotion.name}. The sheets had already placed him, which took most of it away.`
              : sinceFree <= 1
                ? `${person.name} walked out on ${world.promotion.name}'s show tonight. He worked his last date for ${signing.fromPromotionName} on the final day of his contract and signed here before the week was out. Nobody had time to catch on.`
                : `${person.name} walked out on ${world.promotion.name}'s show tonight. Everybody in the building still had him down at ${signing.fromPromotionName}. His deal there quietly ran out ${sinceFree} weeks ago and he has been signed here ever since.`,
            world.week,
            'lead',
          ),
        );
      });
    },

    tearUpSecretSigning: (wrestlerId) => {
      set((state) => {
        const world = state.world;
        if (!world) return;
        const signing = world.secretSignings.find((s2) => s2.wrestlerId === wrestlerId);
        const person = world.wrestlers[wrestlerId];
        // Walking away from a handshake costs nothing, because a handshake is
        // nothing. Walking away from a signed contract nobody has seen means
        // releasing a man the world thinks still works somewhere else — so he
        // becomes exactly what he is: a free agent nobody has announced.
        if (signing?.signedWeek !== null && signing !== undefined && person) {
          person.promotionId = null;
          person.contract = null;
          world.promotion.rosterIds = world.promotion.rosterIds.filter((id) => id !== wrestlerId);
        }
        world.secretSignings = world.secretSignings.filter((s2) => s2.wrestlerId !== wrestlerId);
      });
    },

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

    answerReleaseRequest: (wrestlerId, grant) => {
      set((state) => {
        const world = state.world;
        if (!world) return;
        const index = world.releaseRequests.findIndex((r) => r.wrestlerId === wrestlerId);
        const wrestler = world.wrestlers[wrestlerId];
        if (index < 0 || !wrestler) return;
        world.releaseRequests.splice(index, 1);

        if (!grant) {
          // He stays, and he is not happy about it. Saying no is often right
          // — he is still your wrestler and he still has to work.
          wrestler.morale = clamp(wrestler.morale - refusalCost(world.settings) * 2, 0, 100);
          world.weeklyNews.push(
            wire(
              'departure',
              `${wrestler.name} asked for his release. He was told no, and he is still on the roster.`,
              world.week,
            ),
          );
          return;
        }

        const terms = exitTerms(wrestler, 'negotiatedRelease', world.settings, world.promotion.name);
        letThemGo(world, wrestler, terms);
      });
    },
  })),
);
