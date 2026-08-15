// The year at a glance: months, weeks, and what is on each of them.
//
// The booker's planning problem is not "what is this week", it is "what is
// coming and can I get somebody ready for it". A line of text saying
// "November, week 2" answers the first and none of the second, which is why
// the two joint shows and the cup were invisible until you were standing on
// them.
//
// So: a strip of months, each a row of week tiles, each tile saying what that
// night is. Dates are deliberately absent — the game has never had a 14th of
// November and is not going to start. A week is a month, a week number, and
// the day the show runs on.

import type { WorldSettings } from '../types';
import { MONTHS, DAYS, WEEKS_PER_YEAR, weekLabel, type Month, type Day } from './calendar';
import { showsThisWeek, type PromotionSchedule } from './schedule';
import { SUPERSHOW_SEASONS } from './supershow';

/** What kind of night this is. Ordered by how much it matters. */
export type WeekMark = 'none' | 'houseShow' | 'television' | 'ppv' | 'supershow' | 'cup';

export interface CalendarWeek {
  /** Absolute week number, the one the rest of the sim counts in. */
  week: number;
  /** 1-based within its month. */
  weekOfMonth: number;
  mark: WeekMark;
  /** What to call it — the show's name, or the event's. */
  label: string;
  /** Which night it runs. No dates, ever; a day name is as specific as it gets. */
  day: Day | null;
  isNow: boolean;
  isPast: boolean;
  /**
   * All seven nights, dark ones included.
   *
   * The dark nights are the point: an empty Tuesday is a Tuesday you could put
   * a show on, and a calendar that only draws the nights already booked cannot
   * be used to plan. There are no dates on them — a night is a month, a week,
   * and a day name, which is as specific as this game gets.
   */
  nights: CalendarNight[];
}

/** One night. Every day of the week gets one, whether anything runs or not. */
export interface CalendarNight {
  day: Day;
  mark: WeekMark;
  /** The show's name, or null on a dark night. */
  label: string | null;
  /** The show in the pattern that runs here, if any — what a click acts on. */
  showId: string | null;
}

export interface CalendarMonth {
  month: Month;
  year: number;
  weeks: CalendarWeek[];
}

export interface CalendarViewContext {
  now: number;
  schedule: PromotionSchedule;
  settings: WorldSettings;
  /** Month the interpromotional cup runs in, if the world runs one. */
  cupMonth?: Month | null;
}

/**
 * What is on in a given week, as one mark.
 *
 * The precedence is the point: a cup night or a joint show replaces whatever
 * the company would otherwise have run, because those are the nights the whole
 * business stops for.
 */
export function markFor(week: number, ctx: CalendarViewContext): { mark: WeekMark; label: string; day: Day | null } {
  const label = weekLabel(week, ctx.settings);
  const shows = showsThisWeek(week, ctx.schedule, ctx.settings);
  const televised = shows.find((s) => s.kind === 'television' || s.kind === 'ppv');
  const day = televised?.day ?? shows[0]?.day ?? null;

  if (ctx.cupMonth && label.month === ctx.cupMonth && label.weekOfMonth === 1) {
    return { mark: 'cup', label: 'The Crucible', day };
  }
  if (
    (SUPERSHOW_SEASONS as readonly string[]).includes(label.month) &&
    label.weekOfMonth === 1
  ) {
    return { mark: 'supershow', label: 'Joint show', day };
  }
  if (televised) {
    return {
      mark: televised.kind === 'ppv' ? 'ppv' : 'television',
      label: televised.name,
      day: televised.day,
    };
  }
  if (shows.length > 0) return { mark: 'houseShow', label: shows[0]!.name, day };
  return { mark: 'none', label: 'Dark', day: null };
}

/**
 * Every night of one week, dark ones included.
 *
 * The dark nights are the whole point of drawing it this way. A calendar that
 * only shows the two nights already booked tells the booker what he already
 * knows; one that shows all seven tells him where the room is.
 */
export function nightsFor(week: number, ctx: CalendarViewContext): CalendarNight[] {
  const shows = showsThisWeek(week, ctx.schedule, ctx.settings);
  const weekMark = markFor(week, ctx);

  return DAYS.map((day) => {
    const here = shows.find((s) => s.day === day);
    if (!here) return { day, mark: 'none' as WeekMark, label: null, showId: null };

    // A cup night or a joint show replaces the company's own televised night,
    // because those are the nights the whole business stops for.
    const isTheBigOne =
      (weekMark.mark === 'cup' || weekMark.mark === 'supershow') && here.day === weekMark.day;

    const mark: WeekMark = isTheBigOne
      ? weekMark.mark
      : here.kind === 'ppv'
        ? 'ppv'
        : here.kind === 'television'
          ? 'television'
          : 'houseShow';

    return { day, mark, label: isTheBigOne ? weekMark.label : here.name, showId: here.id };
  });
}

/**
 * `count` months of calendar starting from the month `from` falls in.
 *
 * Months are 4 or 5 weeks (the calendar is 4-4-5 by quarter), so the rows are
 * not all the same length. That is deliberate and it is why the weeks are
 * walked rather than divided.
 */
export function calendarMonths(from: number, count: number, ctx: CalendarViewContext): CalendarMonth[] {
  const startLabel = weekLabel(from, ctx.settings);
  // Rewind to the first week of the month `from` sits in.
  let cursor = from - (startLabel.weekOfMonth - 1);

  const months: CalendarMonth[] = [];
  for (let m = 0; m < count; m++) {
    const here = weekLabel(cursor, ctx.settings);
    const weeks: CalendarWeek[] = [];

    let w = cursor;
    while (weekLabel(w, ctx.settings).month === here.month && weeks.length < 6) {
      const label = weekLabel(w, ctx.settings);
      const { mark, label: name, day } = markFor(w, ctx);
      weeks.push({
        week: w,
        weekOfMonth: label.weekOfMonth,
        mark,
        label: name,
        day,
        isNow: w === ctx.now,
        isPast: w < ctx.now,
        nights: nightsFor(w, ctx),
      });
      w += 1;
    }

    months.push({ month: here.month, year: here.year, weeks });
    cursor = w;
  }
  return months;
}

/** The next night worth clearing the diary for, and how far off it is. */
export function nextBigNight(
  ctx: CalendarViewContext,
): { week: number; mark: WeekMark; label: string; weeksAway: number } | null {
  for (let ahead = 0; ahead <= WEEKS_PER_YEAR; ahead++) {
    const week = ctx.now + ahead;
    const { mark, label } = markFor(week, ctx);
    if (mark === 'cup' || mark === 'supershow' || mark === 'ppv') {
      return { week, mark, label, weeksAway: ahead };
    }
  }
  return null;
}

/** Short words for the tiles. Never a number — §0 keeps numbers off the face. */
export const MARK_LABELS: Record<WeekMark, string> = {
  none: 'Dark',
  houseShow: 'Road',
  television: 'TV',
  ppv: 'PPV',
  supershow: 'Joint',
  cup: 'Cup',
};

export { MONTHS };
