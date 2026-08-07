// What a show costs to put on, and what it takes at the door.
//
// The shape of the decision this creates: rent is committed before anybody
// buys a ticket. Book a 6,000-seat arena on the back of a hot main event and
// draw 1,900, and the rent alone eats the gate. Run the school gym forever
// and you are safe, capped, and never growing. Everything in between is the
// game.
//
// Ticket price is a straight demand curve against what the audience thinks
// the show is worth: charge under the odds and you sell out cheap, charge
// over it and the building looks empty on television.

import { clamp } from '../rng';
import type { ProductionAsset, ShowExtra, Venue, ProductionEffects, WorldSettings } from '../types';

export interface ShowCostContext {
  venue: Venue;
  ownedAssets: readonly ProductionAsset[];
  extras: readonly ShowExtra[];
  rosterSize: number;
  settings: WorldSettings;
}

export interface ShowCostBreakdown {
  venueRent: number;
  assetUpkeep: number;
  extras: number;
  travel: number;
  crew: number;
  total: number;
}

/** Everything that has to be paid to open the doors, before a single wage. */
export function computeShowCosts(ctx: ShowCostContext): ShowCostBreakdown {
  const venueRent = ctx.venue.rentalCost;
  const assetUpkeep = ctx.ownedAssets.reduce((sum, a) => sum + a.upkeepPerShow, 0);
  const extras = ctx.extras.reduce((sum, e) => sum + e.cost, 0);

  // Getting the roster and the gear to the building. Scales with how big the
  // operation has become, which is the quiet cost of growth.
  const travel = ctx.rosterSize * ctx.settings.travelCostPerHead;
  const crew = ctx.settings.crewCostBase + ctx.venue.capacity * ctx.settings.crewCostPerSeat;

  return {
    venueRent,
    assetUpkeep,
    extras,
    travel,
    crew,
    total: venueRent + assetUpkeep + extras + travel + crew,
  };
}

/** Sum one effect field across everything the promotion is running tonight. */
export function sumEffect(
  sources: readonly { effects: ProductionEffects }[],
  field: keyof ProductionEffects,
  mode: 'add' | 'multiply' = 'add',
): number {
  if (mode === 'multiply') {
    return sources.reduce((product, s) => product * (s.effects[field] ?? 1), 1);
  }
  return sources.reduce((sum, s) => sum + (s.effects[field] ?? 0), 0);
}

export interface AttendanceContext {
  venue: Venue;
  ticketPrice: number;
  /** 0-100 — how much the audience wants to see this card. */
  demand: number;
  /** Combined multiplier from assets and extras. */
  attendanceMultiplier: number;
  settings: WorldSettings;
}

/**
 * How many people want to see this show, in actual human beings.
 *
 * Deliberately independent of the building. An audience belongs to the
 * promotion, not to the room it rented — booking a stadium does not conjure
 * thirty thousand interested people. This is what makes venue choice a real
 * decision instead of a free multiplier: pick a room bigger than your
 * audience and you pay for seats nobody sits in.
 *
 * Steeply curved, so the difference between a promotion people quite like and
 * one they will travel for is enormous.
 */
export function potentialAudience(demand: number, settings: WorldSettings): number {
  const t = clamp(demand, 0, 100) / 100;
  return settings.demandAudienceScale * t ** settings.demandAudienceCurve;
}

/**
 * What a ticket to this show is worth to the people who might buy one.
 *
 * Exported because three separate places need the same number and two of them
 * used to compute it inline while a third — the opening night's default price
 * — was a hardcoded 12 that had drifted to 43% of fair. A promotion was
 * giving away well over half its gate on day one and nothing in the game said
 * so.
 */
export function fairTicketPrice(demand: number, settings: WorldSettings): number {
  return settings.ticketFairPriceBase + (clamp(demand, 0, 100) / 100) * settings.ticketFairPriceRange;
}

/**
 * How many actually turn up: the interested audience, moved by price, then
 * capped by the seats available.
 */
