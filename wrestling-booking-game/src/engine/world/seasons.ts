// Rolling the year: what season it is, whether tonight is a holiday, and what
// the sky is doing over the town you booked.
//
// Pure. Everything takes (week, territory, settings, rng) and returns a
// description of what happened; the store decides what to do about it.
//
// The roll is two-stage on purpose. First pick a severity tier from weights
// that are overwhelmingly weighted toward "nothing much"; then pick an event
// from the ones that tier allows in this season and this climate. Doing it
// that way means the rarity of a catastrophe is one tunable number rather
// than an emergent property of a hundred individual weights, and it means
// adding a new blizzard to the library does not quietly make blizzards more
// likely than they were yesterday.

import type { Rng } from '../rng';
import { chance, clamp, pick, weightedPick } from '../rng';
import type { Climate, Id, Season, Territory, WorldSettings } from '../types';
import {
  HOLIDAYS,
  WEEKS_PER_YEAR,
  holidayForWeekOfYear,
  seasonForWeekOfYear,
  type Holiday,
} from '../../data/seasons';
import { eligibleWeather, type WeatherEvent, type WeatherSeverity } from '../../data/weather';

/** Week 1 of the save is week 1 of the year. */
export function weekOfYear(week: number): number {
  return ((week - 1) % WEEKS_PER_YEAR + WEEKS_PER_YEAR) % WEEKS_PER_YEAR + 1;
}

export function seasonForWeek(week: number): Season {
  return seasonForWeekOfYear(weekOfYear(week));
}

export function holidayForWeek(week: number): Holiday | null {
  return holidayForWeekOfYear(weekOfYear(week));
}

/** How many weeks until the next holiday, so the player can build to it. */
export function weeksUntilHoliday(week: number): { holiday: Holiday; weeksAway: number } | null {
  const now = weekOfYear(week);
  const upcoming = [...HOLIDAYS].sort((a, b) => a.week - b.week);
  const next = upcoming.find((h) => h.week >= now) ?? upcoming[0];
  if (!next) return null;
  const weeksAway = next.week >= now ? next.week - now : WEEKS_PER_YEAR - now + next.week;
  return { holiday: next, weeksAway };
}

/**
 * The tiers, and how the dice are loaded.
 *
 * Read as: nine weeks in twenty nothing worth reporting happens at all, and
 * of the rest the overwhelming majority is drizzle. The catastrophe tier is
 * two parts in a thousand of the rolls that happen, which lands it at
 * roughly once every four or five years of weekly shows.
 */
const SEVERITY_ORDER: WeatherSeverity[] = ['flavour', 'minor', 'notable', 'severe', 'catastrophe'];

export interface WeatherRoll {
  event: WeatherEvent;
  severity: WeatherSeverity;
  /** Multiplier on the house. Zero means there was no show. */
  draw: number;
  cancelled: boolean;
  /** Ready to print, with the town's name already in it. */
  line: string;
}

/**
 * What the weather did tonight, or null for an ordinary week.
 *
 * chaosLevel bends the top of the table only: at 0 the severe and
 * catastrophic tiers are damped almost out of existence, at 3 they are
 * several times more likely. It never touches the mild tiers, so a high-chaos
 * world is not noisier week to week — it is a world where the rare thing is
 * less rare, which is the knob the setting was always named for.
 */
export function rollWeather(
  rng: Rng,
  week: number,
  territory: Territory,
  settings: WorldSettings,
): WeatherRoll | null {
  if (!chance(rng, settings.weatherChancePerShow)) return null;

  const season = seasonForWeek(week);
  const climate = territory.climate;
  const chaos = clamp(settings.chaosLevel, 0, 3);

  const tiers = SEVERITY_ORDER.map((severity) => {
    const base = settings.weatherSeverityWeights[severity];
    // Only the two dangerous tiers move with chaos.
    const scaled =
      severity === 'severe' || severity === 'catastrophe'
        ? base * (settings.weatherChaosDamping + chaos * settings.weatherChaosPerLevel)
        : base;
    // A tier with nothing eligible in this town at this time of year cannot
    // be rolled — otherwise a desert would get a quiet week every time the
    // dice said "blizzard".
    return [severity, eligibleWeather(season, climate, severity).length > 0 ? scaled : 0] as const;
  }).filter(([, w]) => w > 0);

  if (tiers.length === 0) return null;

  const severity = weightedPick(rng, tiers);
  const candidates = eligibleWeather(season, climate, severity);
  const event = weightedPick(
    rng,
    candidates.map((e) => [e, e.weight] as const),
  );

  return {
    event,
    severity,
    draw: event.draw,
    cancelled: severity === 'catastrophe',
    line: pick(rng, event.lines).replace(/\{town\}/g, territory.name),
  };
}

/**
 * What a cancelled show costs. The rent and the crew are already committed —
 * that is the whole point of the venue being a bet — but nobody is paid an
 * appearance fee for a show that did not happen.
 */
export function cancellationCost(committedShowCosts: number, settings: WorldSettings): number {
  return Math.round(committedShowCosts * clamp(settings.cancelledShowCostShare, 0, 1));
}

/** Everything tonight's date is worth, before a single match is booked. */
export interface NightModifiers {
  season: Season;
  holiday: Holiday | null;
  weather: WeatherRoll | null;
  /** Combined multiplier on the house. */
  draw: number;
  /** Combined multiplier on the merchandise stand. */
  merch: number;
  cancelled: boolean;
}

export function nightModifiers(
  rng: Rng,
  week: number,
  territory: Territory,
  settings: WorldSettings,
): NightModifiers {
  const holiday = holidayForWeek(week);
  const weather = rollWeather(rng, week, territory, settings);
  return {
    season: seasonForWeek(week),
    holiday,
    weather,
    draw: (holiday?.draw ?? 1) * (weather?.draw ?? 1),
    merch: holiday?.merch ?? 1,
    cancelled: weather?.cancelled ?? false,
  };
}

/** A tribute night. Announced, never silent — see the memoriam rules. */
export interface MemoriamShow {
  forWrestlerId: Id;
  forName: string;
  draw: number;
  line: string;
}

/**
 * The show after somebody dies.
 *
 * The business does this, and it does it whether or not the booker feels like
 * it — so it is applied rather than offered. A tribute draws well and it
 * would be grotesque for that to be the only thing the player noticed, which
 * is why the line is a lead item in the wire rather than a modifier tucked
 * into the takings.
 */
export function memoriamFor(
  wrestlerId: Id,
  name: string,
  promotionName: string,
  settings: WorldSettings,
): MemoriamShow {
  return {
    forWrestlerId: wrestlerId,
    forName: name,
    draw: settings.memoriamDrawBonus,
    line: `${promotionName} ran the show as a tribute to ${name}. Ten bells, a full house, and not a dry eye in the building.`,
  };
}

export { CLIMATE_LABELS, SEASON_LABELS } from '../../data/seasons';
export type { Climate, Holiday, Season };
