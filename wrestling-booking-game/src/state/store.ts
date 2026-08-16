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
import { MATCH_BEAT_LINES, STORYLINE_NAME_PATTERNS } from '../data/storylineBeats';
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
  secondGenerationLine,
  biddingOpenedLine,
  biddingSettledLine,
} from '../engine/world/wire';
import {
  askingMinimum,
  decideBids,
  interestedIn,
  minimumLine,
  rosterStrengthOf,
  invitationLine,
  resultLine,
  rivalBid,
  watchedItLine,
  worthAnAuction,
  guaranteeFor,
  // Aliased: world/auction.ts already exports a `Bid`, and that one is a
  // number bid on a lot of assets rather than an offer of employment.
  type Bid as ContractBid,
  type BiddingReason,
} from '../engine/economy/bidding';
import { styleProfileFor } from '../data/promotionIdentity';
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
  memorialShow,
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
  // No rental list any more: a manager is somebody under contract. Resolved
  // from the roster so a signed manager is bookable the week they arrive,
  // whether they were signed as one or moved into a suit.
  const signed = world.staffManagers.find((m) => m.id === id);
  if (signed) return signed;
  const person = world.wrestlers[id];
  return person && person.role === 'manager' ? managerFromWrestler(person) : undefined;
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
import { backstageAttackChance, backstageDamage, backstageLine, muggingLine } from '../engine/sim/ringside';
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
import { computeBuys, computeBuyRevenue, isInMonth, weekLabel } from '../engine/world/calendar';
import {
  bigShowName,
  defaultShowName,
  houseShowRevenueMultiplier,
  houseShowsThisWeek,
  isBigShowWeek,
  recoveryMultiplier,
  resizeSchedule,
  scheduleOf,
  segmentsForShow,
  showsThisWeek,
  type PPVCadence,
} from '../engine/world/schedule';
import type { Day } from '../engine/world/calendar';
import { resolvePromo, promoIsValid, promoShowContribution, promoEnergyCost } from '../engine/sim/promo';
import { promoTopicById, type PromoTopicId } from '../data/promoTopics';
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
  venueFitsTerritory,
} from '../engine/world/territories';
import { businessCapacity, graduateClass, graduateCount, workingPopulation } from '../engine/world/academy';
import { walkOnIntake, walkOnLine } from '../engine/world/walkOns';
import { managerIntake } from '../engine/world/managerTalent';
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
import {
  openingOffer,
  respondToOffer,
  coopAppetite,
  moodFor,
  moodLine,
  supershowPurse,
  crossPromoStakes,
} from '../engine/world/supershow';
import { runSupershow } from '../engine/world/supershowRun';
import {
  willEnter,
  slotsPerPromotion,
  cupEntrantsFrom,
  cupPurse,
  crownAura,
  crownSurge,
  crownWinsBefore,
  crownsFor,
  fieldIsBigEnough,
  fieldLine,
  CUP_MONTH,
  CUP_NAME,
  CUP_TROPHY,
} from '../engine/world/cup';
import { runCup, cupStandingFor } from '../engine/world/cupRun';
import {
  HAULAGE,
  haulageById,
  nextHaulage,
  ladderStatus,
  productionEffects,
  productionUpkeepPerShow,
} from '../engine/economy/production';
import { StatementBuilder } from '../engine/economy/statement';
import { SUPERSHOW_SEASONS } from '../engine/world/supershow';
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
import { decayGrudges, grudgeAgainst, grudgeLine, rememberNight } from '../engine/world/grudges';
import { recordInjury } from '../engine/career/theBody';
import {
  concessionsPerHead,
  houseTakeOfGate,
  houseTakeOfMerch,
  openAirWeather,
  productionInRoom,
  venueAtmosphereModifier,
} from '../engine/economy/venue';
import { nightAtTheTables, prunedStands, standById } from '../engine/economy/stands';
import {
  breakLeaseCost,
  exposureLine,
  localCeiling,
  localTopTicket,
  residencyDeposit,
  residencyExposure,
  residencyHaulageCost,
  residencyHomeById,
  residencyMerchMultiplier,
  residencyOverhead,
  residencyTerms,
  scaleExposure,
  signResidency,
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
  desiredContractWeeks,
} from '../engine/economy/contracts';
import {
  driftEgo,
  targetEgo,
  contractDemand,
  clauseUpkeep,
  blocksDeckStacking,
} from '../engine/career/ego';
import { availablePerks, perkUpkeep } from '../engine/economy/perks';
import type { PerkId } from '../data/perks';
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
  /** Stock a merch line or open a concession stand for the show. */
  toggleStand: (standId: Id) => void;
  /**
   * Take a room for a season. Cheaper rent, no travel, no lorry, and a town
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
  setTicketPrice: (price: number) => void;
  toggleShowExtra: (extraId: Id) => void;
  buyProductionAsset: (assetId: Id) => void;
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
  /** Where this slot's storyline beat is reported, if it produced one. */
  confrontationBeats: { participantIds: Id[]; kind: StorylineBeatKind; text: string }[],
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
  // Two people in the same room is a story beat, and a bigger one than a
  // monologue. Collected by the caller — see tonightsBeats.
  confrontationBeats.push({
    participantIds: pair,
    kind: 'confrontation',
    text: `${speaker.name} and ${opposite.name} came face to face. ${outcome.twistLabel}.`,
  });
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
      // Written into the body's permanent record, not only the current
      // status. A career is what has already happened to it.
      hurt.injuryHistory = recordInjury(
        hurt.injuryHistory ?? [],
        hurt.injury,
        world.settings.startingYear + Math.floor(world.week / 52),
      );
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
            wantsWeeks: desiredContractWeeks(wrestler, world.settings),
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
function resolveAuction(world: World, playerLevel: PlayerBidLevel, books?: StatementBuilder): void {
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
    if (winner.id === world.promotion.id) {
      books?.spend('other', result.winningBid);
      books?.earn('other', lot.cash);
    }

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
            wantsWeeks: desiredContractWeeks(w, world.settings),
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
// ---------------------------------------------------------------------------
// The bidding war
//
// Opening one and settling one, kept together because the invariant that
// matters spans both: exactly one auction runs at a time, and every auction
// that opens settles — whether or not the booker ever looks at it. A pending
// war that could be left hanging would be a way to freeze a star out of the
// business forever by ignoring a dialog.

/** Everybody a promotion is paying this week, for the headroom check. */
function payrollOf(world: World, promotionId: Id): number {
  const company =
    world.promotion.id === promotionId ? world.promotion : world.rivals.find((r) => r.id === promotionId);
  if (!company) return 0;
  return company.rosterIds.reduce((sum, id) => {
    const member = world.wrestlers[id];
    return sum + (member?.contract?.weeklyRate ?? 0);
  }, 0);
}

/**
 * Open an auction, if this person actually warrants one and enough of the
 * business can afford to turn up. Returns whether one opened.
 */
function openBiddingWar(world: World, wrestler: Wrestler, reason: BiddingReason): boolean {
  if (!world.settings.biddingEnabled) return false;
  // One at a time. Two open auctions would mean two blocking dialogs and a
  // player choosing between them, which is not the decision this is about.
  if (world.pendingBiddingWar) return false;
  if (!worthAnAuction(wrestler, world.settings)) return false;

  // Drawn once, before anybody is asked anything — the number is the thing
  // that decides who is even in the room.
  const minimum = askingMinimum(rng, wrestler, world.settings);
  const everyone = [world.promotion, ...world.rivals];
  const interested = interestedIn(
    wrestler,
    everyone,
    {
      weeklyPayroll: (id) => payrollOf(world, id),
      banned: (id) => (id === world.promotion.id ? world.signingBanWeeks > 0 : false),
      minimum,
    },
    world.settings,
  );

  const rivals = interested.filter((p) => p.id !== world.promotion.id);
  // Fewer than two other companies in the room and this is a negotiation, not
  // an auction — the ordinary free-agent flow handles that perfectly well.
  if (rivals.length < world.settings.biddingMinRivals) return false;

  world.pendingBiddingWar = {
    id: `war-${world.nextId++}`,
    wrestlerId: wrestler.id,
    wrestlerName: wrestler.name,
    reason,
    openedWeek: world.week,
    stage: 'invited',
    minimum,
    round: 1,
    reBidReason: null,
    // The player is only invited if they are one of the interested parties.
    // Being told about an auction you could never have entered is noise.
    playerIn: interested.some((p) => p.id === world.promotion.id) ? null : false,
    rivalIds: rivals.map((p) => p.id),
    bids: [],
    result: null,
  };
  world.weeklyNews.push(
    biddingOpenedLine(
      `${invitationLine(world.pendingBiddingWar, wrestler, rivals.length)} ${minimumLine(wrestler, minimum)}`,
      world.week,
    ),
  );
  return true;
}

/** Move somebody onto a roster on the terms that won them. */
function awardContract(world: World, wrestler: Wrestler, bid: ContractBid, promotionId: Id, books?: StatementBuilder): void {
  const winner =
    world.promotion.id === promotionId ? world.promotion : world.rivals.find((r) => r.id === promotionId);
  if (!winner) return;

  // Wherever they were, they are not there now.
  for (const company of [world.promotion, ...world.rivals]) {
    company.rosterIds = company.rosterIds.filter((id) => id !== wrestler.id);
  }
  world.freeAgents = world.freeAgents.filter((a) => a.wrestlerId !== wrestler.id);

  wrestler.promotionId = winner.id;
  wrestler.contract = {
    ...createStandardContract(wrestler, world.settings, world.settings.startingYear + Math.floor(world.week / 52)),
    weeklyRate: bid.weeklyRate,
    weeksRemaining: bid.weeks,
    totalWeeks: bid.weeks,
    clauses: [...bid.clauses],
    guaranteedPct: guaranteeFor(bid, world.settings),
  };
  winner.rosterIds.push(wrestler.id);
  // The bonus is real money and it leaves the bank the day they sign.
  winner.bankBalance -= bid.signingBonus;
  if (winner.id === world.promotion.id) books?.spend('payroll', bid.signingBonus);
}

/**
 * Take every bid, let them choose, and hand over the contract.
 *
 * Called both when the player answers and when the week rolls over without
 * them — an auction the booker ignored still happens, they just watch it.
 */
function settleBiddingWar(world: World, rng: Rng, playerBid: ContractBid | null, books?: StatementBuilder): void {
  const war = world.pendingBiddingWar;
  if (!war) return;
  const wrestler = world.wrestlers[war.wrestlerId];
  if (!wrestler) {
    world.pendingBiddingWar = null;
    return;
  }

  const bids: ContractBid[] = [];
  if (playerBid) bids.push(playerBid);
  for (const rivalId of war.rivalIds) {
    const rival = world.rivals.find((r) => r.id === rivalId);
    if (!rival || rival.closedWeek !== null) continue;
    // Null when they cannot make the announced number at all.
    const offer = rivalBid(
      rng,
      wrestler,
      rival,
      {
        weeklyPayroll: payrollOf(world, rival.id),
        minimum: war.minimum,
        rosterStrength: rosterStrengthOf(
          rival.rosterIds.map((id) => world.wrestlers[id]).filter((w): w is Wrestler => Boolean(w)),
          world.settings,
        ),
      },
      world.settings,
    );
    if (offer) bids.push(offer);
  }

  const outcome = decideBids(
    rng,
    wrestler,
    bids,
    {
      promotions: [world.promotion, ...world.rivals],
      relationships: world.relationships,
      rosterOf: (id) => {
        const company =
          world.promotion.id === id ? world.promotion : world.rivals.find((r) => r.id === id);
        return (company?.rosterIds ?? []).map((rid) => world.wrestlers[rid]).filter((w): w is Wrestler => Boolean(w));
      },
      currentPromotionId: wrestler.promotionId,
    },
    world.settings,
    war.round,
    war.minimum,
  );

  // Nobody in the room was worth signing. They say so, and everybody goes
  // again — including the player, who gets a fresh invitation rather than an
  // automatic re-entry, because staying out is still a choice they can make.
  if (outcome?.kind === 'reBid') {
    war.round += 1;
    war.stage = 'invited';
    war.playerIn = war.playerIn === false ? false : null;
    war.reBidReason = outcome.reason;
    world.weeklyNews.push(biddingOpenedLine(outcome.reason, world.week));
    return;
  }

  const result = outcome?.kind === 'signed' ? outcome.result : null;
  if (result) {
    awardContract(world, wrestler, result.bid, result.winningPromotionId, books);
    war.bids = result.allBids;
    war.result = result;
    world.weeklyNews.push(
      biddingSettledLine(
        war.playerIn ? resultLine(war, result) : watchedItLine(war, result),
        world.week,
      ),
    );
  } else {
    // Every door in the room was one they would not walk through. They stay
    // where they are — unsigned, and still in the business.
    world.weeklyNews.push(
      biddingSettledLine(`${war.wrestlerName} signed with nobody. Not one of those offers was worth taking.`, world.week),
    );
  }

  war.stage = 'settled';
  world.lastBiddingWar = { war, result: war.result ?? null } as World['lastBiddingWar'];
  world.pendingBiddingWar = null;
}

/**
 * Apply one event effect, and report the money it moved.
 *
 * The return exists so the weekly statement can account for incidents. An
 * effect that pays a fine or costs a settlement moves the bank balance like
 * anything else, and a statement that cannot see it would close out of
 * balance with its own closing figure.
 */
function applyEffect(world: World, effect: EventEffect): number {
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
      return effect.delta;
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
        // Written into the body's permanent record, not only the current
        // status. A career is what has already happened to it.
        w.injuryHistory = recordInjury(
          w.injuryHistory ?? [],
          w.injury,
          world.settings.startingYear + Math.floor(world.week / 52),
        );
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

  // Everything that is not a `money` effect moved no money.
  return 0;
}

/**
 * Run a list of effects and book whatever they cost or paid.
 *
 * Incidents and promos can hand out a bonus or a bill. Routing them through
 * one place keeps the statement honest without every call site remembering.
 */
function applyEffects(world: World, effects: readonly EventEffect[], books: StatementBuilder): void {
  for (const effect of effects) {
    const money = applyEffect(world, effect);
    if (money >= 0) books.earn('other', money);
    else books.spend('other', money);
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
          // Rolls what the business believes about them, as against what is true.
          settings: world.settings,
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
          .filter((w): w is Wrestler => Boolean(w) && !alreadyBooked.has(w!.id) && canWork(w!, world.settings, world.week));

        // The microphone, first.
        //
        // Fill the card only ever filled *matches*, so an auto-played save
        // never cut a promo — which meant a whole system with a UI, a topic
        // list and a show-rating contribution ran zero times unless the player
        // built every card by hand. It also meant no manager was ever booked
        // as a mouthpiece, so the one thing a manager is best at never
        // happened either.
        //
        // The office books the obvious thing: the best talker on the roster,
        // aimed at somebody they already have a feud with when there is one.
        const talkers = [...available].sort((a, b) => b.charisma - a.charisma);
        const speaking = new Set<Id>();
        for (const slot of world.currentPromos) {
          if (slot.kind === 'confrontation' || slot.promoSpeakerId) continue;
          const speaker = talkers.find((w) => !speaking.has(w.id));
          if (!speaker) break;

          // Somebody they are already in with, if anybody. A promo aimed at a
          // live feud is worth more than one aimed at nobody — see promo.ts.
          const feud = world.rivalries.find(
            (r) => r.resolvedWeek === null && r.participantIds.includes(speaker.id),
          );
          const targetId = feud?.participantIds.find((id) => id !== speaker.id) ?? null;
          const target = targetId ? world.wrestlers[targetId] : undefined;
          const holdsTitle = world.titles.some(
            (t) => t.promotionId === world.promotion.id && t.currentHolderIds.includes(speaker.id),
          );

          const topicId: PromoTopicId = target
            ? 'continueFeud'
            : holdsTitle
              ? 'championshipAddress'
              : 'callOutLockerRoom';
          if (!promoIsValid(topicId, speaker, target ?? null, holdsTitle)) continue;

          slot.promoSpeakerId = speaker.id;
          slot.promoTopicId = topicId;
          slot.promoTargetId = target?.id ?? null;
          // And a mouthpiece for somebody who cannot talk, which is the whole
          // reason to carry one — see sim/ringside.ts.
          // Off the roster rather than off `staffManagers`, which only fills
          // when somebody *changes role* — a manager signed as a manager was
          // never in it, so the lookup found nobody however many you had.
          const ownMouth = speaker.charisma;
          const mouthpiece = world.promotion.rosterIds
            .map((id) => world.wrestlers[id])
            .find(
              (m): m is Wrestler =>
                Boolean(m) &&
                m!.role === 'manager' &&
                !m!.deceased &&
                m!.charisma > ownMouth + world.settings.autoFillMouthpieceGap,
            );
          slot.promoMouthpieceId = mouthpiece?.id ?? null;
          speaking.add(speaker.id);
        }

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
          refuses: (aId, bId) =>
            refusesToWorkWith(findRelationship(world.relationships, aId, bId), world.settings),
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

        // The books for the week, opened before a penny moves. Every place
        // money changes hands below reports into this, so the statement is a
        // record of what happened rather than a second guess at it.
        const books = new StatementBuilder(world.week, world.promotion.bankBalance);

        // An auction you never answered goes ahead without you. The business
        // does not wait for a booker to make up their mind.
        if (world.pendingAuction) resolveAuction(world, 'pass', books);

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
        // auctions, a company folding, tampering, a secret signing. Patching
        // those individually would have left holes, and a career page with
        // holes in it is worse than no career page.
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
        /** Stories the booker actually settled in the ring tonight. */
        const blowoffsTonight: {
          storylineId: Id;
          rating: number;
          winnerName: string;
          winnerIds: Id[];
        }[] = [];

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

          const result = simulateMatch(rng, simParticipants, wrestlerById, {
            relationshipHeat: relHeat,
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
                  world.weeklyNews.push(
                    wire(
                      'misfortune',
                      `${suspensionLine(blamed.name, sanction) ?? sanction.note} ${person.name} is the one in hospital.`,
                      world.week,
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
                ringside.muggingDistractor?.[side] ?? 'His mouthpiece',
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
            applyEffects(world, incident.effects, books);
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
              world.weeklyNews.push(
                wire('signing', announced ?? `${culprit.name}. ${sanction.note}`, world.week, announced ? 'normal' : 'minor'),
              );
            }
          }

          for (const change of changes) {
            const w = world.wrestlers[change.wrestlerId];
            if (w) applyAftermath(w, change, world.settings, result.rating);
            worked.add(change.wrestlerId);
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

        // ---- the talking ------------------------------------------------
        // Promo slots sit alongside the card rather than inside it (§9), so
        // they are resolved here, after the matches, and contribute to the
        // show on their own smaller scale.
        let promoRating = 0;
        for (const slot of world.currentPromos) {
          // A talking slot can be a promo or a confrontation. The budget is
          // shared on purpose — time on the microphone is finite.
          if (slot.kind === 'confrontation') {
            const outcome = resolveConfrontationSlot(world, slot, wrestlerById, rng, tonightsBeats);
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
          });

          applyEffects(world, promo.effects, books);
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
          // is the trucks and the crew; this is the man's own petrol, and
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
        // A resident promotion has no lorry: the gear lives in the building.
        const truck = residencyHaulageCost(world.residency, haulageById(world.haulageId)?.upkeepPerWeek ?? 0);
        world.promotion.bankBalance -= rig + truck;
        books.spend('production', rig);
        books.spend('haulage', truck);

        for (const extra of tonightsImpromptu) {
          const takings = returnsFor(extra, world.settings);
          world.promotion.bankBalance -= takings.cost;
          books.spend('venue', takings.cost);
          world.promotion.reputation = clamp(
            world.promotion.reputation + takings.reputation,
            0,
            100,
          );
          for (const id of world.promotion.rosterIds) {
            const member = world.wrestlers[id];
            if (!member || member.deceased) continue;
            member.morale = clamp(member.morale + takings.morale, 0, 100);
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
              (town.following[world.promotion.id] ?? 0) + takings.following,
              0,
              100,
            );
          }
          world.weeklyNews.push(wire('houseShow', afterLine(extra), world.week, 'normal'));
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
          world.weeklyNews.push(wire('houseShow', benefit.announcement, world.week, 'minor'));
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
          const needed = world.settings.segmentsPerTV * 2;
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
                ? `${houseShows[0]!.name} ran on the road this week. $${houseGate.toLocaleString()} through the door, and a roster that has now worked twice.`
                : `${houseShows.length} house shows on the road this week — ${houseShows.map((s) => s.name).join(', ')}. $${houseGate.toLocaleString()} through the door, and everybody has the miles to show for it.`,
              world.week,
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
          rivalShows.set(rival.id, show);

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
                applyEffects(world, incident.effects, books);
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
                  `${story.name} is as hot as it is going to get. Whatever happens next had better settle it.`,
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
                `${story.name} has quietly died. Nobody has done anything with it in ${story.neglectedWeeks} weeks and the crowd has moved on.`,
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
                // The length he asked for, not a flat two years for everybody.
                // See economy/contracts.ts desiredContractWeeks.
                const agreedWeeks = desiredContractWeeks(person, world.settings);
                person.contract.weeksRemaining = agreedWeeks;
                person.contract.totalWeeks = agreedWeeks;
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
          // On the payroll line, because that is what it is — even though the
          // man it pays is not on the roster and cannot be booked.
          books.spend('payroll', signing.weeklyRate);
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
            // A real star does not get quietly re-papered by the office he
            // already works for. He reaches the open market and the whole
            // business finds out at once — see economy/bidding.ts. This is
            // the third door out of a contract, alongside renewals (your own
            // people) and poaching (somebody else's, mid-deal).
            if (openBiddingWar(world, person, 'freeAgentStar')) continue;
            const agreedWeeks = desiredContractWeeks(person, world.settings);
            person.contract.weeksRemaining = agreedWeeks;
            person.contract.totalWeeks = agreedWeeks;
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
              if (
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
              const felt = bereavements(
                person,
                Object.values(world.wrestlers),
                world.relationships,
                world.settings,
              );
              for (const grief of felt) {
                const mourner = world.wrestlers[grief.wrestlerId];
                if (!mourner) continue;
                mourner.morale = clamp(mourner.morale + grief.moraleDelta, 0, 100);
                mourner.moraleNote = grief.note;
              }
              const said = mourningLine(felt);
              if (said) world.weeklyNews.push(wire('death', said, world.week, 'normal'));

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
                  `The Crucible is taking entries. ${likely.length} ${likely.length === 1 ? 'company has' : 'companies have'} already paid.`,
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
              `${world.pendingSupershow.partnerName} have moved on. The joint show is off the table.`,
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
                  `${partner.name} want to run a joint pay-per-view. ${world.pendingSupershow.pitch}`,
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
                wire('signing', `${w.name} has served his suspension and is available again.`, world.week, 'minor'),
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
                `${agent.name} is speaking for ${target.name} now, for ${Math.round(cut * 100)}% of his purse.`,
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
            everyone.map((w) => w.appearance),
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
            everyone.map((w) => w.appearance),
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
              existingAppearances: everyone.map((w) => w.appearance),
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
                  ? `${newManagers.wrestlers[0]!.name} is looking for somebody to speak for.`
                  : `${newManagers.wrestlers.map((w) => w.name).join(' and ')} are looking for somebody to speak for.`,
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
            if (phenom) openBiddingWar(world, phenom, 'phenom');
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
            wantsWeeks: desiredContractWeeks(w, world.settings),
                weeksUnsigned: 0,
              });
            }
            world.promotion.rosterIds = [];
          }
        } else {
          world.weeksInTheRed = 0;
        }

        world.currentCard = createEmptyCard(
          segmentsForShow(
            isBigShowWeek(world.week, scheduleOf(world.promotion, world.settings), world.settings)
              ? 'ppv'
              : 'television',
            world.settings,
          ),
        );
        world.currentPromos = createEmptyPromoSlots(world.settings.promoSlotsPerCard);

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
                `The run at the ${deal.homeName} is over. ${deal.showsRun} shows in ${deal.town}, in front of the same faces, and from next week the trucks go back out.`,
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
            `${world.promotion.name} has taken the ${home.name} in ${home.town} for ${term.label.toLowerCase()}. ` +
              `${exposureLine(world.residency)} The trucks stay in the yard.`,
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
            `${world.promotion.name} has bought its way out of the ${homeName} in ${town}. It cost $${owed.toLocaleString()} to be allowed to leave.`,
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
            `${world.promotion.name} bought a ${here.rung.name.toLowerCase()}. ${here.rung.blurb}`,
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
          wire('story', `${world.promotion.name} are hauling on a ${next.name.toLowerCase()} now. ${next.blurb}`, world.week, 'minor'),
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
          // The term he advertised in the pool, so the length a booker read on
          // Tuesday is the length he signs on Thursday.
          ...createStandardContract(wrestler, world.settings, world.settings.startingYear, agent.wantsWeeks),
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
            wantsWeeks: desiredContractWeeks(member, world.settings),
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

    startStoryline: (participantIds, name) => {
      let outcome: { ok: boolean; reason: string | null } = { ok: false, reason: 'No world.' };
      set((state) => {
        const world = state.world;
        if (!world) return;
        const people = participantIds
          .map((id) => world.wrestlers[id])
          .filter((w): w is Wrestler => Boolean(w));
        if (people.length < 2) {
          outcome = { ok: false, reason: 'A story needs two people in it.' };
          return;
        }
        if (storylineBetween(world.storylines, participantIds)) {
          outcome = { ok: false, reason: 'These two are already in a story.' };
          return;
        }

        // Booking a story is allowed to be what starts the feud — that is
        // how most of them start in the real thing.
        let rivalry = findRivalry(world.rivalries, participantIds);
        if (!rivalry) {
          rivalry = createRivalry(
            `rivalry-story-${world.week}-${world.rivalries.length}`,
            [...participantIds],
            'worked',
            world.week,
            0,
          );
          world.rivalries.push(rivalry);
        }

        const surnames = people.map((w) => w.name.split(' ').slice(-1)[0] ?? w.name);
        const town = world.territories.find((t) => t.id === world.promotion.homeTerritoryId);
        const pattern = pick(
          rngFromSeed(`${world.settings.seed}-story-${world.week}-${participantIds.join('-')}`),
          STORYLINE_NAME_PATTERNS,
        );
        const generated = pattern
          .replace('{a}', surnames[0] ?? 'Them')
          .replace('{b}', surnames[1] ?? 'Him')
          .replace('{town}', town?.name ?? 'Town');

        world.storylines.push({
          id: `story-${world.week}-${world.storylines.length}`,
          name: (name ?? '').trim() || generated,
          participantIds: [...participantIds],
          rivalryId: rivalry.id,
          stage: 'opening',
          startWeek: world.week,
          lastAdvancedWeek: world.week,
          beats: [],
          neglectedWeeks: 0,
          resolvedWeek: null,
          payoff: null,
        });
        outcome = { ok: true, reason: null };
      });
      return outcome;
    },

    renameStoryline: (storylineId, name) => {
      set((state) => {
        const story = state.world?.storylines.find((s2) => s2.id === storylineId);
        if (!story) return;
        const trimmed = name.trim();
        if (trimmed) story.name = trimmed;
      });
    },

    abandonStoryline: (storylineId) => {
      set((state) => {
        const world = state.world;
        const story = world?.storylines.find((s2) => s2.id === storylineId);
        if (!world || !story || !isLive(story)) return;
        story.stage = 'fizzled';
        story.resolvedWeek = world.week;
        story.payoff = 'Dropped. Whatever it was going to be, it is not going to be it.';
        world.weeklyNews.push(
          wire('story', `${story.name} has been quietly dropped.`, world.week, 'minor'),
        );
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

        const roster = (ids: readonly Id[]) =>
          ids.map((id) => world.wrestlers[id]).filter((w): w is Wrestler => Boolean(w) && canWork(w!, world.settings, world.week));

        const result = runSupershow(rng, {
          player: world.promotion,
          partner,
          deal: offer.deal,
          playerRoster: roster(world.promotion.rosterIds),
          partnerRoster: roster(partner.rosterIds),
          titles: world.titles,
          stables: world.stables,
          territories: world.territories,
          week: world.week,
          settings: world.settings,
        });
        if (!result) return;

        world.lastSupershow = result;

        // What they will remember about it. The split of the joint card is the
        // thing a rival booker actually carries, so taking everything costs
        // you the next approach and possibly the one after that.
        const remembered = rememberNight(
          grudgeAgainst(world.grudges, partner.id),
          partner.id,
          {
            playerWins: result.playerWinnerIds.length,
            partnerWins: result.partnerWinnerIds.length,
            showStars: result.show.showStars,
          },
          world.week,
          world.settings,
        );
        world.grudges = world.grudges.filter((g) => g.promotionId !== partner.id);
        if (remembered) {
          world.grudges.push(remembered);
          // Nothing happens off-screen: if the night has cost you a
          // relationship, the wire says so on the night rather than leaving
          // the player to work it out from a refusal six months later.
          world.weeklyNews.push(
            wire('story', `${grudgeLine(remembered, partner.name)}`, world.week, 'minor'),
          );
        }

        // The money. The company banks its share of a gate neither of them
        // could have drawn alone, and pays its own people out of it.
        world.promotion.bankBalance += result.purse.playerNet;

        // And everybody who worked gets paid, which is the whole reason the
        // roster wants to be on this show. Recorded against their career
        // earnings, not just handed over and forgotten.
        for (const [wrestlerId, amount] of Object.entries(result.payouts)) {
          const person = world.wrestlers[wrestlerId];
          if (!person) continue;
          creditPay(ledgerOf(person), amount);
        }

        // §16 amplification. A win on a night like this is worth more than a
        // win on a Tuesday, and a loss costs more.
        const winners = new Set([...result.playerWinnerIds, ...result.partnerWinnerIds]);
        for (const id of Object.keys(result.sideOf)) {
          const person = world.wrestlers[id];
          if (!person) continue;
          if (!(id in result.payouts)) continue;
          const holdsTitle = world.titles.some((t) => t.currentHolderIds.includes(id));
          const stakes = crossPromoStakes(holdsTitle, world.settings);
          const swing = stakes.popularityMultiplier * world.settings.supershowMoraleSwing / 2;
          person.popularity = clamp(person.popularity + (winners.has(id) ? swing : -swing), 0, 100);
          person.morale = clamp(
            person.morale + (winners.has(id) ? stakes.moraleSwing : -stakes.moraleSwing),
            0,
            100,
          );
        }

        // Who won the night, and what it did to the two companies.
        world.promotion.rating = clamp(
          world.promotion.rating + result.verdict.companyRatingSwing,
          0,
          100,
        );
        partner.rating = clamp(partner.rating - result.verdict.companyRatingSwing, 0, 100);

        world.weeklyNews.push(wire('story', result.verdict.line, world.week, 'lead'));
        world.weeklyNews.push(
          wire(
            'story',
            `The joint show with ${result.partnerName} drew $${result.purse.totalGate.toLocaleString()}. ` +
              `Everybody on the card took $${result.purse.appearanceFee.toLocaleString()}, winners $${result.purse.winBonus.toLocaleString()} on top. ` +
              `No titles changed hands.`,
            world.week,
            'lead',
          ),
        );
      });
    },

    dismissSupershowResult: () => {
      set((state) => {
        if (state.world) state.world.lastSupershow = null;
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
          // And he remembers. Morale comes back; this does not. The next time
          // he is a free man and this company is in the room, they are not in
          // it — see economy/bidding.ts stanceToward.
          if (!wrestler.grudges) wrestler.grudges = [];
          if (!wrestler.grudges.includes(world.promotion.id)) wrestler.grudges.push(world.promotion.id);
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
