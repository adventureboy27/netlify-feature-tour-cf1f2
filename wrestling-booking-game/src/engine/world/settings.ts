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
