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
    // Smaller out of the gate, deliberately. A 34-man roster on a card of six
    // means most of the company never works, and 198 people in the business
    // on week one is more names than anybody can hold. The population system
    // fills the gap over time now rather than front-loading it.
    startingRosterSize: 26,
    targetRosterSize: 38,
    freeAgentPoolSize: 24,
    talentQualityCurve: 0,
    starDensity: 0.07,
    womensDivision: 'separate',
    // Weather and the year. The dice are deliberately lopsided: something
    // worth a line happens about a third of the weeks, and of those the vast
    // majority is drizzle. The catastrophe tier is two parts in a thousand of
    // the rolls that land, which puts "no show at all" at roughly once every
    // four or five years of weekly television at the default chaos level, and
    // measured at exactly that: a storm bad enough to cost a third of the
    // house lands about every eighteen months, and a show is called off
    // outright about every four years. A calm world stretches that to a
    // decade; a chaotic one shortens it to about eighteen months.
    //
    // chaosLevel bends only the two dangerous tiers, so a chaotic world is
    // not a noisier one week to week — it is one where the rare thing is less
    // rare. At chaos 0 they are damped to a fifth; at chaos 3 they are three
    // times the baseline.
    weatherChancePerShow: 0.34,
    weatherSeverityWeights: {
      flavour: 55,
      minor: 30,
      notable: 11,
      severe: 5,
      catastrophe: 1.6,
    },
    weatherChaosDamping: 0.3,
    weatherChaosPerLevel: 0.55,
    // The rent and the crew were committed before anybody looked at the sky.
    // Nobody collects an appearance fee for a show that did not happen.
    cancelledShowCostShare: 0.8,
    memoriamDrawBonus: 1.35,
    // The call on bad weather. Two forecast strengths so the answer is not
    // the same every time: a confident one is usually worth calling off, an
    // even one usually is not, and telling them apart is the skill the
    // decision asks for.
    //
    // Calling it off is deliberately expensive. If it were free the player
    // would take it every single time a warning appeared, which is the exact
    // failure this whole decision exists to avoid — and the storm can miss,
    // so it is a gamble in both directions rather than an insurance premium.
    forecastLikelyShare: 0.45,
    forecastLikelyHitChance: 0.85,
    forecastEvenHitChance: 0.45,
    calledOffCostShare: 0.45,
    calledOffFollowing: -3,
    calledOffWronglyFollowing: -8,
    ranThroughItFollowing: 4,
    ranThroughItInjuryRisk: 0.35,
    ranThroughItWear: 2.5,
    stormMissedDraw: 0.88,
    movedShowDraw: 0.55,
    movedShowScrambleCost: 4500,
    movedShowFollowing: -2,
    weatherInjuryMaxWeeks: 3,
    // A women's championship needs a division, not two wrestlers taking turns.
    // An even split, and it is now read by every generator rather than only
    // by the player's opening roster.
    womensRosterShare: 0.5,
    womensDivisionFloor: 6,
    // One team per this many wrestlers, within bounds.
    wrestlersPerTagTeam: 7,
    tagTeamsMin: 2,
    tagTeamsMax: 7,
    agingEnabled: true,
    deathsEnabled: true,
    retirementEnabled: true,
    regenerateTalent: true,

    // Contracts
    // The shortest deal anybody signs and the longest. Two years is the cap:
    // longer than that and a booker never has to make the decision again,
    // which is the decision this whole system exists to create.
    contractLengthMin: 5,
    contractLengthMax: 104,
    // Where an ordinary wrestler in his prime sits between the two, before
    // age, a comeback, leverage or the spread move him.
    contractWantBase: 0.45,
    contractYouthAge: 26,
    contractYouthWant: 0.3,
    // Measured at 0.05 and half of everybody past forty-four piled onto the
    // five-week floor, which is a clamp rather than a spread. Softened so the
    // old end of the roster has a range too.
    contractWantLostPerVeteranYear: 0.032,
    contractComebackWant: 0.25,
    // Leverage of this is treated as neutral; above it shortens the deal
    // wanted, below it lengthens it.
    contractLeverageNeutral: 0.75,
    contractLeverageSwing: 0.55,
    contractWantSpread: 0.22,
    contractLengthDefault: 52,
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
    // Swapped from the original 42/24 — see the note on these in types.ts.
    matchRatingPopularityWeight: 24,
    matchRatingWorkrateWeight: 42,
    segmentsPerTV: 6,
    segmentsPerPPV: 10,
    broadcastWindowTV: 120,
    broadcastWindowPPV: 180,
    ratingLadderStepPerWeek: 1,
    // Standing is lost at two fifths the speed it is won. See
    // stepCompanyRatingTowardTarget.
    ratingLadderFallMultiplier: 0.4,
    // Show stars -> the company rating those shows are worth. See the DESIGN
    // note on targetCompanyRatingForStars: §13's own table put the floor at
    // 60 and paid 80 for an ordinary night, which made the ladder's stated
    // purpose — consistency as a strategy, a bad month expensive to escape —
    // unreachable. Convex at the top so the gap between strong and elite is
    // the widest one on the ladder.
    ratingLadderAnchors: [
      [1, 15],
      [2, 32],
      [3, 50],
      [4, 75],
      [5, 100],
    ],
    defaultMatchLength: 12,
    houseShowsEnabled: true,
    tournamentsEnabled: true,
    promoSlotsPerCard: 2,
    darkMatchSlots: 2,
    // A televised match's popularity swing chases the crowd it reached.
    // A dark match reaches the building and not much past it.
    darkMatchPopularityShare: 0.3,
    // A fifth of what a head spends on merch on an ordinary night — a bonus
    // match is a nice surprise, not the reason they came.
    darkMatchMerchPerHead: 0.9,
    hardcoreSaturationPerViolence: 6,
    hardcoreSaturationDecayPerWeek: 8,
    slotExpectationPercentileMin: 0.5,
    slotExpectationPercentileMax: 0.95,

    // Rivalries
    rivalryHeatDecayPerWeek: 3,
    rivalryHeatFromMatch: 6,
    rivalryHeatFromNonDecisiveFinish: 12,
    rivalryBlowoffPopularityFactor: 0.12,
    rivalryHeatRatingBonus: 12,
    shootHeatDecayPerWeek: 0.5,
    shootHeatRatingBonus: 8,
    shootHeatInjuryMultAtMax: 1.6,
    shootHeatMoralePerWeekAtMax: 4,
    shootLeanInConversion: 0.35,
    // Below this the animosity is not worth putting a camera on — two people
    // being a bit frosty is not an angle.
    shootHeatWorthRunning: 25,

    // Tournaments
    tournamentNightFatiguePerMatch: 0.09,
    tournamentNightHealthCostPerMatch: 7,
    tournamentFinalRatingBonus: 5,

    // Career status
    rookieYearsPro: 3,
    journeymanYearsPro: 8,
    veteranYearsPro: 12,
    veteranAge: 38,
    // Six points of asking price a year past thirty-eight, so a forty-five
    // year old name with nothing left is on roughly half what he was.
    leverageLostPerYearPastPrime: 0.06,
    // A comeback is the weakest position in the business.
    comebackLeverage: 0.55,
    // Below one, so a veteran who is merely good keeps a fair slice rather
    // than falling off a cliff — and one who is genuinely the best worker in
    // the company keeps effectively all of it.
    leverageCraftCurve: 0.8,
    leverageFloor: 0.25,
    // What the business calls an elite worker. A veteran at or above this can
    // still ask for his money whatever his birth certificate says.
    leverageEliteCraft: 85,

    // ---- the body -------------------------------------------------------
    // What to assume about somebody the game has no opinion about.
    // Below this a knock is not worth a conversation.
    injuryCallMinWeeks: 3,
    // How far out an unhappy man tells you he is leaving. A fortnight is
    // enough to move a belt and not enough to fix him.
    noticeWeeks: 2,
    noticeMoraleUnder: 35,
    noticeLoyaltyWeight: 0.45,
    noticeThreshold: 0.6,
    // Same fortnight as noticeWeeks above, on purpose — but this is the
    // booker's own chance to ask first, not the wrestler's warning that he
    // is already leaving.
    renewalWindowWeeks: 2,
    selfPreservationDefault: 50,
    bodyLongHistoryCount: 4,
    bodyHistoryTeachesCaution: 0.12,
    bodyEgoRecklessness: 0.35,
    bodyWorkThroughChance: 0.45,
    // Coming back early is usually fine. Working through it is a real gamble,
    // and it has to be usually survivable or nobody would ever do it and the
    // whole choice would be a decoration.
    bodyEarlyReturnBackfire: 0.18,
    bodyWorkThroughBackfire: 0.34,
    bodyEarlyWeeks: 0.65,
    bodyWorkThroughWeeks: 0.25,
    bodyBackfireWeeks: 2.6,
    bodyWorkThroughToll: 4,
    bodyWorseToll: 9,
    bodyCareerEndingToll: 45,
    bodyCareerEndingChance: 0.12,
    // Rare enough to be a story rather than a mechanic, and possible enough
    // that "he says he is fine" is never simply free.
    bodyDeathChance: 0.06,
    // What a death on your own show costs you afterwards. Two years is long
    // enough that a company can come back from it and short enough that it is
    // a real problem now. See career/onOurWatch.ts.
    watchMemoryWeeks: 104,
    watchRoomMoraleCost: 18,
    watchAskingPremiumMax: 0.45,
    // At full weight only the careful stay away; by the time it has faded
    // nobody does.
    watchRefusalCare: 0.6,
    watchLeaveWeeks: 4,
    // Whose fault the room decides it was. A match asking more than the other
    // man can safely give is most of it; a file and a careless streak are the
    // rest. See career/onOurWatch.ts.
    watchViolenceForFullRisk: 3,
    watchPriorsForFullBlame: 4,
    watchNegligenceFromDepth: 0.55,
    watchNegligenceFromPriors: 0.25,
    watchNegligenceFromCarelessness: 0.2,
    // Never zero: the company still said a hurt man could work.
    watchOfficeShareWhenBlamed: 0.3,
    watchShunWeeks: 30,
    // What it costs to keep him. Weekly, for as long as the room is shunning
    // him — the other half of the decision to pay him off instead.
    moraleBlamedInTheRoom: 1.6,
    // How long a man keeps asking before he gives up on being answered.
    // Unbounded, this was an absorbing state: ask, get ignored, bleed morale
    // every week until zero and stay there for the rest of the save.
    releaseRequestPatienceWeeks: 10,
    doctorAgePerYear: 0.04,
    doctorConditionWeight: 0.5,
    // What moves somebody from wanting cash to wanting cover. A bad injury is
    // worth several ordinary ones — the third knee is not an argument.
    appetiteHistoryWeight: 0.1,
    appetiteBadInjuryWeight: 0.25,
    // Measured at 0.85 and nobody in the world ever wanted insurance: the
    // trait tops out around 0.84 on its own, so the threshold sat above its
    // practical ceiling and the whole appetite was unreachable without a
    // serious injury first.
    appetiteInsuranceAt: 0.68,
    appetiteCashAt: 0.5,
    appetiteCashEgoAt: 0.55,
    // How much longer a deal a frightened body wants, as a share of the span.
    securityPerInjury: 0.05,
    securityPerBadInjury: 0.09,
    securityFromCaution: 0.1,
    securityMax: 0.35,
    leverageStrongAt: 0.95,
    leverageFairAt: 0.75,
    leverageWeakAt: 0.5,
    legendYearsPro: 10,
    legendPeakPopularity: 88,
    prospectTalent: 72,
    enhancementPopularity: 30,
    gatekeeperPopularity: 45,
    upperCardPopularity: 62,
    mainEventPopularity: 75,
    fallenStarDrop: 28,

    // The read on a wrestler. Set so that on a starting roster most people
    // have a real catch against them and a handful genuinely do not — a
    // screen where everybody reads "fine" tells the player nothing.
    scoutExhaustedFatigue: 70,
    scoutWornDownHealth: 55,
    scoutUnhappyMorale: 35,
    scoutHotMomentum: 72,
    scoutColdMomentum: 25,
    scoutDrawPopularity: 78,
    scoutKnownPopularity: 60,
    scoutEliteCraft: 80,
    scoutStrongCraft: 65,
    scoutBigEgo: 78,
    scoutBadAttitude: 25,
    scoutOldAge: 44,
    scoutProspectAge: 26,

    // TV ratings
    tvRatingBase: 2.4,
    tvRatingCeiling: 12,
    tvShowQualityWeight: 0.55,

    // Rivals approaching your talent once a deal has run out (§19)
    approachBaseChance: 0.09,
    approachOfferPremiumMin: 0.15,
    approachOfferPremiumRange: 0.6,
    approachMoneyWeight: 0.5,
    approachMoraleWeight: 0.35,
    approachMomentumWeight: 0.15,
    approachContractLengthResistance: 0.45,
    approachAttitudeResistance: 0.3,

    // Creative events — with the library roughly doubled (personnel issues
    // are meant to feel close to weekly now, per direct user feedback: "I
    // want personnel decisions pretty regularly (weekly)"), tuned for most
    // weeks to bring the booker something, not one every 3-4 weeks.
    eventWeeklyChance: 0.8,
    eventGlobalGapWeeks: 1,
    eventCategoryGapWeeks: 4,
    eventRepeatDamping: 0.55,
    eventMinWeightFraction: 0.15,

    // A couple of times a year across the whole business, per direct user
    // feedback — and landed on a random promotion, not always the player's,
    // "so the user can dodge a bullet if the rival's stadium roof caves in."
    catastropheWeeklyChance: 0.04,
    catastropheRivalRatingDip: 10,
    rivalMoveReactionPopularity: 65,
    rivalNewTitleWeeklyChance: 0.003,

    // Contracts, scaled to a promotion running small buildings: a jobber is
    // around $25/wk, a midcarder around $160, a genuine draw around $750.
    // The curve is what makes a star cost multiples of a midcarder.
    contractBaseWeeklyRate: 60,
    contractRateRange: 2200,
    contractRateCurve: 2,
    // Pay splits into a retainer everybody draws and an appearance fee only
    // the booked collect. An enhancement talent is on 30% guaranteed and
    // works for the rest; a genuine draw is on 75% and gets paid to exist.
    // This is what makes carrying thirty-five people possible at all — the
    // card uses fourteen of them, and the other twenty-one cost a retainer
    // rather than a wage.
    retainerShareBase: 0.18,
    retainerShareRange: 0.5,
    contractDrawWeight: 0.7,
    contractCraftWeight: 0.3,
    contractRenewalFloor: 1.05,
    contractAffordabilityWeeks: 12,
    // Ninety days. Long enough that granting a release is a real weapon
    // against a rival, short enough that it is not a retirement.
    noCompeteWeeks: 13,
    // Guarantees arrive with ego. Somebody you have pushed for two years
    // wants their money whatever happens; the rest of the card is disposable.
    egoGuaranteedPartial: 55,
    egoGuaranteedHalf: 70,
    egoGuaranteedFull: 88,
    guaranteedPctPartial: 0.25,

    // Trades. The margin is what stops the player laundering bad contracts
    // through the AI: a rival has to come out ahead, not level.
    tradeAcceptanceMargin: 1.15,
    tradeContractBurdenWeight: 0.6,
    tradeValueCurve: 2.2,
    tradeValueScale: 1000,
    tradeCooldownWeeks: 8,
    tradeMoraleCost: 12,
    tradeAffordabilityShare: 0.25,
    releaseRequestChance: 0.07,
    releaseRequestMorale: 30,
    releaseRefusedMoraleCost: 4,

    // Show production economics
    travelCostPerHead: 45,
    crewCostBase: 400,
    crewCostPerSeat: 0.35,
    ticketFairPriceBase: 8,
    ticketFairPriceRange: 34,
    ticketUnderpriceBonus: 0.45,
    ticketOverpricePenalty: 0.85,
    // Greed used to be free. Price moved how many turned up tonight and was
    // then forgotten, so once a promotion outgrew its building — thirty
    // thousand wanting in, fifteen thousand seats — doubling the price still
    // sold out and the greedy price was strictly the best one. Now the town
    // remembers, and it remembers the price rather than the empty seats, so
    // it still stings on a night that sold out.
    //
    // Calibrated against territoryFollowingPerStar (1.6): a four-star show
    // earns 6.4 following. At 1.5x fair the gouge takes 5.6 of it back, so a
    // great card barely holds its ground. At 2x it takes 12.6 and the town
    // goes backwards however good the wrestling was.
    priceGougeForgiveness: 0.1,
    priceGougeGoodwillPenalty: 14,
    priceBargainGoodwillBonus: 3,
    priceGiveawayRatio: 0.6,
    priceGougeRatio: 1.4,
    merchSpendPerHead: 4.5,
    // The venue ladder is the progression, so the audience curve has to map
    // onto it. Before this it did not: a brand-new promotion at demand 54
    // drew 4,500 people, outgrew the top of the ladder by week fifteen, and
    // sold out every room it ever rented for the rest of the save. Picking a
    // building stopped being a decision because bigger was always free.
    //
    // Now: demand 54 -> ~750 (an armoury), 70 -> ~4,400 (a theatre), 85 ->
    // ~15,600 (a real arena), 95 -> ~32,000, 100 -> 45,000 (the dome). Each
    // rung needs a promotion that has genuinely grown into it, and reaching
    // above your draw leaves visible empty seats — which is what
    // venueEmptyPenalty has always been for and has never once been able to
    // charge you.
    audienceLoyalCore: 350,
    demandAudienceScale: 45000,
    demandAudienceCurve: 6.5,
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

    // The room's own character, scaled into show-rating points. A venue's
    // atmosphere runs roughly -4 to +10, so at 0.55 the best room in the game
    // is worth about five and a half points and the worst costs two — real,
    // and smaller than the card.
    venueAtmosphereWeight: 0.55,
    // Where the facilities list changes its wording. Words, never figures.
    venueHeavyCut: 0.12,
    venueGoodBar: 2.2,
    venuePoorBar: 1.0,
    venueGreatRoom: 7,
    venuePoorRoom: -2,
    venueHardLoadIn: 800,
    // With no roof, the weather's bite is multiplied. A night that would have
    // cost an indoor show a fifth of its house costs an outdoor one half.
    openAirWeatherMultiplier: 2.4,
    // However bad it gets, somebody always turns up.
    openAirWorstDraw: 0.2,

    // ---- the tables ------------------------------------------------------
    // How far a gimmick's merch pull swings a stall keyed to it. At 2.5 a
    // lucha card roughly doubles a mask stand against an average one.
    standGimmickWeight: 2.5,
    standWorstFit: 0.35,
    standBestFit: 2.0,
    standPrestigeSwing: 1.7,
    // Where the break-even verdict changes wording, as a share of the room.
    standEasySell: 0.15,
    standFairSell: 0.5,

    // ---- residency -------------------------------------------------------
    residencyShortWeeks: 26,
    residencyLongWeeks: 52,
    // A landlord with a year of guaranteed dates negotiates; one with half a
    // year negotiates less.
    residencyShortDiscount: 0.3,
    residencyLongDiscount: 0.45,
    residencyDepositWeeks: 4,
    // Every show in the same room wears the town a little further out. At
    // 0.012 a half-year run ends around three-quarters of the draw it started
    // with, which is a real cost without being ruinous.
    residencySaturationPerShow: 0.012,
    residencyWorstDraw: 0.35,
    // Walking away early costs most of what is left, but not all of it.
    residencyBreakShare: 0.7,
    // The real price of a residency, and the one not denominated in money:
    // a night in front of the same three hundred people is worth a third of a
    // night on the road towards getting anybody over.
    residencyExposure: 0.33,
    // A converted cinema in a mill town is not a prestigious address.
    residencyPrestige: 8,
    // One room and a calendar instead of a booking operation. Measured: this
    // is the saving that decides whether a residency is survivable, because
    // overhead scales with what a company is worth rather than what it draws.
    residencyOverheadShare: 0.45,
    // The bar is yours in every one of these rooms — it is a large part of why
    // a company with nothing survives one.
    residencyConcessionsPerHead: 2.4,

    // Answering a rival's offer
    // How long a rival's approach sits on the table before it settles itself.
    poachOfferWeeks: 2,
    poachResponseMoneyEffect: 0.45,
    poachResponseMoneyRaise: 1.35,
    poachResponsePushEffect: 0.3,
    poachOfferWeeksToRespond: 1,

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
    // How many of the asks are reserved for what he actually wants, before
    // the clauses everybody wants fill the rest.
    egoAppetiteAsks: 2,
    egoMaxClauseAsks: 3,
    egoWalkRiskMax: 0.55,
    egoRosterFrictionMax: 6,

    // What agreed clauses cost every week.
    // Half a year to make good on a promised title run before they start
    // souring. Long enough to book it properly, short enough to remember.
    clauseTitlePushWeeks: 26,
    // What a broken promise, or a loss for somebody who was told they would
    // not lose, costs in morale every week.
    clauseTitlePushMoraleDrain: 1.6,
    // How long the wire keeps mentioning a promise that has come due.
    clauseTitlePushNoticeWeeks: 2,
    clauseNoJobbingMoraleHit: 9,
    clauseInsuranceRate: 0.18,
    clauseTravelCost: 120,
    clauseGuaranteedDatesRate: 0.25,
    clauseMerchandiseCut: 0.08,

    // The mood bands. Everybody starts at 65 — "Happy" — so the opening
    // locker room is content rather than delighted, and has somewhere to go
    // in both directions.
    moodDelightedAbove: 82,
    moodHappyAbove: 64,
    moodContentAbove: 48,
    moodRestlessAbove: 34,
    moodUnhappyAbove: 18,
    // What somebody thinks they are owed. A popular man with a big opinion
    // of himself expects the main event; a nobody is glad of the work.
    moraleExpectationStanding: 0.65,
    moraleExpectationEgo: 0.35,
    moralePositionWeight: 3.2,
    moraleMainEventFloor: 1.2,
    moraleWinGain: 0.9,
    moraleRoutineLoss: 0.5,
    moraleBadLossGap: 0.35,
    moraleBadLossWeight: 4.5,
    // Two weeks off is a week off. Three is a message. Measured: at a grace
    // of 0 a 24-man roster running a 6-match card lost every person morale
    // every single week, because half the roster is idle by construction.
    // Who somebody is. See career/personality.ts — one trait each, mostly,
    // and the second one is where the interesting people come from.
    traitLeverCap: 2.5,
    traitRestRelief: 0.45,
    // Ring intelligence. The floor is high on purpose: carrying a match is a
    // rare thing, and a world where two thirds of the roster can do it is a
    // world where booking the pairing does not matter.
    carryRingIQFloor: 68,
    carryMax: 0.55,
    carryWorthSaying: 6,
    botchFromCondition: 0.5,
    botchFromStamina: 0.35,
    botchReferenceMinutes: 15,
    botchPerRiskPoint: 0.055,
    botchMaxChance: 0.16,
    botchInjuryShare: 0.12,
    botchRatingCost: 5,
    botchBadOneMultiplier: 2.2,
    botchInjuryMultiplier: 3.5,
    // Rare, and minor when it lands — a scorch, not a catastrophe. Smaller
    // rating cost and injury multiplier than a botch on purpose: this is an
    // entrance mishap, not a blown spot in the match itself.
    pyroBurnChance: 0.015,
    pyroBurnInjuryShare: 0.35,
    pyroBurnRatingCost: 3,
    pyroBurnInjuryMultiplier: 2.5,
    // Once per show, not once per match. A handful of shows a season on
    // decent gear, a real nuisance on nothing but a mat and a truck.
    broadcastDropoutChance: 0.05,
    ringcraftGeneralAt: 78,
    ringcraftSafeAt: 58,
    ringcraftGreenAt: 35,
    likedBelovedAt: 78,
    likedFineAt: 55,
    likedAwkwardAt: 32,
    // The weeks nobody is booked for. Everything here is small on purpose: a
    // week is a week, and the numbers are meant to add up over a season rather
    // than be felt in a fortnight. Anything bigger makes the gym the game.
    assignmentRestBelowHealth: 42,
    assignmentRingBelowIQ: 45,
    assignmentAppearancesBelowPop: 45,
    assignmentAppearancesNeedFreshness: 45,
    assignmentAgePeak: 22,
    assignmentAgeNoGain: 38,
    assignmentGymGain: 2.4,
    assignmentGymEnergyCost: 4,
    // Slower than the gym, because it is the harder thing to teach — and it is
    // the one that has no other route in.
    assignmentRingGain: 1.9,
    assignmentRingSkillShare: 0.5,
    assignmentRingEnergyCost: 3,
    assignmentAppearanceDraw: 0.5,
    assignmentAppearanceFreshnessCost: 0.9,
    assignmentAppearanceEnergyCost: 2,
    assignmentAppearanceFee: 220,
    assignmentRestHealth: 4.5,
    assignmentRestEnergy: 9,
    assignmentRestMorale: 0.9,
    assignmentRestWantedBonus: 1.3,
    assignmentRestGlassBonus: 2,
    assignmentAgeDeclineMax: 45,
    assignmentNeglectLoss: 1.2,
    physicalStatFloor: 20,
    moraleSetPointFloor: 22,
    moraleSetPointCeiling: 92,
    traitSecondChance: 0.28,
    // A bit more generous than traits — the player asked for "one thing to a
    // handful," and a motivator drawn alone reads thinner than a trait does
    // since three of the six (fame, creative, competition) only ever speak
    // up, never shape a negotiation or a lever weight the way a trait can.
    motivatorSecondChance: 0.32,
    motivatorThirdChance: 0.15,
    fameMotivatorNotices: 0.08,
    fameMotivatorWeight: 5,
    creativeMotivatorNotices: 0.1,
    creativeMotivatorWeight: 4,
    competitionMotivatorNotices: 0.08,
    competitionMotivatorWeight: 4.5,
    // An In It For The Money notices a tenth either way, and the swing is
    // deliberately large: they are cheap to keep and expensive to shortchange,
    // which is the whole of the character.
    traitPayGapNotices: 0.1,
    traitPayGapWeight: 6,
    traitPayGapMax: 3.5,
    traitTogetherGain: 1.6,
    traitApartCost: 1.1,
    // Six weeks is a tour. Everybody can do a tour; this one wants it to end.
    traitRestWantedAfter: 6,
    traitRoadCostPerWeek: 0.55,
    traitRoadCostMax: 3,
    traitGlassNoticesAfter: 3,
    traitGlassCostEach: 0.5,
    traitGlassCostMax: 2.5,
    // Traits reaching outside morale. Scaled against the formulas they land
    // in rather than picked in isolation: the approach pulls are a fraction
    // of a raw temptation score that usually sits under 1 before the clamp
    // (approachMoneyWeight alone maxes at 0.5), and the release threshold
    // bump is against a 0-100 morale scale with the base ask-out line at 30.
    traitOfficeDislikePull: 0.12,
    traitPartnerPull: 0.22,
    traitSpotlightPull: 0.15,
    // Twice the "notices" gap (0.1) — noticing you are underpaid and asking
    // to leave over it are different thresholds.
    traitBadlyUnderpaidGap: 0.35,
    traitApartReleaseThreshold: 12,
    // Secondary nudges against retirementBodyWeight (0.45) and
    // retirementDeclineWeight (0.3) — real, but age and the body still do
    // most of the deciding.
    retirementLoveOfTheGameRelief: 0.1,
    retirementRoadWearyPush: 0.08,
    moraleIdleGraceWeeks: 2,
    moraleSpotsPerSegment: 2,
    moraleIdlePerWeek: 1.1,
    moraleIdleCap: 6,
    moraleIdleFloor: 0.35,
    moraleChampionGain: 0.7,
    // Deliberately the largest single positive term in the system. Reading
    // what the audience is asking for and booking it should be the best week
    // anybody on the roster has.
    moraleDemandDelivered: 3.5,
    // Mood rubs off on the people you are in the ring with. At the extreme —
    // a delighted man in with a miserable one — this is worth about 3 points
    // a week to the man at the bottom, which is a real lever without being a
    // way to launder a whole unhappy roster through one cheerful veteran.
    moraleContagionWeight: 3.5,
    moraleAllyGain: 0.5,
    moraleEnemyCost: 1.4,
    // What an ordinary night actually scores, measured rather than assumed:
    // 160 of the player's shows and 889 of the rivals' over a played save both
    // averaged 41, and only one night in ten cleared 55. So this sat above the
    // whole distribution, "The show was a mess" fired on nearly every card
    // anybody ran, and a term meant to reward a good night was a standing tax
    // on the entire business instead. It has to be the middle of the range or
    // it is not a neutral point.
    moraleShowNeutral: 42,
    moraleShowWeight: 4,
    // Even a small company is a fine place to work if the booker uses you.
    // Pulling everybody toward the company rating instead dragged a mid-table
    // locker room to "restless" however well it was booked.
    moraleSetPointBase: 45,
    moraleSetPointRange: 35,
    moraleSettleRate: 0.06,
    moraleSettleReportable: 0.6,
    moraleWeeklyCap: 9,
    // Comfortably under moodUnhappyAbove (18): still a real "miserable"
    // reading, not a promotion out of the band. See the note in types.ts.
    moraleFloor: 10,

    // The live call. Sixteen lines is about forty seconds of reading, which
    // is long enough to tell the story of a match and short enough that six
    // of them on a card is not a chore.
    commentaryEnabled: true,
    commentaryMaxLines: 16,
    // Not every beat gets a remark. A colour man who speaks after every
    // single line is the thing that makes commentary feel like filler.
    commentaryColourChance: 0.62,
    commentaryComebackChance: 0.45,
    commentaryBanterChance: 0.4,
    commentaryGrudgeHeat: 40,
    commentaryGreatMatch: 74,
    commentaryPoorMatch: 32,
    commentaryLongReignWeeks: 20,
    commentaryRookieAge: 23,
    commentarySizeGapLbs: 80,
    commentaryHotHouseShare: 0.85,
    commentaryFlatHouseShare: 0.45,
    commentaryUpsetProbability: 0.3,
    commentaryDeviousManager: 60,
    commentaryStreakRun: 4,
    commentarySlumpRun: 3,
    // Against a ten-week booking memory, four meetings is a pairing nobody
    // would actually book; three is a real feud's cadence. Measured: at four,
    // "they have met this often" fired in 0 of 1246 called matches.
    commentaryMetOftenTimes: 3,
    // And at 55 "they have never met" needed a three-and-a-half-star match to
    // be worth saying, which never happened in a mid-table company. 45 is a
    // solid TV match.
    commentaryFirstMeetingRating: 45,
    commentaryLongFeudWeeks: 8,
    commentaryWeatherDrawHit: 0.9,
    commentaryLongCareerYears: 12,

    // Storylines. Against the beat weights in data/storylineBeats.ts these
    // put "building" at three or four real events and "boiling" at seven or
    // eight — about two months of weekly television for a story told
    // properly. A feud built in a fortnight is a feud nobody believed in.
    storylineBuildingInvestment: 25,
    storylineBoilingInvestment: 60,
    // Five weeks of silence kills it. Long enough that a week off is fine,
    // short enough that forgetting about a feud is a real thing you did.
    storylineFizzleWeeks: 5,
    storylineColdWeeks: 3,
    storylineStaleAfterWeeks: 3,
    storylineStalePerWeek: 0.12,
    // A blow-off is worth most when the story was told and the match
    // delivered. The floor means even a badly built one pays something.
    storylineToldWeight: 0.8,
    storylineNightWeight: 0.5,
    storylineBlowoffFloor: 0.2,
    storylineGreatBlowoff: 1.2,
    storylineFairBlowoff: 0.75,
    storylineSuggestHeat: 45,
    storylinePayoffPopularity: 6,
    storylinePayoffMomentum: 10,
    storylinePayoffCompanyRating: 2.5,
    storylineFizzleRating: 0.8,

    // Tired is tonight's tank; worn is the debt that does not clear between
    // shows. The player cares about both and they are different problems.
    miniTiredEnergy: 45,
    miniWornFatigue: 55,

    // Where somebody is over. The national share is deliberately the larger
    // half — television exists and a real star is a real star everywhere —
    // but the local half is enough that a hometown hero out-draws a bigger
    // name in his own building, which is the whole point of a territory.
    reachNationalShare: 0.55,
    reachUnseenShare: 0.55,
    reachHometownHead: 15,
    reachGainBase: 1.4,
    reachGainPerQuality: 3.2,
    reachLocalCeiling: 100,
    reachHometownGainBonus: 1.35,
    // Slow. A town takes months to forget you, and never forgets a star at
    // all — absenceDecay floors at what national reputation carries.
    reachDecayPerWeek: 0.55,
    reachNationalPopularity: 78,
    reachKnownHere: 45,
    reachRegionalTowns: 3,

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

    // §16 cross-promotional supershows. The biggest night in the game and the
    // only one neither booker controls.
    supershowAppetiteBase: 50,
    supershowAppetiteStandingWeight: 60,
    supershowAppetiteReputationWeight: 20,
    supershowAppetiteResentmentWeight: 0.8,
    supershowHostileResentment: 70,

    // ---- what a partner remembers -----------------------------------------
    // An even split of a joint card. Slightly under half because the host
    // carries the show and the business expects the visitors to be looked
    // after a little.
    grudgeFairShare: 0.45,
    // Squared above the fair share, so taking three quarters of a card is much
    // worse than taking three fifths — which is what makes the split a
    // decision rather than a formality.
    grudgeBurialMax: 55,
    // Putting the other company over earns goodwill back, but slowly. The
    // asymmetry with grudgeBurialMax is the whole design.
    grudgeGenerosityMax: 14,
    // A night at or under this many stars annoys everybody a little, whoever
    // won. Deliberately the smaller term.
    grudgeFlopStars: 2.5,
    grudgeFlopWeight: 6,
    grudgeMassacreShare: 0.75,
    // About nine months to forget a full burial: it costs you the next season
    // and most of the one after.
    grudgeDecayPerWeek: 1.4,
    supershowEagerAt: 65,
    supershowCautiousAt: 38,
    supershowPublicRefusalChance: 0.35,
    // Two audiences buy one show, and the novelty draws people neither company
    // reaches alone. This is why a joint PPV beats running two separate ones.
    supershowGatePerRatingPoint: 1900,
    supershowNoveltyMultiplier: 1.45,
    supershowHostGateBonus: 0.08,
    // Everybody on the card gets paid well above a normal night, and the
    // winners take a multiple of that again. The incentive to win is money.
    supershowAppearanceShare: 0.011,
    supershowWinBonusMultiple: 1.4,
    // A quarter of the bonus for losing. Sat at zero and unused for a long
    // time, which meant a man who worked the biggest night of the year and got
    // beaten went home on the flat fee — while §16 also took his popularity
    // and his champion's prestige. One punishment for one loss is enough; the
    // incentive to win is still four to one.
    supershowLoserBonusShare: 0.25,
    // §16's amplification table, both directions.
    supershowPopularityMultiplier: 2.2,
    supershowMoraleSwing: 14,
    supershowTitlePrestigeSwing: 6,
    supershowCompanyRatingSwing: 7,
    supershowTerritorySwing: 9,
    supershowRoutMargin: 0.5,
    // Negotiation.
    supershowMinPartnerShare: 0.2,
    supershowMaxPartnerShare: 0.8,
    supershowCautiousPremium: 0.08,
    supershowSplitTolerance: 0.03,
    supershowGuaranteeMin: 15000,
    supershowGuaranteeMax: 60000,
    supershowMinCard: 8,
    supershowMaxCard: 14,
    supershowRatingPerSegment: 11,
    supershowEarliestWeek: 20,
    // Roughly one offer a year in practice. The raw rate looks generous
    // because only about half of it survives contact: measured on a fresh
    // world, three of six rivals are dismissive enough to refuse outright, so
    // half the rolls produce nothing. At 0.025 a save could run two years and
    // never see one, which is no use for the biggest night on the calendar.
    supershowOfferChancePerWeek: 0.05,
    supershowOfferWeeks: 4,
    // A booker who rings round every week is a booker nobody takes seriously.
    supershowProposalCooldownWeeks: 12,
    // The card negotiation. Twenty points of standing is a match that reads as
    // a squash to both audiences, and no booker sends his champion out into
    // one; an eager partner will swallow half again as much because he wants
    // to be on the show more than he wants to look after anybody.
    supershowOutmatchedGap: 20,
    supershowEagerTolerance: 1.5,
    // Three spares. Enough that a booker can protect two of his people and
    // still run the agreed card, not so many that striking is free.
    supershowStandbys: 3,
    // A card that came up short draws less. Not catastrophically — both
    // audiences already bought the ticket — but the night is smaller and the
    // money says so.
    supershowShortCardPenalty: 0.5,
    supershowShortCardFloor: 0.6,

    // The Crucible: the annual interpromotional tournament, every August.
    // The fee is deliberately punishing — a company that cannot cover it and
    // still make payroll does not get to be there, so the field is a statement
    // about who is doing well.
    // Swept against a played save rather than guessed. At $120,000 exactly one
    // rival could cover it at the first August, so with the three-company floor
    // the tournament never ran at all; at $80,000 three qualify and the first
    // Crucible lands in the very first August with a full sixteen-man bracket,
    // four names apiece. Cheaper than that only dilutes the field to three
    // names each and stops the fee meaning anything.
    cupEntryFee: 80_000,
    cupAffordabilityCushion: 2.5,
    cupMinimumStanding: 25,
    // The bracket is a fixed size, so the field decides how many names each
    // company brings: two companies bring eight apiece, eight bring two.
    cupBracketTarget: 16,
    cupGatePerRatingPoint: 2600,
    // Carrying the Iron Crown is standing, not stats. It expires when somebody
    // else wins the thing.
    cupCrownPopularityBonus: 9,
    // Winning it is the biggest night an individual can have; going out in the
    // first round in front of the whole business costs something too.
    cupNeutralRoundShare: 0.34,
    cupStandingSwing: 12,
    // Two companies is not a tournament, it is a supershow with brackets drawn
    // on it — and the year already has two of those.
    cupMinimumField: 3,
    // The road to superstardom. Winning it is supposed to change a career, not
    // nudge it, so this is the wrestler coming back different — permanent, and
    // it stacks for a repeat winner.
    // Each Crucible win moves a person less than the last. At 0.5 a second
    // win is worth half the first and a third a quarter — still worth having,
    // and no longer a route to a wrestler who is 100 at everything.
    cupRepeatWinFalloff: 0.5,
    cupWinnerPopularitySurge: 14,
    cupWinnerSkillSurge: 5,
    cupWinnerCharismaSurge: 6,
    cupWinnerStaminaSurge: 4,
    cupWinnerAttitudeSurge: 4,
    cupWinnerMomentumSurge: 25,
    // Ties that form in play, because the seeded ones were the only ones that
    // ever existed. Deliberately slow: three shared matches before it can
    // happen at all, then a one-in-eight roll, starting weak enough that the
    // ordinary drift decides whether it becomes anything.
    tieFormMinMeetings: 3,
    tieFormChancePerMeeting: 0.12,
    tieFormStartMin: 22,
    tieFormStartMax: 40,
    tieFormMentorAgeGap: 12,

    // Free agents
    freeAgentRateDecayPerWeek: 0.008,
    freeAgentMaxDiscount: 0.4,
    freeAgentRivalSigningChance: 0.05,

    // Ringside personnel. A manager is a small rating bump and a large heat
    // bump for somebody who cannot talk; a guest referee is star power at the
    // cost of a clean finish.
    managerRatingBonusMax: 4,
    // What a manager is actually for. Small on purpose: the sim picks the
    // winner (§0), so a man at ringside tilts a match and never decides one.
    // Six points of win probability to his own man and four off the other is
    // enough to matter across a feud and never enough to be a guarantee.
    managerWinBonusMax: 0.06,
    // A manager's cut. The percentage is the earner — the base wage is a
    // retainer — which is what gives him a reason to want more names.
    //
    // The counterweight is attention: at two clients he is at 74% of himself,
    // at four 48%, at six 36%. So the sweet spot is two or three, a book of
    // six is a man collecting cheques and doing nobody any good, and the
    // player can watch it happen without being told a number.
    repCutMin: 0.08,
    repCutMax: 0.3,
    repRateLiftMax: 0.35,
    repAttentionFalloff: 0.35,
    repAttentionFloor: 0.25,
    repStretchedAt: 0.5,
    repWorthCourting: 35,
    // A manager on your books goes looking roughly every couple of months.
    // Often enough that a signed manager fills a book over a year, rare
    // enough that he does not sweep the roster in a fortnight.
    repCourtingEnabled: true,
    repCourtChancePerWeek: 0.12,
    // And what the book costs him. Super-linear because the travel is what
    // kills — two clients in two towns is not twice one client, it is two
    // towns and the driving between them.
    //
    // At one client he is fine indefinitely. At three he wears down slowly
    // enough to manage; at six he is running on fumes inside a few months and
    // the only fixes are rest or letting somebody go.
    repRoadCostPerClient: 1.6,
    repRoadCostCurve: 1.4,
    repWearPenalty: 0.55,
    repWearFloor: 0.35,
    repTooTiredToCourt: 0.8,
    // Getting out. A deal nobody can end is a trap rather than a deal, and
    // both sides can see a different half of the problem: the client sees the
    // bill, the manager sees his diary.
    repClientPatience: 0.45,
    repOutgrowsAt: 82,
    repDropsWhenWornTo: 0.55,
    repMinWorthKeeping: 40,
    // What everybody pays to get to work, unless their deal covers it. Set
    // against a base weekly rate so a two-night week is a noticeable slice of
    // a hand's purse and pocket change to a main eventer — which is exactly
    // who ends up with the clause.
    travelOwnCostPerNight: 85,

    // Discipline. Two on file before it costs money, four before it costs
    // you a spot on the card — slow enough that one bad night is not a
    // crisis, fast enough that a repeat offender becomes the booker's
    // problem rather than only the victim's.
    disciplineWarnUntil: 2,
    disciplineFineUntil: 4,
    disciplineFineWeeks: 2,
    disciplineSuspensionWeeks: 3,
    disciplineRepeatWeeks: 2,
    // Hurting somebody on purpose is not a worse version of working stiff.
    // Six weeks minimum and a month's pay, first time, no ladder.
    disciplineInjurySuspensionWeeks: 6,
    disciplineInjuryFineWeeks: 4,
    // Real animosity, not a worked feud. Below this an injury is what it
    // looks like — an accident in a violent job.
    disciplineShootHeatBar: 55,
    disciplineReoffendWeight: 0.25,
    // Managers are people now, not a rental list. Old for the job, poor in
    // the ring, and priced off what they used to charge a night.
    managerTalentAgeMin: 46,
    managerTalentAgeMax: 72,
    managerTalentDebutAge: 24,
    managerTalentPresenceShare: 0.75,
    managerTalentRingScale: 0.35,
    managerTalentFeeToWage: 0.9,
    // A bodyguard can be put in a match and will not be embarrassed. Still
    // short of an actual wrestler — standing behind somebody is not the same
    // job as working a card — but a long way clear of a mouthpiece.
    managerTalentMuscleBonus: 0.45,
    // Rolled per graduating class, so roughly one new manager every few
    // years. Deliberately thin: most of the pool should arrive by a wrestler
    // moving into a suit or a natural talker walking in off the street, both
    // of which already happen — this is the stranger who was never either.
    managerTalentArrivalChance: 0.16,
    // How many strangers get looked at each year. The arrival chance above
    // decides how many of them actually turn up, so this is the width of the
    // funnel rather than the number of managers.
    managerArrivalsConsideredPerYear: 2,
    managerTalentMinMic: 62,
    // ...and the price of it. A maximally crooked manager in front of a
    // maximally sharp official is caught roughly one match in six; a good
    // talker cuts that by up to two thirds, and a bent referee never sees a
    // thing. The client eats the disqualification, not the manager.
    managerCaughtChanceMax: 0.18,
    managerSlicknessMax: 0.65,
    // Bigger when it lands, and it rarely lands. A permanent few points off
    // the other man was overplayed by construction — every match, forever,
    // invisibly. Roughly one match in six for a manager the crowd actually
    // notices, and the write-up says so when it happens.
    managerOpponentPenaltyMax: 0.12,
    managerDistractionChance: 0.18,
    // A manager only takes the microphone off somebody clearly worse at it.
    autoFillMouthpieceGap: 15,
    promoAsMatchShare: 6,
    promoJabHeat: 5,
    // A bodyguard takes a real slice of what the ring throws at his man —
    // worth nothing on the microphone and a great deal to somebody who keeps
    // getting hurt. The two jobs are deliberately separate.
    managerInjuryShieldMax: 0.35,
    // ...and what he does with the other half of the job. Needs somebody both
    // willing and capable, which most of the pool is not: at the very worst
    // pairing it is about one match in nine, and it costs the victim a real
    // slice of the condition he was going to wrestle on.
    bodyguardBackstageChance: 0.14,
    bodyguardBackstageDamage: 18,
    // The combination: a mouthpiece pulls the official, the muscle in the same
    // corner uses the seconds. Rarer than either half on its own, because it
    // needs both of them bought and both of them standing behind one client.
    bodyguardMuggingChance: 0.22,
    bodyguardMuggingDamage: 22,
    // A mouthpiece and a heavy. More than two at ringside is a stable run-in.
    cornerSeats: 2,

    // Where the production ladder's plain-language labels change over.
    productionShoestringRungs: 2,
    productionTouringRungs: 5,
    // Two years of books is plenty to read a trend off.
    statementsKept: 104,
    // A quarter's burn. Shorter and one bad supershow week reads as a crisis;
    // longer and a company that started bleeding a month ago still looks fine.
    runwaySampleWeeks: 13,
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
    matchPopularityChaseFallShare: 0.4,
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
    deathYoungFloor: 0.0002,
    // A crowd numb to blow-away matches. Steep enough that running all-out
    // every week stops working inside a couple of months.
    paceSaturationPenalty: 14,
    paceSaturationDecayPerWeek: 7,
    // Half the fee rides on the rating, capped at a 40% bonus and a 35% cut.
    // Enough that a bad run on television is felt in the bank, bounded enough
    // that one soft week does not end a promotion.
    broadcastRatingSensitivity: 0.5,
    broadcastRatingUpside: 0.4,
    broadcastRatingDownside: 0.35,
    deathOldAge: 75,

    // The fans. Ten voices a show, and never more than 85% agreeing.
    fanTweetsPerShow: 10,
    // The rumour mill. Echoes are the signal: one voice is noise, three is a
    // thing that is happening. A false rumour can reach two so that counting
    // is a read rather than a lie detector — see world/rumours.ts.
    rumourMaxVoices: 3,
    rumourFalseSecondVoice: 0.3,
    rumourTrueGoesQuiet: 0.15,
    rumoursPerWeek: 3,
    rumourOnFireMomentum: 70,
    rumourBadBloodHeat: 35,
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
    // The knee of the curve in types.ts: the lists genuinely disagree (16 of
    // the 20 top-five places go to different people, and two circuits share
    // under 3 of their top ten) while a real draw still places on most loops.
    circuitTasteWeight: 35,
    circuitAgilityFloor: 55,
    circuitRankingSize: 10,
    // Roughly a season. Long enough that a belt can miss a few weeks for a
    // story, short enough that it cannot be forgotten about for a year.
    titleDefenceWindowWeeks: 12,
    titleDefenceWindowTelevisionWeeks: 6,
    titleDefenceNoticeWeeks: 4,
    titleDefenceWarningWeeks: 1,
    championInjuryGraceWeeks: 3,
    workingHurtInjuryMultiplier: 2.6,
    titleSignatureHonoured: 4,
    titleSignatureIgnored: 7,
    confrontationCharismaWeight: 0.62,
    confrontationPopularityWeight: 0.38,
    confrontationLuck: 14,
    confrontationDeadHeat: 4,
    confrontationBestShare: 0.65,
    confrontationHeatBonus: 12,
    confrontationRingBonus: 5,
    confrontationBackstageHeatScale: 0.7,
    confrontationBackstageShootBias: 2.2,
    confrontationTurnShift: 55,
    confrontationWinMomentum: 7,
    confrontationWinPopularity: 2,
    confrontationLossMomentum: 4,
    confrontationEnergyCost: 5,
    // A quarter of a year: long enough that a handful of people are always in
    // the window, short enough that you cannot simply agree deals with a
    // rival's whole roster and wait.
    secretSigningWindowWeeks: 13,
    // Bidding blind against an incumbent whose number you cannot see. The
    // premium is the whole reason this is not simply better than signing
    // somebody the ordinary way.
    secretSigningPremium: 1.7,
    secretSigningRateFloor: 9,
    // These four sum to less than one on purpose: a miserable egomaniac with
    // the whole window still to run is a very likely yes and never a certain
    // one, so approaching somebody is always a risk.
    secretSigningMoraleWeight: 0.4,
    secretSigningEgoWeight: 0.28,
    secretSigningRunwayWeight: 0.2,
    secretSigningBaseAppeal: 0.08,
    // Roughly one in eight a week against a mid-table company, which is what
    // makes shaking hands three months out a genuinely bad idea.
    secretRetentionBase: 0.03,
    secretRetentionClout: 0.14,
    secretRetentionMorale: 0.09,
    secretRetentionTalk: 0.05,
    secretRetentionCap: 0.35,
    // And once it is signed, the clock is brutal on purpose. Two weeks of
    // sitting on it is roughly even money that somebody prints it.
    secretExposureBase: 0.12,
    secretExposurePerWeek: 0.22,
    secretExposureCap: 0.95,
    secretSigningBaseImpact: 3.2,
    secretSigningBlownImpact: 0.35,
    secretDebutDecayPerWeek: 0.45,
    secretSigningProofWeeks: 8,
    secretSigningRefusalMorale: 6,
    revealMomentumPerImpact: 9,
    revealPopularityPerImpact: 2.5,
    revealCompanyRatingPerImpact: 1.6,
    revealRivalRatingPerImpact: 1.1,
    factionDrawWeight: 0.55,
    factionFormWeight: 0.25,
    factionSizeBonus: 6,
    factionSizeBonusCap: 24,
    factionOvershadowMargin: 8,
    factionEstablishedSize: 4,
    factionOutOfControlSize: 6,
    factionRecruitMoraleWeight: 0.5,
    factionRecruitEgoWeight: 0.3,
    factionRecruitOverlookedWeight: 0.6,
    factionPullForming: 0.35,
    factionPullEstablished: 0.6,
    factionPullRunning: 0.85,
    factionPullOutOfControl: 1.1,
    // A group is a story over months. Rolled every week this produced
    // forty-one comings and goings in a year, which reads as noise rather
    // than as anybody deciding anything.
    factionChurnWeeks: 6,
    factionMaxMembers: 5,
    factionDefectionWeight: 0.06,
    factionDefectionCap: 0.12,
    factionEgoDriftRunning: 0.6,
    factionEgoDriftOutOfControl: 1.2,
    demandDreamMatchPopularity: 72,
    demandWastedGap: 26,
    demandTitleShotMomentum: 74,
    demandRematchHeat: 55,
    demandOverexposedWeeks: 7,
    demandOverexposedHeatPerWeek: 9,
    demandPushPopularity: 55,
    demandPushGap: 12,
    demandBoardSize: 6,
    demandPerKindCap: 2,
    demandDeliveryRatingBonus: 5,
    // Roughly one wrestler on a thirty-odd roster every two or three weeks —
    // often enough to be part of the game, rare enough that most weeks are
    // quiet. Measured in misfortune.test.ts.
    misfortuneChanceHealthy: 0.012,
    misfortuneChanceInjured: 0.06,
    // $150/wk all-in clears ordinary promotion pay by a wide margin — this
    // only ever bites a roster genuinely working for nothing.
    dayJobWageThreshold: 150,
    // About one week in twenty, per underpaid wrestler — noticeable over a
    // season without turning every card into a scramble.
    dayJobAbsenceChance: 0.05,
    mysteryOpponentLongShotWeight: 18,
    // Tuned against the measurement in freshness.test.ts: rotating a deep
    // roster has to beat running the same twelve people every week, or the
    // roster the game asks you to build is money you had no reason to spend.
    overexposureLookbackWeeks: 10,
    overexposureFreeMeetings: 1,
    overexposureRepeatPenalty: 5,
    overexposureRepeatCap: 16,
    overexposureFreeWeeks: 4,
    overexposureAppearancePenalty: 2.5,
    overexposureAppearanceCap: 12,
    gimmickHeatNeutralMomentum: 50,
    // Neutral sits inside "Wearing thin" on purpose — an act with no real
    // reaction either way is already costing something, not waiting at a
    // comfortable middle. Real heat (well above neutral momentum) is what
    // keeps a character fresh; real rejection crashes it toward ice cold.
    gimmickHeatNeutralTarget: 40,
    gimmickHeatMomentumScale: 1.0,
    gimmickHeatWorkedDriftRate: 0.03,
    gimmickHeatIdleDriftRate: 0.01,
    iceColdThreshold: 20,
    coldMeetingTriggerWeeks: 6,
    staleGimmickThreshold: 60,
    staleGimmickPenaltyMax: 8,
    bookerRestWeight: 22,
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
    // Half the open jobs a year. The rest is filled by walk-ons, comebacks
    // and people other companies let go — a school that filled every vacancy
    // on its own would make the free agent pool pointless.
    academyFillRate: 0.5,
    academyGraduatePopularity: 0.12,
    // Past this the school says no. It is not that nobody starts at
    // thirty-five — plenty do — it is that they do not start in a class.
    academyMaxAge: 34,

    // Companies are born as well as dying. Measured before this existed:
    // seven alive in year one, four by year three, and nothing ever replaced
    // the three that went — so a hundred wrestlers ended up in a pool with no
    // employer left to drain it. A glut of unemployed talent is now the thing
    // that makes somebody open a promotion, which is self-limiting in exactly
    // the right way.
    newPromotionsEnabled: true,
    promotionCountMax: 9,
    newPromotionUnemployedTrigger: 45,
    newPromotionPressureRange: 60,
    // Folds have to be outpaced, not merely matched — measured at 0.004/0.02
    // the business still shrank from seven companies to four in four years.
    newPromotionChanceBase: 0.01,
    newPromotionChanceRange: 0.06,
    // Bottom of the ladder, and they have to climb like anybody else.
    newPromotionRatingMin: 12,
    newPromotionRatingMax: 28,
    newPromotionCashMin: 60_000,
    newPromotionCashMax: 180_000,
    newPromotionRosterSize: 9,
    //
    // Measured over seven simulated years, starting from 137 people:
    //
    //         total  active  signed  free agents  companies
    //   y1     141     129     110       19           7
    //   y3     151     117      57       58           4    <- three folds
    //   y5     156     111      64       41           5
    //   y7     164     103      51       45           5
    //
    // The population no longer inflates (198 -> 256 in four years before
    // this), the glut from a fold spikes and then drains instead of sitting
    // there forever, and companies come back. It settles a little below where
    // it started, which is a business slowly consolidating — the right
    // direction for it to drift if it is going to drift at all.

    // Walk-ons: everybody past the school's door policy who still wants a
    // shot. Mostly rough and staying that way, because the years to grow into
    // it are the thing they do not have — but one in eleven is a gem and one
    // in eight cannot work at all and can talk better than anybody you employ.
    walkOnsPerYearMin: 2,
    walkOnsPerYearMax: 6,
    walkOnMaxAge: 44,
    // Same reasoning as the phenom: a gem is a gamble now, not a windfall.
    walkOnGemChance: 0.16,
    walkOnTalkerChance: 0.13,
    // Untrained: about a third of the ring skill a trained version would have
    // had. A gem keeps two thirds, which is what makes them obvious.
    walkOnCraftScale: 0.34,
    walkOnGemCraftScale: 0.66,
    walkOnTalkerCraftScale: 0.4,
    walkOnTalentScale: 0.6,
    walkOnGemTalentFloor: 78,
    walkOnGemCharismaFloor: 62,
    walkOnTalkerCharismaFloor: 74,
    walkOnCeilingRoom: 8,
    walkOnGemCeilingRoom: 34,
    walkOnPopularitySpread: 5,
    //
    // Measured, 800 of each, against a graduating class:
    //
    //                     age  skl  agi  str  mic  tal  ceiling(skl)
    //   school             22   56   52   59   50   50    63
    //   walk-on, ordinary  39   22   21   57   51   30    30
    //   walk-on, gem       39   37   35   55   70   83    70
    //   walk-on, talker    40   12   11   60   82   30    30
    //
    // Strength barely moves, because a frame is not something a school gives
    // you. Skill halves. 48% of the street could still work a midcard spot
    // against the school's 81%, and the street produces *more* managers than
    // the school does (29% against 17%) — which is the point of the door.
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

    // Four signature events on rotation, so the same one comes round at the
    // same point every year. How often they run is the promotion's own call
    // now — see engine/world/schedule.ts. Buys are worth more than the gate
    // at any real size, which is what makes the big show matter.
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
    // Across the whole roster, so it is multiplied by however many people
    // are on the books. At 6 one promo was four times the morale damage of
    // killing somebody in the ring, which is not the shape anybody intended.
    promoCalloutMorale: 2.5,
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

    // Changing jobs. A year, both directions. Long enough that converting
    // somebody is a plan rather than a patch for tonight's injured official,
    // short enough that a career has room for a second act.
    roleTransitionLockWeeks: 52,
    convertedRefereeBaseCompetence: 34,
    convertedRefereeExperienceWeight: 1.1,
    convertedRefereeLearningRate: 0.09,
    convertedRefereeCompetenceCap: 78,

    // Casualties. A competitor is in the match; a referee is in the way; a
    // manager is at ringside asking for it. A guest referee is the worst of
    // both — in the middle of it without a wrestler's licence.
    casualtyChanceCompetitor: 0.017,
    casualtyChanceGuestReferee: 0.05,
    casualtyChanceReferee: 0.012,
    casualtyChanceManager: 0.02,
    casualtyChanceCap: 0.4,
    casualtyWeeksVariance: 0.4,
    casualtyLengthExponent: 0.45,
    // About one injury in forty. Rare enough to be a story, common enough
    // that a long career will meet one.
    casualtyCatastrophicChance: 0.025,
    casualtyCatastrophicMultiplier: 4,
    // At zero equipment safety, a ladder/cage/tables match is half again as
    // dangerous as its flat injuryMult alone says. Shrinks toward nothing as
    // the production ladder climbs, same as everything else in this stack —
    // never reaching zero, same "never fully safe" rule as everywhere else.
    hardwareGearRiskAtWorst: 0.5,
    // Severity as a number. 30 weeks out is the top of the scale, so grade is
    // just "weeks, as a percentage of thirty".
    //
    // The band edges are derived from the week thresholds below rather than
    // picked, so the labels keep meaning exactly what they meant when severity
    // was inferred from a week count — moderate at 5 weeks, severe at 10,
    // career-threatening at 26. Choosing round numbers instead quietly moved
    // "severe" from ten weeks to fifteen, which is a balance change nobody
    // asked for dressed up as a refactor.
    gradeModerate: 17, // 5 / 30
    gradeSevere: 33, // 10 / 30
    gradeCareerThreatening: 87, // 26 / 30
    gradeFitToWork: 12,
    gradeWeeksAtWorst: 30,
    // Pinned to the scale rather than picked: grade 100 is 30 weeks, so a week
    // of proper rest is 100/30 of a grade. Any faster and the weeks-remaining
    // estimate is lying about itself.
    gradeHealResting: 3.3,
    gradeHealTrainingShare: 0.45,
    gradeHealLightDutyShare: 0.7,
    // Deliberately small. Going out hurt should be tempting, and the thing
    // that punishes it is the risk below, not this drift.
    gradeWorsenPerMatch: 2.5,
    // A knock is a small risk; a serious injury worked on is a reckless one.
    gradeRiskCurve: 1.6,
    gradeRiskAtWorst: 3.5,
    gradeAggravationShare: 0.7,
    casualtyHealthCost: 30,
    injuryModerateWeeks: 5,
    injurySevereWeeks: 10,
    injuryCareerThreateningWeeks: 26,

    // House style. A few points either way — enough to notice over a season,
    // never enough to stop you booking who you like.
    houseStyleRatingWeight: 4,
    houseStyleViolencePenalty: 10,

    // Fan taste. Deliberately slower and smaller than house style itself —
    // this is the crowd catching up to what you've actually been showing
    // them, not a second identity system.
    fanTasteNeutral: 50,
    fanTasteShareScale: 300,
    fanTasteDriftRate: 0.05,
    fanTasteRatingWeight: 2,
    fanTasteNoticeGap: 15,

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
    // Not dollar for dollar against the player's own loan — a lighter, more
    // frequent form of the same struggle, and it never speeds up shouldFold
    // above. Half of the grace period is the same point foldRisk starts
    // reading "In real trouble," so a rival cutting people and a rival the
    // player can see is in trouble are the same moment.
    rivalTrimEnabled: true,
    rivalTrimAtGraceShare: 0.5,
    rivalTrimWeeklyChance: 0.1,

    // The player's own lifeline. Sized against current payroll (see
    // economy/loan.ts) rather than a flat figure — $250k is nothing to a
    // company that started with $400k and more than most will ever see if
    // they started with $25k. Two weeks in the red is half of
    // bankruptcyGraceWeeks (4): the bank calls before the business dies, not
    // after.
    loanEnabled: true,
    loanTriggerWeeksInTheRed: 2,
    loanMinimumCeiling: 10_000,
    loanTierSmallFraction: 0.4,
    loanTierMediumFraction: 0.7,
    loanTierLargeFraction: 1.0,
    // First loan buys real room — six weeks of payroll. Each one after that
    // buys less: the bank believes the story less each time it hears it.
    loanCeilingWeeks1st: 6,
    loanCeilingWeeks2nd: 4,
    loanCeilingWeeks3rd: 3,
    loanRepaymentMultiple1st: 1.3,
    loanRepaymentMultiple2nd: 1.6,
    loanRepaymentMultiple3rd: 2.0,
    loanRepaymentWeeks1st: 26,
    loanRepaymentWeeks2nd: 26,
    // A shorter fuse on top of everything else — by the third ask, the bank
    // wants its money back fast, not just a bigger cut of it.
    loanRepaymentWeeks3rd: 20,
    // A year clean before the bank will talk again; a year and a half after
    // a second rescue; two full years after a third. Counted in solvent
    // weeks, not calendar time — a backslide resets the climb.
    loanCooldownWeeks1st: 52,
    loanCooldownWeeks2nd: 78,
    loanCooldownWeeks3rd: 104,
    loanMandateStrikes1st: 1,
    loanMandateStrikes2nd: 2,
    loanMandateStrikes3rd: 3,

    // A rare, dramatic offer, not a weekly nuisance — roughly once every two
    // months of active repayment. The count is 15-30% of the roster, and the
    // price is payroll times 3-8x — big enough to look tempting mid-crisis,
    // deliberately disconnected from what actually gets taken.
    buyoutEnabled: true,
    buyoutWeeklyChance: 0.12,
    buyoutCountFractionMin: 0.15,
    buyoutCountFractionMax: 0.3,
    buyoutCountMin: 2,
    buyoutCountMax: 8,
    buyoutPriceMultiplierMin: 3,
    buyoutPriceMultiplierMax: 8,
    buyoutTeammateMoraleDelta: -4,

    // Fades in about two months of clean weeks — noticeably faster than the
    // loan's own cooldown, since this is a lighter, everyday-negotiation
    // tax rather than another rescue mechanism.
    releaseStigmaEnabled: true,
    releaseStigmaCooldownWeeks: 8,
    releaseStigmaGuaranteedPct: 0.25,
    releaseStigmaBonusWeeks: 3,

    // Deliberately harsh — a third of value at best, and only ever while an
    // active loan means things are genuinely bad. Not a normal way to raise
    // cash; the last lever after the loan and the buyout offer.
    fireSaleEnabled: true,
    fireSaleValueFraction: 0.35,

    tagTeamsPerPromotion: 3,
    rivalRosterSizeMin: 8,
    rivalRosterSizeMax: 20,
    // From one week to two and a half years. The floor matters: at 6 the
    // opening world had nobody inside the safe end of the signing window, so
    // week one could only ever offer a long-odds handshake.
    openingContractMinWeeks: 1,
    openingContractMaxWeeks: 130,
    territoryCount: 12,
    startingTerritories: 1,
    startingYear: new Date().getFullYear(),
    seed: 'wrestling-booking-game',
    rivalsCanGoBankrupt: true,

    // What the business believes, against what is true. The noise is wide
    // deliberately: scouting that is 95% accurate has no draft busts in it.
    hypeNoise: 14,
    // One certainty in five has nothing behind it. Measured over the phenoms
    // and gems a long save produces, that is roughly one genuine bust every
    // decade or so — often enough to be a real risk, rare enough that signing
    // a phenom is still the right call.
    hypeBustChance: 0.2,
    hypeBustTalent: 42,
    hypeBustGap: 22,
    hypeSleeperGap: 22,
    // The market learns by watching. Somebody kept off television keeps their
    // reputation, which is true to the business and is also a real (bad)
    // strategy the player can run.
    // A couple of years of television to close on the truth, so a bad
    // signing's stock falls the way a real one does — not a revelation, a
    // gradual stopping of people bringing him up. At 0.02 a badly-rated
    // signing was exposed inside six months, which reads as the game telling
    // you rather than you finding out.
    hypeLearnWorked: 0.008,
    hypeLearnIdle: 0.0015,
    hypeRatedAt: 70,
    hypePhenomAt: 85,
    //
    // Measured. Across the whole business 6% are over-rated and 5% under-
    // rated, which is the background noise. The certainties are where it
    // bites: 22% of phenoms out of the school and 22% of gems off the street
    // are bad draft picks, and they are indistinguishable from the real thing
    // at the moment anybody has to decide —
    //
    //   solid phenom   hype 94   talent 96   ceiling(skl) 91
    //   bust           hype 94   talent 42   ceiling(skl) 70
    //
    // A bust is not useless, note. They are a decent hand who cost a fortune
    // and a main-event spot, which is what a bad draft pick actually is.
    //
    // How long before anybody knows, working every week:
    //   92 -> y1 74 -> y2 63 -> y3 55 -> y4 50 -> y5 46 -> y6 44
    // ...and kept off television for those same six years: still 73.

    // Shows nobody planned. A memorial is not a decision — you run the
    // building — and a benefit is a small one. Neither pays: what they buy is
    // a locker room that thinks better of the company and a town that
    // remembers you turned up.
    memorialTenureWeeks: 104,
    // A memorial draws well for an unplanned night late in the week, but it
    // is not a card anybody advertised. The gate covers the building and the
    // rest goes to the family — see world/impromptu.ts.
    memorialGateShare: 0.6,
    memorialGenerousGate: 25_000,
    // Turning up is most of it. The rest is the size of the cheque.
    memorialGoodwillFloor: 0.35,
    memorialReputation: 4,
    memorialMorale: 6,
    memorialFollowing: 5,
    charityShowsEnabled: true,
    // Roughly one a year and a half. Often enough to be a thing that happens,
    // rare enough that it never reads as part of the pattern.
    charityShowChance: 0.013,
    charityReputation: 2,
    charityMorale: 3,
    charityFollowing: 4,
    impromptuShowCost: 6_000,

    // A manager is somebody's manager if they have worked their corner in the
    // last half year. There is no client list to maintain — being at ringside
    // is the relationship, which is also the one the player can see.
    ledgerClientWindowWeeks: 26,
    // People finish matches hurt all the time. Four weeks out is the point
    // where it stopped being a match somebody finished.
    ledgerStoppageWeeks: 4,

    // Where somebody sits on the card. Bands are wide so nobody flickers
    // between two of them on a good week, and the fall cushion means a main
    // eventer who cools off is still booked like one for a while — the
    // audience remembers who you were.
    //
    // Thresholds are read against `overnessIn`, not raw popularity, so the
    // same man is a main eventer in the company that suits him and an upper
    // midcarder in the one that does not. See career/fit.ts.
    cardMainEventAt: 72,
    cardUpperMidcardAt: 56,
    cardMidcardAt: 38,
    cardLowerCardAt: 20,
    cardFallCushion: 8,
    cardMinMatches: 6,
    // Catching fire: momentum through the roof *and* the crowd already moving.
    // Momentum on its own is a hot streak somebody has been protected through.
    cardBreakoutMomentum: 82,
    cardBreakoutStanding: 44,
    cardHotMomentum: 68,
    cardColdMomentum: 30,

    // Somebody's people. Five is a place for five, not a quota — most
    // wrestlers have one or two of each and plenty have none.
    //
    // The gain and fade rates are a decade apart on purpose: you make a friend
    // over about a year of being in each other's matches, and you lose one
    // over about five years of not seeing them. Measured in circle.test.ts.
    circleMax: 5,
    circleFloor: 30,
    circleThickAt: 70,
    circleGainWorked: 0.9,
    circleGainSharedCard: 0.25,
    circleFadePerWeek: 0.12,
    circleLapseAt: 8,
    // A death costs the man who travelled with him a real week of morale, and
    // everybody further down the list proportionally less. An enemy dying is
    // not a good week either — nobody celebrates it.
    circleGriefFriend: 22,
    circleGriefEnemy: 6,

    // The schedule. Money from extra nights is concave — a house show does
    // not draw what the televised one draws — and the work is linear, because
    // a house show is a card worked by a card's worth of people. What makes a
    // heavy pattern ruinous rather than merely expensive is `recoveryLoss`:
    // the roster that is never home never heals, and a broken roster puts on
    // bad shows, which is what the extra gates were paying for.
    //
    // So the punishment is not a penalty, it is a delay. Measured over three
    // years, bank balance every six months, on a save nobody manages:
    //
    //   1 night    695 1090 1320 1448 1122  444   never folds
    //   2 nights   907 1481 1333  706  203        folds week 152
    //   3 nights  1014 1354  595   97             folds week 116
    //   4 nights   894  333  -31                  folds week  81
    //   5 nights   489   69                       folds week  63
    //
    // Every extra night earns more in the first year and dies sooner. Two is
    // the best peak and the last sustainable one, which is what "the ideal is
    // two" has to mean if it is going to mean anything. Nothing in the game
    // says which column the player is in (§0) — they find out the way the
    // business found out.
    scheduleMaxShows: 5,
    scheduleIdealShows: 2,
    scheduleHouseShowRevenueShare: 0.24,
    scheduleRevenueCurve: 0.62,
    scheduleHouseShowIntensity: 0.36,
    scheduleRecoveryLossPerShow: 0.12,
    scheduleRecoveryFloor: 0.2,
    scheduleMonthlyPPVRating: 45,
    scheduleBiMonthlyPPVRating: 25,

    // Where somebody gets over. Fit multiplies the target a wrestler's
    // popularity chases, so nothing is confiscated when they sign — a name is
    // still a name on their first night — but a bad fit stops climbing well
    // short of what his matches are worth and drifts back down toward it.
    //
    // The chemistry weight is deliberately close to the legible half. If
    // reading the promotion correctly guaranteed the signing worked, fit
    // would just be a checklist; the point is that it is a bet.
    fitEnabled: true,
    fitStyleWeight: 0.55,
    fitDrawWeight: 0.45,
    fitChemistryWeight: 0.8,
    // ±22% on the ceiling at the stops, and the stops bind often enough to
    // matter. Measured across the business, the gap between somebody's best
    // room and their worst is 0.18 at the median and 0.26 at the ninetieth
    // percentile — so a popularity-80 wrestler is worth about fourteen points
    // more in the right company than the wrong one, and twenty at the ends.
    // The difference between a main eventer and an upper midcarder, without
    // making a mis-signing unrecoverable.
    fitSpread: 0.22,
    fitFloor: 0.72,
    fitCeiling: 1.28,
    fitPoachingGap: 0.12,
    fitLovedAt: 1.15,
    fitSuitsAt: 1.06,
    fitPoorAt: 0.9,
    //
    // Measured. The same wrestler, working matches of the same quality at the
    // same cadence, starting at popularity 60:
    //
    //   fit 0.80   y1 57   y2 56   y3 56   y5 55
    //   fit 1.00   y1 63   y2 65   y3 66   y5 67
    //   fit 1.13   y1 68   y2 72   y3 74   y5 74
    //
    // Nineteen points between the room that suits him and the one that does
    // not, arrived at over two or three years rather than announced. Which is
    // how it should read: not a revelation, a wrestler who quietly never
    // becomes what he was supposed to become here — and becomes it somewhere
    // else after you let him go.

    // Contract perks. The resentment scale is what makes a private locker
    // room a decision rather than a free morale point: cheap in money, and
    // paid for weekly by twenty-five people who noticed.
    perksEnabled: true,
    perkResentmentScale: 1.0,
    perkInsulation: 1.6,

    // The bidding war. Rare by construction rather than by a rarity dial: it
    // takes a genuine star reaching the open market, or a phenom out of the
    // school, plus at least two other companies with the headroom to enter.
    // Most weeks in most saves none of that is true.
    biddingEnabled: true,
    biddingStarPopularity: 78,
    biddingProspectTalent: 88,
    biddingProspectAge: 26,
    // Per graduating class, not per graduate — a class with two phenoms in it
    // would not be a phenom.
    // Raised from 0.05 once busts existed. When a phenom was a guaranteed
    // star, one every twenty classes was right — a certainty should be rare.
    // Now that one in five has nothing behind them, a phenom is a gamble
    // rather than a gift, and a gamble the player only sees once a decade is
    // not a mechanic they ever learn to play.
    biddingPhenomChancePerClass: 0.14,
    biddingPhenomStatFloor: 68,
    biddingPhenomTalentFloor: 90,
    biddingPhenomPopularity: 38,
    biddingMinRivals: 2,
    biddingHeadroomWeeks: 26,
    biddingWantsThreshold: 0.85,

    // What the business reckons somebody is worth. A wrestler exactly average
    // on the present/future blend prices at 1.0x their own asking rate; a
    // genuine draw prices well above it and a body held together with tape
    // prices below.
    biddingCeilingAge: 34,
    biddingValueFloor: 0.62,
    biddingValueRange: 0.85,
    biddingDamageDiscount: 0.35,
    biddingMomentumSwing: 0.2,

    // Who they will and will not work for. At strength 70 bad blood stops
    // being a price and becomes an answer — which is roughly where the rest
    // of the game already treats a feud as real (relationshipRefusalThreshold).
    biddingRefusalStrength: 70,
    biddingWarmthPull: 0.22,
    biddingChillPush: 0.3,
    biddingStanceDeadzone: 0.05,
    // A friend in the building is worth about a fifth off; somebody they
    // cannot stand costs about a third on top.
    biddingDiscountMax: 0.2,
    biddingPremiumMax: 0.35,
    biddingWeightStanceHeadline: 14,

    // The announced number. Somebody with no opinion of themselves names
    // roughly what the business thinks they are worth; somebody who knows
    // they are the draw names half again. Announcing it up front replaced a
    // hidden "anything under 85% is an insult" rule, which did the same job
    // without ever telling the booker what the job was.
    biddingMinimumBase: 0.95,
    biddingMinimumEgoRange: 0.55,
    biddingMinimumNerve: 0.07,
    biddingSelfRegardFuture: 0.5,
    biddingMaxRounds: 2,

    // A company with a thin top of the card stretches for a name a stacked
    // one treats as a luxury. And once in a while somebody decides this is
    // the signing that defines their year — rare, still capped by the same
    // runway as everything else, and drawn per company per auction, so a rich
    // booker can never be sure they have bought it.
    biddingRosterFullAt: 70,
    biddingRosterTopN: 5,
    biddingKeennessHunger: 0.35,
    // Companies bid on the fit they can see. A hardcore promotion pays up
    // for a hardcore worker and passes on a mat technician, which is what
    // makes free agency a market rather than an auction of the same list.
    biddingKeennessFit: 0.14,
    biddingBigSwingChance: 0.12,
    biddingBigSwingMultiple: 1.55,

    // Nobody bids with money they do not have. A reckless owner keeps three
    // months of payroll in the bank; a cautious one wants the better part of
    // a year before they will talk about anybody.
    biddingRunwayWeeksMin: 12,
    biddingRunwayWeeksRange: 30,

    biddingTermSecurityPull: 0.5,
    biddingTermEgoPush: 0.45,

    biddingKeennessBase: 0.45,
    biddingKeennessLift: 0.5,
    biddingKeennessUpside: 0.4,
    biddingKeennessYouth: 0.3,
    biddingYouthPivot: 28,
    // How far each kind of company stretches, how generous it is and how much
    // it will risk now lives in data/biddingTemperaments.ts, keyed on the
    // owner personality the promotion already had.
    biddingRivalMaxClauses: 4,
    biddingBonusWeeks: 20,
    biddingMinWeeks: 52,
    biddingMaxWeeks: 208,
    biddingBaseGuarantee: 0.35,

    // Money is the biggest single term, and scoreBid normalises it by the
    // ceiling so this really is the most it can ever be worth. The rest of the
    // sheet adds up to about 64, so a big enough cheque *can* win on its own —
    // it is simply the expensive way to do it.
    //
    // Measured against a full field — one company of each owner personality —
    // for an ego-70 star. Share of auctions the player wins, as multiples of
    // the number the wrestler's people announced:
    //
    //                      1.00x  1.25x  1.50x  2.00x  3.00x
    //   money alone           0%     1%    21%    34%    34%
    //   + the right clauses  13%    51%    85%    96%    96%
    //
    // The flat top is the point. Money stops helping at the ceiling, so a rich
    // booker cannot simply buy an auction — and even a perfect offer loses one
    // in twenty-five, because somebody in the room occasionally decides this
    // is the signing that defines their year (biddingBigSwingChance). The
    // field is not uniform either: for an established star the star-chaser
    // takes most of what the player does not, and for a phenom out of the
    // school the builder and the showman take it between them — see
    // data/biddingTemperaments.ts.
    biddingWeightMoney: 68,
    biddingWeightBonus: 12,
    biddingWeightTerm: 10,
    biddingWeightClauses: 22,
    biddingWeightStanding: 10,
    biddingWeightLoyalty: 6,
    biddingWeightHome: 5,
    biddingMoneyCeiling: 2.2,
    biddingClauseSaturation: 2.5,
    biddingUnlistedClauseAppeal: 0.25,
    biddingGutFeeling: 2.5,
    biddingCloseCall: 4,

    // Second generation. Tuned so a save has to have run a while before the
    // first one appears: the parent must be finished, must have peaked at 65,
    // and must have debuted 22 years ago, which in a world starting at year 0
    // means nobody qualifies until the opening roster's veterans have retired.
    // That is the intent — a second-generation wrestler in year three would
    // be a stat bonus, not a payoff.
    secondGenerationEnabled: true,
    secondGenMinParentPopularity: 65,
    secondGenParentDebutedYearsAgo: 22,
    secondGenMaxChildren: 2,
    // Per graduate, and the schools put out 0-14 a year — most years, inside
    // the normal population band, they put out none at all. Measured over 45
    // simulated years in a world engineered to retire people early (so that
    // eligible parents actually exist): 24 second-generation debuts against
    // 474 people in the business, about one every other year. A real save is
    // rarer than that, because a real save spends its first two decades with
    // nobody eligible.
    secondGenChancePerGraduate: 0.08,
    secondGenParentShortlist: 6,
    // 45% of a 90-popularity legend's peak is 40 — a long way above a
    // graduate's 5-15, a long way below anybody you would main-event.
    secondGenInheritedShare: 0.45,
    secondGenInheritedCap: 55,
    secondGenTownShare: 0.55,
    secondGenCharismaPull: 0.35,
    secondGenResemblance: 0.6,
    // A year and a half of television. Long enough that squandering it is a
    // decision rather than an accident.
    secondGenPatienceWeeks: 78,
    secondGenProofMatches: 20,
    secondGenProofWinRate: 0.5,
    secondGenProofPopularityGain: 12,
    secondGenFadePerWeek: 0.6,
    secondGenFadeFloor: 20,
    secondGenExpectationBurden: 0.14,
    relationshipsEnabled: true,
    hallOfFameEnabled: true,
  };
}

