// WorldSettings defaults and the four world-creation presets, §5.
// Every number tunable by the balance harness lives here, not hardcoded in
// engine/ formulas.

import type { WorldSettings, WorldPresetName } from '../types';

export function defaultWorldSettings(): WorldSettings {
  return {
    // Money and economy
    startingCash: 75_000,
    startingCompanyRating: 55,
    weeklyExpenseRate: 0.02,
    expenseCapPctOfRevenue: 50,
    ticketPriceBase: 4,
    ticketPricePerSegment: 1,
    salaryInflation: 0.01,
    bankruptcyGraceWeeks: 4,
    tvDealsEnabled: true,
    arenaTiersEnabled: true,

    // Roster and talent
    startingRosterSize: 30,
    targetRosterSize: 35,
    freeAgentPoolSize: 40,
    talentQualityCurve: 0,
    starDensity: 0.07,
    womensDivision: 'separate',
    agingEnabled: true,
    deathsEnabled: true,
    retirementEnabled: true,
    regenerateTalent: true,

    // Contracts
    contractLengthMin: 12,
    contractLengthMax: 104,
    contractLengthDefault: 52,
    allowedClauses: [
      'ironClad',
      'noCompete',
      'titlePush',
      'creativeControl',
      'nepotism',
      'immediateStart',
      'incentive',
      'downside',
      'creativeFreedom',
      'payPerView',
      'healthInsurance',
      'guaranteedDates',
      'travelCovered',
      'merchandiseCut',
      'noHardcore',
      'noJobbing',
      'releaseClause',
      'partTime',
      'exclusivity',
      'trainerRole',
      'rematchClause',
    ],
    clauseAvailability: 'all',
    buyoutsEnabled: true,
    poachingAggression: 1,
    demandStrictness: 1,

    // Booking and simulation
    outcomeMode: 'simulated',
    resimAllowed: false,
    warningsEnabled: false,
    oddsClampMin: 0.08,
    oddsClampMax: 0.92,
    simVariance: 6.5,
    segmentsPerTV: 6,
    segmentsPerPPV: 10,
    broadcastWindowTV: 120,
    broadcastWindowPPV: 180,
    ratingLadderStepPerWeek: 1,
    defaultMatchLength: 12,
    houseShowsEnabled: true,
    tournamentsEnabled: true,
    promoSlotsPerCard: 2,
    hardcoreSaturationPerViolence: 6,
    hardcoreSaturationDecayPerWeek: 8,
    slotExpectationPercentileMin: 0.5,
    slotExpectationPercentileMax: 0.95,

    // Rivalries
    rivalryHeatDecayPerWeek: 3,
    rivalryHeatFromMatch: 6,
    rivalryHeatFromNonDecisiveFinish: 12,
    rivalryGrudgeThreshold: 70,
    rivalryBlowoffPopularityFactor: 0.12,
    rivalryHeatRatingBonus: 12,
    shootHeatDecayPerWeek: 0.5,
    shootHeatRatingBonus: 8,
    shootHeatInjuryMultAtMax: 1.6,
    shootHeatMoralePerWeekAtMax: 4,
    shootLeanInConversion: 0.35,

    // Tournaments
    tournamentNightFatiguePerMatch: 0.09,
    tournamentNightHealthCostPerMatch: 7,
    tournamentFinalRatingBonus: 5,

    // Career status
    rookieYearsPro: 3,
    journeymanYearsPro: 8,
    veteranYearsPro: 12,
    veteranAge: 38,
    legendYearsPro: 10,
    legendPeakPopularity: 88,
    prospectTalent: 72,
    enhancementPopularity: 30,
    gatekeeperPopularity: 45,
    upperCardPopularity: 62,
    mainEventPopularity: 75,
    fallenStarDrop: 28,

    // TV ratings
    tvRatingBase: 2.4,
    tvRatingCeiling: 12,
    tvShowQualityWeight: 0.55,

    // Tampering and poaching
    tamperingBaseChance: 0.09,
    tamperingAppealThreshold: 0.55,
    tamperingOfferPremiumMin: 0.15,
    tamperingOfferPremiumRange: 0.6,
    tamperingMoneyWeight: 0.5,
    tamperingMoraleWeight: 0.35,
    tamperingMomentumWeight: 0.15,
    tamperingContractLengthResistance: 0.45,
    tamperingAttitudeResistance: 0.3,
    tamperingIronCladResistance: 0.5,
    tamperingNoCompeteResistance: 0.2,

    // Creative events — tuned so something happens often enough to matter and
    // rarely enough to stay a story. Roughly one event every 3-4 weeks.
    eventWeeklyChance: 0.45,
    eventGlobalGapWeeks: 2,
    eventCategoryGapWeeks: 6,
    eventRepeatDamping: 0.55,
    eventMinWeightFraction: 0.15,

    // Contracts, scaled to a promotion running small buildings: a jobber is
    // around $25/wk, a midcarder around $160, a genuine draw around $750.
    // The curve is what makes a star cost multiples of a midcarder.
    contractBaseWeeklyRate: 25,
    contractRateRange: 900,
    contractRateCurve: 2,
    contractDrawWeight: 0.7,
    contractCraftWeight: 0.3,
    contractRenewalFloor: 1.05,
    contractAffordabilityWeeks: 12,

    // Show production economics
    travelCostPerHead: 45,
    crewCostBase: 400,
    crewCostPerSeat: 0.35,
    ticketFairPriceBase: 8,
    ticketFairPriceRange: 34,
    ticketUnderpriceBonus: 0.45,
    ticketOverpricePenalty: 0.85,
    merchSpendPerHead: 4.5,
    // demand 25 -> ~310 people, 50 -> ~3,500, 80 -> ~18,000, 100 -> 40,000.
    demandAudienceScale: 40000,
    demandAudienceCurve: 3.5,
    venuePrestigeDraw: 0.15,
    venuePrestigeRatingWeight: 8,
    venueFullThreshold: 0.75,
    venueFullBonus: 6,
    venueEmptyPenalty: 14,

    // Answering a rival's offer
    poachResponseMoneyEffect: 0.45,
    poachResponseMoneyRaise: 1.35,
    poachResponsePushEffect: 0.3,
    poachResponseLegalEffect: 0.5,
    poachOfferWeeksToRespond: 1,

    // The player tampering. Low ceiling on success, high chance of being
    // caught, and a punishment bad enough that it is never the smart play.
    playerTamperingSuccessScale: 0.35,
    playerTamperingSuccessCap: 0.18,
    playerTamperingCaughtBase: 0.4,
    playerTamperingCaughtByFame: 0.35,
    playerTamperingFineFraction: 0.35,
    playerTamperingMinFine: 25000,
    playerTamperingReputationPenalty: 25,
    playerTamperingBanWeeks: 12,
    playerTamperingSuspensionWeeks: 6,
    playerTamperingExpulsionRatingLoss: 25,
    playerTamperingEscalation: 1.0,

    // Free agents
    freeAgentRateDecayPerWeek: 0.008,
    freeAgentMaxDiscount: 0.4,
    freeAgentRivalSigningChance: 0.05,

    // Chaos
    chaosLevel: 1,
    ownerMandatesEnabled: true,
    ownerPatience: 3,

    // World
    rivalPromotionCount: 6,
    territoryCount: 12,
    startingTerritories: 1,
    startingYear: new Date().getFullYear(),
    seed: 'wrestling-booking-game',
    rivalsCanGoBankrupt: true,
    secondGenerationEnabled: true,
    relationshipsEnabled: true,
    hallOfFameEnabled: true,
  };
}

/** §5 "Presets" table. Each preset overrides a subset of the defaults. */
export const WORLD_PRESETS: Record<Exclude<WorldPresetName, 'custom'>, Partial<WorldSettings>> = {
  territoryDays: {
    startingCash: 25_000,
    startingRosterSize: 18,
    rivalPromotionCount: 7,
    chaosLevel: 2,
  },
  standard: {
    startingCash: 75_000,
    startingRosterSize: 30,
    rivalPromotionCount: 6,
    chaosLevel: 1,
  },
  bigMoney: {
    startingCash: 400_000,
    startingRosterSize: 40,
    rivalPromotionCount: 5,
    chaosLevel: 0,
  },
  sinkOrSwim: {
    startingCash: 8_000,
    startingRosterSize: 12,
    rivalPromotionCount: 8,
    chaosLevel: 3,
  },
};

export function worldSettingsFromPreset(preset: Exclude<WorldPresetName, 'custom'>): WorldSettings {
  return { ...defaultWorldSettings(), ...WORLD_PRESETS[preset] };
}