export function computeAttendanceForShow(ctx: AttendanceContext): number {
  const { settings } = ctx;

  const fairPrice = fairTicketPrice(ctx.demand, settings);
  const priceRatio = ctx.ticketPrice / Math.max(fairPrice, 1);

  // Under the fair price people still only turn up so fast; over it they stop
  // hard. Asymmetric on purpose — underpricing wastes money, overpricing
  // empties the building.
  const priceFactor =
    priceRatio <= 1
      ? 1 + (1 - priceRatio) * settings.ticketUnderpriceBonus
      : Math.max(0.1, 1 - (priceRatio - 1) * settings.ticketOverpricePenalty);

  // A nicer building pulls a little walk-up on its own, but only a little.
  const prestigePull = 1 + (ctx.venue.prestige / 100) * settings.venuePrestigeDraw;

  const wantToCome = potentialAudience(ctx.demand, settings) * priceFactor * ctx.attendanceMultiplier * prestigePull;
  return Math.max(0, Math.min(Math.floor(wantToCome), ctx.venue.capacity));
}

/** People who wanted in and could not get a seat — the case for a bigger room. */
export function turnedAway(ctx: AttendanceContext): number {
  const { settings } = ctx;
  const fairPrice = fairTicketPrice(ctx.demand, settings);
  const priceRatio = ctx.ticketPrice / Math.max(fairPrice, 1);
  const priceFactor =
    priceRatio <= 1
      ? 1 + (1 - priceRatio) * settings.ticketUnderpriceBonus
      : Math.max(0.1, 1 - (priceRatio - 1) * settings.ticketOverpricePenalty);
  const wantToCome = Math.floor(potentialAudience(ctx.demand, settings) * priceFactor * ctx.attendanceMultiplier);
  return Math.max(0, wantToCome - ctx.venue.capacity);
}

export interface ShowRevenueContext {
  attendance: number;
  ticketPrice: number;
  /** From production assets — a merch stand you actually built. */
  merchMultiplier: number;
  /**
   * From the gimmicks on the card. A luchador with a mask to sell moves more
   * shirts than a corporate stooge in a suit, and every gimmick in data/ has
   * carried a merchMultiplier since the day the file was written — it was
   * simply never read by anything.
   */
  gimmickMerchMultiplier: number;
  /**
   * Share of merchandise owed to wrestlers with a `merchandiseCut` clause.
   *
   * The clause has always been offered to the player as "a slice off the top
   * of every shirt sold" and has always cost exactly nothing. This is the
   * slice.
   */
  merchCutShare: number;
  revenuePerHead: number;
  /** Average roster popularity — people buy shirts for wrestlers they like. */
  averagePopularity: number;
  settings: WorldSettings;
}

export interface ShowRevenueBreakdown {
  gate: number;
  merch: number;
  other: number;
  total: number;
}

export function computeShowRevenue(ctx: ShowRevenueContext): ShowRevenueBreakdown {
  const gate = ctx.attendance * ctx.ticketPrice;

  const merchPerHead =
    ctx.settings.merchSpendPerHead *
    (0.5 + (ctx.averagePopularity / 100) * 1.5) *
    ctx.merchMultiplier *
    ctx.gimmickMerchMultiplier;
  // What the promotion keeps, after the people who negotiated a cut take it.
  const gross = ctx.attendance * merchPerHead;
  const merch = Math.round(gross * (1 - clamp(ctx.merchCutShare, 0, 0.9)));

  const other = Math.round(ctx.attendance * ctx.revenuePerHead);

  return { gate, merch, other, total: gate + merch + other };
}

/**
 * How full the building looked, which the audience and the camera both
 * notice. A half-empty arena is worse for the show than a packed gym.
 */
export function attendanceRatingModifier(attendance: number, capacity: number, settings: WorldSettings): number {
  const fill = clamp(attendance / Math.max(capacity, 1), 0, 1);
  // Below the comfortable threshold it reads as empty and starts costing.
  if (fill >= settings.venueFullThreshold) return settings.venueFullBonus * fill;
  return -(settings.venueFullThreshold - fill) * settings.venueEmptyPenalty;
}

/**
 * How much the audience wants to see your next show.
 *
 * The dominant input is what you have actually been putting on — not the
 * roster you own and not the slow television ladder. Two great wrestlers who
 * put on a show sell the building next week; a month of draws, count-outs and
 * one-sided squashes empties it, however famous the people in it are.
 *
 * `recentShowQuality` is an exponential moving average of show ratings, so it
 * climbs over a good run and decays over a bad one rather than swinging on a
 * single night.
 */
