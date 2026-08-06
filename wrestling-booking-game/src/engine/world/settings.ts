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
    // What you have been putting on matters more than what you are called or
    // who is on the payroll.
    demandFromCompanyRating: 0.3,
    demandFromRecentShows: 0.5,
    demandFromRoster: 0.2,
    recentShowQualityWeight: 0.35,

    // Wear. Half a point a show: fine through year one, noticeably degraded
    // by year two, in real trouble by year three, dead a little after that.
    // Long enough to forget about, short enough to bite a promotion that
    // keeps buying and never maintains.
    assetWearPerShow: 0.5,
    assetFailureThreshold: 15,
    assetRepairCostFraction: 0.55,
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

    // Ego. Rises roughly twice as fast as it falls — you can make somebody in
    // a season and spend two bringing them back down.
    egoFromStanding: 45,
    egoFromHoldingTitle: 12,
    egoFromCareerTitles: 4,
    egoFromTopStatus: 15,
    egoFromMomentum: 10,
    egoAttitudeSwing: 0.4,
    egoRiseRate: 0.08,
    egoFallRate: 0.04,
    egoRateMultiplierMax: 1.4,
    egoMaxClauseAsks: 3,
    egoWalkRiskMax: 0.55,
    egoRosterFrictionMax: 6,

    // What agreed clauses cost every week.
    clauseInsuranceRate: 0.18,
    clauseTravelCost: 120,
    clauseGuaranteedDatesRate: 0.25,

    // Relationships. Most people get along; the ones who do not are the
    // interesting exception, and enemies work stiffer — better to watch,
    // likelier to hurt somebody.
    relationshipsPerWrestler: 0.8,
    relationshipEnemyChance: 0.22,
    relationshipAllyRatingBonus: 3,
    relationshipAllyInjuryReduction: 0.2,
    relationshipEnemyRatingBonus: 5,
    relationshipEnemyInjuryIncrease: 0.35,
    relationshipRefusalThreshold: 85,

    // Free agents
    freeAgentRateDecayPerWeek: 0.008,
    freeAgentMaxDiscount: 0.4,
    freeAgentRivalSigningChance: 0.05,

    // Ringside personnel. A manager is a small rating bump and a large heat
    // bump for somebody who cannot talk; a guest referee is star power at the
    // cost of a clean finish.
    managerRatingBonusMax: 4,
    managerPopularityBoostMax: 0.35,
    managerInterferenceWeight: 1.6,
    managerSelfMadePenalty: 0.15,
    refereeRatingSwing: 2.5,
    refereeScrewyFinishWeight: 1.4,
    refereeBendableWeight: 1.8,
    guestRefereeRatingBonus: 7,
    guestRefereeScrewyFinishWeight: 1.2,
    guestRefereeInterferenceWeight: 2.0,

    // Chaos
    chaosLevel: 1,
    ownerMandatesEnabled: true,
    ownerPatience: 3,

    // Championships. Prestige follows the matches: a belt defended in
    // five-star main events is worth more than one defended in the opener.
    titlePrestigeDrift: 0.12,
    titleWinMomentum: 15,
    titleWinPopularity: 4,
    titleForTitleBonus: 15,

    // Aftermath. A win is worth roughly two losses' worth of momentum, so a
    // wrestler pushed steadily climbs and one beaten every week sinks fast.
    // Popularity is the slow number: a four-star match is worth about a
    // point, which is a season's work to move somebody up a tier.
    momentumPerWin: 9,
    momentumPerLoss: 7,
    momentumPerDraw: 2,
    popularityPerWin: 0.25,
    matchPopularityChase: 0.02,
    mainEventAftermathMultiplier: 1.4,
    matchHealthCost: 4,
    matchHealthCostPerViolence: 1.6,
    matchEnergyCost: 12,
    matchFatiguePerMatch: 6,
    weeklyHealthRecovery: 6,
    weeklyEnergyRecovery: 22,
    weeklyFatigueRecovery: 9,
    momentumDecayPerWeek: 0.06,

    // Leaving. Nothing before 38, everything by 55 — and a broken-down
    // midcarder goes years before a healthy main eventer does.
    retirementAgeSoft: 38,
    retirementAgeHard: 55,
    retirementMinYearsPro: 8,
    retirementBodyWeight: 0.45,
    retirementCareerEndingInjury: 0.4,
    retirementDeclineWeight: 0.3,
    retirementStillDrawingRelief: 0.35,
    retirementChanceAtMaxPressure: 0.55,
    retirementUiThreshold: 0.45,
    // Coming back. Rare, and almost always about somebody in particular.
    comebackShootHeatThreshold: 45,
    comebackChanceWithScore: 0.5,
    comebackChanceForLove: 0.04,
    comebackMaxAge: 58,
    comebackStartingHealth: 65,
    comebackMomentum: 25,

    // Mortality. ~0.15% a year at 45, doubling every 12 years after.
    deathBaseAge: 45,
    deathBaseChance: 0.0015,
    deathAgeDoubling: 12,
    deathHealthWeight: 0.8,
    deathChanceCap: 0.3,
    deathOldAge: 75,

    // The fans. Ten voices a show, and never more than 85% agreeing.
    fanTweetsPerShow: 10,
    fanDissentFloor: 0.15,
    fanMatchTweetShare: 0.55,
    fanTweetLikesScale: 400,

    // The awards. Movement counts for a lot against standing, because the
    // whole point is that Wrestler of the Year is about the year — a legend
    // who coasted should lose it to somebody who climbed.
    awardMovementWeight: 1.5,
    awardWrestlerOfYearFloor: 55,
    awardMatchOfYearFloor: 80,
    awardWorstMatchCeiling: 30,
    awardComebackFromBelow: 40,
    awardComebackGain: 12,
    awardMinMatches: 8,
    awardImprovementGain: 10,
    awardTeamMinWins: 8,
    awardDownfallDrop: 10,
    awardDisappointmentFloor: 60,
    awardDisappointmentDrop: 8,
    // The two big ones are worth double, good and bad alike.
    awardHeadlineScale: 2,
    awardPopularityGain: 4,
    awardPopularityLoss: 3,
    awardMomentumGain: 10,
    awardMomentumLoss: 8,
    awardMoraleGain: 8,
    awardMoraleLoss: 6,

    // Incidents. Roughly one match in twenty, tripled in a main event and
    // doubled again with a belt on the line — so a big main event is close to
    // one night in three, and an opener almost never. Wild things stay wild.
    incidentChance: 0.015,
    incidentMainEventMultiplier: 3,
    incidentTitleMultiplier: 2,
    incidentChanceCap: 0.12,
    incidentTurnHeat: 45,
    incidentTurnMomentum: 18,
    incidentBetrayalMorale: 15,
    incidentShootHeat: 30,
    incidentShootThreshold: 30,
    incidentShootInjuryWeeks: 8,
    incidentRosterUnease: 5,
    incidentControversyHeat: 25,
    incidentCredibilityCost: 3,
    incidentBeatdownHealth: 18,
    incidentSympathyPopularity: 3,
    incidentReturnHeat: 40,
    incidentReturnMomentum: 25,
    incidentReturnPopularity: 5,
    incidentBreakoutRating: 66,
    incidentBreakoutGap: 18,
    incidentBreakoutPopularity: 9,
    incidentCompanyLift: 2,
    incidentTorchAgeGap: 14,
    incidentGraciousMorale: 6,
    incidentOvationRating: 88,
    incidentOvationPopularity: 4,
    incidentHijackRating: 25,
    incidentHijackPopularity: 3,

    // Rankings. The contender list is deliberately twitchy — momentum is the
    // biggest single term, so a hot streak genuinely earns a title shot. The
    // world list is the opposite: peak and championships dominate, so it
    // reads like a historian's list rather than this month's form guide.
    rankMomentumWeight: 45,
    rankFormWeight: 25,
    rankPopularityWeight: 30,
    contenderRankingSize: 10,
    worldRankPopularityWeight: 30,
    worldRankPeakWeight: 25,
    worldRankReignsWeight: 20,
    worldRankChampionWeeksWeight: 15,
    worldRankFormWeight: 10,
    rankReignsForFullCredit: 5,
    rankChampionWeeksForFullCredit: 200,
    worldRankingSize: 25,
    publicationWrestlerListSize: 10,
    publicationTeamListSize: 5,
    publicationTeamRecordWeight: 0.45,
    publicationTeamLongevityWeeks: 156,
    publicationTeamLongevityBonus: 8,

    // The hall of fame. A career needs to be genuinely good: peaking at 85
    // with a couple of reigns gets you in; a long ordinary one does not.
    hofPeakWeight: 55,
    hofReignsWeight: 20,
    hofReignsForFullCredit: 4,
    hofChampionWeeksWeight: 15,
    hofChampionWeeksForFullCredit: 150,
    hofLongevityWeight: 10,
    hofYearsForFullCredit: 20,
    hofScoreThreshold: 55,
    hofInductionsPerYear: 2,

    // The academy. A working population of roughly 60-100 people, so the
    // free agent pool never empties and never floods.
    worldPopulationMin: 150,
    worldPopulationMax: 230,
    academyMaxGraduates: 14,
    academyDebutAgeMin: 19,
    academyDebutAgeMax: 25,

    // Nicknames. Four years in and getting over: about a year of eligible
    // weeks before one lands, so they trickle in across a career.
    nicknameYearsPro: 4,
    nicknamePopularity: 55,
    nicknameMainEventPopularity: 78,
    nicknameMainEventChance: 0.7,
    nicknameEgoThreshold: 70,
    nicknameWeeklyChance: 0.02,
    
    // Ring names the player types. Long enough to be a name, short enough to
    // fit on a poster and in a results line.
    ringNameMinLength: 3,
    ringNameMaxLength: 28,

    // Three headlines is a lede. Four is a list.
    newsLedeLength: 3,
    newsGreatShowRating: 78,
    newsPoorShowRating: 35,

    // Territories. A five-star show is worth 8 following; a week away costs
    // 1.2 — so a town you run monthly holds roughly steady and a town you
    // abandon has forgotten you inside a year.
    territoryFollowingPerStar: 1.6,
    territoryFollowingDecayPerWeek: 1.2,
    territoryFitRatingWeight: 9,
    territoryHardcoreFullViolence: 6,
    territoryLongMatchMinutes: 20,
    territoryInvasionDamagePerStar: 1.1,
    territoryClaimMinimumAttendance: 500,
    demandFromTerritoryFollowing: 0.5,
    rivalHouseShare: 0.7,
    startingTerritoryFollowing: 55,

    // The owner. Roughly every four weeks, with four weeks to comply, and
    // three failures ends the run — see engine/world/mandates.ts.
    ownerMandatesEveryWeeks: 4,
    mandateWeeksToComply: 4,
    mandateStrikesBeforeFiring: 3,
    mandateRatingClimb: 6,
    mandatePayrollCut: 0.85,
    mandateAttendanceClimb: 1.2,
    mandateSignPopularity: 45,
    mandateReleasePopularity: 32,
    mandatePushMaxAge: 30,
    mandatePushClimb: 8,
    mandateAttendanceCeiling: 0.9,
    mandateHardcoreCeiling: 40,
    mandateRewardCash: 20_000,
    mandatePenaltyCash: 15_000,
    mandateFailureRating: 4,

    // One pay-per-view a month, four of them on rotation, so the same event
    // comes round at the same point every year. Buys are worth more than the
    // gate at any real size, which is what makes the monthly show matter.
    weeksBetweenPPVs: 4,
    ppvCalendarSize: 4,
    // Tuned by playing it: a good pay-per-view at mid-size is worth roughly
    // half a month of gates — the biggest single payday in the game without
    // making the other three weeks pocket change.
    ppvBuysScale: 60_000,
    ppvBuysReachCurve: 3,
    ppvBuysFromQuality: 0.45,
    ppvBuysQualityCurve: 2.5,
    ppvBuysFromBuild: 0.55,
    ppvBuyPrice: 12,

    // Six weeks at a rating before a network believes it; four weeks of a
    // broken condition before they walk. The second number is the window the
    // player has to notice a problem and fix it.
    broadcastWeeksToQualify: 6,
    broadcastWeeksOfGrace: 4,
    maxSponsors: 2,

    // Promos. Charisma is worth twice popularity, so a 90-charisma nobody
    // out-talks a 90-popularity mute — which is the entire design.
    promoCharismaWeight: 0.6,
    promoPopularityWeight: 0.3,
    promoHeatBonus: 12,
    promoMoraleSwing: 8,
    promoVariance: 7,
    promoNeutralQuality: 50,
    promoShowRatingWeight: 0.12,
    promoStartFeudHeat: 25,
    promoContinueFeudHeat: 14,
    promoChallengeHeat: 20,
    promoPopularity: 3,
    promoMomentum: 10,
    promoCompanyLift: 1,
    promoCalloutPopularity: 5,
    promoCalloutMorale: 6,
    promoDebutPopularity: 8,
    promoFarewellMorale: 6,
    promoFollowingGain: 3,
    promoEnergyCost: 4,
    promoEnergyCostDoubleBooked: 10,

    // A wrestler in the shirt. The shifts are points of win probability — a
    // grudge is worth more than a friendship, and both beat "a heel is not
    // going to help a babyface". The [8%, 92%] clamp still applies, so the
    // most agenda anybody can have is a heavy thumb, never a decision.
    guestRefereeGrudgeShift: 18,
    guestRefereeBiasShift: 12,
    guestRefereeAlignmentShift: 7,
    guestRefereeHealthCost: 6,
    guestRefereeMoraleCost: 3,
    // Being handed the shirt because the booker would not pay for an official
    // annoys the room more than being booked into the role on purpose.
    draftedRefereeMoraleCost: 4,

    // Officials on the payroll. A referee costs roughly a quarter of what a
    // comparable wrestler does — enough that carrying four of them is a real
    // line on the budget, cheap enough that it is never the reason you went
    // under. The crooked ones charge a premium because doing what you are
    // told is a service.
    refereeBaseWeeklyRate: 55,
    refereeRateRange: 300,
    refereeRateCurve: 2.8,
    refereeBendablePremium: 190,
    refereeContractWeeks: 52,
    refereeRateDecayPerWeek: 0.01,
    refereeMaxDiscount: 0.3,
    refereeRivalSigningChance: 0.03,
    refereePoolSize: 14,

    // Burnout. Six matches takes a fresh official most of the way down, which
    // is what makes one referee for the whole card a decision rather than the
    // obvious default — the main event gets whatever is left of him.
    refereeSharpnessPerMatch: 13,
    refereeSharpnessRecoveryPerWeek: 45,
    refereeSharpnessFloor: 0.55,

    // Blown calls. Tuned so a good official on a normal card misses something
    // a couple of times a year and the cheap one does it most weeks.
    refereeMissBaseChance: 0.02,
    refereeMissIncompetenceWeight: 0.3,
    refereeMissChanceCap: 0.45,
    refereeMissRatingPenalty: 6,
    refereeMissVictimMorale: 7,
    refereeMissReputationCost: 3.5,
    refereeCleanNightReputationGain: 0.4,
    refereeReputationCeiling: 6,

    // Casualties. A competitor is in the match; a referee is in the way; a
    // manager is at ringside asking for it. A guest referee is the worst of
    // both — in the middle of it without a wrestler's licence.
    casualtyChanceCompetitor: 0.035,
    casualtyChanceGuestReferee: 0.05,
    casualtyChanceReferee: 0.012,
    casualtyChanceManager: 0.02,
    casualtyChanceCap: 0.4,
    casualtyWeeksVariance: 0.5,
    casualtyHealthCost: 30,
    injuryModerateWeeks: 5,
    injurySevereWeeks: 10,
    injuryCareerThreateningWeeks: 26,

    // House style. A few points either way — enough to notice over a season,
    // never enough to stop you booking who you like.
    houseStyleRatingWeight: 4,
    houseStyleViolencePenalty: 10,

    // World. You start as a territory: a small room, regulars who know the
    // card, and belts named after the town rather than the world.
    promotionName: 'Southside Championship Wrestling',
    promotionArchetype: 'territory',
    rivalPromotionCount: 6,
    rivalMinHealthToBook: 45,
    rivalTitleDefenceChance: 0.12,
    rivalMaxTitleDefencesPerCard: 1,
    rivalTagMatchChance: 0.45,
    rivalStipulationChance: 0.15,
    rivalCredibilityRatingWeight: 0.12,
    // Tuned so a mid-table company roughly breaks even: at rating 60 with an
    // 18-person roster, revenue and costs both land near $17k a week. The top
    // of the ladder makes real money; anybody under about 50 is bleeding, and
    // bleeding for two years is what closes a company.
    rivalRevenueCurve: 3,
    rivalRevenueScale: 100_000,
    rivalRevenueFormWeight: 0.65,
    rivalOverheadBase: 4_000,
    rivalOverheadPerHead: 260,
    // Two years in the red before the doors close.
    rivalBankruptcyGraceWeeks: 104,
    // What an emergency investor puts in when a company would otherwise close
    // but the business cannot spare it.
    rivalBailoutCash: 250_000,
    minimumPromotions: 4,

    // The fire sale. A package of twenty midcarders and five belts appraises
    // around $400k, which is real money for everybody but the biggest company.
    auctionValuePerStar: 25_000,
    auctionValuePerTitle: 40_000,
    auctionReserveFraction: 0.35,
    auctionBaseAppetite: 0.5,
    auctionStyleFitAppetite: 0.35,
    auctionRosterRoomAppetite: 0.3,
    auctionAmbitionAppetite: 0.25,
    auctionBidVariance: 0.18,
    auctionMaxBankFraction: 0.6,
    auctionLowballFraction: 0.45,
    auctionFairFraction: 0.85,
    auctionAggressiveFraction: 1.35,

    tagTeamsPerPromotion: 3,
    rivalRosterSizeMin: 10,
    rivalRosterSizeMax: 26,
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
    promotionArchetype: 'territory',
    startingCash: 25_000,
    startingRosterSize: 18,
    rivalPromotionCount: 7,
    chaosLevel: 2,
  },
  standard: {
    startingCash: 75_000,
    startingRosterSize: 30,
    rivalPromotionCount: 6,
    rivalMinHealthToBook: 45,
    rivalTitleDefenceChance: 0.12,
    rivalMaxTitleDefencesPerCard: 1,
    rivalTagMatchChance: 0.45,
    rivalStipulationChance: 0.15,
    rivalCredibilityRatingWeight: 0.12,
    // Tuned so a mid-table company roughly breaks even: at rating 60 with an
    // 18-person roster, revenue and costs both land near $17k a week. The top
    // of the ladder makes real money; anybody under about 50 is bleeding, and
    // bleeding for two years is what closes a company.
    rivalRevenueCurve: 3,
    rivalRevenueScale: 100_000,
    rivalRevenueFormWeight: 0.65,
    rivalOverheadBase: 4_000,
    rivalOverheadPerHead: 260,
    // Two years in the red before the doors close.
    rivalBankruptcyGraceWeeks: 104,
    // What an emergency investor puts in when a company would otherwise close
    // but the business cannot spare it.
    rivalBailoutCash: 250_000,
    minimumPromotions: 4,

    // The fire sale. A package of twenty midcarders and five belts appraises
    // around $400k, which is real money for everybody but the biggest company.
    auctionValuePerStar: 25_000,
    auctionValuePerTitle: 40_000,
    auctionReserveFraction: 0.35,
    auctionBaseAppetite: 0.5,
    auctionStyleFitAppetite: 0.35,
    auctionRosterRoomAppetite: 0.3,
    auctionAmbitionAppetite: 0.25,
    auctionBidVariance: 0.18,
    auctionMaxBankFraction: 0.6,
    auctionLowballFraction: 0.45,
    auctionFairFraction: 0.85,
    auctionAggressiveFraction: 1.35,

    tagTeamsPerPromotion: 3,
    rivalRosterSizeMin: 10,
    rivalRosterSizeMax: 26,
    chaosLevel: 1,
  },
  bigMoney: {
    promotionName: 'Apex Wrestling Entertainment',
    promotionArchetype: 'sportsEntertainment',
    startingCash: 400_000,
    startingRosterSize: 40,
    rivalPromotionCount: 5,
    chaosLevel: 0,
  },
  sinkOrSwim: {
    promotionName: 'Blackline Pro',
    promotionArchetype: 'hardcore',
    startingCash: 8_000,
    startingRosterSize: 12,
    rivalPromotionCount: 8,
    chaosLevel: 3,
  },
};

export function worldSettingsFromPreset(preset: Exclude<WorldPresetName, 'custom'>): WorldSettings {
  return { ...defaultWorldSettings(), ...WORLD_PRESETS[preset] };
}
