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
 * How many actually turn up: the interested audience, moved by price, then
 * capped by the seats available.
 */
export function computeAttendanceForShow(ctx: AttendanceContext): number {
  const { settings } = ctx;

  const fairPrice = settings.ticketFairPriceBase + (ctx.demand / 100) * settings.ticketFairPriceRange;
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
  const fairPrice = settings.ticketFairPriceBase + (ctx.demand / 100) * settings.ticketFairPriceRange;
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
  merchMultiplier: number;
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
    ctx.settings.merchSpendPerHead * (0.5 + (ctx.averagePopularity / 100) * 1.5) * ctx.merchMultiplier;
  const merch = Math.round(ctx.attendance * merchPerHead);

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

/** A venue you cannot afford to rent is not a choice you can make. */
export function canAffordShow(bankBalance: number, costs: ShowCostBreakdown): boolean {
  return bankBalance >= costs.total;
}
