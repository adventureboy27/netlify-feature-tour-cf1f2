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
  Id,
  MatchRules,
  Promotion,
  Segment,
  SegmentResult,
  RefereeMissRecord,
  TitleBlueprint,
  WorldSettings,
  WrestlingStyle,
} from '../engine/types';
import {
  createInitialWorld,
  createEmptyCard,
  createEmptyPromoSlots,
  createEmptyDarkMatches,
  cardSizeFor,
  pairKey,
  rivalRosterSize,
  type World,
  type YearInReview,
  type NewGamePlan,
} from './world';
import {
  findManager,
  carriedNight,
  stripTitle,
  closeInterimClaim,
  resolveConfrontationSlot,
  leaveTheBusiness,
  commitTitleChange,
  closePromotion,
  finishFoldPicking,
  settleSupershow,
  openBiddingWar,
  settleBiddingWar,
  applyEffects,
  incidentContextFor,
  couldTurnUp,
  tickLoan,
  tickReleaseStigma,
  maybeOfferLoan,
  expireStaleLoanOffer,
  maybeOfferBuyout,
  expireStaleBuyoutOffer,
  maybeTrimRivalPayroll,
  openSigningTalk,
  letThemGo,
} from './storeHelpers';
import { createCardBuilderSlice } from './slices/cardBuilder';
import { createEventsSlice } from './slices/events';
import { createTagTeamsAndIdentitySlice } from './slices/tagTeamsAndIdentity';
import { createBusinessDealsSlice } from './slices/businessDeals';
import { createShowAndProductionSlice } from './slices/showAndProduction';
import { createOfficialsAndScheduleSlice } from './slices/officialsAndSchedule';
import { createRosterAndContractsSlice } from './slices/rosterAndContracts';
import { createStorylinesSlice } from './slices/storylines';
import { createTitlesSlice } from './slices/titles';
import { createCupSlice } from './slices/cup';
import { createSupershowSlice } from './slices/supershow';
import { isActiveTitle, createStartingTitles, startingBlueprints } from '../data/titles';
import type { PromotionArchetype } from '../data/promotionIdentity';
import {
  findRivalry,
  createRivalry,
  applyHeatChange,
  decayRivalry,
  shootMoraleCostPerWeek,
  heatMultiplier,
} from '../engine/sim/rivalry';
import { computeTvRatings, buildRatingsChart } from '../engine/world/tvRatings';
import {
  ringsideTotals,
  guestRefereeIsLegal,
  refereeAgenda,
  guestRefereeHealthCost,
} from '../engine/sim/ringside';
import { refereeMissById } from '../data/refereeMisses';
import {
  managerFromWrestler,
  learnOnTheJob,
  type TransitionRole,
} from '../engine/career/transition';
import { decayPaceSaturation } from '../engine/sim/pacing';
import {
  defectionRisk,
  factionEgoDrift,
  factionHeat,
  factionStanding,
  recruitmentTargets,
  rollRecruit,
} from '../engine/world/faction';
import { inventRumour, rumourTweets, type Rumour } from '../engine/world/rumours';
import { demandsDelivered, deliveryBonus, fanDemands } from '../engine/world/fanDemand';
import { clampMorale, deliveredTo, moraleContext, weeklyMorale } from '../engine/career/morale';
import { absenceDecay, cardDrawIn, localStanding, setLocal, workingGain } from '../engine/career/reach';
import {
  advance,
  blowOff,
  blowOffQuality,
  isLive,
  neglect,
  readyToBlowOff,
  storylineBetween,
} from '../engine/world/storyline';
import type { StorylineBeatKind } from '../data/storylineBeats';
import { MATCH_BEAT_LINES } from '../data/storylineBeats';
import { callTheMatch } from '../engine/sim/commentary';
import {
  isAlly,
  isEnemy,
  findRelationship,
  relationshipMatchEffect,
  refusesToWorkWith,
  rollNewTie,
} from '../engine/career/relationships';
import {
  isFree,
  rollExposure,
  rollRetention,
} from '../engine/world/secretSigning';
import {
  injuryFromMisfortune,
  pickReplacement,
  rollDayJobAbsence,
  rollMisfortune,
  type Misfortune,
  type Replacement,
} from '../engine/world/misfortune';
import {
  ageGimmick,
  goneIceColdLine,
  goneStaleLine,
  isIceCold,
  isStale,
  memoryFromRoster,
  overexposurePenalty,
  recallBookings,
  staleGimmickPenalty,
} from '../engine/sim/freshness';
import { segmentPairChemistry } from '../engine/sim/pairChemistry';
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
  secondGenerationLine,
} from '../engine/world/wire';
import {
  // Aliased: world/auction.ts already exports a `Bid`, and that one is a
  // number bid on a lot of assets rather than an offer of employment.
  type Bid as ContractBid,
} from '../engine/economy/bidding';
import { crossing, hypeDrift } from '../engine/career/hype';
import { isFinished } from '../engine/career/status';
import { bereavements, hasLapsed, mourningLine, tieDrift, applyDrift } from '../engine/career/circle';
import { statusOf, statusMove } from '../engine/career/cardStatus';
import {
  creditMatch,
  openStint,
  tickWeek,
  creditPay,
  join as joinLedger,
  leave as leaveLedger,
  type LedgerRole,
} from '../engine/career/ledger';
import { ledgerOf } from '../engine/career/ledgerAccess';
import { moodSpread } from '../engine/career/personality';
import { assignmentOf, weekOff, type AssignmentChoice } from '../engine/career/assignment';
import { moodInsulation } from '../engine/economy/perks';
import {
  askingCut,
  bookOf,
  cutOf,
  clientWouldWalk,
  endRepresentation,
  managerWouldDrop,
  presenceAt,
  representativeOf,
  roadCost,
  splitNote,
  travelBill,
  wouldCourt,
} from '../engine/career/representation';
import {
  applySanction,
  disciplineOf,
  sanctionFor,
  suspensionLine,
  tickSuspension,
} from '../engine/career/discipline';
import { totalsFor } from '../engine/career/ledger';
import {
  afterLine,
  familyLine,
  memorialShow,
  scaleForGenerosity,
  settleMemorial,
  returnsFor,
  rollCharityNight,
  worthAMemorial,
} from '../engine/world/impromptu';
import {
  foundPromotion,
  foundingRoster,
  openingLine,
  rollOpening,
} from '../engine/world/newPromotions';
import {
  asSecondGeneration,
  debutAge as lineageDebutAge,
  debutLine as lineageDebutLine,
  inheritedTowns,
  rollParent,
  weeklyLineage,
} from '../engine/career/lineage';
import {
  wantsOut,
  canBeSigned,
  refusalCost,
  exitTerms,
} from '../engine/economy/termination';

/**
 * A manager by id, from the standing pool or from your own roster.
 *
 * One lookup so no caller has to know which kind it got. A wrestler in a suit
 * is a Manager record like any other; the only difference is that his fee is
 * zero, because he is already on the payroll.
 */
// findManager moved to ./storeHelpers.ts
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
} from '../engine/sim/referees';
import { NETWORK_SHOWS } from '../data/networkShows';
import {
  rollApproaches,
  resolveOffer,
  type PoachingResponse,
} from '../engine/world/poaching';
import { deriveCareerStatus } from '../engine/career/status';
import { rollRetirement, rollComeback, retire, unretire, RETIREMENT_REASON_TEXT } from '../engine/career/retirement';
import { agePool } from '../engine/world/freeAgents';
import { rollDeath, DEATH_CAUSE_TEXT } from '../engine/career/mortality';
import { backstageAttackChance, backstageDamage, backstageLine, muggingLine } from '../engine/sim/ringside';
import { annualInductions } from '../engine/career/hallOfFame';
import { decideAwards, awardEffects, emptyYearRecord, noteMatch, noteTeamResult } from '../engine/career/awards';
import { rollIncident, type Incident } from '../engine/sim/incidents';
import {
  rollCasualty,
  stoppageCasualty,
  injuryFrom,
  severityOf,
  aggravate,
  healPerWeek,
  weeksFromGrade,
  fitToWork,
  aggravationLine,
  outFor,
  type Casualty,
} from '../engine/sim/casualties';
import { computeBuys, computeBuyRevenue, isInMonth, weekLabel } from '../engine/world/calendar';
import {
  bigShowName,
  houseShowRevenueMultiplier,
  houseShowsThisWeek,
  isBigShowWeek,
  recoveryMultiplier,
  scheduleOf,
  showsThisWeek,
  type PPVCadence,
} from '../engine/world/schedule';
import type { Day } from '../engine/world/calendar';
import { resolvePromo, promoIsValid, promoShowContribution, promoEnergyCost } from '../engine/sim/promo';
import { type PromoTopicId } from '../data/promoTopics';
import {
  broadcastBreaches,
  sponsorBreaches,
  broadcastOffer,
  availableSponsors,
  weeklyNetworkFee,
  weeklySponsorIncome,
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
} from '../engine/world/territories';
import { businessCapacity, graduateClass, graduateCount, workingPopulation } from '../engine/world/academy';
import { walkOnIntake, walkOnLine } from '../engine/world/walkOns';
import { managerIntake } from '../engine/world/managerTalent';
import { rollForNickname } from '../engine/generate/nickname';
import { rollWeeklyEvent, recordFired } from '../engine/events/scheduler';
import { CREATIVE_EVENTS } from '../data/events';
import type { Passing, Wrestler } from '../engine/types';
import { clamp, pick, chance, randInt } from '../engine/rng';
import { defaultWorldSettings } from '../engine/world/settings';
import {
  stipulationById,
  stipulationRequirementsMet,
  stipulationConsequence,
  stipulationConsequenceLine,
} from '../data/stipulations';
import { isNonDecisiveFinish } from '../engine/sim/finish';
import { simulateMatch, type SimParticipant } from '../engine/sim/simulateMatch';
import { houseStyleRatingBonus, violenceTolerancePenalty } from '../engine/sim/houseStyle';
import { driftFanTaste, styleRunShare } from '../engine/world/fanTaste';
import { computeAftermath, applyAftermath, restWeek } from '../engine/sim/aftermath';
import { resolveDarkMatch } from '../engine/sim/darkMatch';
import { runRivalShow, canWork, type RivalShow } from '../engine/world/rivalBooking';
import {
  openingOffer,
  respondToOffer,
  coopAppetite,
  moodFor,
  moodLine,
  supershowPurse,
} from '../engine/world/supershow';
import {
  willEnter,
  slotsPerPromotion,
  cupPurse,
  fieldIsBigEnough,
  CUP_MONTH,
} from '../engine/world/cup';
import {
  haulageById,
  productionEffects,
  productionUpkeepPerShow,
  equipmentSafetyEffects,
} from '../engine/economy/production';
import { StatementBuilder } from '../engine/economy/statement';
import { rollBroadcastDropout, broadcastDropoutLine } from '../engine/sim/broadcast';
import { SUPERSHOW_SEASONS } from '../engine/world/supershow';
import { rivalWeek, shouldFold, shouldTrimPayroll } from '../engine/world/rivalEconomy';
import { publishPositions } from '../engine/world/publication';
import { generateFanReaction, crowdVerdict } from '../engine/world/fanReaction';
import { FAN_HANDLES } from '../data/fanVoices';
import { Cap, pronounsFor } from '../engine/career/pronouns';
import {
  recordTeamResult,
  disbandBrokenTeams,
  formTeams,
} from '../engine/world/tagTeams';
import {
  resolveTitleOutcomes,
  matchTitlePrestige,
  eligibleTitles,
  signatureStipulationFit,
} from '../engine/sim/titleMatch';
import type { ChampionInjuryChoice } from '../engine/world/titleDefence';
import {
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
  wearAsset,
  assetEffectiveness,
  assetHasFailed,
} from '../engine/economy/showBudget';
import {
  idleWearUnit,
  useWearUnit,
  unitHasFailed,
  usableUnitsForFamily,
  aggregateBreakChance,
  spectacleBonus,
  type OwnedPropUnit,
} from '../engine/economy/matchProps';
import { tierById as propTierById, type MatchPropTier } from '../data/matchProps';
import { VENUES, venueById, fallbackVenue } from '../data/venues';
import { decayGrudges, grudgeAgainst } from '../engine/world/grudges';
import {
  compassionateLeave,
  leaveLine,
  blameLine,
  mostRecentDeath,
  negligenceOf,
  officeShare,
  wasNegligent,
  roomLine,
  roomMoraleCost,
  stillHeldAgainstUs,
  tickLeave,
  wontRenewLine,
  wontWorkForUs,
} from '../engine/career/onOurWatch';
import { resolveVignette, tickVignette } from '../engine/career/vignette';
import {
  handsInNotice,
  noticeLine,
  recordInjury,
  resolveInjuryCall,
  stanceOn,
} from '../engine/career/theBody';
import {
  concessionsPerHead,
  houseTakeOfGate,
  houseTakeOfMerch,
  openAirWeather,
  productionInRoom,
  venueAtmosphereModifier,
} from '../engine/economy/venue';
import { nightAtTheTables } from '../engine/economy/stands';
import {
  localCeiling,
  localTopTicket,
  residencyExposure,
  residencyHaulageCost,
  residencyHomeById,
  residencyMerchMultiplier,
  residencyOverhead,
  scaleExposure,
  tickResidency,
  venueForHome,
} from '../engine/economy/residency';
import { productionAssetById, showExtraById } from '../data/production';
import {
  expireContracts,
  weeklyWageBill,
  createStandardContract,
  askingRate,
  renewalRate,
  splitRate,
  desiredContractWeeks,
} from '../engine/economy/contracts';
import {
  driftEgo,
  targetEgo,
  clauseUpkeep,
  blocksDeckStacking,
} from '../engine/career/ego';
import { perkUpkeep } from '../engine/economy/perks';
import type { PerkId } from '../data/perks';
import {
  computeWeeklyExpenses,
  computeShowExpenseSplit,
  computeAppearanceFee,
  computeDownsideGuarantee,
} from '../engine/economy/payroll';
import { nightModifiers, memoriamFor, cancellationCost } from '../engine/world/seasons';
import type { WeatherCallOptionId } from '../data/weatherCalls';
import {
  weatherCallFrom,
  resolveWeatherCall,
  hasCallLines,
} from '../engine/world/weatherCall';
import { rollCatastrophe, forcedSevereWeatherRoll } from '../engine/world/catastrophe';
import { noShowCallFrom, resolveNoShowCall, type NoShowChoiceId } from '../engine/world/noShowCall';
import { RIVAL_WEATHER_CATASTROPHE_LINES, RIVAL_NO_SHOW_CATASTROPHE_LINES } from '../data/misfortunes';
import type { TitleMemorialChoiceId } from '../engine/world/titleMemorial';
import type { RivalMoveChoiceId } from '../engine/world/rivalMove';
import type { ConfrontationCallChoiceId } from '../engine/world/confrontationCall';
import type { LoanTier } from '../engine/economy/loan';
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
// Exported as a live binding: slice files that only ever *read* the current
// stream (never reseed it — only newGame/newGameFromPlan/continueGame/
// importSaveFile do that, and those stay in this file) can import `rng`
// directly and always see the current value, the same way a function defined
// right here would.
export let rng: Rng = rngFromSeed(defaultWorldSettings().seed);

// §12.5 route 3 — "two wrestlers meeting three times in a short span".
const MEETINGS_TO_FORM_RIVALRY = 3;
// Scales a good match's rating into starting heat. Tuned so three four-star
// meetings open a feud around 30 heat — interested, a long way from a grudge.
const ORGANIC_RIVALRY_HEAT_SCALE = 0.25;

export interface GameStore {
  world: World | null;
  newGame: (settings?: WorldSettings) => void;
  /**
   * The new-game screen's alternative to `newGame` — one or more promotions
   * exactly as the player named and staffed (or imported) them, rather than
   * the single hand-authored company `newGame` always builds. See
   * `state/world.ts`'s `NewGamePlan`.
   */
  newGameFromPlan: (plan: NewGamePlan, settings?: WorldSettings) => void;
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
  /** Cast a dark match slot — sits alongside the card, never airs. */
  setDarkMatchParticipant: (slot: number, wrestlerId: Id, side: number) => void;
  removeDarkMatchParticipant: (slot: number, wrestlerId: Id) => void;
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
  /** Which owned match-prop units (ladders, a cage, tables) are in play tonight. See data/matchProps.ts. */
  setSegmentGearUnits: (slot: number, unitIds: Id[]) => void;
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
  /** Pick one wrestler off a folded promotion's roster — signs them directly, or opens a bidding war if a rival wants them too. */
  pickFoldedWrestler: (wrestlerId: Id) => void;
  /** Done browsing the folded roster — whoever is left goes to free agency. */
  finishFoldPicking: () => void;
  /** Take a tier of the pending loan offer, or turn it down with `null`. */
  answerLoanOffer: (tier: LoanTier | null) => void;
  /** Answer a rival's blind bulk buyout offer — who it costs is not known until this is "yes". */
  answerBuyoutOffer: (accept: boolean) => void;
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
  /** Stock a merch line or open a concession stand for the show. */
  toggleStand: (standId: Id) => void;
  /**
   * Take a room for a season. Cheaper rent, no travel, no truck, and a town
   * that tires of you. See engine/economy/residency.ts.
   */
  signResidency: (homeId: Id, weeks: number) => void;
  /** Buy your way out of the term early. It is not cheap. */
  breakResidency: () => void;
  /** Where you are running this week. */
  setTerritory: (territoryId: Id) => void;
  /** Climb one rung of the production ladder. The ladder decides if you can. */
  buyRung: (rungId: Id) => void;
  /** Trade up to the next truck. One at a time, upwards only. */
  buyHaulage: (haulageId: Id) => void;
  /** Trade up to the next card-size tier. One at a time, upwards only. */
  buyCardSizeTier: (tierId: Id) => void;
  setTicketPrice: (price: number) => void;
  toggleShowExtra: (extraId: Id) => void;
  buyProductionAsset: (assetId: Id) => void;
  /** One more unit of match hardware — a ladder, a cage panel set, a table. Gated on the family's maxUnitsOwned. */
  buyPropUnit: (tierId: Id) => void;
  /** Put a specific owned unit back to full condition, for a fraction of its tier's cost. */
  repairPropUnit: (unitId: Id) => void;
  // Ringside
  /**
   * Put somebody in a corner. `seat` 0 is the mouthpiece, 1 is the muscle —
   * two is the most a corner holds, and it is the pair that makes the
   * combination possible (see sim/ringside.ts muggingChance).
   */
  setSegmentManager: (slot: number, managerId: Id | null, forSide: number, seat?: number) => void;
  setSegmentReferee: (slot: number, refereeId: Id | null) => void;
  setSegmentGuestReferee: (slot: number, wrestlerId: Id | null) => void;
  /** The official who works every match nobody else was named for. */
  setDefaultReferee: (refereeId: Id | null) => void;
  // The pattern — what the company runs and how often. See
  // engine/world/schedule.ts.
  /** How many nights a week. 1 to `scheduleMaxShows`. */
  setShowsPerWeek: (count: number) => void;
  /** How often the big one comes round. */
  setPPVCadence: (cadence: PPVCadence) => void;
  /** Name a show. A show with a name is a show. */
  renameShow: (showId: string, name: string) => void;
  /** Move a show to a different night. */
  setShowDay: (showId: string, day: Day) => void;
  /**
   * Click a night on the calendar: run a show on that weekday, or stop
   * running one. The schedule is a weekly pattern, so this sets every
   * Tuesday rather than one particular Tuesday.
   */
  toggleShowOnDay: (day: Day) => void;
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
  /** A booked wrestler never showed up. Same "answering runs the show" shape as the weather call. */
  answerNoShowCall: (choice: NoShowChoiceId) => void;
  /** A rival made a signing worth reacting to. Non-blocking — answer it whenever, or never. */
  answerRivalMove: (choice: RivalMoveChoiceId) => void;
  /** A confrontation went physical — let the injury land, or pull them apart. */
  answerConfrontationCall: (choice: ConfrontationCallChoiceId) => void;
  /**
   * Take the invitation to a bidding war, or stay out of it. Staying out is
   * final: there is no bidding on somebody you have already told the room you
   * are not bidding on.
   */
  /**
   * Put something in somebody's deal, or take it back out. Only on people you
   * already employ, and only what they are eligible for — see
   * engine/economy/perks.ts.
   */
  setPerk: (wrestlerId: Id, perkId: PerkId, on: boolean) => { ok: boolean; reason: string | null };
  answerBiddingInvitation: (join: boolean) => void;
  /** Pay the entry fee for the Crucible, or sit the year out. */
  answerCupEntry: (enter: boolean) => void;
  /** Clear the tournament write-up once it has been read. */
  dismissCupResult: () => void;
  /** Put a joint PPV to a rival yourself, rather than waiting to be asked (§16). */
  proposeSupershow: (partnerId: Id) => void;
  /** Sign the joint PPV a rival has offered, or turn them down (§16). */
  answerSupershow: (accept: boolean) => void;
  /**
   * Strike a pairing off the signed joint card (§16). The other office has
   * already struck what it would not do; this is the player's half of "both
   * must approve every match".
   */
  strikeSupershowMatch: (matchId: string) => void;
  /** Sign the card off and work the show. */
  runSupershowNight: () => void;
  /** Clear the joint-show write-up once it has been read. */
  dismissSupershowResult: () => void;
  /** Your one offer. Submitting it settles the auction. */
  submitBid: (offer: Omit<ContractBid, 'promotionId' | 'promotionName'>) => void;
  /** Clear the result once it has been read. */
  dismissBiddingResult: () => void;
  /**
   * Decide what happens to a hurt champion's belt. `interimHolderId` is only
   * read for the 'interim' choice — who the booker is putting the interim
   * version on.
   */
  answerChampionCall: (choice: ChampionInjuryChoice, interimHolderId?: Id) => void;
  /** A champion died holding one of this promotion's belts — vacate, name a successor, or retire it. */
  answerTitleMemorial: (choice: TitleMemorialChoiceId) => void;
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
  /**
   * Give a feud a name and start running it as a story. Creates the rivalry
   * if these two have not been in one — booking a story is allowed to be the
   * thing that starts the feud.
   */
  startStoryline: (participantIds: Id[], name?: string) => { ok: boolean; reason: string | null };
  /**
   * Point the camera at a fight that is already real. See sim/rivalry.ts —
   * it converts backstage animosity into crowd heat and inflames what is
   * left, which is the only way a shoot ever draws money.
   */
  leanIntoShoot: (rivalryId: Id) => { ok: boolean; reason: string | null };
  /** Answer a rival's approach. Every answer costs something — see poaching.ts. */
  answerApproach: (offerId: Id, response: PoachingResponse) => { ok: boolean; reason: string | null };
  renameStoryline: (storylineId: Id, name: string) => void;
  /** Walk away from an arc. It counts as fizzled, because it is. */
  abandonStoryline: (storylineId: Id) => void;
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
    change: { name?: string; nickname?: string | null; photoDataUrl?: string | null },
  ) => { ok: boolean; reason: string | null };
  /**
   * Attach (or clear) a real photo on its own, with none of repackageWrestler's
   * other effects — no name check, no gimmickFreshness reset. See
   * ui/components/BatchPhotoImport.tsx.
   */
  setWrestlerPhoto: (wrestlerId: Id, photoDataUrl: string | null) => void;
  /** Put two of your people together as a tag team. Empty name = let the announcers pick. */
  formTagTeam: (aId: Id, bId: Id, name?: string) => void;
  /** Split a team up. Any tag belts they were carrying go vacant. */
  disbandTagTeam: (teamId: Id) => void;
  /**
   * Pin what somebody does with a week they are not booked for, or hand them
   * back to the office with 'auto'. See career/assignment.ts.
   */
  setAssignment: (wrestlerId: Id, choice: AssignmentChoice) => void;
  /** Pay to put a worn rig back to new. */
  repairProductionAsset: (assetId: Id) => void;
  /** A genuine last resort — only works while an active loan means things are already bad. See economy/fireSale.ts. */
  sellProductionAsset: (assetId: Id) => void;
  /** Meet a renewal demand in full, or refuse it and risk them walking. */
  answerRenewal: (wrestlerId: Id, accept: boolean) => void;
  /** Node 1 of the renewal window: does the promotion even want them back? See RenewalTalk. */
  answerRenewalInterest: (wrestlerId: Id, interested: boolean) => void;
  /** Node 2: negotiate, let them play out the string, or throw it open to the market. */
  answerRenewalWish: (wrestlerId: Id, choice: 'stay' | 'leave' | 'explore') => void;
  /** Node 1 of the signing meeting: the booker picks (or keeps) the new signee's gimmick. See SigningTalk. */
  chooseSigningGimmick: (wrestlerId: Id, gimmickId: Id) => void;
  /** Node 2 of the signing meeting: debut them tonight, or run a paid vignette package first. See career/vignette.ts. */
  chooseSigningDebut: (wrestlerId: Id, choice: 'now' | 'vignette') => void;
  /** Node 3, "no": keep them solo, closing the signing meeting without a pairing. */
  declineSigningPairing: (wrestlerId: Id) => void;
  /** Node 2, "yes": form a tag team or faction under a GroupGimmick's shared identity. */
  formSigningGroup: (wrestlerId: Id, groupGimmickId: Id, partnerIds: Id[]) => void;
  /** The forced cold-meeting's first node: try a new direction, or cut them loose. See ColdMeeting. */
  answerColdMeeting: (wrestlerId: Id, choice: 'regimmick' | 'release') => void;
  /** Node 2, only reached via "try a new direction": the relaunch, same picker as the signing meeting. */
  chooseColdMeetingGimmick: (wrestlerId: Id, gimmickId: Id) => void;
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
// dropFromCard .. couldTurnUp moved to ./storeHelpers.ts

