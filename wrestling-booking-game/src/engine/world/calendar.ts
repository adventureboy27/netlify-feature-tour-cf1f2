// The calendar — §8. Telling the time, and what a pay-per-view is worth.
//
// This used to own the whole rhythm: every fourth week was the big one, for
// everybody, forever. It does not any more — which company runs a big show on
// which week is a decision each promotion makes, and it lives in
// world/schedule.ts. What is left here is the part that is true for
// everybody: where in the year a week falls, and what buys are worth.
//
// A pay-per-view is not simply a bigger television show. It runs a longer
// card, it is worth double on the ratings ladder, it pays the wrestlers who
// negotiated for it, and it earns buys — money that comes from how much
// people wanted to see it rather than from how many seats the building has,
// which is the first income in the game not capped by the room you rented.

import type { WorldSettings } from '../types';

// ---------------------------------------------------------------------------
// Telling the time
//
// The game has no dates and is never getting any. A promotion does not think
// in the 14th of March, it thinks in "the go-home show" and "the week before
// the pay-per-view" — so the calendar is month names, which week of that month
// it is, and the day of the week a show runs on. Nothing else.
//
// Fifty-two weeks over twelve months does not divide, so the year runs on the
// 4-4-5 pattern: two four-week months and then a five, four times over. That
// is a real convention (it is how retail books a year) and it lands exactly on
// week 52 in the last week of December, which is the thing that matters —
// "December, week five" is a sentence a booker would say, and "week 53" is not.

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
export type Month = (typeof MONTHS)[number];

/** Weeks in each month, 4-4-5 by quarter. Sums to 52. */
const WEEKS_IN_MONTH = [4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 5];

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type Day = (typeof DAYS)[number];

export const WEEKS_PER_YEAR = 52;

export interface WeekLabel {
  month: Month;
  /** Which week of that month, 1-based. */
  weekOfMonth: number;
  /** Which week of the year, 1-based — 1 through 52. */
  weekOfYear: number;
  year: number;
}

/**
 * Where in the year a week number lands.
 *
 * `week` is the absolute counter the world keeps, and that counter is
 * one-based — a new save opens on week 1, and week 1 is the first week of
 * January. Getting this wrong is not a rounding error, it is a header that
 * says the second week of January on opening night.
 */
export function weekLabel(week: number, settings: WorldSettings): WeekLabel {
  const elapsed = Math.max(0, week - 1);
  const year = settings.startingYear + Math.floor(elapsed / WEEKS_PER_YEAR);
  const weekOfYear = elapsed % WEEKS_PER_YEAR;

  let remaining = weekOfYear;
  for (let m = 0; m < WEEKS_IN_MONTH.length; m++) {
    const span = WEEKS_IN_MONTH[m]!;
    if (remaining < span) {
      return { month: MONTHS[m]!, weekOfMonth: remaining + 1, weekOfYear: weekOfYear + 1, year };
    }
    remaining -= span;
  }
  // Unreachable while WEEKS_IN_MONTH sums to WEEKS_PER_YEAR, and asserted in
  // the tests. Falling back to the last week rather than throwing, because a
  // save should never die on a date label.
  return { month: 'December', weekOfMonth: 5, weekOfYear: WEEKS_PER_YEAR, year };
}

/** How the header says it. */
export function weekLine(week: number, settings: WorldSettings): string {
  const label = weekLabel(week, settings);
  return `${label.month}, week ${label.weekOfMonth}`;
}

/**
 * Zero-based week within the year, so callers can talk about "May" without
 * caring which year the save is in.
 */
export function weekOfYear(week: number): number {
  return Math.max(0, week - 1) % WEEKS_PER_YEAR;
}

/**
 * The zero-based week-of-year that a named month opens on.
 *
 * The calendar is 4-4-5, so the months do not start on multiples of four and
 * working the offsets out by hand is how you end up scheduling the year's
 * biggest show in the wrong month.
 */
export function monthStartWeek(month: Month): number {
  let start = 0;
  for (let m = 0; m < WEEKS_IN_MONTH.length; m++) {
    if (MONTHS[m] === month) return start;
    start += WEEKS_IN_MONTH[m]!;
  }
  return 0;
}

/** Is `week` inside the given month? */
export function isInMonth(week: number, month: Month): boolean {
  const start = monthStartWeek(month);
  const index = MONTHS.indexOf(month);
  const span = index >= 0 ? WEEKS_IN_MONTH[index]! : 0;
  const woy = weekOfYear(week);
  return woy >= start && woy < start + span;
}

/** Is this the last week of its month? The month's big show goes here. */
export function isLastWeekOfMonth(week: number, settings: WorldSettings): boolean {
  const here = weekLabel(week, settings);
  return weekLabel(week + 1, settings).month !== here.month;
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
