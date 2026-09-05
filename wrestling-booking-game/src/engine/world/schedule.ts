// What a promotion runs, and how often.
//
// Until now every company ran exactly one show a week, forever, and the only
// question the calendar ever asked was whether that show was the monthly
// pay-per-view. Which meant the single biggest decision a real promotion makes
// — how hard to work — was not a decision at all.
//
// ---------------------------------------------------------------------------
// The trade
//
// More shows is more money. It is also more miles: five nights a week destroys
// a roster inside a year, and a destroyed roster puts on bad shows, which is
// the thing the extra gates were supposed to be paying for. Fewer shows is a
// healthy locker room and a budget that cannot afford anybody.
//
// Two a week is the shape the business settled on for a reason and the game
// agrees with it — two is where the money and the wear cross. Going to three
// is a real gamble you can win; going to five is a decision you make once and
// spend two years regretting.
//
// ---------------------------------------------------------------------------
// The pattern, set early and kept
//
// A promotion does not decide week by week. It announces a pattern — these are
// our shows, they run on these nights, and the big one is monthly — and then
// lives inside it for a year. So the schedule is named: `Monday Night Havoc`
// is a thing that exists on the calendar, not "show 1".
//
// One show a week is the **televised** one and it is the one the player books.
// The rest are house shows: real cards, real gates, real wear on the people
// working them, booked by the office rather than by you. That is how the
// business actually divides the work, and it is the only version of "five
// shows a week" that is playable on a phone.
//
// On a pay-per-view week the big show *replaces* the television, so a week
// with a pay-per-view in it does not have more shows than any other week —
// which is why every promotion in the world runs the same top number and some
// weeks come in under it.

import type { Rng } from '../rng';
import { pick } from '../rng';
import type { Promotion, WorldSettings } from '../types';
import { DAYS, type Day, isLastWeekOfMonth, weekLabel } from './calendar';

/** How often the company runs its biggest show. */
export type PPVCadence =
  /** The last week of every month. The standard. */
  | 'monthly'
  /** Six a year. Each one is a bigger deal for being rarer. */
  | 'biMonthly'
  /** One night a year that everything points at. */
  | 'annual';

export interface ScheduledShow {
  /** Stable across the year — the calendar is a fixture list, not a queue. */
  id: string;
  /** `Monday Night Havoc`. Named, because a show with a name is a show. */
  name: string;
  day: Day;
  /**
   * The one the player books and the cameras are at. Exactly one show in the
   * pattern is televised; the others are house shows.
   */
  televised: boolean;
}

export interface PromotionSchedule {
  shows: ScheduledShow[];
  ppvCadence: PPVCadence;
  /** What the big show is called this year, in the order they come round. */
  ppvNames: string[];
}

export type ShowKind = 'television' | 'houseShow' | 'ppv';

export interface ShowTonight {
  id: string;
  name: string;
  day: Day;
  kind: ShowKind;
  /** True for the one the player builds a card for. */
  booked: boolean;
}

// ---------------------------------------------------------------------------
// Reading the pattern

export function showsPerWeek(schedule: PromotionSchedule): number {
  return schedule.shows.length;
}

/** How many weeks between the big ones. */
function weeksBetweenBigShows(cadence: PPVCadence): number {
  return cadence === 'monthly' ? 1 : cadence === 'biMonthly' ? 2 : 12;
}

/**
 * Is the big show this week?
 *
 * Anchored to the last week of a month rather than to a week number, so it
 * lands where a booker would put it — the end of a month, after four weeks of
 * build — whatever the cadence is.
 */
export function isBigShowWeek(
  week: number,
  schedule: PromotionSchedule,
  settings: WorldSettings,
): boolean {
  if (!isLastWeekOfMonth(week, settings)) return false;
  const monthIndex = MONTH_INDEX[weekLabel(week, settings).month] ?? 0;
  return monthIndex % weeksBetweenBigShows(schedule.ppvCadence) === 0;
}