export const useGameStore = create<GameStore>()(
  immer((set, get, api) => ({
    world: null,

    // Actions that don't need to see the whole weekly-resolution loop live
    // in their own files under state/slices/ — see the doc comment at the
    // top of storeHelpers.ts for why the split happened and what stayed
    // here. Everything below this block (through resolveWeek) is unchanged.
    ...createCardBuilderSlice(set, get, api),
    ...createEventsSlice(set, get, api),
    ...createTagTeamsAndIdentitySlice(set, get, api),
    ...createBusinessDealsSlice(set, get, api),
    ...createShowAndProductionSlice(set, get, api),
    ...createOfficialsAndScheduleSlice(set, get, api),
    ...createRosterAndContractsSlice(set, get, api),
    ...createStorylinesSlice(set, get, api),
    ...createTitlesSlice(set, get, api),
    ...createCupSlice(set, get, api),
    ...createSupershowSlice(set, get, api),

    newGame: (settings = defaultWorldSettings()) => {
      rng = rngFromSeed(settings.seed);
      const world = createInitialWorld(rng, settings);
      set((state) => {
        state.world = world;
      });
      saveGame(world, rng.state?.() ?? 0);
    },

    newGameFromPlan: (plan, settings = defaultWorldSettings()) => {
      rng = rngFromSeed(settings.seed);
      const world = createInitialWorld(rng, settings, plan);
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
          // Rolls what the business believes about them, as against what is true.
          settings: world.settings,
          currentYear: world.settings.startingYear + Math.floor(world.week / 52),
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
            wantsWeeks: desiredContractWeeks(wrestler, world.settings),
            weeksUnsigned: 0,
          });
          added += 1;
        });
      });

      const world = get().world;
      if (world) saveGame(world, rng.state?.() ?? 0);
      return { added, problems };
    },


    resolveWeek: () => {
      set((state) => {
        const world = state.world;
        // Two ways a save ends: the bank, and the owner.
        if (!world || world.folded || world.fired) return;

        // A couple of times a year, across the whole business — see
        // catastrophe.ts. Rolled once, here, rather than at either point it
        // gets used below, so the draw happens on the same path regardless
        // of which branch reads the result. Skipped while a call from an
        // earlier roll is still sitting there unanswered, so pressing
        // "resolve" again while blocked can't roll a second catastrophe on
        // top of the first.
        //
        // Drawn from its own per-week seed rather than the shared rng
        // stream — the CLAUDE.md trap: this check runs on every single
        // week, including the ~96% where nothing happens, and consuming the
        // shared stream that often would shift every other seeded roll in
        // the game by one draw, breaking unrelated tests that pin a seed.
        const catastropheAlreadyPending =
          world.pendingWeatherCall?.week === world.week || world.pendingNoShowCall?.week === world.week;
        const catastrophe = catastropheAlreadyPending
          ? null
          : rollCatastrophe(
              rngFromSeed(`${world.settings.seed}-catastrophe-${world.week}`),
              [world.promotion.id, ...world.rivals.map((r) => r.id)],
              world.settings,
            );

        // The books for the week, opened before a penny moves. Every place
        // money changes hands below reports into this, so the statement is a
        // record of what happened rather than a second guess at it.
        const books = new StatementBuilder(world.week, world.promotion.bankBalance);

        // A folded roster left open from a prior week — the booker gets the
        // rest of that week to pick through it, then the business moves on.
        // Whoever is left goes to free agency, same as picking nobody.
        if (world.pendingFoldPicks && world.pendingFoldPicks.openedWeek < world.week) finishFoldPicking(world);

        // A loan offer nobody answered lapses after a week. The bank does
        // not chase — it just stops waiting.
        expireStaleLoanOffer(world);

        // Same one-week grace for a buyout offer nobody answered.
        expireStaleBuyoutOffer(world);

        // An auction the booker never answered goes ahead without them. The
        // room does not hold a star off the market because somebody did not
        // open a dialog — and leaving one open forever would be a way to
        // freeze somebody out of the business entirely.
        if (world.pendingBiddingWar) settleBiddingWar(world, rng, null, books);
        const wrestlerById = new Map(Object.values(world.wrestlers).map((w) => [w.id, w]));

        // Books. Where everybody is, what they have been paid, and how long
        // they have been there.
        //
        // Reconciled once a week against `promotionId` rather than hooked into
        // each of the ten places a roster can change — signings, releases,
        // auctions, a company folding, a rival's approach, a secret signing.
        // Patching those individually would have left holes, and a career
        // page with holes in it is worse than no career page.
        for (const person of Object.values(world.wrestlers)) {
          if (person.deceased) continue;
          const ledger = ledgerOf(person);
          const open = openStint(ledger);
          const employer =
            person.promotionId === null
              ? null
              : person.promotionId === world.promotion.id
                ? world.promotion
                : (world.rivals.find((r) => r.id === person.promotionId) ?? null);
          const role: LedgerRole = person.role === 'manager' ? 'manager' : 'wrestler';

          if (!employer) {
            // Out of work. The spell is over; the record of it is not.
            if (open) leaveLedger(ledger, world.week);
          } else if (!open || open.promotionId !== employer.id || open.role !== role) {
            // Somewhere new, or the same place in a different job. A wrestler
            // who turns manager starts a new spell so the years already
            // banked in the ring stay banked as ring years.
            joinLedger(ledger, employer.id, employer.name, role, world.week);
          }
          tickWeek(ledger);
        }



        // Tonight is either television or the show everything has been built
        // towards. Decided here, once, and read by everything below.
        const schedule = scheduleOf(world.promotion, world.settings);
        const isPPV = isBigShowWeek(world.week, schedule, world.settings);
        const ppvName = bigShowName(world.week, schedule, world.settings);

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
        /**
         * Who had a wrestler counting their match because the office had
         * nobody, and who has already been annoyed about it tonight.
         *
         * The room's grievance here is with the office for not having an
         * official, and that is one grievance however many matches it
         * spoiled. Charged per match it compounded: measured on a card of six
         * with the only referee hurt, every wrestler on the show took it in
         * every match they worked, which was a third of a locker room's
         * morale a week and none of it said out loud.
         */
        const draftedIntoTheShirt = new Set<Id>();
        const annoyedByTheDraft = new Set<Id>();
        /** Officials who worked tonight, and how many calls each one blew. */
        const refereesUsed = new Set<Id>();
        const refereeMissesTonight = new Map<Id, number>();
        const segmentPopAvgs: { stars: number; avgPopularity: number }[] = [];
        const violenceLevels: number[] = [];
        // Every competitor's style tonight, one entry per appearance — what
        // engine/world/fanTaste.ts's driftFanTaste needs to know what the
        // crowd was actually shown. Consumed after the card resolves, same
        // pattern as violenceLevels feeding hardcoreSaturation below.
        const tonightsStyles: WrestlingStyle[] = [];
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

        // The catastrophe roll landed on this promotion's own show tonight,
        // and it is weather — force the same severe call the ordinary
        // per-week forecast would produce, so everything below (carried,
        // resolveWeatherCall, the DialogueCard in BookingScreen) handles it
        // exactly as it always has. A promotion elsewhere in the business is
        // handled later, at that rival's own show — see the rivalShows loop.
        if (catastrophe?.kind === 'weather' && catastrophe.targetPromotionId === world.promotion.id) {
          const forcedRoll = forcedSevereWeatherRoll(rng);
          if (forcedRoll) {
            const forcedCall = weatherCallFrom(rng, forcedRoll, world.week, territory.id, territory.name, world.settings);
            if (forcedCall) {
              world.pendingWeatherCall = forcedCall;
              world.weatherChoice = null;
            }
          }
        }

        // Same idea for a no-show: the catastrophe landed on tonight's card
        // specifically, and it is somebody simply never turning up. Picked
        // from whoever is actually booked, so pulling them means something.
        if (
          catastrophe?.kind === 'noShow' &&
          catastrophe.targetPromotionId === world.promotion.id &&
          !world.pendingNoShowCall
        ) {
          const bookedIds = [...new Set(world.currentCard.flatMap((s) => s.participants.map((p) => p.wrestlerId)))];
          const bookedWrestlers = bookedIds
            .map((id) => world.wrestlers[id])
            .filter((w): w is Wrestler => Boolean(w));
          if (bookedWrestlers.length > 0) {
            const absent = pick(rng, bookedWrestlers);
            const candidates = world.promotion.rosterIds
              .map((id) => world.wrestlers[id])
              .filter(
                (w): w is Wrestler =>
                  Boolean(w) &&
                  w!.id !== absent.id &&
                  !bookedIds.includes(w!.id) &&
                  canWork(w!, world.settings, world.week),
              );
            world.pendingNoShowCall = noShowCallFrom(rng, world.week, world.promotion.id, absent, candidates, world.settings);
            world.noShowChoice = null;
            return; // nothing resolves until the booker answers, same as weather
          }
        }

        // A no-show call from an earlier press still sitting unanswered
        // holds the week open the same way an unanswered weather call does.
        if (world.pendingNoShowCall?.week === world.week && !world.noShowChoice) return;

        // Answered — apply it to tonight's card before anything else reads
        // who is actually in the building. Direct card surgery rather than
        // feeding into the ordinary per-week misfortune/standIns loop
        // further down: that loop would re-roll its own replacement, which
        // could hand out a different name than the one the booker was just
        // shown and answered against.
        if (world.pendingNoShowCall?.week === world.week && world.noShowChoice) {
          const call = world.pendingNoShowCall;
          const outcome = resolveNoShowCall(call, world.noShowChoice, world.settings);
          const segmentIndex = world.currentCard.findIndex((s) =>
            s.participants.some((p) => p.wrestlerId === call.absentId),
          );
          if (segmentIndex !== -1) {
            if (outcome.pullSegment) {
              world.currentCard = world.currentCard.filter((_s, i) => i !== segmentIndex);
            } else if (outcome.replacementId) {
              const role = world.currentCard[segmentIndex]!.participants.find((p) => p.wrestlerId === call.absentId);
              if (role) role.wrestlerId = outcome.replacementId;
            } else {
              world.currentCard[segmentIndex]!.participants = world.currentCard[segmentIndex]!.participants.filter(
                (p) => p.wrestlerId !== call.absentId,
              );
            }
          }
          world.weeklyNews.push(wire('misfortune', outcome.line, world.week, 'lead'));
          const absentWrestler = world.wrestlers[call.absentId];
          if (absentWrestler) {
            const file = disciplineOf(absentWrestler);
            const sanction = sanctionFor(
              file,
              'noShow',
              absentWrestler.contract?.weeklyRate ?? world.settings.contractBaseWeeklyRate,
              world.settings,
            );
            applySanction(file, 'noShow', sanction, world.week);
          }
          world.pendingNoShowCall = null;
          world.noShowChoice = null;
        }

        // A severe forecast is the one thing in the game that stops the
        // clock, and it stops it because running the show *is* the decision.
        // The roll is carried on the pending call rather than re-rolled when
        // the player answers — their choice must not be able to change
        // whether the storm was ever going to arrive.
        const carried = world.pendingWeatherCall?.week === world.week ? world.pendingWeatherCall : null;
        const rolled = carried
          ? carriedNight(world.week, carried)
          : nightModifiers(rng, world.week, territory, world.settings);

        // The building is picked here rather than down at settlement because
        // with nothing over the crowd the weather is not a modifier on the
        // night, it *is* the night — and that has to be known before anything
        // else reads the draw.
        // A residency fixes the room for the term. You signed for this one.
        const residentHome = world.residency ? residencyHomeById(world.residency.homeId) : undefined;
        const venue =
          (residentHome
            ? venueForHome(residentHome, world.settings)
            : venueById(world.showSetup.venueId)) ?? fallbackVenue();
        const open = openAirWeather(
          rolled.draw,
          rolled.cancelled,
          rolled.weather?.severity ?? null,
          venue,
          world.settings,
        );
        const night = { ...rolled, draw: open.draw, cancelled: open.cancelled };

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
        // Saturation is deliberately NOT folded in here. It thins the town, not
        // the national audience — a residency's crowd is capped by how many
        // people in one small city will ever come, and that ceiling is applied
        // to the house itself further down. Putting it on the draw would have
        // shrunk a figure that is already irrelevant once the cap bites.
        const nightDraw = (callOutcome ? callOutcome.draw : night.draw) * (memoriam ? memoriam.draw : 1);
        const showIsOff = callOutcome ? !callOutcome.ran : night.cancelled;

        // ---- the week everybody else had ---------------------------------
        // Rolled before the card resolves, because some of it decides who is
        // actually in the building. Most weeks this is empty.
        const misfortunes: Misfortune[] = [];
        const misfortuneNews: { text: string; lead: boolean }[] = [];
        // Shared across the whole roster this week so two people who draw
        // the same misfortune definition don't also read the identical
        // flavour line — see misfortune.ts's rollMisfortune doc comment.
        const usedMisfortuneLines = new Set<string>();
        for (const person of world.promotion.rosterIds.map((id) => world.wrestlers[id])) {
          if (!person) continue;
          // Ordinary bad luck first; the day job only gets a look if nothing
          // else already took this person out of the building tonight.
          const misfortune =
            rollMisfortune(rng, person, world.settings, usedMisfortuneLines) ??
            rollDayJobAbsence(person, world.week, world.settings, usedMisfortuneLines);
          if (!misfortune) continue;
          misfortunes.push(misfortune);

          if (misfortune.kind !== 'absence') {
            person.injury = injuryFromMisfortune(misfortune, world.week, person.injury, world.settings);
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
        // keeps you out just as surely as a blown tire does.
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
                    Boolean(w) && !bookedNow.has(w!.id) && !missingTonight.has(w!.id) && canWork(w!, world.settings, world.week),
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
        const saidTonight = new Map<string, number>();

        // ---- what happened in the stories tonight ------------------------
        // Collected from the matches, the talking and the confrontations
        // alike, then folded into the arcs in one pass after the show. Beats
        // are reactions to results the simulation already produced — nothing
        // here decides anything.
        const tonightsBeats: { participantIds: Id[]; kind: StorylineBeatKind; text: string }[] = [];

        /**
         * Everybody who went out there already hurt, with the booker's
         * blessing, and who was in the ring with them. Collected during the
         * card and settled once after it — a man in two matches on the same
         * night took one gamble, not two.
         *
         * The other names are carried because of what happens if he does not
         * get up: everybody who was out there with him goes home for a month.
         */
        const workedHurtTonight = new Map<Id, { others: Set<Id>; violence: number }>();

        /**
         * Somebody has died. One path for it, wherever it came from.
         *
         * This used to live inline in the annual mortality roll, which meant
         * the ring could not kill anybody without either duplicating seventy
         * lines or quietly skipping the memorial, the tribute and the grief.
         * `howItHappened` is the sentence the wire prints — §0's rule that a
         * death says how it happened is enforced by making it an argument.
         *
         * `ourDoing` is set when this company caused it — a man sent out on an
         * injury the office signed off. Not optional: every caller has to say
         * which kind of death this was, because the two are not the same event
         * and the business does not treat them as one. See career/onOurWatch.
         */
        const passAway = (
          person: Wrestler,
          passing: Passing,
          howItHappened: string,
          ourDoing: { alsoInTheRing: readonly Id[]; blamed: Wrestler | null } | null,
        ) => {
          person.deceased = passing;
          world.memoriam.push(passing);
          world.thisYear.passings.push(passing);
          world.weeklyNews.push(deathLine(person.name, person.age, howItHappened, world.week));
          // The business runs a tribute for its own. Applied rather than
          // offered — a promotion does not decide whether to ring ten
          // bells for somebody who was on the card last week.
          if (world.promotion.rosterIds.includes(person.id)) {
            world.pendingMemoriam = memoriamFor(person.id, person.name, world.promotion.name, world.settings);
          }

          // A belt left with a dead champion is the one thing a tribute show
          // does not settle on its own — see titleMemorial.ts. Only this
          // company's own belts: a rival's championship is a rival's
          // decision, not the player's.
          const heldNow = world.titles.find(
            (t) => t.promotionId === world.promotion.id && !t.vacant && t.currentHolderIds.includes(person.id),
          );
          if (heldNow && !world.pendingTitleMemorial) {
            world.pendingTitleMemorial = {
              week: world.week,
              titleId: heldNow.id,
              titleName: heldNow.name,
              championId: person.id,
              championName: person.name,
            };
          }

          // ...and a night that would not otherwise have existed. The
          // tribute above is a modifier on the show that was happening
          // anyway; this is the company closing the doors for him, on a
          // spare night, named after him. Run for anybody who gave this
          // company real time, not only for whoever was under contract
          // the day they died. See world/impromptu.ts.
          const tenure = totalsFor(ledgerOf(person), world.promotion.id);
          const heldOneHere = world.titles.some(
            (t) =>
              t.promotionId === world.promotion.id &&
              t.history.some((reign) => reign.holderIds.includes(person.id)),
          );
          // A man who died in your ring gets the show whoever he was. The
          // test of whether he earned one is for the deaths the company did
          // not cause; there is no version of this where the company that
          // killed him decides he was not worth closing the doors for.
          if (
            ourDoing ||
            worthAMemorial(
              {
                onOurRoster: world.promotion.rosterIds.includes(person.id),
                weeksWithUs: tenure.weeks,
                wasAChampionHere: heldOneHere,
                hallOfFamer: person.careerStatus === 'hallOfFamer',
              },
              world.settings,
            )
          ) {
            const show = memorialShow(
              rng,
              person.id,
              person.name,
              world.week + 1,
              scheduleOf(world.promotion, world.settings).shows.map((sh) => sh.day),
              world.promotion.name,
            );
            world.impromptuShows.push(show);
            world.weeklyNews.push(wire('houseShow', show.announcement, world.week, 'normal'));
          }
          // §0: a death happens to the people left as well. Until now the
          // memorial wall recorded it and the locker room did not notice.
          const felt = bereavements(person, Object.values(world.wrestlers), world.relationships, world.settings);
          for (const grief of felt) {
            const mourner = world.wrestlers[grief.wrestlerId];
            if (!mourner) continue;
            mourner.morale = clampMorale(mourner.morale + grief.moraleDelta, world.settings);
            mourner.moraleNote = grief.note;
          }
          const said = mourningLine(felt);
          if (said) world.weeklyNews.push(wire('death', said, world.week, 'normal'));

          leaveTheBusiness(world, person.id, 'died');

          if (!ourDoing) return;

          // ---- and then the part that is about the company ----------------
          // Everything above happens whoever killed him. What follows only
          // happens when it was us. See career/onOurWatch.ts.
          // How much of it lands on the company. Full when the office's
          // decision was the whole story; a fraction when the room saw whose
          // hands it was. Never nothing — it still said he could work.
          const ours = officeShare(Boolean(ourDoing.blamed), world.settings);
          world.promotion.deathsOnOurWatch = [
            ...(world.promotion.deathsOnOurWatch ?? []),
            { wrestlerId: person.id, name: person.name, week: world.week, blame: ours },
          ];

          // The whole room, not only the people who knew him. What they are
          // reacting to is the office, not the man — and proportionally less
          // of it when they have somebody else to be angry at.
          for (const id of world.promotion.rosterIds) {
            const member = world.wrestlers[id];
            if (!member || member.deceased) continue;
            member.morale = clampMorale(member.morale + roomMoraleCost(world.settings) * ours, world.settings);
          }
          world.weeklyNews.push(
            wire(
              'death',
              ourDoing.blamed
                ? blameLine(ourDoing.blamed.name, person.name)
                : roomLine(person.name, world.promotion.name, pronounsFor(person)),
              world.week,
              'lead',
            ),
          );

          // And the man they blame carries it. Not a fine and not a
          // suspension — the office is not punishing him, the locker room is,
          // and what it does is refuse to go out there with him. He is on
          // full pay the whole time, which is the point: you cannot use him
          // and you cannot stop paying him.
          if (ourDoing.blamed) {
            ourDoing.blamed.blamedFor = {
              wrestlerId: person.id,
              name: person.name,
              week: world.week,
            };
          }

          // Anybody who was out there with him goes home for a month on full
          // money. Not a decision the booker makes and not one he can undo.
          const sentHome: string[] = [];
          for (const id of ourDoing.alsoInTheRing) {
            const other = world.wrestlers[id];
            if (!other || other.deceased) continue;
            other.leave = compassionateLeave(person.name, world.settings, pronounsFor(other));
            sentHome.push(other.name);
          }
          if (sentHome.length > 0) {
            world.weeklyNews.push(
              wire('injury', leaveLine(sentHome, person.name, world.settings), world.week, 'lead'),
            );
          }
        };
        /**
         * What the internet has heard this week. Collected as the world's
         * systems run and emptied into the fan feed at the end — see
         * world/rumours.ts for why the count of voices is the whole signal.
         */
        const factionRumours: Rumour[] = [];

        /** Stories the booker actually settled in the ring tonight. */
        const blowoffsTonight: {
          storylineId: Id;
          rating: number;
          winnerName: string;
          winnerIds: Id[];
        }[] = [];

        // Shared across every match on tonight's card so two winners of the
        // same style (routine on a real roster — CONTROL_BEATS only carries
        // 2 lines per style) cannot read the identical control-segment
        // sentence twice. See narrative.ts's generateBeats doc comment.
        const usedBeats = new Set<string>();
        // Same reasoning, for a blown call — see referees.ts's
        // rollRefereeMiss doc comment.
        const usedRefereeMissLines = new Set<string>();

        // Did the feed hold tonight — once per show, decided before any
        // match runs, so every segment below can just check its own index
        // against it. Its own seeded stream rather than the shared `rng`
        // (CLAUDE.md: an RNG draw that always fires shifts every roll after
        // it — this only ever draws once, per world+week, isolated from
        // everything else). See sim/broadcast.ts.
        const dropoutEligibleSlots = world.currentCard
          .map((segment, i) => ({ segment, i }))
          .filter(
            ({ segment }) =>
              segment.kind === 'match' &&
              segment.participants.length >= 2 &&
              new Set(segment.participants.map((p) => p.side)).size >= 2,
          )
          .map(({ i }) => i);
        const broadcastDropoutSlot = night.cancelled
          ? null
          : rollBroadcastDropout(
              // The save's own seed, not the promotion's id — every save has
              // exactly one player promotion, always the same id, so keying
              // on it would have made the dropout schedule identical across
              // every save that ever exists rather than varying with the
              // seed the way every other per-week roll in this file does
              // (see the `${world.settings.seed}-...-${world.week}` pattern
              // used throughout). Caught in the live balance pass for this
              // phase, not by a test.
              rngFromSeed(`${world.settings.seed}-broadcastDropout-${world.week}`),
              dropoutEligibleSlots,
              equipmentSafetyEffects(world.ownedAssetIds, world.productionRungs, world.showSetup.extraIds)
                .injuryReduction,
              world.settings,
            );

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
                ownedGearUnits: stipulation.gearFamilyId
                  ? usableUnitsForFamily(world.ownedPropUnits, stipulation.gearFamilyId, world.settings).length
                  : 0,
              })
            : true;

          const lengthMinutes = segment.rules.timeLimit > 0 ? segment.rules.timeLimit : world.settings.defaultMatchLength;
          const simParticipants: SimParticipant[] = segment.participants.map((p) => ({ wrestlerId: p.wrestlerId, side: p.side }));

          violenceLevels.push(stipulation?.violenceLevel ?? 0);
          for (const w of participantWrestlers) tonightsStyles.push(w.style);

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
          // §13's escape hatch, honestly implemented. Creative control does not
          // let anybody script a win — the sim still picks it — but somebody
          // who has it will not work a match with a planted second or a
          // hand-picked official, so both levers come off this segment. The
          // helper for this has existed in career/ego.ts since the clause was
          // written and was called by nothing, so the player had been paying
          // for it at the negotiating table and getting nothing.
          const controlled = participantWrestlers.some(blocksDeckStacking);

          const guestReferee = controlled
            ? draftedReferee
            : segment.guestRefereeId
              ? wrestlerById.get(segment.guestRefereeId)
              : draftedReferee;
          const ringside = ringsideTotals({
            managers: (controlled ? [] : segment.managerIds ?? [])
              .map((m) => ({
                manager: findManager(world, m.managerId),
                client: participantWrestlers[m.forSide],
                // Which corner. Without it the sim knows somebody is out there
                // and not who it helps — see sim/ringside.ts.
                side: m.forSide,
                // How thin his book has him spread. A percentage man with six
                // clients is not really in anybody's corner.
                attention: presenceAt(
                  world.representations,
                  m.managerId,
                  world.wrestlers[m.managerId] ?? null,
                  world.settings,
                ),
              }))
              .filter((m): m is { manager: NonNullable<typeof m.manager>; client: Wrestler; side: number; attention: number } =>
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

          // Friends and enemies across the ring. Relationships used to be read
          // for morale and the locker room and nothing else — two men who
          // genuinely hated each other worked an ordinary match. The strongest
          // tie in the segment carries it: allies work smoother and safer,
          // enemies work stiffer and more dangerous, and both rate higher
          // because the crowd can tell.
          const competitorIds = segment.participants
            .filter((p) => p.role === 'competitor')
            .map((p) => p.wrestlerId);
          let relHeat = 0;
          let relInjury = 1;
          for (let a = 0; a < competitorIds.length; a++) {
            for (let b = a + 1; b < competitorIds.length; b++) {
              const tie = findRelationship(world.relationships, competitorIds[a]!, competitorIds[b]!);
              if (!tie) continue;
              const effect = relationshipMatchEffect(tie, world.settings);
              if (Math.abs(effect.ratingBonus) > Math.abs(relHeat)) relHeat = effect.ratingBonus;
              if (Math.abs(effect.injuryMultiplier - 1) > Math.abs(relInjury - 1)) {
                relInjury = effect.injuryMultiplier;
              }
            }
          }

          // Which owned units are actually assigned to tonight's match, if
          // the stipulation needs a family at all. A failed unit can't be
          // put to work even if it's still sitting in inventory — same
          // usableUnitsForFamily gate the booking screen already applies.
          const assignedGearUnits = (segment.gearUnitIds ?? [])
            .map((id) => world.ownedPropUnits.find((u) => u.id === id))
            .filter((u): u is NonNullable<typeof u> => u !== undefined && !unitHasFailed(u, world.settings));
          const gearUnitsInPlay = assignedGearUnits
            .map((u) => {
              const tier = propTierById(u.tierId);
              return tier ? { id: u.id, name: tier.name, condition: u.condition } : null;
            })
            .filter((u): u is NonNullable<typeof u> => u !== null);
          const gearUnitsWithTiers = assignedGearUnits
            .map((u) => ({ unit: u as OwnedPropUnit, tier: propTierById(u.tierId) }))
            .filter((x): x is { unit: OwnedPropUnit; tier: MatchPropTier } => x.tier !== undefined);
          // Degrades to an ordinary mismatched-stipulation match (no gear
          // assigned, or everything assigned since got sold/repaired away) —
          // never manufactured risk out of nothing. See the plan's edge case.
          // gearWearMultiplier also raises the odds it gives out mid-match,
          // not just how fast it wears afterward — a table that is actually
          // on fire is not just short-lived, it is more likely to go right
          // there in the spot.
          const gearFailureChance =
            gearUnitsWithTiers.length > 0
              ? clamp(aggregateBreakChance(gearUnitsWithTiers, world.settings) * (stipulation?.gearWearMultiplier ?? 1), 0, 1)
              : 0;
          const gearUnitRisk =
            assignedGearUnits.length > 0
              ? 1 - Math.min(...assignedGearUnits.map((u) => u.condition)) / 100
              : 0;
          const gearSpectacleBonusValue = spectacleBonus(assignedGearUnits.length, world.settings);

          const result = simulateMatch(rng, simParticipants, wrestlerById, {
            relationshipHeat: relHeat,
            rules: segment.rules,
            stipulation,
            requirementsMet,
            isPPV,
            matchLengthMinutes: lengthMinutes,
            settings: world.settings,
            week: world.week,
            // A real ring is a real ring whoever is standing in it — see
            // sim/simulateMatch.ts's own comment on the field. Pure and
            // cheap; recomputed per match rather than hoisted so this stays
            // a small, local change next to the roll it feeds.
            equipmentInjuryReduction: equipmentSafetyEffects(
              world.ownedAssetIds,
              world.productionRungs,
              world.showSetup.extraIds,
            ).injuryReduction,
            // The pyro rung is a standing purchase that fires every show it's
            // owned; pyroCharges is bought fresh, per show. Either one means
            // tonight's entrances have real fire in them. See sim/pyro.ts.
            pyroActive:
              world.productionRungs.includes('pyro') || world.showSetup.extraIds.includes('pyroCharges'),
            // Real match hardware, not the abstract production ladder — see
            // engine/economy/matchProps.ts. Empty/zero whenever nothing was
            // actually assigned, which is deliberate: booking the stipulation
            // without the prop is a mismatched-stipulation match, not a
            // manufactured-risk one.
            gearUnitsInPlay,
            gearFailureChance,
            gearUnitRisk,
            gearSpectacleBonus: gearSpectacleBonusValue,
            // Saturation is read at the level the promotion carried into the
            // show, so every segment on one card is judged against the same
            // number rather than each match penalising the next.
            hardcoreSaturation: world.promotion.hardcoreSaturation,
            slotExpectedPopularity: slotExpectations[i] ?? null,
            titlePrestige: matchTitlePrestige(titlesOnTheLine, world.settings),
            // What the company is known for. A card full of people who suit
            // the house rates a little higher here than it would anywhere
            // else, and a card full of people who don't rates a little lower.
            houseStyleFit: houseStyleRatingBonus(
              participantWrestlers,
              world.promotion.identity,
              world.settings,
              world.promotion.fanTaste,
            ),
            usedBeats,
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
            // Some pairings just click and some never do, and a pairing that
            // already told one real story together can be brought back for
            // a genuine spark — or run into the ground. See sim/pairChemistry.ts.
            pairChemistryBonus: segmentPairChemistry(segment, world.storylines, world.week, world.settings),
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

          // The specific unit that gave out is done for the night — reuses
          // the existing "Failed" semantics wholesale (excluded from
          // usableUnitsForFamily until repaired) rather than inventing new
          // state. See engine/sim/gearFailure.ts.
          if (result.gearFailureUnitId) {
            const brokenUnit = world.ownedPropUnits.find((u) => u.id === result.gearFailureUnitId);
            if (brokenUnit) brokenUnit.condition = 0;
          }

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
            if (draftedReferee) {
              // Nobody was available. One grievance with the office, taken
              // once each however many matches it happened in.
              draftedIntoTheShirt.add(draftedReferee.id);
              for (const competitor of participantWrestlers) {
                if (annoyedByTheDraft.has(competitor.id)) continue;
                annoyedByTheDraft.add(competitor.id);
                competitor.morale = clampMorale(
                  competitor.morale - world.settings.draftedRefereeMoraleCost,
                  world.settings,
                );
              }
            } else {
              // The booker named him on purpose. That is an angle, and it is
              // a fresh irritation every time he does it.
              for (const competitor of participantWrestlers) {
                competitor.morale = clampMorale(
                  competitor.morale - world.settings.guestRefereeMoraleCost,
                  world.settings,
                );
              }
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

            const miss = rollRefereeMiss(
              rng,
              {
                referee: assignedReferee,
                competitorIds: participantIds,
                hasTags: [...sideSizes.values()].some((n) => n > 1),
                hadInterference: result.finish === 'interference' || result.finish === 'disqualification',
                settings: world.settings,
              },
              usedRefereeMissLines,
            );

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
                victim.morale = clampMorale(
                  victim.morale - world.settings.refereeMissVictimMorale * severity,
                  world.settings,
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

          /** Anybody this match had to be stopped for. See career/ledger.ts. */
          const stoppedTonight = new Set<Id>();
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
              if (existing) {
                // It stacks. Going out on something and getting hurt again is
                // how a serious injury becomes a career-threatening one — and
                // taking the worse of the two would let a bad knee be
                // laundered by a light knock.
                const before = existing.severity;
                const worse = aggravate(existing.grade, next.grade, world.settings);
                person.injury = {
                  ...existing,
                  grade: worse,
                  severity: severityOf(worse, world.settings),
                  weeksRemaining: weeksFromGrade(worse, world.settings),
                  totalWeeks: Math.max(existing.totalWeeks, weeksFromGrade(worse, world.settings)),
                };
                world.weeklyNews.push(
                  wire(
                    'misfortune',
                    aggravationLine(person.name, before, person.injury.severity),
                    world.week + 1,
                    'normal',
                  ),
                );
              } else {
                person.injury = next;
              }
              // Into the permanent record as well as the current status.
              //
              // This is the path virtually every in-ring injury takes, and it
              // was the one path not writing history — measured at one written
              // history in a hundred and eighty-seven people over two and a
              // half years, which read as an injury-rate problem and was
              // actually three hooks on the wrong lines.
              person.injuryHistory = recordInjury(
                person.injuryHistory ?? [],
                next,
                world.settings.startingYear + Math.floor(world.week / 52),
              );
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
                  stipulationId: stipulation?.id ?? null,
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
            // He is out there on a bad knee because the booker sent him. What
            // that costs is settled after the show, once — see the injury
            // calls below the card loop.
            if (person.injury) {
              const out = workedHurtTonight.get(person.id) ?? { others: new Set<Id>(), violence: 0 };
              for (const other of participantWrestlers) if (other.id !== person.id) out.others.add(other.id);
              // The worst thing he was asked to do tonight, which is what
              // decides whether the room blames the office or the other man.
              out.violence = Math.max(out.violence, violence);
              workedHurtTonight.set(person.id, out);
            }

            const casualty = rollCasualty(rng, {
              personId: person.id,
              name: person.name,
              role: 'competitor',
              violenceLevel: violence,
              // A bodyguard takes some of what the ring throws at his man.
              // A different job from the mouthpiece and a different reason to
              // carry one — see sim/ringside.ts.
              injuryMultiplier:
                result.injuryMultiplier *
                relInjury *
                workingHurtRisk(person, world.settings) *
                (1 - (ringside.injuryShield?.[person.id] ?? 0)),
              toughness: person.toughness,
              settings: world.settings,
              stipulationId: stipulation?.id ?? null,
            });
            if (casualty) {
              putOut(casualty);
              // Somebody got hurt in a match two men genuinely hate each
              // other in. That is not a wrestling accident, and the office
              // treats it as what it is — the one violation that skips every
              // rung of the ladder. See career/discipline.ts.
              //
              // The blame goes on the opponent rather than on the victim,
              // which is the whole point: shoot heat is mutual, and the man
              // who is still standing is the one who has to answer for it.
              const badBlood = rivalry?.shootHeat ?? 0;
              if (badBlood >= world.settings.disciplineShootHeatBar && casualty.weeks >= world.settings.ledgerStoppageWeeks) {
                const blamed = participantWrestlers.find((other) => other.id !== person.id);
                if (blamed) {
                  const file = disciplineOf(blamed);
                  const sanction = sanctionFor(
                    file,
                    'deliberateInjury',
                    blamed.contract?.weeklyRate ?? world.settings.contractBaseWeeklyRate,
                    world.settings,
                  );
                  applySanction(file, 'deliberateInjury', sanction, world.week);
                  if (sanction.kind === 'suspended') {
                    world.promotion.bankBalance += sanction.amount;
                    books.earn('other', sanction.amount);
                  }
                  // Dated to the week the player reads, not the week that is
                  // ending — this runs before the increment, and the wire
                  // drops anything stamped older than the current week.
                  world.weeklyNews.push(
                    wire(
                      'misfortune',
                      `${suspensionLine(blamed.name, sanction) ?? sanction.note} ${person.name} is the one in hospital.`,
                      world.week + 1,
                      'normal',
                    ),
                  );
                }
              }
              // A bad one stops the match. That is a DNF on his record and a
              // win on the other man's — never a loss, because a man carried
              // out did not lose. Minor knocks do not stop anything; people
              // finish matches hurt all the time.
              if (casualty.weeks >= world.settings.ledgerStoppageWeeks) {
                stoppedTonight.add(person.id);
              }
            }
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
              stipulationId: stipulation?.id ?? null,
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
              stipulationId: stipulation?.id ?? null,
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
          // The combination. A mouthpiece pulls the official, and the muscle in
          // the same corner puts the other man into the barricade while his
          // back is turned. Two people in one corner is the whole trick —
          // neither half does anything like it alone (sim/ringside.ts).
          for (const side of [0, 1]) {
            const odds = ringside.muggingChance?.[side] ?? 0;
            if (odds <= 0 || !chance(rng, odds)) continue;
            const victim = participantWrestlers[1 - side];
            if (!victim) continue;

            const hurt = ringside.muggingDamage?.[side] ?? 0;
            const live = world.wrestlers[victim.id];
            if (live) live.health = clamp(live.health - hurt, 0, 100);

            // §0: nothing happens to anybody off-screen. It is in the write-up
            // with both names on it, because a match that swung on something
            // the player never saw reads as the sim cheating.
            tonightsBeats.push({
              participantIds: [victim.id],
              kind: 'interference',
              text: muggingLine(
                ringside.muggingBy?.[side] ?? 'The muscle',
                ringside.muggingDistractor?.[side] ?? 'The mouthpiece',
                victim.name,
              ),
            });
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
              stipulationId: stipulation?.id ?? null,
            });
            if (casualty) hurtTonight.push(casualty);
          }

          // Who has now shared a ring with whom, and what they make of each
          // other. Counted for every pair in the segment — partners included —
          // rather than only for singles, which is why a tag team that had been
          // together a year still read as having met zero times.
          //
          // The tie is a different thing from the rivalry below: a rivalry is
          // the feud the crowd is watching, this is what the two of them
          // actually think. Keep feeding two people to each other and they end
          // up friends or enemies whether the angle says so or not.
          {
            const inRing = segment.participants.filter((p) => p.role === 'competitor');
            for (let x = 0; x < inRing.length; x++) {
              for (let y = x + 1; y < inRing.length; y++) {
                const pa = inRing[x]!;
                const pb = inRing[y]!;
                const wa = world.wrestlers[pa.wrestlerId];
                const wb = world.wrestlers[pb.wrestlerId];
                if (!wa || !wb) continue;
                const key = pairKey(wa.id, wb.id);
                const met = (world.meetings[key] ?? 0) + 1;
                world.meetings[key] = met;
                const tie = rollNewTie(
                  rng,
                  wa,
                  wb,
                  pa.side === pb.side,
                  met,
                  world.relationships,
                  world.settings,
                );
                if (tie) world.relationships.push(tie);
              }
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
            // Counted once, below, for every pair in the segment rather than
            // only for singles — a tag team that has been together fifty weeks
            // had met zero times as far as this map was concerned.
            const key = pairKey(participantIds[0]!, participantIds[1]!);
            const meetings = world.meetings[key] ?? 0;

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

            // The gear gave out before anybody won it. Nobody defended it
            // for real, so the office won't call it a defence — the belt
            // comes off the table entirely rather than quietly staying with
            // whoever walked in holding it. Must run before the
            // isUnificationMatch/commitTitleChange logic below: that branch
            // falls back to result.winnerWrestlerIds, which is empty on a
            // draw finish.
            if (result.finish === 'equipmentFailure') {
              stripTitle(world, title, 'vacatedByEquipmentFailure');
              world.weeklyNews.push(
                wire(
                  'title',
                  `The ${title.name} is vacant tonight — the match for it never got a finish after the gear gave out, and the office isn't willing to call that a defence.`,
                  world.week + 1,
                  'lead',
                ),
              );
              continue;
            }

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
              // Steel barricades, professional security — whichever's
              // owned/booked tonight. Only the player's own show; a rival's
              // incident roll below is never handed this.
              incidentReduction: equipmentSafetyEffects(
                world.ownedAssetIds,
                world.productionRungs,
                world.showSetup.extraIds,
              ).incidentReduction,
              managers: (segment.managerIds ?? [])
                .map((m) => ({ manager: findManager(world, m.managerId), forSide: m.forSide }))
                .filter((m): m is { manager: NonNullable<typeof m.manager>; forSide: number } => Boolean(m.manager))
                .map((m) => ({ id: m.manager.id, name: m.manager.name, forSide: m.forSide })),
              hasReferee: Boolean(assignedReferee) && !segment.guestRefereeId,
              availableReturns: couldTurnUp(world, world.promotion.id, bookedTonight, participantIds),
            }),
          );
          if (incident) {
            applyEffects(world, rng, incident.effects, books);
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
          // commentary.ts's whole vocabulary — {sideA}/{sideB}, two-corner
          // framing — is built around exactly two corners. Flattening every
          // side past 0 into "sideB" was correct for a 1v1 or tag match, but
          // wrong for a genuine multi-way: it called a fatal 4-way or battle
          // royal like a tag match against a phantom team. A real N-way
          // announcer system is a separate project (new placeholder
          // vocabulary, new fact-gating, every OPENERS/beat line rewritten);
          // here, a genuine multi-way just gets no live call and leans on
          // the highlight beats instead — same as every rival-show match
          // already does.
          const competitorSideCount = new Set(
            segment.participants.filter((p) => p.role === 'competitor').map((p) => p.side),
          ).size;
          const winnerProbability =
            result.winnerSide === null ? 1 : (result.winProbabilitiesBySide[result.winnerSide] ?? 1);

          // ---- who these people are, beyond tonight -----------------------
          //
          // All of it read off records the game already keeps. The announcers
          // never guess at a career: if there is no former champion in this
          // match, the lookup comes back null and nobody says there is one.
          const onTheLine = new Set(titlesOnTheLine.map((t) => t.id));
          const holdsNow = (w: Wrestler) =>
            world.titles.filter((t) => !t.vacant && t.currentHolderIds.includes(w.id));
          const formerChampion = participantWrestlers.find(
            (w) => w.titleReigns.length > 0 && holdsNow(w).length === 0,
          );
          const formerReign = formerChampion?.titleReigns[formerChampion.titleReigns.length - 1] ?? null;
          // A belt they are carrying that is not the one being contested —
          // "the tag champion, in a singles match here tonight".
          const otherBeltHolder = participantWrestlers
            .map((w) => ({ w, belt: holdsNow(w).find((t) => !onTheLine.has(t.id)) }))
            .find((entry) => entry.belt);
          const streaking = participantWrestlers.find(
            (w) => w.career.streak >= world.settings.commentaryStreakRun,
          );
          const slumping = participantWrestlers.find(
            (w) => w.career.streak <= -world.settings.commentarySlumpRun,
          );
          const debutant = participantWrestlers.find((w) => w.career.matches === 0);
          // The announcers are only allowed to say a lineage they can see. If
          // the father has somehow been dropped from the world, the fact does
          // not exist — no half-known families on commentary.
          const secondGen = participantWrestlers.find(
            (w) => w.lineage && world.wrestlers[w.lineage.parentId],
          );
          const seasonNow = world.settings.startingYear + Math.floor(world.week / 52);
          const oldHand = [...participantWrestlers].sort((a, b) => a.debutYear - b.debutYear)[0];
          const timesMet =
            participantIds.length === 2
              ? (bookingMemory.pairings.get(
                  [participantIds[0]!, participantIds[1]!].sort().join('|'),
                ) ?? 0)
              : 0;
          const call =
            world.settings.commentaryEnabled &&
            world.promotion.commentaryTeam &&
            sideAMembers.length > 0 &&
            sideBMembers.length > 0 &&
            competitorSideCount === 2
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
                  formerChampionName: formerChampion?.name ?? null,
                  formerChampionTitle:
                    (formerReign && world.titles.find((t) => t.id === formerReign.titleId)?.name) ?? null,
                  otherBeltHolderName: otherBeltHolder?.w.name ?? null,
                  otherBeltName: otherBeltHolder?.belt?.name ?? null,
                  onATearName: streaking?.name ?? null,
                  onATearRun: streaking?.career.streak ?? 0,
                  slumpingName: slumping?.name ?? null,
                  // Stored negative — the announcers want the length of it.
                  slumpingRun: Math.abs(slumping?.career.streak ?? 0),
                  debutantName: debutant?.name ?? null,
                  secondGenName: secondGen?.name ?? null,
                  secondGenParentName: secondGen?.lineage?.parentName ?? null,
                  oldHandName: oldHand?.name ?? null,
                  oldHandYears: oldHand ? Math.max(0, seasonNow - oldHand.debutYear) : 0,
                  timesMet,
                  feudWeeks: rivalry ? Math.max(0, world.week - rivalry.startWeek) : 0,
                  feudMatches: rivalry?.matchesContested ?? 0,
                  isBlowoff: Boolean(stipulation?.isBlowoff) || Boolean(rivalry?.blowoffBooked),
                  townName: territory.name,
                  // Only when the sky actually took money off the gate. A
                  // drizzle that cost nothing is not worth a line.
                  weatherLine:
                    nightDraw < world.settings.commentaryWeatherDrawHit && night.weather
                      ? night.weather.event.name
                      : null,
                  isPPV,
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

          // The blowoff stipulations' real stake. isBlowoff alone only ever
          // ended the rivalry — this is what actually happens to the loser:
          // the hair comes off, the mask comes off, or they are off the
          // roster, exactly as advertised. Decisive-only, same test the
          // rivalry system uses for whether a grudge stipulation settled
          // anything — a screwjob finish pays off nothing.
          const consequence = stipulationConsequence(stipulation?.id ?? null);
          if (consequence && result.winnerSide !== null && result.winnerWrestlerIds.length > 0 && !isNonDecisiveFinish(result.finish)) {
            const losers = participantWrestlers.filter((w) => !result.winnerWrestlerIds.includes(w.id));
            // Seeded off the segment rather than the shared stream — this
            // resolves mid-resolveWeek, and a shared-stream draw here would
            // shift every seeded roll after it.
            const lineRng = rngFromSeed(`stipulationConsequence:${segment.slot}:${world.week}`);
            for (const loser of losers) {
              if (consequence === 'shaveHead') {
                // Purely cosmetic — nothing else in the sim reads it, so
                // there's nothing to write down beyond the write-up's line.
              } else if (consequence === 'unmask') {
                loser.masked = false;
              } else {
                const terms = exitTerms(loser, 'fired', world.settings, world.promotion.name);
                world.promotion.bankBalance -= terms.severance;
                letThemGo(world, loser, terms);
              }
              segment.result.beats.push({
                kind: 'finish',
                significant: true,
                text: stipulationConsequenceLine(consequence, lineRng, loser.name),
              });
            }
          }

          // Did this settle a story? The same test the rivalry system uses —
          // a grudge stipulation with a decisive finish — so the two can
          // never disagree about whether something ended.
          // A story that is ready, settled decisively, is over — whatever the
          // match was. Requiring a hair-or-mask stipulation was too narrow:
          // those are the only four in the table with isBlowoff, so every
          // feud in the game would have had to end in somebody's hair, and a
          // cage match that plainly finished it would leave the arc running.
          // A non-decisive finish deliberately does not count, which is the
          // whole reason screwjobs exist.
          const settledStory = storylineBetween(world.storylines, participantIds);
          if (
            settledStory &&
            readyToBlowOff(settledStory) &&
            result.winnerSide !== null &&
            result.winnerWrestlerIds.length > 0 &&
            result.finish !== 'interference' &&
            result.finish !== 'disqualification'
          ) {
            blowoffsTonight.push({
              storylineId: settledStory.id,
              rating: result.rating,
              winnerName: world.wrestlers[result.winnerWrestlerIds[0]!]?.name ?? 'The winner',
              winnerIds: [...result.winnerWrestlerIds],
            });
          }

          // What this match was, as far as any story running through it is
          // concerned. Interference outranks the match itself because a
          // finish that settles nothing is what feuds are made of.
          if (participantIds.length >= 2) {
            const namesHere = participantWrestlers.map((w) => w.name).join(' and ');
            const beatKind: StorylineBeatKind =
              result.finish === 'interference' || result.finish === 'disqualification'
                ? 'interference'
                : injuriesTonight.length > 0
                  ? 'injury'
                  : titlesOnTheLine.length > 0
                    ? 'titleMatch'
                    : 'match';
            const beatText =
              beatKind === 'interference'
                ? `${namesHere} did not settle it — somebody got involved.`
                : beatKind === 'injury'
                  ? `${namesHere} went at it and ${injuriesTonight[0]!.name} came out of it hurt.`
                  : beatKind === 'titleMatch'
                    ? `${namesHere} met with the ${titlesOnTheLine[0]!.name} on the line.`
                    : // Varied by how far into the story it is rather than by a
                    // dice roll, so the recap reads as a sequence and the call
                    // stays out of the simulation's random stream.
                    MATCH_BEAT_LINES[
                      (storylineBetween(world.storylines, participantIds)?.beats.length ?? 0) %
                        MATCH_BEAT_LINES.length
                    ]!.replace('{who}', namesHere);
            tonightsBeats.push({ participantIds: [...participantIds], kind: beatKind, text: beatText });
          }

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
            promotion: world.promotion,
            // Scaled down for a resident promotion: the same three hundred
            // people every week already love him and nobody else is watching.
            // This is the real price of a residency — see economy/residency.ts.
            popularityMultipliers: scaleExposure(
              ringside.popularityMultipliers,
              participantWrestlers.map((w) => w.id),
              residencyExposure(world.residency, world.settings),
            ),
            couldNotContinueIds: [...stoppedTonight],
            settings: world.settings,
          });
          // ...and whoever was got in the corridor before it started.
          //
          // Muscle at ringside is not only a shield. A bodyguard who is
          // willing and capable finds the man his client is wrestling before
          // the bell, and the victim works the match on what he has left.
          // §0: it is in the write-up, because a wrestler quietly starting a
          // match twenty points down is exactly the silent change that is not
          // allowed. See sim/ringside.ts.
          for (const assignment of segment.managerIds ?? []) {
            const heavy = findManager(world, assignment.managerId);
            if (!heavy) continue;
            const odds = backstageAttackChance(heavy, world.settings);
            if (odds <= 0 || !chance(rng, odds)) continue;
            const victim = participantWrestlers.find((w) =>
              segment.participants.some((p) => p.wrestlerId === w.id && p.side !== assignment.forSide),
            );
            if (!victim) continue;
            victim.health = clamp(victim.health - backstageDamage(heavy, world.settings), 0, 100);
            victim.energy = clamp(victim.energy - backstageDamage(heavy, world.settings), 0, 100);
            tonightsBeats.push({
              participantIds: [victim.id],
              kind: 'interference',
              text: backstageLine(heavy.name, victim.name),
            });
            // The office does not need to catch him to have an opinion about
            // a pattern of this. Written against the person, not the ringside
            // record — a manager is a wrestler with role 'manager' now, and
            // that is where his file lives.
            const asPerson = world.wrestlers[heavy.wrestlerId ?? heavy.id];
            if (asPerson) {
              const file = disciplineOf(asPerson);
              const sanction = sanctionFor(
                file,
                'conduct',
                asPerson.contract?.weeklyRate ?? world.settings.contractBaseWeeklyRate,
                world.settings,
              );
              applySanction(file, 'conduct', sanction, world.week);
            }
          }

          // Whoever the official caught answers for it. Until now getting
          // caught cost his client the match and cost the manager nothing at
          // all, so a repeat offender was indistinguishable from somebody who
          // did it once. See career/discipline.ts.
          if (result.caughtManagerId) {
            const culprit = world.wrestlers[result.caughtManagerId];
            if (culprit) {
              const file = disciplineOf(culprit);
              const sanction = sanctionFor(
                file,
                'cheating',
                culprit.contract?.weeklyRate ?? world.settings.contractBaseWeeklyRate,
                world.settings,
              );
              applySanction(file, 'cheating', sanction, world.week);
              if (sanction.kind === 'fined' || sanction.kind === 'suspended') {
                world.promotion.bankBalance += sanction.amount;
                books.earn('other', sanction.amount);
              }
              const announced = suspensionLine(culprit.name, sanction);
              // Dated to the week the player reads. See above.
              world.weeklyNews.push(
                wire('signing', announced ?? `${culprit.name}. ${sanction.note}`, world.week + 1, announced ? 'normal' : 'minor'),
              );
            }
          }

          // The feed dropped during this one — nobody at home saw it happen,
          // so it pays the same dampened popularity a genuine dark match
          // pays. See sim/darkMatch.ts's identical scaling, and
          // sim/broadcast.ts for why this segment in particular.
          const wentDark = i === broadcastDropoutSlot;
          const finalChanges = wentDark
            ? changes.map((c) => ({ ...c, popularity: c.popularity * world.settings.darkMatchPopularityShare }))
            : changes;

          for (const change of finalChanges) {
            const w = world.wrestlers[change.wrestlerId];
            if (w) applyAftermath(w, change, world.settings, result.rating);
            worked.add(change.wrestlerId);
          }

          if (wentDark) {
            const dropoutNames = participantWrestlers.map((w) => w.name).join(' and ');
            world.weeklyNews.push(
              wire(
                'broadcast',
                broadcastDropoutLine(
                  rngFromSeed(`${world.settings.seed}-broadcastDropoutLine-${world.week}`),
                  dropoutNames,
                ),
                world.week + 1,
                'normal',
              ),
            );
          }

          // A manager takes the result of the side they worked. Their record
          // needs no client list to maintain — being at ringside *is* the
          // relationship, which is why it stops the moment a wrestler stops
          // being booked with them, and why moving companies starts a fresh
          // set of books. See career/ledger.ts.
          for (const assignment of segment.managerIds ?? []) {
            const manager = findManager(world, assignment.managerId);
            if (!manager) continue;
            const theirSide = segment.participants
              .filter((p) => p.side === assignment.forSide)
              .map((p) => p.wrestlerId);
            if (theirSide.length === 0) continue;
            // Whatever happened to the people he was out there for. A corner
            // whose man was carried out did not lose either.
            const forThem = changes.find((c) => theirSide.includes(c.wrestlerId));
            if (forThem) creditMatch(ledgerOf(manager), forThem.outcome, 'manager');
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

          // The rating itself stays real — the live crowd got a real match.
          // Whether it counts toward the broadcast's own number is decided
          // below, at computeShowRating, by dropping this slot's weight
          // entirely rather than scoring it 0 (0 is what an unfilled slot
          // gets, and this was not that — see sim/broadcast.ts).
          segmentRatings.push(result.rating);
          // Weighed for the town this card is actually in. Using the national
          // number meant a card of local heroes drew exactly the same in their
          // own back yard as it did four hundred miles away — see
          // engine/career/reach.ts.
          const avgPop = cardDrawIn(participantWrestlers, territory.id, world.settings);
          segmentPopAvgs.push({ stars: result.stars, avgPopularity: avgPop });

          // And working a town builds you there. A good match builds you
          // faster, and a hometown night is worth more than a strange one.
          for (const person of participantWrestlers) {
            setLocal(
              person,
              territory.id,
              localStanding(person, territory.id, world.settings) +
                workingGain(person, territory.id, result.rating, world.settings),
            );
          }


        });

        // ---- the dark matches ---------------------------------------------
        // Optional, off-camera, and simulated for real — resolved after the
        // televised card and before the talking, on the same principle as
        // the promo slots below: they sit alongside the card rather than
        // inside it and never touch the TV rating. See the design note at
        // the top of engine/sim/darkMatch.ts for exactly what they get and
        // don't — no stipulations, no titles, no managers, no referee.
        let darkMatchesRun = 0;
        if (!night.cancelled) {
          for (const segment of world.currentDarkMatches) {
            const sides = new Set(segment.participants.map((p) => p.side));
            if (segment.participants.length < 2 || sides.size < 2) continue;

            const participantWrestlers = segment.participants.map((p) => wrestlerById.get(p.wrestlerId)!);
            const rivalry = findRivalry(world.rivalries, participantWrestlers.map((w) => w.id)) ?? null;
            const simParticipants: SimParticipant[] = segment.participants.map((p) => ({
              wrestlerId: p.wrestlerId,
              side: p.side,
            }));
            const lengthMinutes =
              segment.rules.timeLimit > 0 ? segment.rules.timeLimit : world.settings.defaultMatchLength;

            const outcome = resolveDarkMatch(rng, simParticipants, wrestlerById, world.week, {
              rules: segment.rules,
              matchLengthMinutes: lengthMinutes,
              settings: world.settings,
              promotionArchetype: world.promotion.identity,
              rivalry,
            });

            segment.result = outcome.result;
            darkMatchesRun += 1;

            for (const change of outcome.changes) {
              const w = world.wrestlers[change.wrestlerId];
              if (w) applyAftermath(w, change, world.settings, outcome.result.rating);
            }

            // Same rule the televised card uses: it stacks, and a body
            // already carrying something keeps the worse of the two. See
            // the identical logic a few hundred lines up, in putOut.
            for (const { casualty, injury } of outcome.casualties) {
              const person = world.wrestlers[casualty.personId];
              if (!person) continue;
              person.health = clamp(person.health - world.settings.casualtyHealthCost, 0, 100);
              person.career.longestInjuryWeeks = Math.max(person.career.longestInjuryWeeks, casualty.weeks);
              const existing = person.injury;
              if (existing) {
                const before = existing.severity;
                const worse = aggravate(existing.grade, injury.grade, world.settings);
                person.injury = {
                  ...existing,
                  grade: worse,
                  severity: severityOf(worse, world.settings),
                  weeksRemaining: weeksFromGrade(worse, world.settings),
                  totalWeeks: Math.max(existing.totalWeeks, weeksFromGrade(worse, world.settings)),
                };
                world.weeklyNews.push(
                  wire(
                    'misfortune',
                    aggravationLine(person.name, before, person.injury.severity),
                    world.week + 1,
                    'normal',
                  ),
                );
              } else {
                person.injury = injury;
              }
              person.injuryHistory = recordInjury(
                person.injuryHistory ?? [],
                injury,
                world.settings.startingYear + Math.floor(world.week / 52),
              );
              person.clearedToWorkHurt = false;
            }

            // §0: nothing happens off-screen, including backstage.
            const winnerNames = outcome.result.winnerWrestlerIds
              .map((id) => world.wrestlers[id]?.name)
              .filter(Boolean)
              .join(' & ');
            const loserNames = participantWrestlers
              .filter((w) => !outcome.result.winnerWrestlerIds.includes(w.id))
              .map((w) => w.name)
              .join(' & ');
            world.weeklyNews.push(
              wire(
                'houseShow',
                winnerNames && loserNames
                  ? `Dark match, never made air: ${winnerNames} put away ${loserNames} in front of a crowd that had no idea they were even seeing it.`
                  : `A dark match sent tonight's crowd home happy. Cameras were already off — nobody outside that building will ever see it.`,
                world.week + 1,
                'minor',
              ),
            );
          }
        }

        // ---- the talking ------------------------------------------------
        // Promo slots sit alongside the card rather than inside it (§9), so
        // they are resolved here, after the matches, and contribute to the
        // show on their own smaller scale.
        let promoRating = 0;
        // Shared across every talking slot tonight — promo or confrontation
        // alike — so two segments on the same card cannot write up as the
        // identical line. See promo.ts's writeUp / confrontation.ts's
        // pickUnused doc comments.
        const usedPromoLines = new Set<string>();
        for (const slot of world.currentPromos) {
          // A talking slot can be a promo or a confrontation. The budget is
          // shared on purpose — time on the microphone is finite.
          if (slot.kind === 'confrontation') {
            const outcome = resolveConfrontationSlot(world, slot, wrestlerById, rng, tonightsBeats, usedPromoLines);
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
            // Material for the man on the microphone: does the other fellow
            // do his own talking? See jabAt in sim/promo.ts.
            targetHasMouthpiece: Boolean(
              target && representativeOf(world.representations, target.id),
            ),
            topicId,
            existingHeat: rivalry?.heat ?? 0,
            settings: world.settings,
          }, usedPromoLines);

          applyEffects(world, rng, promo.effects, books);
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
          if (target) {
            tonightsBeats.push({
              participantIds: [speaker!.id, target.id],
              kind: 'promo',
              text: `${speaker!.name} took a microphone and had something to say about ${target.name}.`,
            });
          }
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
        // A dropped-feed slot is dropped from both arrays entirely, not
        // scored 0 — that is what an unfilled slot gets, and this is a
        // different thing: a real match the *broadcast* never carried. See
        // sim/broadcast.ts.
        const inRingRating =
          broadcastDropoutSlot === null
            ? computeShowRating(segmentRatings, slotWeights)
            : computeShowRating(
                segmentRatings.filter((_, i) => i !== broadcastDropoutSlot),
                slotWeights.filter((_, i) => i !== broadcastDropoutSlot),
              );

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
          // Dated to the week the player reads. See above.
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
        // The ladder, folded in alongside the older asset list. Represented as
        // one synthetic entry rather than by rewriting every consumer, because
        // `sumEffect` already knows how to add these up and the two systems
        // want to coexist while the old assets are still around.
        // Only what will actually go through the door of this building. Gear
        // that does not fit is neither a benefit nor a cost tonight — it never
        // came off the trailer. See economy/venue.ts.
        const rigInRoom = productionInRoom(world.productionRungs, venue);
        const climbed = productionEffects(rigInRoom);
        production.push({
          id: 'productionLadder',
          name: 'Production',
          cost: 0,
          upkeepPerShow: 0,
          blurb: '',
          effects: {
            showRating: climbed.showRating,
            tvRating: climbed.tvRating,
            attendanceMultiplier: climbed.attendanceMultiplier,
            merchMultiplier: climbed.merchMultiplier,
            injuryReduction: climbed.injuryReduction,
          },
        } as (typeof production)[number]);
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
          : Math.min(
              computeAttendanceForShow({
                venue,
                ticketPrice,
                demand,
                attendanceMultiplier:
                  sumEffect(production, 'attendanceMultiplier', 'multiply') * nightDraw,
                // The regulars in this town are the floor under a bad night.
                territoryFollowing: homeFollowing,
                // One small city has a ceiling on what a ticket is worth, and
                // it is not the one a good card would justify anywhere else.
                fairPriceCeiling: localTopTicket(world.residency) ?? undefined,
                settings: world.settings,
              }),
              // And a ceiling on how many people exist to sell one to. This is
              // why a residency never sells out: the room is bigger than the
              // town, and no card fixes that.
              localCeiling(world.residency, world.settings),
            );

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
        // The building takes its slice of the merch table before anybody on
        // the card takes theirs — a wrestler's cut and a landlord's cut are
        // both just money off the same stack of shirts.
        const merchCutShare =
          venue.merchCut +
          onTheCard.reduce(
            (share, w) =>
              share +
              (w.contract?.clauses.includes('merchandiseCut') ? world.settings.clauseMerchandiseCut : 0),
            0,
          );

        // The merch table and the bar. Stock is bought before the doors open,
        // so every line is a bet on the crowd — see economy/stands.ts.
        const standCtx = {
          gimmickMerchMultiplier: gimmickMerch,
          prestige: world.promotion.rating,
          identity: world.promotion.identity,
          venue,
          rigInRoom,
          settings: world.settings,
        };
        const tables = nightAtTheTables(world.showSetup.standIds, attendance, standCtx);

        const revenue = computeShowRevenue({
          attendance,
          ticketPrice,
          merchMultiplier:
            sumEffect(production, 'merchMultiplier', 'multiply') * residencyMerchMultiplier(world.residency),
          gimmickMerchMultiplier: gimmickMerch * night.merch,
          merchCutShare,
          // The rig's own concessions, plus whatever this building lets you
          // keep of the bar and the tuck shop.
          revenuePerHead: sumEffect(production, 'revenuePerHead') + concessionsPerHead(venue),
          averagePopularity: cardStrength,
          settings: world.settings,
        });

        // A bonus match the crowd was not expecting is worth more merch at
        // the table on the way out, whatever it rated — the ticket already
        // felt like it went further. Sized as a fraction of an ordinary
        // night's per-head spend; see darkMatchMerchPerHead.
        if (darkMatchesRun > 0) {
          revenue.merch += Math.round(attendance * world.settings.darkMatchMerchPerHead * darkMatchesRun);
        }

        const showCosts = computeShowCosts({
          // The rent held for the term, not this week's list price — that is
          // what signing for a season buys.
          // The rent held for the term, not the room's list price — that is
          // what signing for a season buys.
          venue: world.residency ? { ...venue, rentalCost: world.residency.rentPerWeek } : venue,
          ownedAssets,
          extras,
          // Nobody is travelling, so nobody is being paid to travel. For a
          // company carrying a real roster this is the larger half of the deal.
          rosterSize: world.residency ? 0 : world.promotion.rosterIds.length,
          settings: world.settings,
        });
        // What a ticket is worth here. A sell-out in the small town is not the
        // same money as a sell-out in the metro.
        const grossGate = Math.round(revenue.gate * territory.revenueMult);
        // What the building keeps, on top of the rent. The better the night,
        // the bigger this is — which is why an arena never quite becomes free
        // money, however well you draw in it.
        const houseGateCut = houseTakeOfGate(grossGate, venue);
        const gate = grossGate - houseGateCut;

        const weeklyExpenses = residencyOverhead(
          world.residency,
          computeWeeklyExpenses(
            world.promotion.bankBalance,
            world.settings.weeklyExpenseRate,
            world.promotion.ownedTerritoryIds.length,
          ),
          world.settings,
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
          const paid = worked.has(member.id)
            ? computeAppearanceFee({
                contract: member.contract,
                role: 'competitor',
                isMainEvent: mainEventIds.has(member.id),
                isPPV,
              })
            : computeDownsideGuarantee(member.contract);
          // A manager takes his percentage out of the client's purse rather
          // than off the promotion's bill — see career/representation.ts. The
          // wrestler's books show what he kept; the manager's show what he
          // took. The promotion pays the same either way, which is the point:
          // you are billed for the agent being good, not for the agent.
          const gross = paid + (member.contract.weeklyRate ?? 0);
          const rep = representativeOf(world.representations, member.id);
          const takenByAgent = rep ? cutOf(gross, rep) : 0;
          // ...and what it cost him to get there. The promotion's travel line
          // is the trucks and the crew; this is the man's own gas money, and
          // `travelCovered` is what buys him out of it. Without this the
          // clause charged the company extra to spare a wrestler a cost he
          // never had. See career/representation.ts.
          const ownTravel = travelBill(
            worked.has(member.id) ? showsThisWeek(world.week, schedule, world.settings).length : 0,
            member.contract.clauses.includes('travelCovered'),
            world.settings,
          );
          creditPay(ledgerOf(member), gross - takenByAgent - ownTravel);
          if (rep && takenByAgent > 0) {
            const agent = world.wrestlers[rep.managerId];
            if (agent) creditPay(ledgerOf(agent), takenByAgent);
          }
          return sum + paid;
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
        // Clauses you agreed to have a weekly price of their own, and so does
        // the jet.
        const clauseBill = world.promotion.rosterIds.reduce((sum, id) => {
          const member = world.wrestlers[id];
          return member ? sum + clauseUpkeep(member, world.settings) : sum;
        }, 0);
        const perkBill = world.settings.perksEnabled
          ? world.promotion.rosterIds.reduce((sum, id) => {
              const member = world.wrestlers[id];
              return member ? sum + perkUpkeep(member) : sum;
            }, 0)
          : 0;
        const totalOut = payroll + weeklyExpenses + showPayable + ringsideCost + clauseBill + perkBill;

        // The nights the cameras were not at.
        //
        // A promotion running four times a week is on the road three of them,
        // and those buildings take money and take it out of people. The gate
        // is modelled in the aggregate rather than as three more full cards —
        // a house show does not draw what the televised one draws and the
        // fourth night of the week draws worse than the second, which is what
        // `houseShowRevenueMultiplier` is — and the wear lands on everybody
        // healthy enough to have been on the bus. See engine/world/schedule.ts.
        // Nights that were not on the calendar: a memorial announced last
        // week, or a benefit somebody asked for. They run alongside the
        // pattern, cost the building, and pay in something other than money.
        const tonightsImpromptu = world.impromptuShows.filter((sh) => sh.week === world.week);
        const houseShows = houseShowsThisWeek(world.week, schedule, world.settings);
        const houseGate = night.cancelled
          ? 0
          : Math.round(
              (revenue.total - showPayable) *
                (houseShowRevenueMultiplier(schedule, world.settings) - 1),
            );

        // The night, line by line rather than as one net figure. This is the
        // whole point of the statement: "up nine thousand" tells a booker
        // nothing, and "gate 21,000, payroll 13,000, venue 4,200" tells him
        // what to do next.
        books.earn('gate', gate);
        // Merch is the built-in per-head trickle plus whatever the tables you
        // chose to stock actually sold, less the building's slice of both.
        const standMerch = Math.round(tables.merchGross * residencyMerchMultiplier(world.residency));
        const standMerchNet = standMerch - houseTakeOfMerch(standMerch, venue);
        books.earn('merch', revenue.merch + standMerchNet);
        // The building's own per-head concessions, plus the stands you ran
        // yourself. Small per head and large by the end of the night, which is
        // exactly why it wants naming.
        books.earn('concessions', revenue.other + tables.concessionsGross);
        books.earn('houseShows', houseGate);
        // Stock and staffing, owed whether anybody turned up or not. This is
        // the line that makes the merch table a decision rather than free money.
        books.spend('stock', tables.cost);
        books.spend('payroll', payroll);
        // The rent, the load-in, and the building's share of what you sold.
        books.spend(
          'venue',
          (world.residency ? world.residency.rentPerWeek : venue.rentalCost + venue.loadIn) + houseGateCut,
        );
        books.spend('production', showPayable - (world.residency ? world.residency.rentPerWeek : venue.rentalCost));
        // Named rather than swept into Other. The office overhead is the
        // largest single thing most companies pay and it scales with what they
        // are worth, so a booker reading his own sheet has to be able to see it
        // sitting there above the payroll.
        books.spend('overhead', weeklyExpenses);
        books.spend('agents', ringsideCost);
        books.spend('perks', clauseBill + perkBill);

        world.promotion.bankBalance +=
          revenue.total - totalOut + houseGate + standMerchNet + tables.concessionsGross - tables.cost;

        // The kit and the truck, whether or not a wheel turned. A company that
        // owns a video wall pays for a video wall in a week it runs nothing.
        // Only what was hauled in and switched on. A video wall that stayed on
        // the trailer costs nothing to run.
        const rig = productionUpkeepPerShow(rigInRoom) * Math.max(1, houseShows.length + 1);
        // A resident promotion has no truck: the gear lives in the building.
        const truck = residencyHaulageCost(world.residency, haulageById(world.haulageId)?.upkeepPerWeek ?? 0);
        world.promotion.bankBalance -= rig + truck;
        books.spend('production', rig);
        books.spend('haulage', truck);

        for (const extra of tonightsImpromptu) {
          const takings = returnsFor(extra, world.settings);
          // A memorial takes money at the door and none of it is the
          // company's. The house pays for the house and the rest goes to the
          // family, which is what the announcement has always promised and
          // what the night did not previously do — it was a flat cost with no
          // gate, so burying somebody properly was a fixed fine rather than a
          // gesture. See world/impromptu.ts.
          const settled = extra.kind === 'memorial' ? settleMemorial(gate, world.settings) : null;
          if (settled) {
            books.earn('gate', settled.gate);
            books.spend('venue', takings.cost);
            books.spend('charity', settled.toTheFamily);
            world.promotion.bankBalance -= settled.costToUs;
          } else {
            world.promotion.bankBalance -= takings.cost;
            books.spend('venue', takings.cost);
          }
          // A packed building and a cheque is not the same gesture as an
          // empty one, so what the night buys is scaled by what reached them.
          const earned = (base: number) =>
            settled ? scaleForGenerosity(base, settled.generosity, world.settings) : base;
          world.promotion.reputation = clamp(
            world.promotion.reputation + earned(takings.reputation),
            0,
            100,
          );
          for (const id of world.promotion.rosterIds) {
            const member = world.wrestlers[id];
            if (!member || member.deceased) continue;
            member.morale = clampMorale(member.morale + earned(takings.morale), world.settings);
            // It is still a night's work. A company that buries somebody
            // properly still put its roster in a building to do it.
            member.fatigueDebt = clamp(
              member.fatigueDebt +
                world.settings.matchFatiguePerMatch * world.settings.scheduleHouseShowIntensity,
              0,
              100,
            );
          }
          // A town remembers who turned up for something that was not about
          // selling them a ticket.
          const town = world.territories.find((t) => t.id === territory.id);
          if (town) {
            town.following[world.promotion.id] = clamp(
              (town.following[world.promotion.id] ?? 0) + earned(takings.following),
              0,
              100,
            );
          }
          // Filed against the week the player is about to read, like the rest
          // of the weekly news — this runs before the increment, and the wire
          // drops anything stamped earlier than the current week. Every one of
          // these sentences was being thrown away as last week's news.
          world.weeklyNews.push(wire('houseShow', afterLine(extra), world.week + 1, 'normal'));
          // What the family got. Money leaving the company is not something
          // the player should have to find by reading the statement.
          if (settled && extra.forName) {
            world.weeklyNews.push(
              wire('houseShow', familyLine(extra.forName, settled), world.week + 1, 'normal'),
            );
          }
        }
        world.impromptuShows = world.impromptuShows.filter((sh) => sh.week !== world.week);

        // Somebody asks. Never in a week that already has something unplanned
        // in it — a company does not run a benefit the same week it buries
        // one of its own.
        const benefit = rollCharityNight(
          rng,
          {
            week: world.week + 1,
            takenNights: schedule.shows.map((sh) => sh.day),
            promotionName: world.promotion.name,
            townName: territory.name,
            alreadyBusy: world.impromptuShows.some((sh) => sh.week === world.week + 1),
          },
          world.settings,
        );
        if (benefit) {
          world.impromptuShows.push(benefit);
          world.weeklyNews.push(wire('houseShow', benefit.announcement, world.week + 1, 'minor'));
        }

        if (houseShows.length > 0 && !night.cancelled) {
          // What the road costs the people on it.
          //
          // A house show is a card, not a summons: it takes about as many
          // people as a television taping does, and the office sends the ones
          // who can go. So the wear falls on a card's worth per night, taken
          // healthiest-first, rather than on everybody with a contract.
          //
          // Which makes roster depth the actual counter to a heavy schedule,
          // and that is the point. Applying it to the whole roster instead
          // meant a company running four nights wore out its twenty-sixth
          // wrestler exactly as fast as its main eventer, so signing more
          // people bought nothing and the only lever on the road was to stop
          // going on it.
          const needed = cardSizeFor('television', world) * 2;
          const fit = world.promotion.rosterIds
            .map((id) => world.wrestlers[id])
            .filter((member): member is Wrestler => Boolean(member) && !member!.deceased && !member!.injury)
            .sort((a, b) => b.health + b.energy - (a.health + a.energy));

          for (const show of houseShows) {
            void show;
            for (let i = 0; i < needed; i++) {
              // The same names come round again when the roster is thin —
              // which is exactly what running four nights with fourteen
              // people does to fourteen people.
              const member = fit[i % Math.max(fit.length, 1)];
              if (!member) break;
              // A house show is a lighter night than the one on television:
              // shorter matches, no cameras, nobody protecting a body for a
              // finish anybody will see again. It scales the whole night
              // rather than only the damage — charging a full televised
              // night's work for it made a two-show week cost twice what the
              // same roster used to pay for a one-show week, and folded
              // companies that were solvent before the schedule existed.
              const intensity = world.settings.scheduleHouseShowIntensity;
              member.fatigueDebt = clamp(
                member.fatigueDebt + world.settings.matchFatiguePerMatch * intensity,
                0,
                100,
              );
              member.health = clamp(
                member.health - world.settings.matchHealthCost * intensity,
                0,
                100,
              );
              member.energy = clamp(
                member.energy - world.settings.matchEnergyCost * intensity,
                0,
                100,
              );
            }
          }
          // §0: the shows happened, so the paper says they happened and says
          // what they were worth. A week of money the player never sees the
          // source of is money that arrived off-screen.
          world.weeklyNews.push(
            wire(
              'houseShow',
              houseShows.length === 1
                ? `${houseShows[0]!.name} hit the road this week and delivered — $${houseGate.toLocaleString()} through the door, and a roster that has now worked twice in the same stretch.`
                : `${houseShows.length} house shows hit the road this week — ${houseShows.map((s) => s.name).join(', ')}. $${houseGate.toLocaleString()} through the door, and every single one of them has the miles to prove it.`,
              world.week + 1,
              'minor',
            ),
          );
        }

        // Staging feeds back into how the show itself was received: the
        // production, and whether the building looked full on camera.
        const productionRating =
          sumEffect(production, 'showRating') +
          (venue.prestige / 100) * world.settings.venuePrestigeRatingWeight +
          // The room's own character, which is not the same question as how
          // full it looked: a bingo hall is hot at four hundred.
          venueAtmosphereModifier(venue, world.settings) +
          attendanceRatingModifier(attendance, venue.capacity, world.settings) +
          // Run past what this room will take and they do not come back for
          // it — the deathmatch crowd's ceiling is not the old-school one's.
          violenceTolerancePenalty(violenceLevels, world.promotion.identity, world.settings);
        for (const effect of production) {
          if (effect.effects.rosterMorale) {
            for (const id of world.promotion.rosterIds) {
              const member = world.wrestlers[id];
              if (member) member.morale = clampMorale(member.morale + effect.effects.rosterMorale, world.settings);
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

        // The crowd's own taste moves toward whatever they were actually
        // shown tonight — see engine/world/fanTaste.ts. A cancelled night
        // leaves tonightsStyles empty, which correctly nudges everything
        // very slightly toward neutral rather than doing nothing at all.
        driftFanTaste(world.promotion.fanTaste, styleRunShare(tonightsStyles), world.settings);

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
        books.earn('television', buyRevenue);

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
            // Never on the card that decided showRating below — dark is
            // still set on these, so nothing downstream mistakes one for a
            // broadcast segment.
            ...world.currentDarkMatches.filter((slot) => slot.result),
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
        // matches on it, and anything that changed hands. Dark matches count
        // here — the player asked for the fans in the building to be able to
        // tweet about them same as anything broadcast, even though nobody
        // outside the building saw them.
        const ratedSegments = [...world.currentCard, ...world.currentDarkMatches]
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
              gimmickReactions: world.pendingGimmickReactions,
              settings: world.settings,
            }),
          };
          // Drained, not cleared unconditionally — a week with no show at
          // all leaves the queue standing for the next one that actually
          // runs, rather than losing a reaction nobody was ever shown.
          world.pendingGimmickReactions = [];
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
            .filter((w): w is Wrestler => Boolean(w) && canWork(w!, world.settings, world.week));

          const show = runRivalShow(rng, {
            promotion: rival,
            available,
            titles: world.titles,
            stables: world.stables,
            week: world.week,
            settings: world.settings,
            memory: memoryFromRoster(available),
            representedIds: new Set(world.representations.map((r) => r.clientId)),
            // Rivals are not stupid either — a grudge that stops a match
            // stopping it on their card too.
            refuses: (aId, bId) =>
              refusesToWorkWith(findRelationship(world.relationships, aId, bId), world.settings),
          });
          if (!show) continue;

          // The catastrophe roll (top of resolveWeek) landed on this rival's
          // show instead of the player's — the same random-target roll,
          // just resolved without a decision on their side, and still
          // written into the wire so the player finds out either way. See
          // catastrophe.ts and the user's own framing: "the events happen
          // but the company they happen to need to be random."
          if (catastrophe && catastrophe.targetPromotionId === rival.id) {
            show.showRating = clamp(show.showRating - world.settings.catastropheRivalRatingDip, 0, 100);
            show.showStars = Math.max(0, show.showStars - 1);
            // Seeded from the rival and week rather than the shared stream —
            // this sits well inside resolveWeek's deterministic sequence, and
            // a shared-stream draw here would shift every seeded roll after
            // it (the documented trap). A pool rather than a fixed sentence:
            // every rival's catastrophe, for the whole business, for the
            // whole save, otherwise reads as the identical line forever.
            const lineRng = rngFromSeed(`rivalCatastropheLine:${rival.id}:${world.week}`);
            const line = pick(
              lineRng,
              catastrophe.kind === 'weather' ? RIVAL_WEATHER_CATASTROPHE_LINES : RIVAL_NO_SHOW_CATASTROPHE_LINES,
            ).replace(/\{name\}/g, rival.name);
            world.weeklyNews.push(wire('misfortune', line, world.week + 1, 'normal'));
          }

          rivalShows.set(rival.id, show);
          // Same drift the player's own show gets, off what this rival
          // actually ran tonight — see fanTaste.ts and RivalShow.styles.
          driftFanTaste(rival.fanTaste, styleRunShare(show.styles), world.settings);

          // Rivals' locker rooms are locker rooms too. Without this the only
          // people in the business who ever made a friend or an enemy were the
          // twenty-odd on the player's roster — measured at 25 of 163 people
          // carrying any tie at all, because a tie could only form on the
          // player's card. Same rule, same counter, their show.
          for (const match of show.matches) {
            for (let x = 0; x < match.participantIds.length; x++) {
              for (let y = x + 1; y < match.participantIds.length; y++) {
                const wa = world.wrestlers[match.participantIds[x]!];
                const wb = world.wrestlers[match.participantIds[y]!];
                if (!wa || !wb) continue;
                const key = pairKey(wa.id, wb.id);
                const met = (world.meetings[key] ?? 0) + 1;
                world.meetings[key] = met;
                const tie = rollNewTie(
                  rng,
                  wa,
                  wb,
                  match.sides[x] === match.sides[y],
                  met,
                  world.relationships,
                  world.settings,
                );
                if (tie) world.relationships.push(tie);
              }
            }
          }

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
                applyEffects(world, rng, incident.effects, books);
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
          // Not `books` — that name belongs to the player's statement, which
          // is open for the whole of resolveWeek.
          const theirBooks = rivalWeek(rival, theirRoster, world.settings);
          const net = rivalShows.has(rival.id) ? theirBooks.net : -theirBooks.costs;
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

          if (!world.pendingFoldPicks && shouldFold(failing)) {
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
            // world.week + 1: this runs before the week actually turns over
            // below (see the CLAUDE.md note on wire items stamped too early
            // vanishing under the post-increment filter).
            world.weeklyNews.push(
              wire('story', `${rival.name} took on emergency investment just to keep the lights on and the doors open.`, world.week + 1, 'minor'),
            );
          } else {
            // Same struggle the player faces, not the same numbers — see
            // rivalEconomy.ts. Its own isolated seed: this is a weekly roll
            // gated on world state, and CLAUDE.md's own history says never
            // trust that gate to protect the shared stream.
            maybeTrimRivalPayroll(world, rngFromSeed(`trim:${rival.id}:${world.week}`), rival);
          }
        }

        // Rivals were on opposite you tonight, with the shows they actually
        // ran — so a hot rival takes audience off you even when your own show
        // was fine, and a promotion in decline stops being a threat.
        const tvResults = computeTvRatings(
          [
            {
              promotionId: world.promotion.id,
              showRating,
              companyRating: world.promotion.rating,
              broadcast: true,
              // Cameras, a production truck, advertising, guest talent,
              // streaming — every tvRating field owned production declares,
              // finally read by something. See tvRatings.ts's own comment.
              tvRatingBonus: sumEffect(production, 'tvRating'),
            },
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

        // Time off that is not an injury counts down here, ahead of tonight's
        // aftermath — anybody sent home *this* week starts his four weeks next
        // week rather than having one of them eaten by the night he was in.
        // He comes back on the wire rather than simply reappearing in the
        // pick-list: a man sent home for a month is not returned quietly.
        for (const id of world.promotion.rosterIds) {
          const member = world.wrestlers[id];
          if (!member?.leave) continue;
          member.leave = tickLeave(member.leave);
          if (!member.leave) {
            world.weeklyNews.push(
              wire('injury', `${member.name} is officially back on the roster and cleared to book.`, world.week, 'normal'),
            );
          }
        }

        // A vignette campaign counts down the same way — except what lands
        // at the end is a first-ever debut rather than a return. See
        // engine/career/vignette.ts.
        for (const id of world.promotion.rosterIds) {
          const member = world.wrestlers[id];
          if (!member?.vignette) continue;
          const ticked = tickVignette(member.vignette);
          if (ticked) {
            member.vignette = ticked;
            continue;
          }
          const payoff = resolveVignette(member, member.vignette, world.settings);
          member.vignette = null;
          if (payoff.success) {
            member.popularity = clamp(member.popularity + payoff.popularityDelta, 0, 100);
            if (member.popularity > member.careerHighPopularity) {
              member.careerHighPopularity = member.popularity;
              member.careerHighWeek = world.week;
            }
            member.momentum = clamp(member.momentum + payoff.momentumDelta, 0, 100);
          }
          const weeksWord = `${world.settings.vignetteWeeks} ${world.settings.vignetteWeeks === 1 ? 'week' : 'weeks'}`;
          world.weeklyNews.push(
            wire(
              'debut',
              payoff.success
                ? `${weeksWord} of those vignettes finally pay off — ${member.name} debuts tonight as ${member.gimmick.name}, and this crowd already knows every syllable of the name.`
                : `${member.name} finally debuts tonight as ${member.gimmick.name}, exactly as advertised for ${weeksWord} running. The crowd's reaction? Not much of one at all.`,
              world.week,
              payoff.success ? 'lead' : 'minor',
            ),
          );
          world.pendingGimmickReactions.push({ kind: 'debut', name: member.name, gimmickName: member.gimmick.name });
        }

        // ---- the night nobody had a referee -------------------------------
        // §0: this system takes health off the man in the shirt and morale
        // off everybody in the match, and it said nothing. A booker whose
        // only official was hurt watched his locker room sour for weeks with
        // no line anywhere explaining it. It is one of the few problems in
        // this game with an obvious fix — go and sign another referee — so
        // not saying it was the whole of the damage.
        if (draftedIntoTheShirt.size > 0) {
          const counted = [...draftedIntoTheShirt]
            .map((id) => world.wrestlers[id]?.name)
            .filter((name): name is string => Boolean(name));
          world.weeklyNews.push(
            wire(
              'official',
              counted.length === 1
                ? `There was not one official fit to work tonight, so ${counted[0]} counted their own matches in a borrowed shirt — and nobody in that ring was thrilled about it.`
                : `There was not one official fit to work tonight. ${counted.slice(0, -1).join(', ')} and ${counted[counted.length - 1]} counted their own matches, and this room knew exactly who was not on the payroll.`,
              world.week,
              'lead',
            ),
          );
        }

        // ---- what it cost the men who worked hurt -------------------------
        // The booker cleared them and then booked them. Their own stated
        // intention decides the gamble: a man who said he would take the full
        // time is simply having a bad night at work, but a man who said he was
        // fine has now proved it or not. See career/theBody.ts.
        //
        // Settled once per night rather than per match, and only for the men
        // who were still carrying the same injury at the final bell — anybody
        // hurt fresh tonight had his clearance torn up by `putOut`, and the
        // new injury is the story instead.
        //
        // Filed *after* the week ticks over, with the rest of the weekly news,
        // and that placement is the whole reason this took two goes to land.
        // Written inside the card loop it ran correctly and reported nothing:
        // the wire drops anything stamped earlier than the current week, so
        // every line it produced was discarded as last week's news and the
        // system looked dead from the outside. A path that can retire or bury
        // somebody must not be able to do it quietly — see §0.
        for (const [id, night] of workedHurtTonight) {
          const person = world.wrestlers[id];
          if (!person?.injury || !person.clearedToWorkHurt) continue;
          const stance = stanceOn(person, world.settings);
          // He is doing what the doctor told him and happened to be booked. No
          // gamble was taken, so there is nothing to settle.
          if (!stance || stance.man.intent === 'restProperly') continue;

          // Seeded from the man and the night, never drawn from the world's
          // stream — an extra draw here shifts every seeded roll downstream
          // and silently rebases unrelated content. Third time this session.
          const outcome = resolveInjuryCall(
            stance.man.intent,
            stance.doctor,
            person,
            rngFromSeed(`workedhurt:${person.id}:${world.week}`),
            world.settings,
          );

          person.health = clamp(person.health - outcome.healthCost, 0, 100);
          // Remembered as one he ignored the doctor over, whichever way it
          // went — `recklessHistory` is about the decision, not the luck, and
          // the memorial wall reads it back to say he went out there hurt.
          //
          // Matched on the week rather than taken as the last entry: the last
          // entry is only this injury if nothing has been written since, and
          // an injury that never reached `recordInjury` at all still has to be
          // written down, or a man can die of something with no record of it.
          const history = person.injuryHistory ?? [];
          const mine = history.find((r) => r.week === person.injury!.sufferedWeek);
          if (mine) mine.workedThroughIt = true;
          else {
            person.injuryHistory = recordInjury(
              history,
              person.injury,
              world.settings.startingYear + Math.floor(world.week / 52),
              true,
            );
          }

          if (outcome.outcome === 'died') {
            const passing: Passing = {
              wrestlerId: person.id,
              cause: 'accident',
              age: person.age,
              week: world.week,
            };
            // Whose hands it was. The room looks at the man who was least
            // equipped for what the match was asking, and if it was bad
            // enough it stops blaming the office and starts blaming him.
            const inThereWithHim = [...night.others]
              .map((other) => world.wrestlers[other])
              .filter((other): other is Wrestler => Boolean(other) && !other!.deceased);
            const likeliest = inThereWithHim.reduce<Wrestler | null>(
              (worst, other) =>
                !worst ||
                negligenceOf(other, night.violence, world.settings) >
                  negligenceOf(worst, night.violence, world.settings)
                  ? other
                  : worst,
              null,
            );
            const blamed =
              likeliest &&
              wasNegligent(
                likeliest,
                night.violence,
                rngFromSeed(`blame:${person.id}:${world.week}`),
                world.settings,
              )
                ? likeliest
                : null;
            passAway(person, passing, outcome.line, {
              alsoInTheRing: [...night.others],
              blamed,
            });
            continue;
          }

          if (outcome.outcome === 'gotAwayWithIt') {
            // He is back sooner. `totalWeeks` is left alone deliberately: the
            // doctor's number is what it always was, so a man who keeps going
            // out there keeps rolling against the same odds rather than
            // grinding his own injury down to nothing.
            person.injury.weeksRemaining = Math.min(person.injury.weeksRemaining, outcome.weeksOut);
            world.weeklyNews.push(wire('injury', outcome.line, world.week, 'normal'));
            continue;
          }

          // It went wrong. Whatever the arrangement was, it is over.
          person.injury.weeksRemaining = outcome.weeksOut;
          person.injury.totalWeeks = Math.max(person.injury.totalWeeks, outcome.weeksOut);
          person.clearedToWorkHurt = false;
          person.career.longestInjuryWeeks = Math.max(person.career.longestInjuryWeeks, outcome.weeksOut);
          world.weeklyNews.push(wire('injury', outcome.line, world.week, 'lead'));

          if (outcome.outcome === 'careerEnding') {
            retire(person);
            const reason = RETIREMENT_REASON_TEXT.body;
            world.thisYear.retirements.push({ wrestlerId: person.id, reason });
            world.weeklyNews.push(retirementLine(person.name, reason, world.week));
            leaveTheBusiness(world, person.id, 'retired');
          }
        }
        // Feuds nobody advanced this week go cold; the bad blood behind them
        // barely moves (§12.5).
        world.rivalries = world.rivalries.map((r) => decayRivalry(r, world.week, world.settings));

        // And rival bookers slowly forget what you did to them on a joint card.
        world.grudges = decayGrudges(world.grudges, world.settings);

        // A show's worth of wear on everything that was hauled out tonight.
        world.assetConditions = world.assetConditions.map((state) =>
          wearAsset(state, {
            ...world.settings,
            // A night spent hauling gear through a storm ages it faster than
            // an ordinary one.
            assetWearPerShow: world.settings.assetWearPerShow + (callOutcome?.extraWear ?? 0),
          }),
        );

        // Match hardware wears differently depending on whether it actually
        // did anything tonight — a ladder sitting in storage ages slowly; one
        // that just took a beating in a match ages a lot faster. See
        // engine/economy/matchProps.ts. Nothing "used tonight" if the show
        // itself never happened.
        const usedTonight = night.cancelled
          ? new Set<Id>()
          : new Set<Id>(
              [...world.currentCard, ...world.currentDarkMatches, ...world.currentPromos].flatMap(
                (s) => s.gearUnitIds ?? [],
              ),
            );
        // How much harder tonight's specific booking was on the gear it
        // used — a table that was actually on fire in a Flaming Tables
        // match wears out far faster than the same tier table in a plain
        // Tables Match. See Stipulation.gearWearMultiplier.
        const gearWearMultiplierByUnit = new Map<Id, number>();
        if (!night.cancelled) {
          for (const s of [...world.currentCard, ...world.currentDarkMatches, ...world.currentPromos]) {
            const mult = (s.stipulation ? stipulationById(s.stipulation) : null)?.gearWearMultiplier ?? 1;
            for (const unitId of s.gearUnitIds ?? []) {
              gearWearMultiplierByUnit.set(unitId, Math.max(gearWearMultiplierByUnit.get(unitId) ?? 1, mult));
            }
          }
        }
        world.ownedPropUnits = world.ownedPropUnits.map((unit) => {
          const tier = propTierById(unit.tierId);
          if (!tier) return unit;
          return usedTonight.has(unit.id)
            ? useWearUnit(unit, tier, gearWearMultiplierByUnit.get(unit.id) ?? 1)
            : idleWearUnit(unit, tier);
        });

        // Deals run down whether or not anybody was booked.
        const expired = expireContracts(world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean));

        // ---- who wants out, and who is still sitting out ------------------
        // A release request is never a surprise: morale is on the roster card
        // for weeks before it gets here, so this is the consequence of
        // something the player watched happen.
        // Keep anything the player did since the last report — firing
        // somebody on a Tuesday has to appear in Monday's write-up, not
        // vanish because the show ran. Only the *previous* report's items go.
        world.weeklyNews = world.weeklyNews.filter((item) => item.week >= world.week);

        // ---- the joint show, if the booker never signed the card off -----
        // The building was booked the moment both companies shook hands. A
        // booker still arguing about the running order when the week turns
        // does not get the show postponed; it runs on whatever survived.
        // Filed after the increment so its lines are not dropped by the sweep
        // above, like every other piece of weekly news.
        settleSupershow(world, rng);

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
                grade: 15,
                description: 'Hurt getting to the building',
                sufferedWeek: world.week,
                totalWeeks: weeks,
                weeksRemaining: weeks,
                permanentStatLoss: {},
                earlyReturnWeeksUsed: 0,
              };
              // Written into the body's permanent record, not only the current
              // status. A career is what has already happened to it.
              unlucky.injuryHistory = recordInjury(
                unlucky.injuryHistory ?? [],
                unlucky.injury,
                world.settings.startingYear + Math.floor(world.week / 52),
              );
              world.weeklyNews.push(
                wire(
                  'departure',
                  `${unlucky.name} went over on the ice in the loading bay carrying ${pronounsFor(unlucky).their} own bag in and is out for ${weeks} ${weeks === 1 ? 'week' : 'weeks'}. Nothing to do with the match.`,
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
        // ---- the towns forget, slowly ------------------------------------
        // Everywhere somebody has a standing and did not appear this week
        // fades a little — never below what their national reputation holds
        // up, because you cannot be forgotten somewhere while you are famous
        // everywhere. See engine/career/reach.ts.
        const townTonight = world.showSetup.territoryId;
        for (const person of Object.values(world.wrestlers)) {
          if (!person?.regionalPopularity) continue;
          const workedTonight = worked.has(person.id);
          for (const territoryId of Object.keys(person.regionalPopularity)) {
            if (workedTonight && territoryId === townTonight) continue;
            const fade = absenceDecay(person, territoryId, world.settings);
            if (fade > 0) {
              setLocal(person, territoryId, localStanding(person, territoryId, world.settings) - fade);
            }
          }
        }

        // ---- the stories -------------------------------------------------
        //
        // Everything booked tonight, folded into whatever arcs it belongs to.
        // A storyline is advanced by the things the player was already doing,
        // which is the whole point: no extra clicks, and forgetting to book a
        // feud is a thing that can actually happen to you.
        const advancedTonight = new Set<Id>();
        for (const beat of tonightsBeats) {
          for (const story of world.storylines) {
            if (!isLive(story)) continue;
            // Everybody in the story has to be in the thing that happened.
            if (!story.participantIds.every((id) => beat.participantIds.includes(id))) continue;
            const before = story.stage;
            const moved = advance(
              story,
              { week: world.week, kind: beat.kind, text: beat.text },
              world.settings,
            );
            Object.assign(story, moved);
            advancedTonight.add(story.id);

            // Nothing happens off-screen: a story coming to the boil is news,
            // and the booker is owed the sentence rather than having to spot
            // a label change on a board.
            if (before !== moved.stage && moved.stage === 'boiling') {
              world.weeklyNews.push(
                wire(
                  'story',
                  `${story.name} is boiling over — this thing is as hot as it is ever going to get, and whatever comes next had better settle it once and for all.`,
                  world.week,
                  'normal',
                ),
              );
            }
          }
        }

        // A blow-off, when the booker actually booked one. Only a decisive
        // finish in a grudge stipulation settles a story — the same rule the
        // rivalry system already uses, so the two never disagree about
        // whether something ended.
        for (const settled of blowoffsTonight) {
          const story = world.storylines.find((st) => st.id === settled.storylineId);
          if (!story || !isLive(story)) continue;
          const quality = blowOffQuality(story, settled.rating, world.week, world.settings);
          Object.assign(story, blowOff(story, world.week, settled.winnerName, quality, world.settings));
          advancedTonight.add(story.id);

          // What it was worth. Scaled entirely by how well it was built and
          // how it went on the night — see world/storyline.ts.
          for (const id of story.participantIds) {
            const person = world.wrestlers[id];
            if (!person) continue;
            const won = settled.winnerIds.includes(id);
            person.popularity = clamp(
              person.popularity + quality * world.settings.storylinePayoffPopularity * (won ? 1 : 0.4),
              0,
              100,
            );
            person.momentum = clamp(
              person.momentum +
                quality * world.settings.storylinePayoffMomentum * (won ? 1 : -0.3),
              0,
              100,
            );
          }
          world.promotion.rating = clamp(
            world.promotion.rating + quality * world.settings.storylinePayoffCompanyRating,
            0,
            100,
          );
          world.weeklyNews.push(
            wire('story', `${story.name} is over. ${story.payoff}`, world.week, 'lead'),
          );
        }

        // And the ones nobody touched. A week off is survivable; five is not,
        // and the board has been saying so the whole time.
        for (const story of world.storylines) {
          if (!isLive(story) || advancedTonight.has(story.id)) continue;
          const before = story.stage;
          Object.assign(story, neglect(story, world.week, world.settings));
          if (before !== story.stage && story.stage === 'fizzled') {
            world.promotion.rating = clamp(
              world.promotion.rating - world.settings.storylineFizzleRating,
              0,
              100,
            );
            world.weeklyNews.push(
              wire(
                'story',
                `${story.name} has quietly flatlined. Nobody has touched it in ${story.neglectedWeeks} weeks, and this crowd has already moved on to something else.`,
                world.week,
                'normal',
              ),
            );
          }
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
        // The room, once, rather than rebuilt for every person in it — what
        // the office gave everybody else is the same list whoever is reading.
        const lockerRoom = world.promotion.rosterIds
          .map((id) => world.wrestlers[id])
          .filter((w): w is Wrestler => Boolean(w) && !w!.deceased);
        /** Everybody's mood before tonight is folded in. See `moraleOf`. */
        const moodBefore = new Map(lockerRoom.map((w) => [w.id, w.morale]));
        for (const id of world.promotion.rosterIds) {
          const member = world.wrestlers[id];
          if (!member || member.deceased) continue;
          const report = weeklyMorale(
            member,
            moraleContext(member, moraleShow, {
              popularityOf: (other) => world.wrestlers[other]?.popularity ?? 0,
              roster: lockerRoom,
              alliesOf: (who) => alliesOf.get(who) ?? noneSet,
              enemiesOf: (who) => enemiesOf.get(who) ?? noneSet,
              beltsHeldBy: (who) =>
                world.titles.filter((t) => !t.vacant && t.currentHolderIds.includes(who)).length,
              // Read off the *start* of the pass, so everybody's night is
              // judged against the same room. Reading it live would mean the
              // first man processed rubbed off on the second and the second
              // on the third, and the order of `rosterIds` would silently
              // decide who cheered whom up.
              moraleOf: (who) => moodBefore.get(who) ?? world.wrestlers[who]?.morale ?? 0,
              // Whose mood actually carries. Most people's does not.
              spreadOf: (who) => {
                const person = world.wrestlers[who];
                if (!person) return 1;
                // Damped by their own door, which is the other half of the
                // insulation: a Poison in a private locker room is not in
                // anybody's face all week, so less of them reaches the room.
                const door = world.settings.perksEnabled ? 1 - moodInsulation(person) : 1;
                return Math.max(0, moodSpread(person) * door);
              },
              // What the market says they are worth, for the one trait that
              // reads its own contract every week. See career/personality.ts.
              worthOf: (who) => {
                const person = world.wrestlers[who];
                return person ? askingRate(person, world.settings) : 0;
              },
              // Their partner, and whether the two of them are on the same
              // shows. A trait about missing somebody needs somebody real to
              // miss, so the pairing is stored rather than implied.
              attachedOf: (person) => {
                if (!person.attachedTo) return null;
                const other = world.wrestlers[person.attachedTo];
                if (!other || other.deceased) return null;
                return { name: other.name, hereToo: other.promotionId === world.promotion.id };
              },
              promotionName: world.promotion.name,
              // Live bad blood, and only inside this locker room — what two
              // men at a rival promotion are doing to each other is not this
              // office's problem.
              shootBurden: (who) => {
                const feud = world.rivalries.find(
                  (r) =>
                    r.resolvedWeek === null &&
                    r.shootHeat > 0 &&
                    r.participantIds.includes(who) &&
                    r.participantIds.every((id) => world.promotion.rosterIds.includes(id)),
                );
                if (!feud) return null;
                const weeklyCost = shootMoraleCostPerWeek(feud, world.settings);
                if (weeklyCost <= 0) return null;
                const withName = feud.participantIds
                  .map((id) => (id === who ? null : world.wrestlers[id]?.name))
                  .find(Boolean);
                return withName ? { withName, weeklyCost } : null;
              },
              weeksIdle: world.week - (lastSeenWeek.get(id) ?? 0),
              companyRating: world.promotion.rating,
              deliveredTo: rewarded,
              currentWeek: world.week,
            }),
            world.settings,
          );
          member.morale = clampMorale(member.morale + report.delta, world.settings);
          member.moraleLastDelta = report.delta;
          member.moraleNote = report.headline?.text ?? null;
        }
        for (const id of world.promotion.rosterIds) {
          const member = world.wrestlers[id];
          if (!member || member.deceased) continue;
          const asking = world.releaseRequests.find((r) => r.wrestlerId === id);
          if (asking) {
            // Still waiting on an answer, and getting unhappier about it —
            // but not forever. Left open, this bled morale every week with no
            // end and no resolution, which put a man on zero and held him
            // there for the rest of the save. Measured at a fifth of a
            // locker room's collapse over twenty weeks.
            //
            // A man who has asked and been ignored for a season stops asking.
            // He does not forgive it: he is sitting on the morale it already
            // cost him, and `handsInNotice` is where that goes when his paper
            // runs out. See career/theBody.ts.
            if (world.week - asking.openedWeek >= world.settings.releaseRequestPatienceWeeks) {
              world.releaseRequests = world.releaseRequests.filter((r) => r.wrestlerId !== id);
              world.weeklyNews.push(
                wire(
                  'departure',
                  `${member.name} has stopped asking to be let go. ${Cap(pronounsFor(member).they)} never got an answer, and is not about to ask twice.`,
                  world.week,
                ),
              );
              continue;
            }
            member.morale = clampMorale(member.morale - refusalCost(world.settings), world.settings);
            continue;
          }
          // What personality needs that morale alone does not carry: what the
          // market says they are worth, for In It For The Money, and whether
          // their `somebodyAtHome` partner is somewhere else right now.
          const partner = member.attachedTo ? world.wrestlers[member.attachedTo] : undefined;
          const wantsOutContext = {
            worth: askingRate(member, world.settings),
            apartFromPartner: Boolean(partner) && partner!.promotionId !== member.promotionId,
          };
          // Seeded from the wrestler and the week, not the shared stream: a
          // trait change that flips `wantsOut` for one member must not shift
          // every seeded roll after it for everybody else. See CLAUDE.md.
          if (
            wantsOut(member, world.settings, wantsOutContext) &&
            chance(rngFromSeed(`releaseRequest:${member.id}:${world.week}`), world.settings.releaseRequestChance)
          ) {
            world.releaseRequests.push({ wrestlerId: id, openedWeek: world.week });
            world.weeklyNews.push(
              wire(
                'departure',
                `${member.name} has formally asked out of ${pronounsFor(member).their} contract, and says outright ${pronounsFor(member).they} will walk away from the money to get it.`,
                world.week,
              ),
            );
          }
        }
        // Another week on the shelf for everybody nobody has signed. This is
        // the only thing that changes about a free agent while he sits there,
        // and `currentAskingRate` reads it to bring his price down — so
        // without it the signing page was a frozen price list and waiting
        // somebody out did nothing. See world/freeAgents.ts.
        world.freeAgents = agePool(world.freeAgents);

        // Ninety days, counted down for everybody in the business.
        for (const person of Object.values(world.wrestlers)) {
          if ((person.noCompeteWeeks ?? 0) > 0) {
            person.noCompeteWeeks = (person.noCompeteWeeks ?? 0) - 1;
            if (person.noCompeteWeeks === 0) {
              world.weeklyNews.push(
                wire(
                  'departure',
                  `${person.name} has cleared ${pronounsFor(person).their} ninety-day freeze and is officially free to sign anywhere in this business.`,
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
                `The ${title.name} has been stripped right off ${names || 'its champion'} — sat undefended too long, and the company took it back. That belt is officially vacant.`,
                world.week,
                'lead',
              ),
            );
          } else if (status === 'finalWarning') {
            world.weeklyNews.push(
              wire(
                'title',
                `The clock has run out — the ${title.name} gets defended this week, or the company vacates it outright.`,
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
                `Nobody up top made a call on the ${title.name} while ${call.championName} sat hurt, so the company took matters into its own hands and vacated it.`,
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
          if (drift !== 0) {
            for (const member of members) {
              if (member) member.ego = clamp(member.ego + drift, 0, 100);
            }
          }

          // ---- who joins, and who walks ---------------------------------
          // A faction that never takes anybody and never loses anybody is a
          // tag team with extra members. All three functions for this were
          // written and tested and had no caller, so a group formed once and
          // then sat there for the rest of the save.
          //
          // Rolled once a week per group rather than per candidate, so a
          // faction cannot absorb four people in a night.
          const ourMembers = faction.memberIds.filter((id) => world.promotion.rosterIds.includes(id));
          if (ourMembers.length === 0) continue;

          // A group is a story that runs for months, not a revolving door.
          // Rolled weekly this produced forty-one comings and goings in a
          // year and read as noise. Each faction gets its own week in the
          // cycle, off its own id, so they do not all move at once.
          const turn = [...faction.id].reduce((h, c) => h + c.charCodeAt(0), 0);
          if ((world.week + turn) % world.settings.factionChurnWeeks !== 0) continue;

          // One man, one group.
          const spokenFor = new Set(
            world.stables
              .filter((other) => other.id !== faction.id && other.disbandedWeek === null)
              .flatMap((other) => other.memberIds),
          );

          // Somebody the group is circling. The reason is the interesting
          // part and it goes on the wire with the signing.
          const targets = recruitmentTargets(
            faction,
            world.promotion.rosterIds
              .map((id) => world.wrestlers[id])
              .filter((w): w is Wrestler => Boolean(w)),
            world.settings,
            spokenFor,
          );
          const wanted = faction.memberIds.length < world.settings.factionMaxMembers ? targets[0] : undefined;
          // Seeded from the group and the week, not the world's stream. See
          // the note on the gossip rng below — same trap, same fix.
          if (
            wanted &&
            rollRecruit(
              rngFromSeed(`recruit:${faction.id}:${world.week}`),
              wanted,
              standing,
              world.settings,
            )
          ) {
            const joining = world.wrestlers[wanted.wrestlerId];
            if (joining && !faction.memberIds.includes(joining.id)) {
              faction.memberIds.push(joining.id);
              world.weeklyNews.push(
                wire(
                  'team',
                  `${joining.name} has officially thrown in with ${faction.name}. ${wanted.reason}`,
                  world.week,
                  'lead',
                ),
              );
              factionRumours.push({
                kind: 'recruitment',
                subject: joining.name,
                who: pronounsFor(joining),
                true: true,
                heat: wanted.appeal,
              });
            }
          }

          // And the door swings the other way. A group that has stopped
          // drawing starts losing the people whose egos brought them.
          for (const member of members) {
            if (!member || faction.memberIds.length <= 2) continue;
            const risk = defectionRisk(member, standing, world.settings);
            if (risk <= 0) continue;
            // Seeded from the man and the week rather than drawn from the
            // world's stream — an extra draw here shifts every seeded roll
            // downstream. This has bitten four times now.
            if (!chance(rngFromSeed(`defect:${member.id}:${world.week}`), risk)) {
              // Not gone, but the internet can tell he is thinking about it.
              factionRumours.push({
                kind: 'defection',
                subject: member.name,
                who: pronounsFor(member),
                true: risk >= world.settings.factionDefectionCap * 0.6,
                heat: risk / world.settings.factionDefectionCap,
              });
              continue;
            }
            faction.memberIds = faction.memberIds.filter((id) => id !== member.id);
            world.weeklyNews.push(
              wire(
                'team',
                `${member.name} has walked clean out on ${faction.name} — it simply stopped being worth the trouble of staying.`,
                world.week,
                'lead',
              ),
            );
          }
        }

        // ---- what the internet has heard --------------------------------
        // The wire is what happened; this is what people think is about to.
        // It is the one channel allowed to be wrong, and the signal is the
        // number of voices rather than any one line — see world/rumours.ts.
        //
        // Real whispers first, then invented ones to fill the week, then the
        // whole lot shuffled so a planted rumour does not sit identifiably at
        // the bottom of the feed.
        if (world.lastFanReaction && world.lastFanReaction.week >= world.week - 1) {
          // Seeded from the week, never drawn from the world's stream. Every
          // draw added here shifts every seeded roll downstream and silently
          // rebases unrelated content — this block broke a secret-signing
          // test the first time it was written, which is the fifth time that
          // has happened in this file. If you are adding randomness to
          // `resolveWeek`, seed it from something stable and move on.
          const gossip = rngFromSeed(`rumours:${world.settings.seed}:${world.week}`);
          const roster = world.promotion.rosterIds
            .map((id) => world.wrestlers[id])
            .filter((w): w is Wrestler => Boolean(w) && !w!.deceased);

          const heard: Rumour[] = [...factionRumours];

          // Somebody the crowd has decided is the best thing here. Good news
          // is information too, and it repeats the same way bad news does.
          const hottest = roster.reduce<Wrestler | null>(
            (best, w) => (!best || w.momentum > best.momentum ? w : best),
            null,
          );
          if (hottest && hottest.momentum >= world.settings.rumourOnFireMomentum) {
            heard.push({
              kind: 'onFire',
              subject: hottest.name,
              who: pronounsFor(hottest),
              true: true,
              heat: hottest.momentum / 100,
            });
          }

          // A man working hurt with the office's blessing is exactly the kind
          // of thing the front row can see and the booker hopes they cannot.
          for (const person of roster) {
            if (person.injury && person.clearedToWorkHurt) {
              heard.push({ kind: 'workingHurt', subject: person.name, who: pronounsFor(person), true: true, heat: 0.8 });
            }
            if (person.noticeGivenWeek != null) {
              heard.push({ kind: 'walkingOut', subject: person.name, who: pronounsFor(person), true: true, heat: 0.9 });
            }
          }

          // Bad blood the crowd is not supposed to know about.
          for (const feud of world.rivalries) {
            if (feud.resolvedWeek !== null || feud.shootHeat < world.settings.rumourBadBloodHeat) continue;
            if (!feud.participantIds.every((id) => world.promotion.rosterIds.includes(id))) continue;
            const names = feud.participantIds.map((id) => world.wrestlers[id]?.name).filter(Boolean);
            if (names.length < 2) continue;
            heard.push({
              kind: 'badBlood',
              subject: names[0]!,
              other: names[1]!,
              who: pronounsFor(world.wrestlers[feud.participantIds[0]!]!),
              true: true,
              heat: feud.shootHeat / 100,
            });
          }

          // And the ones that are not about anything, so that reading the
          // feed stays a judgement rather than an instruction.
          const pairs = roster.map((w) => ({ name: w.name, other: pick(gossip, roster).name, who: pronounsFor(w) }));
          while (heard.length < world.settings.rumoursPerWeek) {
            const made = inventRumour(gossip, pairs, ['defection', 'recruitment', 'badBlood', 'workingHurt', 'walkingOut', 'onFire']);
            if (!made) break;
            heard.push(made);
          }

          const lines = heard
            .slice(0, world.settings.rumoursPerWeek)
            .flatMap((rumour) => rumourTweets(rumour, gossip, world.settings));
          const handles = [...FAN_HANDLES].filter(
            (h) => !world.lastFanReaction!.tweets.some((t) => t.handle === h),
          );
          for (const text of lines) {
            const handle = handles.splice(Math.floor(gossip.next() * handles.length), 1)[0];
            if (!handle) break;
            world.lastFanReaction.tweets.push({
              handle,
              text,
              tone: 'contrarian',
              likes: Math.round(1 + gossip.next() * world.settings.fanTweetLikesScale * 0.4),
            });
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
                // The length he asked for, not a flat two years for everybody.
                // See economy/contracts.ts desiredContractWeeks.
                const agreedWeeks = desiredContractWeeks(person, world.settings);
                person.contract.weeksRemaining = agreedWeeks;
                person.contract.totalWeeks = agreedWeeks;
              }
              world.weeklyNews.push(
                wire(
                  'signing',
                  `${signing.fromPromotionName} moved fast and locked ${person.name} down to a brand-new deal — somebody over there heard ${pronounsFor(person).they} had been shopping around and beat everybody else to the punch.`,
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
          // On the payroll line, because that is what it is — even though the
          // man it pays is not on the roster and cannot be booked.
          books.spend('payroll', signing.weeklyRate);
          if (rollExposure(rng, signing, world.week, world.settings)) {
            signing.blownWeek = world.week;
            world.weeklyNews.push(
              wire(
                'signing',
                `The sheets have finally worked out exactly where ${person.name} went. ${Cap(pronounsFor(person).they)} has not set foot on a ${signing.fromPromotionName} show since that deal ran out, and somebody finally asked the obvious question. Whatever big surprise you were saving ${pronounsFor(person).them} for, the cat is out of the bag now.`,
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
            // A real star does not get quietly re-papered by the office he
            // already works for. He reaches the open market and the whole
            // business finds out at once — see economy/bidding.ts. This is
            // the third door out of a contract, alongside renewals (your own
            // people) and poaching (somebody else's, mid-deal).
            if (openBiddingWar(world, rng, person, 'freeAgentStar')) continue;
            const agreedWeeks = desiredContractWeeks(person, world.settings);
            person.contract.weeksRemaining = agreedWeeks;
            person.contract.totalWeeks = agreedWeeks;
            // And it costs them what it would cost anybody. The term used to
            // be renewed and the number left alone, so a rival's man who came
            // up from nothing to main event for five years was still on his
            // week-one rate — his company never felt its own success, and the
            // player's did, every renewal. Measured over eighty-seven weeks,
            // one rival's average wage did not move by a single dollar.
            const owed = splitRate(person, world.settings, renewalRate(person, world.settings));
            person.contract.weeklyRate = owed.weeklyRate;
            person.contract.perAppearance = owed.perAppearance;
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

        // Injuries mend — or do not — depending on what the week was spent
        // doing. This used to be a flat countdown, which meant a torn knee
        // healed at exactly the same rate whether the man sat at home or
        // worked three matches on it. The grade is what moves now, and the
        // weeks left are re-derived from it, so somebody looking after
        // themselves comes back sooner than anybody said.
        for (const id of world.promotion.rosterIds) {
          const member = world.wrestlers[id];
          if (!member?.injury) continue;
          const doing = workedThisWeek.has(member.id)
            ? ('wrestled' as const)
            : assignmentOf(member, world.settings);
          const before = member.injury.severity;
          member.injury.grade = clamp(
            member.injury.grade + healPerWeek(doing, world.settings),
            0,
            100,
          );
          member.injury.severity = severityOf(member.injury.grade, world.settings);
          member.injury.weeksRemaining = weeksFromGrade(member.injury.grade, world.settings);

          // §0: a body that got worse this week owes the paper a sentence.
          // Going out on it and quietly deteriorating is exactly the kind of
          // off-screen change the write-up is supposed to make impossible.
          if (doing === 'wrestled' && member.injury.severity !== before) {
            world.weeklyNews.push(
              wire('misfortune', aggravationLine(member.name, before, member.injury.severity), world.week, 'normal'),
            );
          }

          // Fit enough to be booked again. Not fully mended — they can still
          // be carrying something, and it still makes them easier to hurt.
          if (fitToWork(member.injury.grade, world.settings)) {
            member.injury = null;
            member.clearedToWorkHurt = false;
          }
        }

        // And an act wears out. Everybody in the business ages their gimmick,
        // not just the player's roster, so a rival's ace goes stale on the
        // same clock — but working is what does most of the damage, so the
        // people who were on this week lose more than the people who were not.
        //
        // Every promotion in the business runs its own gym now, not only the
        // player's — a rival roster used to be static apart from ageing,
        // which meant the player was the only company anybody ever developed
        // and the gap only ever widened. `promotionsById` is who pays for an
        // appearances week and whose books credit it; it is never the
        // player's business what a rival does with its own gym, so this
        // stays silent on the wire either way (see below).
        const promotionsById = new Map<Id, Promotion>([
          [world.promotion.id, world.promotion],
          ...world.rivals.map((r): [Id, Promotion] => [r.id, r]),
        ]);
        for (const person of Object.values(world.wrestlers)) {
          if (person.deceased || person.careerStatus === 'retired') continue;
          // Said once, the week it tips over. `isStale` had no caller at all,
          // so an act could wear out over a year, drag every match the man
          // was in through `staleGimmickPenalty`, and never appear anywhere
          // the player looks — the penalty was live and the diagnosis was not.
          const wasFresh = !isStale(person, world.settings);
          ageGimmick(person, workedThisWeek.has(person.id), world.settings);

          // The forced cold-meeting clock — a harder threshold than the
          // stale warning above, and its own escalating consequence.
          // Tracked for everybody so a released-and-resigned wrestler
          // doesn't inherit a stale counter from nowhere, but only the
          // player's own roster can actually trigger the meeting — a
          // rival's cold act is their problem, same as the stale line.
          const cold = isIceCold(person, world.settings);
          person.weeksIceCold = cold ? (person.weeksIceCold ?? 0) + 1 : 0;
          if (
            cold &&
            person.weeksIceCold >= world.settings.coldMeetingTriggerWeeks &&
            world.promotion.rosterIds.includes(person.id) &&
            !world.coldMeetings.some((m) => m.wrestlerId === person.id)
          ) {
            world.coldMeetings.push({ wrestlerId: person.id, stage: 'decide', openedWeek: world.week });
            world.weeklyNews.push(
              wire('misfortune', goneIceColdLine(person.name, pronounsFor(person)), world.week, 'lead'),
            );
          }

          // What they did with the week, if we did not book them for one —
          // for whichever promotion signs them. See career/assignment.ts.
          const promotion = person.promotionId ? promotionsById.get(person.promotionId) : undefined;
          if (!workedThisWeek.has(person.id) && promotion) {
            const doing = assignmentOf(person, world.settings);
            const week = weekOff(person, doing, world.settings);
            person.strength = clamp(person.strength + week.strength, 1, 100);
            person.skill = clamp(person.skill + week.skill, 1, 100);
            person.agility = clamp(person.agility + week.agility, 1, 100);
            person.stamina = clamp(person.stamina + week.stamina, 1, 100);
            person.ringIQ = clamp(person.ringIQ + week.ringIQ, 1, 100);
            person.popularity = clamp(person.popularity + week.popularity, 0, 100);
            person.health = clamp(person.health + week.health, 0, 100);
            person.energy = clamp(person.energy + week.energy, 0, 100);
            person.morale = clampMorale(person.morale + week.morale, world.settings);
            person.gimmickFreshness = clamp(person.gimmickFreshness - week.freshnessCost, 0, 100);
            if (week.earned > 0) {
              promotion.bankBalance += week.earned;
              creditPay(ledgerOf(person), week.earned);
            }
            person.doingThisWeek = week.note;
          } else {
            person.doingThisWeek = null;
          }
          // The wire only ever reports on the player's own business — a
          // rival's gimmick going stale is their problem to notice, not §0's.
          if (wasFresh && isStale(person, world.settings) && world.promotion.rosterIds.includes(person.id)) {
            world.weeklyNews.push(wire('misfortune', goneStaleLine(person.name, pronounsFor(person)), world.week, 'normal'));
          }
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
              passAway(person, passing, `${DEATH_CAUSE_TEXT[passing.cause]}.`, null);
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
              unretire(person, world.settings, world.week);
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
            wantsWeeks: desiredContractWeeks(person, world.settings),
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

        // Companies are born as well as dying. When the business has more
        // talent than it has places to put it, somebody with money looks at
        // all those unemployed wrestlers and opens a promotion — see
        // world/newPromotions.ts, and the measurements in its header for what
        // the business looked like before anything replaced a fold.
        {
          const employable = Object.values(world.wrestlers).filter(
            (w) => !w.deceased && w.careerStatus !== 'retired' && w.role === 'wrestler',
          );
          const spare = employable.filter((w) => w.promotionId === null);
          const alive = [world.promotion, ...world.rivals].filter((p) => p.closedWeek === null);
          const openingCtx = {
            alive,
            unemployed: spare.length,
            takenNames: new Set(
              [world.promotion, ...world.rivals].map((p) => p.name.toLowerCase()),
            ),
            currentWeek: world.week,
          };
          if (rollOpening(rng, openingCtx, world.settings)) {
            const company = foundPromotion(rng, openingCtx, world.territories.map((t) => t.id), world.settings);
            const founding = foundingRoster(spare, world.settings);
            for (const person of founding) {
              person.promotionId = company.id;
              person.contract = createStandardContract(
                person,
                world.settings,
                world.settings.startingYear + Math.floor(world.week / 52),
              );
              company.rosterIds.push(person.id);
              world.freeAgents = world.freeAgents.filter((a) => a.wrestlerId !== person.id);
            }
            world.rivals.push(company);
            world.weeklyNews.push(
              wire('signing', openingLine(company, founding.length), world.week, 'lead'),
            );
          }
        }

        // Rivals replace the people they lost, the week they lose them. They
        // ---- the Crucible sends its invitation ---------------------------
        // Once a year, first week of August. The fee is steep and it leaves the
        // bank whether the night goes well or badly, which is what makes
        // entering a decision rather than a formality.
        {
          const label = weekLabel(world.week, world.settings);
          const cupYear = label.year;
          if (
            label.month === CUP_MONTH &&
            label.weekOfMonth === 1 &&
            world.lastCupYear !== cupYear &&
            !world.pendingCupEntry &&
            !world.lastCup
          ) {
            const likely = world.rivals.filter(
              (r) => r.closedWeek === null && willEnter(r, world.settings),
            );
            // The player counts toward the field, so the floor is one fewer
            // rivals than the minimum. Below that the thing simply does not run.
            if (fieldIsBigEnough(likely.length + 1, world.settings)) {
              const slots = slotsPerPromotion(likely.length + 1, world.settings);
              world.pendingCupEntry = {
                year: cupYear,
                fee: world.settings.cupEntryFee,
                likelyField: likely.length,
                slotsEach: slots,
                estimatedPot: cupPurse([world.promotion, ...likely], world.settings).pot,
                expiresWeek: world.week,
              };
              world.weeklyNews.push(
                wire(
                  'story',
                  `The Crucible is officially taking entries. ${likely.length} ${likely.length === 1 ? 'company has' : 'companies have'} already paid up and thrown their hat in.`,
                  world.week,
                  'lead',
                ),
              );
            } else {
              world.lastCupYear = cupYear;
            }
          }
        }

        // ---- somebody proposes a joint show ------------------------------
        // §16. A rival with an appetite for it puts a package in front of the
        // booker: their terms, their read on the split, take it or leave it.
        // The offer stands for a few weeks and then it is gone — a company
        // does not hold its biggest night of the year open indefinitely.
        if (
          world.pendingSupershow &&
          world.week > world.pendingSupershow.expiresWeek
        ) {
          world.weeklyNews.push(
            wire(
              'story',
              `${world.pendingSupershow.partnerName} have moved on. The joint show is dead and off the table entirely.`,
              world.week,
              'minor',
            ),
          );
          world.pendingSupershow = null;
        }

        // Two joint shows a year, and they are on the calendar rather than on
        // a dice roll: the spring one lands in May, the autumn one in November.
        // A random weekly chance meant a save could go three years without the
        // biggest night on the schedule, which is no way to run a business.
        const seasonNow = SUPERSHOW_SEASONS.find((m) => isInMonth(world.week, m)) ?? null;
        const seasonTag = seasonNow ? `${weekLabel(world.week, world.settings).year}-${seasonNow}` : null;

        // The joint shows used to be a weekly dice roll and are now a date in
        // the diary, but the draw stays on the stream. Taking it off shifted
        // every seeded world downstream — the same reason facialHair rolls at
        // probability zero for women rather than skipping the call.
        chance(rng, world.settings.supershowOfferChancePerWeek);

        if (
          seasonTag &&
          !world.pendingSupershow &&
          !world.lastSupershow &&
          world.lastSupershowSeason !== seasonTag &&
          world.week >= world.settings.supershowEarliestWeek
        ) {
          world.lastSupershowSeason = seasonTag;
          const open = world.rivals.filter((r) => r.closedWeek === null && r.rosterIds.length >= 4);
          if (open.length > 0) {
            const partner = pick(rng, open);
            // Resentment they carry toward the player, which is what actually
            // decides whether a booker will share a building with you.
            // A booker who is above you and has nothing to gain resents being
            // asked; there is no separate grudge ledger to read from yet, so
            // standing carries it on its own.
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
            const appetite = coopAppetite(world.promotion, partner, resentment, world.settings);
            const mood = moodFor(appetite, resentment, world.settings);
            const draft = openingOffer(
              world.promotion,
              partner,
              world.promotion.homeTerritoryId,
              world.week,
              world.settings,
            );
            const reply = respondToOffer(rng, draft, world.promotion, partner, resentment, world.settings);

            if (reply.kind === 'refused') {
              if (reply.publicly) {
                world.weeklyNews.push(
                  wire('story', `${partner.name} let it be known they turned down a joint show. ${reply.because}`, world.week, 'minor'),
                );
              }
            } else {
              const deal = reply.kind === 'countered' ? reply.deal : reply.deal;
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
                    : moodLine(mood, partner.name),
                estimatedNet: estimate.playerNet,
                expiresWeek: world.week + world.settings.supershowOfferWeeks,
              };
              world.weeklyNews.push(
                wire(
                  'story',
                  `${partner.name} are pitching a joint pay-per-view, and it is a big one. ${world.pendingSupershow.pitch}`,
                  world.week,
                  'lead',
                ),
              );
            }
          }
        }

        // shop in the same pool the player does, so a promotion that leaves
        // talent sitting there will watch somebody else sign it — and now
        // finds out the week it happens rather than the following December.
        for (const rival of world.rivals) {
          if (rival.closedWeek !== null) continue;
          // A company already cutting its own payroll to survive does not
          // spend the same week hiring — see rivalEconomy.ts's
          // shouldTrimPayroll. Otherwise a wrestler released three lines
          // above this one could be signed straight back before the week is
          // even over, and the whole point of the release was to spend less.
          if (shouldTrimPayroll(rival.weeksInTheRed, world.settings)) continue;
          const target = rivalRosterSize(rival.rating, world.settings);
          let short = target - rival.rosterIds.length;
          // One signing a week each. A rival that refilled a whole roster in
          // an afternoon read as a batch job, not as a competitor.
          if (short <= 0) continue;
          const index = Math.floor(rng.next() * world.freeAgents.length);
          const agent = world.freeAgents[index];
          const signing = agent ? world.wrestlers[agent.wrestlerId] : undefined;
          // Finished is finished. Checking only 'retired' let a promotion sign
          // a retired hall of famer off the free agent list, because induction
          // overwrites that status with 'hallOfFamer'.
          if (!signing || signing.deceased || isFinished(signing)) continue;
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
          // Worth an actual reaction, not just a line on the wire, only when
          // it's a name that would move the needle. See rivalMove.ts.
          if (!world.pendingRivalMove && signing.popularity >= world.settings.rivalMoveReactionPopularity) {
            world.pendingRivalMove = {
              week: world.week,
              rivalId: rival.id,
              rivalName: rival.name,
              wrestlerId: signing.id,
              wrestlerName: signing.name,
            };
          }
          short -= 1;

          // A rival launching a whole new championship is rarer than a
          // signing — gated on its own per-week seed for the same reason as
          // the catastrophe roll: this check runs for every rival, every
          // week, and the shared rng stream would shift every other seeded
          // roll in the game by one draw per rival if it drew from it
          // directly. See CLAUDE.md's RNG trap note.
          if (chance(rngFromSeed(`${world.settings.seed}-rivaltitle-${rival.id}-${world.week}`), world.settings.rivalNewTitleWeeklyChance)) {
            const existingNames = new Set(world.titles.filter((t) => t.promotionId === rival.id).map((t) => t.name));
            const blueprints = startingBlueprints(rival.identity);
            // Whichever of the archetype's usual belts this rival does not
            // already run — picked after naming, since the prefix a real
            // belt name gets (beltPrefix, promotionIdentity.ts) is derived
            // from the promotion's own name, not guessable up front.
            const candidates = blueprints
              .map((b) => createStartingTitles(rival.id, rival.name, rival.identity, [b])[0]!)
              .filter((t) => !existingNames.has(t.name));
            const fresh = candidates.length > 0 ? pick(rng, candidates) : null;
            if (fresh) {
              fresh.id = `${rival.id}-title-${world.week}-${world.titles.length}`;
              fresh.lastDefendedWeek = world.week;
              world.titles.push(fresh);
              rival.titleIds.push(fresh.id);
              world.weeklyNews.push(
                wire('title', `${rival.name} has introduced the ${fresh.name}. It is vacant.`, world.week, 'lead'),
              );
            }
          }
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
              official(`${referee.name}'s contract has run out. Back in the pool, and anybody can sign them.`);
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
        //
        // How much of a rest week somebody actually gets depends on who they
        // work for: a night off from a company running one show is a week at
        // home, and a night off from one running five is a night in a
        // different hotel. Cached per company rather than recomputed per
        // person, because this runs across every wrestler alive every week.
        const recoveryByPromotion = new Map<Id, number>();
        const recoveryFor = (promotionId: Id | null): number => {
          if (promotionId === null) return 1; // Nobody's road. Free agents heal.
          const cached = recoveryByPromotion.get(promotionId);
          if (cached !== undefined) return cached;
          const employer =
            promotionId === world.promotion.id
              ? world.promotion
              : world.rivals.find((r) => r.id === promotionId);
          const scale = employer
            ? recoveryMultiplier(scheduleOf(employer, world.settings), world.settings)
            : 1;
          recoveryByPromotion.set(promotionId, scale);
          return scale;
        };

        for (const w of Object.values(world.wrestlers)) {
          if (w.deceased || w.careerStatus === 'retired') continue;
          restWeek(w, worked.has(w.id), world.settings, recoveryFor(w.promotionId));
          // What a book costs the man carrying it. He is on the road for all
          // of them every week — attention says he cannot focus on any one,
          // and this is the half that accumulates until he is no use to
          // anybody. See career/representation.ts.
          if (w.role === 'manager') {
            const carrying = bookOf(world.representations, w.id).length;
            if (carrying > 0) {
              w.fatigueDebt = clamp(w.fatigueDebt + roadCost(carrying, world.settings), 0, 100);
              w.energy = clamp(w.energy - roadCost(carrying, world.settings), 0, 100);
            }
          }

          // A served suspension is served. §0: the player is told he is back,
          // rather than finding out by noticing he is bookable again.
          if (w.discipline && tickSuspension(w.discipline, world.week)) {
            if (w.promotionId === world.promotion.id) {
              world.weeklyNews.push(
                wire('signing', `${w.name} has served ${pronounsFor(w).their} suspension and is available again.`, world.week, 'minor'),
              );
            }
          }
        }

        // Who was in a match with whom tonight. A bond is built by working,
        // and until now relationships were seeded at world creation and frozen
        // for thirty years — two men who wrestled two hundred times were
        // exactly as close in year eight as on day one. See career/circle.ts.
        const inTheSameMatch = new Set<string>();
        for (const segment of world.currentCard) {
          const ids = segment.participants.map((p) => p.wrestlerId);
          for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
              inTheSameMatch.add([ids[i]!, ids[j]!].sort().join('~'));
            }
          }
        }
        const onTheSameCard = new Set(bookedTonight);

        world.relationships = world.relationships.filter((tie) => {
          const a = world.wrestlers[tie.aId];
          const b = world.wrestlers[tie.bId];
          // A tie to somebody who has died stays exactly as it was. It is a
          // fact about a life, and the memorial page reads it.
          if (!a || !b || a.deceased || b.deceased) return true;

          const key = [tie.aId, tie.bId].sort().join('~');
          tie.strength = applyDrift(
            tie,
            tieDrift(
              {
                workedTogether: inTheSameMatch.has(key),
                sharedACard: onTheSameCard.has(tie.aId) && onTheSameCard.has(tie.bId),
                bothWorking: a.promotionId !== null || b.promotionId !== null,
              },
              world.settings,
            ),
          );
          // Two people who lost touch are not lifelong friends at strength 2.
          return !hasLapsed(tie, world.settings);
        });

        // A manager goes looking for a name.
        //
        // Nothing signed a representation deal before this, so `representations`
        // stayed empty forever and the whole percentage system was a thing that
        // could happen rather than one that did. A percentage man on your books
        // with room in his diary courts somebody who is already earning — and
        // the cut he asks for is the one his nerve says he can get.
        if (world.settings.repCourtingEnabled) {
          const agents = world.promotion.rosterIds
            .map((id) => world.wrestlers[id])
            .filter((w): w is Wrestler => Boolean(w) && w!.role === 'manager' && !w!.deceased);

          for (const agent of agents) {
            if (!chance(rng, world.settings.repCourtChancePerWeek)) continue;
            const shape = managerFromWrestler(agent);
            const target = world.promotion.rosterIds
              .map((id) => world.wrestlers[id])
              .find(
                (w): w is Wrestler =>
                  Boolean(w) && wouldCourt(shape, w!, world.representations, world.settings, agent),
              );
            if (!target) continue;

            const cut = askingCut(shape, world.settings);
            world.representations.push({
              managerId: agent.id,
              clientId: target.id,
              cut,
              signedWeek: world.week,
            });
            // §0: money starts leaving somebody's purse this week, so the
            // week it starts is the week it is reported.
            world.weeklyNews.push(
              wire(
                'signing',
                `${agent.name} is officially speaking for ${target.name} now, for a cut of ${Math.round(cut * 100)}% right off the top of ${pronounsFor(target).their} purse.`,
                world.week,
                'minor',
              ),
            );
          }
        }

        // ...and deals ending. Both directions, neither through the office:
        // the client can see the bill, the manager can see his diary, and the
        // booker does not get a vote because he did not sign it.
        if (world.settings.repCourtingEnabled) {
          const rateOf = (id: Id) => world.wrestlers[id]?.contract?.weeklyRate ?? 0;

          for (const deal of [...world.representations]) {
            const client = world.wrestlers[deal.clientId];
            const agent = world.wrestlers[deal.managerId];
            if (!client || !agent) continue;

            const presence = presenceAt(world.representations, agent.id, agent, world.settings);
            const walked = clientWouldWalk(deal, client, presence, world.settings);
            const dropped = walked
              ? null
              : managerWouldDrop(world.representations, agent.id, agent, rateOf, world.settings);

            const ending = walked
              ? { reason: walked, by: 'client' as const, rep: deal }
              : dropped && dropped.rep.clientId === deal.clientId
                ? { reason: dropped.reason, by: 'manager' as const, rep: dropped.rep }
                : null;
            if (!ending) continue;

            world.representations = endRepresentation(world.representations, ending.rep.clientId);
            // §0: money stops leaving somebody's purse, so the week it stops
            // is the week it is reported.
            world.weeklyNews.push(
              wire('signing', splitNote(ending.reason, client.name, agent.name), world.week, 'minor'),
            );
          }
        }

        // Where everybody sits on the card, re-read rather than remembered.
        // A main eventer who stops drawing comes down; somebody the crowd has
        // decided about goes up, occasionally two bands at once. Only the
        // player's own roster gets a line in the paper — a rival reshuffling
        // its midcard is not news. See career/cardStatus.ts.
        for (const id of world.promotion.rosterIds) {
          const person = world.wrestlers[id];
          if (!person || person.deceased || isFinished(person)) continue;
          const before = person.cardStatus;
          const after = statusOf(person, world.promotion, world.settings);
          if (after === before) continue;
          person.cardStatus = after;
          const move = statusMove(person, before, after, person.momentum >= world.settings.cardBreakoutMomentum);
          if (move.kind !== 'none') {
            world.weeklyNews.push(
              wire('signing', move.note, world.week, move.kind === 'caughtFire' ? 'lead' : 'minor'),
            );
          }
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

        // What the business believes about somebody, converging on what is
        // true. It learns by watching, so somebody kept off television keeps
        // their reputation — and a bad signing's stock falls the way a real
        // one does: not a revelation, a gradual stopping of people bringing
        // him up. See career/hype.ts.
        for (const person of Object.values(world.wrestlers)) {
          if (person.deceased || person.careerStatus === 'retired') continue;
          const before = person.hype;
          person.hype = clamp(
            person.hype + hypeDrift(person, workedThisWeek.has(person.id), world.settings),
            5,
            99,
          );
          // Said once, on the week it becomes undeniable, and only about
          // people the booker could plausibly have heard of.
          const verdict = crossing(person, before, world.settings);
          if (verdict.kind !== 'nothing' && person.promotionId === world.promotion.id) {
            world.weeklyNews.push(wire('signing', verdict.note, world.week, 'minor'));
          }
        }

        // The crowd's patience with a borrowed surname. Run across everybody
        // in the business rather than just your roster: a rival's second-gen
        // signing burns his father's name on their watch, not yours.
        for (const w of Object.values(world.wrestlers)) {
          if (!w.lineage || w.deceased || w.careerStatus === 'retired') continue;
          const verdict = weeklyLineage(w, world.week, world.settings);
          if (verdict.kind === 'proven') {
            w.lineage.provenBy = world.week;
            // Only the player's own people are worth a line in the paper —
            // this is a note about somebody's standing, not an event.
            if (w.promotionId === world.promotion.id) {
              world.weeklyNews.push(secondGenerationLine(verdict.note, world.week));
            }
          } else if (verdict.kind === 'fading') {
            const before = Math.round(w.popularity);
            w.popularity = Math.max(0, w.popularity - verdict.loss);
            // Said once, on the week it becomes visible, rather than every
            // week for the rest of the fade — §0's "nothing happens to a
            // person off-screen" wants the news, not a drip.
            if (before !== Math.round(w.popularity) && before === w.lineage.inheritedStanding) {
              if (w.promotionId === world.promotion.id) {
                world.weeklyNews.push(secondGenerationLine(verdict.note, world.week));
              }
            }
          }
        }

        // Ego chases what they have become. Build somebody and they notice.
        const egoCtx = { rosterPeakPopularity: rosterPeak, currentWeek: world.week, settings: world.settings };
        for (const w of roster) {
          w.ego = driftEgo(w.ego, targetEgo(w, w.careerStatus, egoCtx), world.settings);

        }

        // Who has had enough and is saying so before the paper runs out.
        // Checked before the expiries below, so the fortnight of warning
        // actually happens rather than arriving with the departure.
        for (const id of world.promotion.rosterIds) {
          const member = world.wrestlers[id];
          if (!member?.contract || member.noticeGivenWeek != null) continue;
          if (!handsInNotice(member, member.contract.weeksRemaining, world.settings)) continue;

          member.noticeGivenWeek = world.week;
          world.weeklyNews.push(
            wire('signing', noticeLine(member.name, member.contract.weeksRemaining, pronounsFor(member)), world.week, 'lead'),
          );
        }

        // The renewal window — opens once, the moment there's still exactly
        // renewalWindowWeeks left. A real, booker-initiated conversation
        // (answerRenewalInterest / answerRenewalWish), not an automatic
        // demand at the buzzer — see the "A deal that ran down..." block
        // below, which now only handles what nobody answered in time.
        // Somebody who already gave notice above has nothing left to ask.
        for (const id of world.promotion.rosterIds) {
          const member = world.wrestlers[id];
          if (!member?.contract || member.noticeGivenWeek != null) continue;
          if (member.contract.weeksRemaining !== world.settings.renewalWindowWeeks) continue;
          if (world.renewalTalks.some((t) => t.wrestlerId === id)) continue;
          world.renewalTalks.push({ wrestlerId: id, stage: 'askInterest', openedWeek: world.week });
        }

        // A deal that ran down comes back as a demand, not as a departure.
        //
        // What the company did is priced here as well as in the free-agent
        // pool: the man who was in the building the night it happened is not
        // a softer negotiation than a stranger who only read about it. It
        // fades on the same clock, and a deal already signed keeps whatever
        // rate it was signed at — so the money forgets and the wall does not.
        const heldAtTheTable = stillHeldAgainstUs(
          world.promotion.deathsOnOurWatch ?? [],
          world.week,
          world.settings,
        );
        const buriedByUs = mostRecentDeath(world.promotion.deathsOnOurWatch ?? []);
        for (const id of expired) {
          const member = world.wrestlers[id];
          if (!member || world.pendingRenewals.some((r) => r.wrestlerId === id)) continue;

          // A renewal auction's winner, agreed while this deal still had
          // time left — win or lose, they kept working these dates, and
          // today is the day it actually changes. See Wrestler.queuedContract
          // and economy/bidding.ts's 'renewalAuction' reason.
          if (member.queuedContract) {
            const queued = member.queuedContract;
            member.queuedContract = null;
            const destination =
              queued.promotionId === world.promotion.id
                ? world.promotion
                : world.rivals.find((r) => r.id === queued.promotionId);
            if (destination) {
              world.promotion.rosterIds = world.promotion.rosterIds.filter((x) => x !== id);
              member.contract = queued.contract;
              member.promotionId = destination.id;
              member.noticeGivenWeek = null;
              if (destination.id === world.promotion.id) {
                world.promotion.rosterIds.push(id);
                openSigningTalk(world, id);
                world.weeklyNews.push(
                  wire(
                    'signing',
                    `${member.name}'s old deal with ${world.promotion.name} has run its course, and the new one — agreed weeks back on the open market — kicks in today.`,
                    world.week,
                    'normal',
                  ),
                );
              } else {
                destination.rosterIds.push(id);
                world.weeklyNews.push(
                  wire(
                    'departure',
                    `${member.name}'s deal with ${world.promotion.name} has finally run out. ${destination.name} won them on the open market weeks ago, and today is the day the move actually happens.`,
                    world.week,
                    'lead',
                  ),
                );
              }
              continue;
            }
            // The destination folded in the meantime — falls through to a
            // plain departure below, same as if no auction had ever run.
          }

          // If a stranger will not come, the man who watched it happen is not
          // going to stay. He is gone, and the wire says why.
          if (buriedByUs && wontWorkForUs(member, heldAtTheTable, world.settings)) {
            world.promotion.rosterIds = world.promotion.rosterIds.filter((x) => x !== id);
            member.promotionId = null;
            member.contract = null;
            member.noticeGivenWeek = null;
            world.freeAgents.push({
              wrestlerId: id,
              reason: 'contractExpired',
              askingRate: askingRate(member, world.settings),
              wantsWeeks: desiredContractWeeks(member, world.settings),
              weeksUnsigned: 0,
            });
            world.weeklyNews.push(
              wire('signing', wontRenewLine(member.name, buriedByUs.name, pronounsFor(member)), world.week, 'lead'),
            );
            continue;
          }

          // He told you a fortnight ago. There is no negotiation to have.
          if (member.noticeGivenWeek != null) {
            world.promotion.rosterIds = world.promotion.rosterIds.filter((x) => x !== id);
            member.promotionId = null;
            member.contract = null;
            member.noticeGivenWeek = null;
            world.freeAgents.push({
              wrestlerId: id,
              reason: 'contractExpired',
              askingRate: askingRate(member, world.settings),
              wantsWeeks: desiredContractWeeks(member, world.settings),
              weeksUnsigned: 0,
            });
            world.weeklyNews.push(
              wire('signing', `${member.name} worked ${pronounsFor(member).their} last date and left, exactly as ${pronounsFor(member).they} said ${pronounsFor(member).they} would.`, world.week),
            );
            continue;
          }

          // Nothing was agreed — either the renewal-window conversation
          // said no on one side, or it never got answered before the clock
          // ran out. Either way there is no negotiation left to have: a
          // plain, quiet departure, same as it always was before the
          // renewal window existed. (Anybody who DID say yes-and-yes is not
          // here — they already have a pendingRenewals offer, caught by the
          // continue at the top of this loop, or already re-signed via
          // answerRenewal before the clock ran out at all.)
          world.renewalTalks = world.renewalTalks.filter((t) => t.wrestlerId !== id);
          world.promotion.rosterIds = world.promotion.rosterIds.filter((x) => x !== id);
          member.promotionId = null;
          member.contract = null;
          world.freeAgents.push({
            wrestlerId: id,
            reason: 'contractExpired',
            askingRate: askingRate(member, world.settings),
            wantsWeeks: desiredContractWeeks(member, world.settings),
            weeksUnsigned: 0,
          });
          world.weeklyNews.push(
            wire('signing', `${member.name}'s deal with ${world.promotion.name} has run out.`, world.week),
          );
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
              w.morale = clampMorale(w.morale + effect.morale, world.settings);
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
          const takenNamesNow = new Set(everyone.map((w) => w.name.trim().toLowerCase()));
          const intake = graduateClass(
            rng,
            graduateCount(
              rng,
              workingPopulation(everyone),
              world.settings,
              // Jobs, not bodies. See academy.ts — a shortage of employers
              // cannot be fixed by making more wrestlers.
              businessCapacity([world.promotion, ...world.rivals], (rating) =>
                rivalRosterSize(rating, world.settings),
              ),
            ),
            year,
            world.settings,
            new Set(takenNamesNow),
          );

          // Some of them turn out to be somebody's kid. Rolled per graduate,
          // so it takes a class *and* a business old enough to have produced
          // an eligible parent — which in a fresh save is twenty years out.
          const lineageCtx = { currentYear: year, currentWeek: world.week };
          const secondGen: { child: Wrestler; parent: Wrestler }[] = [];
          for (let i = 0; i < intake.wrestlers.length; i++) {
            const graduate = intake.wrestlers[i]!;
            const parent = rollParent(rng, [...everyone, ...intake.wrestlers], lineageCtx, world.settings);
            if (!parent) continue;
            const child = asSecondGeneration(rng, graduate, parent, lineageCtx, takenNamesNow, world.settings);
            child.age = lineageDebutAge(rng, world.settings);
            child.regionalPopularity = inheritedTowns(parent, world.settings);
            takenNamesNow.delete(graduate.name.trim().toLowerCase());
            takenNamesNow.add(child.name.trim().toLowerCase());
            intake.wrestlers[i] = child;
            secondGen.push({ child, parent });
          }

          for (const graduate of intake.wrestlers) world.wrestlers[graduate.id] = graduate;
          world.freeAgents.push(...intake.freeAgents);
          notices.graduates = intake.wrestlers.map((w) => w.id);

          // ...and the other door. The school takes nobody over 34; everybody
          // older who still wants a shot turns up at the building instead.
          const walkOns = walkOnIntake(
            rng,
            randInt(rng, world.settings.walkOnsPerYearMin, world.settings.walkOnsPerYearMax),
            year,
            world.settings,
            takenNamesNow,
          );
          for (const person of walkOns.wrestlers) {
            world.wrestlers[person.id] = person;
            takenNamesNow.add(person.name.trim().toLowerCase());
          }
          world.freeAgents.push(...walkOns.freeAgents);
          if (walkOns.wrestlers.length > 0) {
            world.weeklyNews.push(
              wire('debut', walkOnLine(walkOns.wrestlers.map((w) => w.name)), world.week, 'minor'),
            );
          }

          // And the third door: somebody who was never a wrestler and never
          // will be, who can talk and knows it. Without this the mouthpiece
          // pool was the twelve seeded at world creation — they aged out, they
          // died, and nothing replaced them.
          const managerCandidates = generateWrestlers(
            rng,
            world.settings.managerArrivalsConsideredPerYear,
            {
              settings: world.settings,
              currentYear: year,
              existingNames: new Set(takenNamesNow),
            },
          );
          const newManagers = managerIntake(rng, managerCandidates, year, world.settings);
          for (const person of newManagers.wrestlers) {
            world.wrestlers[person.id] = person;
            takenNamesNow.add(person.name.trim().toLowerCase());
          }
          world.freeAgents.push(...newManagers.freeAgents);
          if (newManagers.wrestlers.length > 0) {
            world.weeklyNews.push(
              wire(
                'debut',
                newManagers.wrestlers.length === 1
                  ? `${newManagers.wrestlers[0]!.name} is on the market and looking for a client worth speaking for.`
                  : `${newManagers.wrestlers.map((w) => w.name).join(' and ')} are on the market and looking for a client worth speaking for.`,
                world.week,
                'minor',
              ),
            );
          }

          // And once in a long while the class contains somebody who does not
          // need the ten years. That is not a free-agent listing, that is an
          // auction — see academy.ts asPhenom.
          if (intake.phenomId) {
            const phenom = world.wrestlers[intake.phenomId];
            if (phenom) openBiddingWar(world, rng, phenom, 'phenom');
          }
          if (intake.wrestlers.length > 0) {
            world.weeklyNews.push(debutLine(intake.wrestlers.map((w) => w.name), world.week));
          }
          // A name coming back is its own story, and §0 says nothing happens
          // off-screen — the paper has to say whose kid this is.
          for (const { child, parent } of secondGen) {
            world.weeklyNews.push(secondGenerationLine(lineageDebutLine(child, parent), world.week));
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

        const networkFee = weeklyNetworkFee(currentDeal ?? null, tvRatingThisWeek, world.settings);
        const sponsorFee = weeklySponsorIncome(signedSponsors);
        world.promotion.bankBalance += networkFee + sponsorFee;
        books.earn('television', networkFee);
        books.earn('sponsor', sponsorFee);

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
              // A met mandate pays a bonus; a missed one costs. Same field,
              // opposite sides of the sheet.
              if (outcome.money >= 0) books.earn('other', outcome.money);
              else books.spend('fines', outcome.money);
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

        // ---- somebody has been talking to your talent --------------------
        // Offers used to be regenerated wholesale every week and nothing
        // could be done about them: no way to answer, and no resolution
        // either way. A rival courted your champion for a fortnight and then
        // the approach simply evaporated. Every function for answering this
        // was written and tested and had no caller.
        //
        // Now an open offer survives until its date, the booker can answer it,
        // and one that reaches the date unanswered resolves as `doNothing` —
        // which is a decision, and sometimes loses the man.
        for (const offer of world.approachOffers) {
          if (offer.status === 'resolved' || world.week < offer.resolvesWeek) continue;
          offer.status = 'resolved';
          const target = world.wrestlers[offer.wrestlerId];
          const rival = world.rivals.find((r) => r.id === offer.rivalPromotionId);
          if (!target || !rival) continue;

          // Seeded from the offer, not the world's stream. Sixth time.
          const goes = resolveOffer(
            rngFromSeed(`poach:${offer.id}`),
            offer,
            { kind: 'doNothing' },
            world.settings,
          );
          if (!goes) {
            world.weeklyNews.push(
              wire(
                'signing',
                `${rival.name} came calling for ${target.name} — and ${pronounsFor(target).they} stayed put anyway. Nobody from this office ever even said a word to ${pronounsFor(target).them} about it.`,
                world.week,
              ),
            );
            continue;
          }
          world.promotion.rosterIds = world.promotion.rosterIds.filter((id) => id !== target.id);
          target.promotionId = rival.id;
          target.contract = createStandardContract(
            target,
            world.settings,
            world.settings.startingYear + Math.floor(world.week / 52),
          );
          rival.rosterIds.push(target.id);
          world.weeklyNews.push(
            wire(
              'departure',
              `${target.name} is gone — off to ${rival.name}. They had been talking to ${pronounsFor(target).them} for weeks and this office never answered.`,
              world.week,
              'lead',
            ),
          );
        }
        world.approachOffers = world.approachOffers.filter((o) => o.status === 'open');

        // Rival bookers come calling. Added to what is already on the table
        // rather than replacing it, and never two approaches for one man.
        const alreadyCourted = new Set(world.approachOffers.map((o) => o.wrestlerId));
        for (const fresh of rollApproaches(rng, {
          roster,
          statusOf: (w) => w.careerStatus,
          rivals: world.rivals,
          currentWeek: world.week,
          settings: world.settings,
          wrestlerById: (wid) => world.wrestlers[wid],
        })) {
          if (alreadyCourted.has(fresh.wrestlerId)) continue;
          alreadyCourted.add(fresh.wrestlerId);
          // `rollApproaches` produces the bare attempt; this is the stored,
          // answerable form.
          world.approachOffers.push({
            ...fresh,
            id: `poach-${world.week}-${fresh.wrestlerId}`,
            openedWeek: world.week,
            resolvesWeek: world.week + world.settings.poachOfferWeeks,
            status: 'open',
          });
        }

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

        // ---- the loan, if one is running -------------------------------
        // Paid before the bankruptcy check below sees the balance, on
        // purpose — a loan payment that itself tips the promotion into the
        // red is exactly the risk it is supposed to be. See economy/loan.ts.
        tickLoan(world);
        // Same shape, a lighter thing — see economy/releaseStigma.ts.
        tickReleaseStigma(world);

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
            wantsWeeks: desiredContractWeeks(w, world.settings),
                weeksUnsigned: 0,
              });
            }
            world.promotion.rosterIds = [];
          }
        } else {
          world.weeksInTheRed = 0;
        }

        // The bank calls before the grace period runs out, not after — see
        // loanTriggerWeeksInTheRed. A company that just folded this same
        // week has nothing left to offer a loan to.
        if (!world.folded) maybeOfferLoan(world);

        // A rival smelling blood — only possible once a loan is actually
        // running, and its own isolated seed so a weekly roll gated behind
        // world state still never touches the shared stream.
        if (!world.folded) {
          maybeOfferBuyout(world, rngFromSeed(`${world.settings.seed}-buyout-${world.week}`));
        }

        world.currentCard = createEmptyCard(
          cardSizeFor(
            isBigShowWeek(world.week, scheduleOf(world.promotion, world.settings), world.settings)
              ? 'ppv'
              : 'television',
            world,
          ),
        );
        world.currentPromos = createEmptyPromoSlots(world.settings.promoSlotsPerCard);
        world.currentDarkMatches = createEmptyDarkMatches(world.settings.darkMatchSlots);

        // A week off the term, and a show against the town's patience if one
        // happened. When the last week runs out the company is touring again,
        // and it is told so rather than discovering it on a rent line.
        if (world.residency) {
          const deal = world.residency;
          world.residency = tickResidency(deal, !night.cancelled);
          if (!world.residency) {
            world.weeklyNews.push(
              wire(
                'signing',
                `The residency at the ${deal.homeName} is officially over. ${deal.showsRun} shows in ${deal.town}, in front of the same faithful faces every time, and starting next week the trucks are rolling out again.`,
                world.week,
              ),
            );
          }
        }

        // The books close last, once every last thing that moves money this
        // week has moved it — the gate, the network, the fines, the truck.
        // Close them any earlier and the closing balance disagrees with the
        // lines above it, which is the one thing a statement may never do.
        // It is still stamped with the week it describes: the builder took
        // that number at the top of the turn, before world.week advanced.
        world.statements.push(books.build(world.promotion.bankBalance));
        world.statements = world.statements.slice(-world.settings.statementsKept);
      });
    },

  })),
);
