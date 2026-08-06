// The calendar — §8.
//
// Every week is a television taping except one a month, which is the show
// everything else has been building to. That rhythm is the reason a weekly
// grind has a shape at all: a feud started in week 33 is not just a feud, it
// is something with a date on it.
//
// A pay-per-view is not simply a bigger television show. It runs a longer
// card, it is worth double on the ratings ladder, it pays the wrestlers who
// negotiated for it, and it earns buys — money that comes from how much
// people wanted to see it rather than from how many seats the building has,
// which is the first income in the game not capped by the room you rented.

import type { WorldSettings } from '../types';

/** Is this week's show the monthly one? */
export function isPPVWeek(week: number, settings: WorldSettings): boolean {
  return week > 0 && week % settings.weeksBetweenPPVs === 0;
}

/** How many weeks until the next one. Zero means it is tonight. */
export function weeksUntilPPV(week: number, settings: WorldSettings): number {
  if (isPPVWeek(week, settings)) return 0;
  return settings.weeksBetweenPPVs - (week % settings.weeksBetweenPPVs);
}

/**
 * Which signature event this is. Cycles the promotion's calendar in order, so
 * the same name comes round at the same point every year.
 */
export function ppvNameForWeek(week: number, calendar: readonly string[], settings: WorldSettings): string | null {
  if (!isPPVWeek(week, settings) || calendar.length === 0) return null;
  const index = Math.floor(week / settings.weeksBetweenPPVs) - 1;
  return calendar[((index % calendar.length) + calendar.length) % calendar.length] ?? null;
}

/** How many segments tonight's card has room for. */
export function segmentsForWeek(week: number, settings: WorldSettings): number {
  return isPPVWeek(week, settings) ? settings.segmentsPerPPV : settings.segmentsPerTV;
}

export interface BuysContext {
  /** How good the show was, 0-100. */
  showRating: number;
  /** How big the company is. Nobody buys a pay-per-view from a promotion they have not heard of. */
  companyRating: number;
  /** Heat on the feuds that actually paid off tonight, 0-100 each. */
  heatOnTheCard: readonly number[];
  settings: WorldSettings;
}

/**
 * Pay-per-view buys.
 *
 * Deliberately driven by build rather than by the night itself. The show
 * being good is worth something, but what people paid for in advance is the
 * feud — which is what makes a blowoff booked on a PPV worth more than the
 * same match on a Tuesday, and what makes a card of strangers a bad buy
 * however well it goes.
 */
export function computeBuys(ctx: BuysContext): number {
  const s = ctx.settings;
  const reach = (ctx.companyRating / 100) ** s.ppvBuysReachCurve * s.ppvBuysScale;
  // Curved, so a bad show sells almost nothing rather than a proportional
  // amount. Nobody orders the next one after being burned by this one, and a
  // flat term here quietly made pay-per-view money unconditional.
  const quality = (ctx.showRating / 100) ** s.ppvBuysQualityCurve;
  const build =
    ctx.heatOnTheCard.length === 0
      ? 0
      : ctx.heatOnTheCard.reduce((sum, heat) => sum + heat, 0) / (ctx.heatOnTheCard.length * 100);

  const interest = quality * s.ppvBuysFromQuality + build * s.ppvBuysFromBuild;
  return Math.max(0, Math.round(reach * interest));
}

export function computeBuyRevenue(buys: number, settings: WorldSettings): number {
  return Math.round(buys * settings.ppvBuyPrice);
}