const MONTH_INDEX: Record<string, number> = {
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
};

/** Which of the year's big shows this one is, by name. */
export function bigShowName(
  week: number,
  schedule: PromotionSchedule,
  settings: WorldSettings,
): string | null {
  if (!isBigShowWeek(week, schedule, settings) || schedule.ppvNames.length === 0) return null;
  const label = weekLabel(week, settings);
  const index = Math.floor(MONTH_INDEX[label.month]! / weeksBetweenBigShows(schedule.ppvCadence));
  return schedule.ppvNames[index % schedule.ppvNames.length] ?? null;
}

/**
 * Tonight's fixture list.
 *
 * On a big-show week the televised show is *replaced* rather than added to —
 * see the header. That is the whole reason a promotion running four nights a
 * week sometimes runs three.
 */
export function showsThisWeek(
  week: number,
  schedule: PromotionSchedule,
  settings: WorldSettings,
): ShowTonight[] {
  const big = bigShowName(week, schedule, settings);

  return schedule.shows.map((show) => {
    if (show.televised && big) {
      return { id: show.id, name: big, day: show.day, kind: 'ppv' as const, booked: true };
    }
    return {
      id: show.id,
      name: show.name,
      day: show.day,
      kind: show.televised ? ('television' as const) : ('houseShow' as const),
      booked: show.televised,
    };
  });
}

/** The shows the office runs without you. */
export function houseShowsThisWeek(
  week: number,
  schedule: PromotionSchedule,
  settings: WorldSettings,
): ShowTonight[] {
  return showsThisWeek(week, schedule, settings).filter((s) => s.kind === 'houseShow');
}

/** How many weeks until the next big one. Zero means it is this week. */
export function weeksUntilBigShow(
  week: number,
  schedule: PromotionSchedule,
  settings: WorldSettings,
): number {
  if (isBigShowWeek(week, schedule, settings)) return 0;
  // Walked rather than divided: the big show is anchored to the end of a
  // month and months are not all the same length, so there is no modulus that
  // answers this. A year of lookahead is plenty — the sparsest cadence in the
  // game has one a year.
  for (let ahead = 1; ahead <= 52; ahead++) {
    if (isBigShowWeek(week + ahead, schedule, settings)) return ahead;
  }
  return 52;
}

/** How many segments a card of this kind has room for. */
export function segmentsForShow(kind: ShowKind, settings: WorldSettings): number {
  return kind === 'ppv' ? settings.segmentsPerPPV : settings.segmentsPerTV;
}

// ---------------------------------------------------------------------------
// What running that hard costs, and pays

/**
 * How much harder than the standard week this promotion works, as a
 * multiplier centred on the ideal.
 *
 * Everything below reads this rather than the raw count, so "two is the shape
 * the business settled on" is stated once and the rest follows.
 */
export function workloadRatio(schedule: PromotionSchedule, settings: WorldSettings): number {
  return showsPerWeek(schedule) / settings.scheduleIdealShows;
}

/**
 * Extra gate and merchandise money from the nights you are not on television.
 *
 * Sub-linear: a house show does not draw what the televised one draws, and the
 * fifth night of the week draws worse than the second. A linear term made
 * running five a week strictly correct, which is the opposite of the point.
 */
export function houseShowRevenueMultiplier(
  schedule: PromotionSchedule,
  settings: WorldSettings,
): number {
  const extra = Math.max(0, showsPerWeek(schedule) - 1);
  return 1 + settings.scheduleHouseShowRevenueShare * extra ** settings.scheduleRevenueCurve;
}

/**
 * How much work a week of this pattern actually is, in cards.
 *
 * Linear, and deliberately so: a house show is a card like any other, worked
 * by a card's worth of people. The convexity that makes a heavy pattern
 * ruinous does not live here — it lives in `recoveryMultiplier`, because the
 * thing that breaks a roster is not the fifth show, it is never being home
 * between them.
 */
export function nightsOfWork(schedule: PromotionSchedule): number {
  return showsPerWeek(schedule);
}