/** §5 "Presets" table. Each preset overrides a subset of the defaults. */
export const WORLD_PRESETS: Record<Exclude<WorldPresetName, 'custom'>, Partial<WorldSettings>> = {
  // Measured week-one positions, at fair pricing with an auto-filled card:
  //
  //   territoryDays  900 in a 900-seat armoury, -2.4k/wk, low 28.8k
  //   standard     1,141 in a 1,600-seat hall,  -5.5k wk1, low 74.4k
  //   bigMoney     4,623 in a 6,000-seat arena, +124k wk1, low 504k
  //   sinkOrSwim     797 in a 900-seat armoury,  break-even, low 17.8k
  //
  // Cash and roster size used to be the only things a preset moved, and that
  // produced four openings that were indistinguishable: same building, same
  // ticket, same first show. Starting cash barely matters once the doors are
  // open — what decides the first year is how well known you are, how over
  // you are at home, and how many people you are paying. Those are the levers
  // now.
  territoryDays: {
    promotionArchetype: 'territory',
    startingCash: 25_000,
    startingRosterSize: 26,
    // Small national name, big local one — the shape of a territory. Sells
    // the armoury out every week and still cannot quite cover the payroll.
    startingCompanyRating: 48,
    startingTerritoryFollowing: 62,
    // An owner who has seen bookers come and go and is in no hurry.
    mandateStrikesBeforeFiring: 4,
    rivalPromotionCount: 7,
    chaosLevel: 2,
  },
  standard: {
    startingCash: 75_000,
    startingRosterSize: 34,
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
    // Not dollar for dollar against the player's own loan — a lighter, more
    // frequent form of the same struggle, and it never speeds up shouldFold
    // above. Half of the grace period is the same point foldRisk starts
    // reading "In real trouble," so a rival cutting people and a rival the
    // player can see is in trouble are the same moment.
    rivalTrimEnabled: true,
    rivalTrimAtGraceShare: 0.5,
    rivalTrimWeeklyChance: 0.1,

    tagTeamsPerPromotion: 3,
    rivalRosterSizeMin: 10,
    rivalRosterSizeMax: 26,
    chaosLevel: 1,
  },
  bigMoney: {
    promotionName: 'Apex Wrestling Entertainment',
    promotionArchetype: 'sportsEntertainment',
    startingCash: 400_000,
    startingRosterSize: 44,
    // Already a big company: an arena, four thousand people, and a gate three
    // times the payroll. The money is not the difficulty here and cannot be
    // made into it — a promotion this size prints cash under any tuning that
    // leaves the smaller starts playable.
    // Was 70. A forty-four person roster generated at the same tier spread as
    // everybody else's puts on the same two-and-a-bit star shows, and the TV
    // ladder marks that at the high forties — so a starting 70 was a number
    // the company could not hold, and it collapsed rather than declined.
    // Making a rich promotion's roster genuinely better needs starDensity and
    // talentQualityCurve wired up, which neither is.
    startingCompanyRating: 62,
    startingTerritoryFollowing: 60,
    // So the squeeze is the owner instead. He inherited a company that is
    // already where he wanted it, and has one strike less of patience for
    // the booker who lets it slip.
    mandateStrikesBeforeFiring: 2,
    rivalPromotionCount: 5,
    chaosLevel: 0,
  },
  sinkOrSwim: {
    promotionName: 'Blackline Pro',
    promotionArchetype: 'hardcore',
    // Twenty-four on the payroll needs more than one week of rent behind it.
    // At 12,000 this folded in week eight, which is a cutscene rather than a
    // difficulty — the same mistake the fourteen-man version made.
    startingCash: 30_000,
    startingRosterSize: 24,
    // Opening night grosses 16,578 against a payroll of 16,460. That margin
    // is the entire preset. Twelve wrestlers on 8k folded by week nine even
    // playing perfectly, which is not a difficulty setting, it is a cutscene.
    // Opening night has to roughly break even — that margin is the whole
    // preset. Twenty-four on the payroll at 52 could not cover itself at any
    // cash pile, so the draw comes up rather than the roster coming down.
    startingCompanyRating: 54,
    startingTerritoryFollowing: 50,
    rivalPromotionCount: 8,
    chaosLevel: 3,
  },
  backyard: {
    promotionName: 'Backlot Wrestling',
    promotionArchetype: 'hardcore',
    // The actual floor. Below Territory Days' 25k on purpose — this is not a
    // hard promotion to run, it is barely a promotion yet. One folding table,
    // a tarp over plywood, and a bank account that could not pay a full
    // roster even if it wanted to.
    startingCash: 8_000,
    // Not who you open with — who's out there to hire. Two people arrive
    // signed (startingPlayerRosterSize, below); this is the shape of the
    // free-agent pool you build the rest of the promotion out of, and the
    // womensDivisionFloor/tagTeamsMin lines below are still tuned against
    // it, just against generateFreeAgentPool's settings.freeAgentPoolSize
    // (24) rather than this exact number now.
    startingRosterSize: 10,
    // Two, full stop. Nobody hands a backyard promotion a locker room —
    // everybody else is a name in the free-agent pool at whatever they'll
    // actually work for, and hiring them is the opening move. See
    // state/world.ts's two roster-generation paths and
    // engine/world/freeAgents.ts's generateFreeAgentPool, which is
    // unaffected by this and still runs at full size.
    startingPlayerRosterSize: 2,
    womensRosterShare: 0.5,
    // divisionSplit(10, 0.5, floor) only produces an exact 5/5 split when the
    // floor itself is <= 5 — the default of 6 fights the split at this size.
    womensDivisionFloor: 5,
    // tagTeamCountFor rounds rosterSize/wrestlersPerTagTeam and clamps to
    // [tagTeamsMin, tagTeamsMax]. At 10 wrestlers that rounds to 1, so the
    // floor has to do the work; 3 is the target because formTeams only pairs
    // same-gender wrestlers, and a 5/5 split can't support more than 4 teams.
    tagTeamsMin: 3,
    // Nobody outside the block has heard of you yet.
    startingCompanyRating: 12,
    startingTerritoryFollowing: 10,
    startingVenueId: 'backyardRing',
    startingTerritoryId: 'brambleHollow',
    // Four matches, not the six everybody else opens with — a real, separate
    // purchase (data/cardSize.ts), unrelated to the venue above. Buying up
    // is the way out of it, not growing the roster.
    startingCardSizeTierId: 'backyardCard',
    // Nobody here is making a living at this yet. The default curve
    // (base 60, range 2200) prices an average wrestler in the hundreds a
    // week purely off the floor and the curve — there is no version of that
    // floor that reads as "doing it for love." Cut both down hard: an
    // average draw now asks for pocket change, and a genuine standout still
    // asks for visibly more than everybody else, the curve just operates on
    // much smaller numbers. See contracts.ts's askingRate.
    contractBaseWeeklyRate: 15,
    contractRateRange: 300,
    // Same problem, one door over: seedManagerTalent prices a mouthpiece's
    // weekly wage off `feePerShow * managerTalentFeeToWage` — a flat,
    // preset-blind per-show fee ($300-$1,400 in data/ringsidePool.ts) that
    // does not shrink with the rest of this economy. Left at the default
    // 0.9, a backyard promotion's free-agent pool put a $1,275/wk manager
    // next to $50/wk wrestlers — found live, playing a fresh save, not in
    // a test. Cut proportionally to the wrestler wage curve above so a
    // top-end mouthpiece reads as expensive *for backyard* (right around
    // what a genuine standout wrestler costs) rather than a flat outlier.
    managerTalentFeeToWage: 0.15,
    // An owner who is also your neighbor gives you a lot of rope.
    mandateStrikesBeforeFiring: 5,
    // Barely anybody else is running shows this small yet.
    rivalPromotionCount: 3,
    // The least controlled start there is.
    chaosLevel: 3,
  },
};

export function worldSettingsFromPreset(preset: Exclude<WorldPresetName, 'custom'>): WorldSettings {
  return { ...defaultWorldSettings(), ...WORLD_PRESETS[preset] };
}