export function computeDemand(
  companyRating: number,
  recentShowQuality: number,
  rosterStrength: number,
  settings: WorldSettings,
  /**
   * How over the promotion is in the town they are running. Demand is national
   * reputation *shaded by* local memory rather than replaced by it: a big
   * company still draws somewhere it has never been, just not as well, and a
   * small one that has worked a town for two years outdraws its own rating
   * there. A multiplier rather than a term for exactly that reason.
   */
  territoryFollowing = 50,
): number {
  const national =
    companyRating * settings.demandFromCompanyRating +
    recentShowQuality * settings.demandFromRecentShows +
    rosterStrength * settings.demandFromRoster;
  const local = 1 + ((territoryFollowing - 50) / 50) * settings.demandFromTerritoryFollowing;
  return clamp(national * local, 0, 100);
}

/**
 * Fold tonight's rating into the running average. A promotion with no history
 * takes tonight's show as its whole reputation.
 */
export function updateRecentShowQuality(current: number, showRating: number, settings: WorldSettings): number {
  const alpha = settings.recentShowQualityWeight;
  return clamp(current * (1 - alpha) + showRating * alpha, 0, 100);
}

// ------------------------------------------------------- wear and tear

/**
 * Gear does not last forever. A ring gets used every week; a video wall gets
 * loaded in and out of a truck fifty times a year. Condition drops with every
 * show, the effects fade with it, and a rig left to rot eventually stops
 * working and has to be replaced outright.
 *
 * This is the quiet counterweight to buying your way up: the bigger the
 * operation, the more of it is wearing out at once.
 */
export interface AssetCondition {
  assetId: string;
  /** 0-100. Below the failure threshold the asset does nothing at all. */
  condition: number;
  /** Shows it has worked. */
  showsUsed: number;
}

export function newAssetCondition(assetId: string): AssetCondition {
  return { assetId, condition: 100, showsUsed: 0 };
}

/** A show's worth of wear. */
export function wearAsset(state: AssetCondition, settings: WorldSettings): AssetCondition {
  return {
    ...state,
    condition: clamp(state.condition - settings.assetWearPerShow, 0, 100),
    showsUsed: state.showsUsed + 1,
  };
}

/**
 * How much of its rated effect a worn asset still delivers. Full effect while
 * healthy, tapering as it wears, nothing once it has failed — a dead big
 * screen is scenery.
 */
export function assetEffectiveness(state: AssetCondition, settings: WorldSettings): number {
  if (state.condition <= settings.assetFailureThreshold) return 0;
  const usable = (state.condition - settings.assetFailureThreshold) / (100 - settings.assetFailureThreshold);
  // Degrades gently at first and then quickly, like real equipment.
  return clamp(usable ** 0.6, 0, 1);
}

export function assetHasFailed(state: AssetCondition, settings: WorldSettings): boolean {
  return state.condition <= settings.assetFailureThreshold;
}

/** What it costs to put a worn asset back to new. Scales with how bad it got. */
export function repairCost(state: AssetCondition, purchaseCost: number, settings: WorldSettings): number {
  const missing = (100 - state.condition) / 100;
  return Math.round(purchaseCost * missing * settings.assetRepairCostFraction);
}

export function repairAsset(state: AssetCondition): AssetCondition {
  return { ...state, condition: 100 };
}

/** Words, never a number. */
export type ConditionLabel = 'As new' | 'Serviceable' | 'Worn' | 'Held together with tape' | 'Failed';

export function conditionLabel(state: AssetCondition, settings: WorldSettings): ConditionLabel {
  if (assetHasFailed(state, settings)) return 'Failed';
  if (state.condition >= 85) return 'As new';
  if (state.condition >= 60) return 'Serviceable';
  if (state.condition >= 35) return 'Worn';
  return 'Held together with tape';
}

/** A venue you cannot afford to rent is not a choice you can make. */
export function canAffordShow(bankBalance: number, costs: ShowCostBreakdown): boolean {
  return bankBalance >= costs.total;
}