/**
 * How much of a rest week survives a heavy schedule. A roster that never gets
 * a night off does not heal, which is what turns a five-night pattern into an
 * injury list rather than merely a tired locker room.
 */
export function recoveryMultiplier(schedule: PromotionSchedule, settings: WorldSettings): number {
  const extra = Math.max(0, showsPerWeek(schedule) - 1);
  return Math.max(settings.scheduleRecoveryFloor, 1 - settings.scheduleRecoveryLossPerShow * extra);
}

// ---------------------------------------------------------------------------
// Making one

const NIGHT_WORDS = ['Havoc', 'Mayhem', 'Fallout', 'Warfare', 'Ignition', 'Onslaught', 'Uprising', 'Thunder', 'Slam', 'Showdown'];
const HOUSE_WORDS = ['Live', 'On the Road', 'Spotlight', 'Rampage', 'Overdrive', 'After Dark'];

/** The nights a company would actually pick, in the order it would pick them. */
const PREFERRED_NIGHTS: Day[] = ['Monday', 'Friday', 'Wednesday', 'Saturday', 'Tuesday'];

export function defaultShowName(
  companyName: string,
  day: Day,
  index: number,
  rng: Rng,
  /** Names already on this company's calendar. Two shows called the same
   *  thing is one show with a scheduling problem. */
  taken: ReadonlySet<string> = new Set(),
): string {
  const initials = companyName
    .split(/\s+/)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 4);

  const words = index === 0 ? NIGHT_WORDS : HOUSE_WORDS;
  const build = (word: string) => (index === 0 ? `${day} Night ${word}` : `${initials} ${word}`);
  for (let attempt = 0; attempt < 20; attempt++) {
    const name = build(pick(rng, words));
    if (!taken.has(name.toLowerCase())) return name;
  }
  // Every word on the list is spoken for, which takes a five-night pattern
  // and bad luck. Fall back to the night, which is unique by construction.
  return `${initials} ${day}`;
}

/**
 * The pattern a company starts on.
 *
 * Two shows and a monthly big one — the ideal, so a player who never touches
 * the schedule screen is on the shape the business settled on rather than on
 * an accident.
 */
export function defaultSchedule(
  rng: Rng,
  companyName: string,
  ppvNames: string[],
  settings: WorldSettings,
): PromotionSchedule {
  const count = Math.max(1, Math.min(settings.scheduleIdealShows, settings.scheduleMaxShows));
  const shows: ScheduledShow[] = [];
  const taken = new Set<string>();
  for (let i = 0; i < count; i++) {
    const day = PREFERRED_NIGHTS[i % PREFERRED_NIGHTS.length]!;
    const name = defaultShowName(companyName, day, i, rng, taken);
    taken.add(name.toLowerCase());
    shows.push({ id: `show-${i}`, name, day, televised: i === 0 });
  }
  return { shows, ppvCadence: 'monthly', ppvNames };
}

/**
 * What a rival runs. Small companies cannot afford to be on the road every
 * night and big ones cannot afford not to be, so the count follows the rating
 * rather than being rolled flat.
 */
export function scheduleForRival(
  rng: Rng,
  promotion: Pick<Promotion, 'name' | 'rating' | 'identity'>,
  ppvNames: string[],
  settings: WorldSettings,
): PromotionSchedule {
  const s = settings;
  const reach = promotion.rating / 100;
  const count = Math.max(
    1,
    Math.min(s.scheduleMaxShows, Math.round(1 + reach * (s.scheduleMaxShows - 1))),
  );
  const shows: ScheduledShow[] = [];
  const taken = new Set<string>();
  for (let i = 0; i < count; i++) {
    const day = PREFERRED_NIGHTS[i % PREFERRED_NIGHTS.length]!;
    const name = defaultShowName(promotion.name, day, i, rng, taken);
    taken.add(name.toLowerCase());
    shows.push({ id: `show-${i}`, name, day, televised: i === 0 });
  }
  // A company that cannot fill a building monthly does not try to.
  const cadence: PPVCadence =
    promotion.rating >= s.scheduleMonthlyPPVRating
      ? 'monthly'
      : promotion.rating >= s.scheduleBiMonthlyPPVRating
        ? 'biMonthly'
        : 'annual';
  return { shows, ppvCadence: cadence, ppvNames };
}

/** Squeeze or stretch a pattern to a new number of nights, keeping the names. */
export function resizeSchedule(
  schedule: PromotionSchedule,
  count: number,
  companyName: string,
  rng: Rng,
  settings: WorldSettings,
): PromotionSchedule {
  const wanted = Math.max(1, Math.min(settings.scheduleMaxShows, Math.round(count)));
  const shows = schedule.shows.slice(0, wanted);
  const taken = new Set(shows.map((show) => show.name.toLowerCase()));
  for (let i = shows.length; i < wanted; i++) {
    const day = PREFERRED_NIGHTS[i % PREFERRED_NIGHTS.length]!;
    const name = defaultShowName(companyName, day, i, rng, taken);
    taken.add(name.toLowerCase());
    shows.push({ id: `show-${i}`, name, day, televised: false });
  }
  // Dropping the televised show would leave nobody to book. Whatever survives
  // the trim, the first one is the one on television.
  if (!shows.some((s) => s.televised)) shows[0] = { ...shows[0]!, televised: true };
  return { ...schedule, shows };
}

/** How the office describes the pattern, in words. */
export function scheduleLine(schedule: PromotionSchedule, settings: WorldSettings): string {
  const count = showsPerWeek(schedule);
  const nights = count === 1 ? 'one night a week' : `${count} nights a week`;
  const cadence =
    schedule.ppvCadence === 'monthly'
      ? 'a big show every month'
      : schedule.ppvCadence === 'biMonthly'
        ? 'a big show every other month'
        : 'one big show a year';
  const load =
    count <= settings.scheduleIdealShows - 1
      ? 'Everybody is fresh, and everybody is cheap to keep, because there is not much coming in.'
      : count === settings.scheduleIdealShows
        ? 'The shape most of the business runs.'
        : count === settings.scheduleIdealShows + 1
          ? 'Hard work. The money is real and so are the miles.'
          : 'Nobody can keep this up, and the locker room already knows it.';
  return `${nights}, ${cadence}. ${load}`;
}

/**
 * The pattern a company is on, whatever state its record is in.
 *
 * Everything that reads a schedule goes through here. A promotion founded
 * mid-save, or loaded from a record written before schedules existed, gets the
 * standard pattern rather than crashing the week — and because the fallback is
 * pure and takes no rng, asking for it costs nothing and shifts nothing.
 */
export function scheduleOf(
  promotion: Pick<Promotion, 'name' | 'schedule' | 'ppvCalendar'>,
  settings: WorldSettings,
): PromotionSchedule {
  if (promotion.schedule && promotion.schedule.shows.length > 0) return promotion.schedule;
  const count = Math.max(1, Math.min(settings.scheduleIdealShows, settings.scheduleMaxShows));
  const shows: ScheduledShow[] = [];
  for (let i = 0; i < count; i++) {
    const day = PREFERRED_NIGHTS[i % PREFERRED_NIGHTS.length]!;
    shows.push({
      id: `show-${i}`,
      // No rng here on purpose — a fallback that rolled a name would give the
      // same company a different show every time anybody asked.
      name: i === 0 ? `${day} Night Wrestling` : `${promotion.name} Live`,
      day,
      televised: i === 0,
    });
  }
  return { shows, ppvCadence: 'monthly', ppvNames: [...promotion.ppvCalendar] };
}

/** The days of the week that have a show on them, for the calendar strip. */
export function nightsOff(schedule: PromotionSchedule): Day[] {
  const working = new Set(schedule.shows.map((s) => s.day));
  return DAYS.filter((d) => !working.has(d));
}
