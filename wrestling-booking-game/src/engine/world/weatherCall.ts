// Making the call on bad weather.
//
// Pure: builds the decision from a severe weather roll, and resolves whatever
// the player picked into a set of consequences the store applies. Nothing here
// touches the world.
//
// The shape of the decision, and why it is shaped that way:
//
//   - The forecast is uncertain, and it is uncertain in two different
//     strengths. A `likely` forecast is usually worth calling off; an `even`
//     one usually is not. If there were one strength the correct answer would
//     be the same every time and the choice would be theatre.
//   - Calling it off costs money and goodwill. If it were free the player
//     would take it every time a warning appeared, which is the failure mode
//     this whole system exists to avoid.
//   - The storm can miss. That is what makes calling it off a gamble too,
//     rather than an insurance premium with a known price.
//
// Odds are said in words, never numbers, per the locked rule. The player
// learns the difference between the two forecasts by living through them.

import type { Rng } from '../rng';
import { chance, clamp, pick } from '../rng';
import type { Id, WorldSettings } from '../types';
import {
  FORECAST_LINES,
  WEATHER_CALL_LINES,
  WEATHER_CALL_OPTIONS,
  type ForecastStrength,
  type WeatherCallOptionId,
} from '../../data/weatherCalls';
import type { WeatherRoll } from './seasons';
import { WEATHER_EVENTS } from '../../data/weather';

export interface WeatherCall {
  week: number;
  territoryId: Id;
  territoryName: string;
  /** The weather event this is a warning about. */
  eventId: Id;
  eventName: string;
  /** The warning itself, town already substituted. */
  warning: string;
  /** How sure it is, in words. Never a number. */
  forecast: string;
  strength: ForecastStrength;
  /**
   * Rolled up front and carried, so answering the call does not re-roll the
   * sky. The player's decision must not change whether the storm was ever
   * going to arrive — that would make the choice reach backwards.
   */
  willHit: boolean;
  options: typeof WEATHER_CALL_OPTIONS;
}

/** Build the decision from a severe roll. Returns null for anything else. */
export function weatherCallFrom(
  rng: Rng,
  roll: WeatherRoll,
  week: number,
  territoryId: Id,
  territoryName: string,
  settings: WorldSettings,
): WeatherCall | null {
  if (roll.severity !== 'severe') return null;

  const strength: ForecastStrength = chance(rng, settings.forecastLikelyShare) ? 'likely' : 'even';
  const hitChance = strength === 'likely' ? settings.forecastLikelyHitChance : settings.forecastEvenHitChance;

  return {
    week,
    territoryId,
    territoryName,
    eventId: roll.event.id,
    eventName: roll.event.name,
    warning: roll.line,
    forecast: pick(rng, FORECAST_LINES[strength]),
    strength,
    willHit: chance(rng, hitChance),
    options: WEATHER_CALL_OPTIONS,
  };
}

export interface WeatherCallOutcome {
  /** Multiplier on the house. Zero means no show. */
  draw: number;
  /** Did a show happen at all? */
  ran: boolean;
  /** Share of the committed show costs still owed. */
  costShare: number;
  /** Extra money out — the scramble of moving at a day's notice. */
  extraCost: number;
  /** Move on the town's following. Negative for letting them down. */
  following: number;
  /** Somebody may get hurt getting through it. */
  injuryRisk: number;
  /** Wear on the gear, in the same units as assetWearPerShow. */
  extraWear: number;
  /** What the paper says happened. */
  line: string;
}

/**
 * What the call cost.
 *
 * Read the four run/off outcomes together and the design is visible: running
 * into a storm that lands is the worst night, calling off a storm that lands
 * is the best of a bad set, and the two "missed" rows are the punishments for
 * guessing wrong in either direction. No option dominates.
 */
export function resolveWeatherCall(
  call: WeatherCall,
  choice: WeatherCallOptionId,
  settings: WorldSettings,
  /** What the house does if the storm lands. Only read on the run-it path. */
  stormDraw = 1,
): WeatherCallOutcome {
  const lines = WEATHER_CALL_LINES[call.eventId];
  const town = call.territoryName;
  const say = (s: string | undefined) => (s ?? '').replace(/\{town\}/g, town);

  if (choice === 'callItOff') {
    return {
      draw: 0,
      ran: false,
      costShare: settings.calledOffCostShare,
      extraCost: 0,
      // Letting a town down is worse when it turns out you did not have to.
      following: call.willHit ? settings.calledOffFollowing : settings.calledOffWronglyFollowing,
      injuryRisk: 0,
      extraWear: 0,
      line: say(call.willHit ? lines?.offAndHit : lines?.offAndMissed),
    };
  }

  if (choice === 'moveIt') {
    return {
      draw: settings.movedShowDraw,
      ran: true,
      costShare: 1,
      extraCost: settings.movedShowScrambleCost,
      following: settings.movedShowFollowing,
      injuryRisk: 0,
      extraWear: 0,
      line: say(lines?.moved),
    };
  }

  // Ran it.
  if (call.willHit) {
    return {
      draw: stormDraw,
      ran: true,
      costShare: 1,
      extraCost: 0,
      // They turned up for you in it. That counts for something.
      following: settings.ranThroughItFollowing,
      injuryRisk: settings.ranThroughItInjuryRisk,
      extraWear: settings.ranThroughItWear,
      line: say(lines?.ranAndHit),
    };
  }
  return {
    draw: clamp(settings.stormMissedDraw, 0, 1),
    ran: true,
    costShare: 1,
    extraCost: 0,
    following: settings.ranThroughItFollowing,
    injuryRisk: 0,
    extraWear: 0,
    line: say(lines?.ranAndMissed),
  };
}

/**
 * Rebuild the weather from a call the player is still answering, so resolving
 * the week does not roll the sky a second time. Re-rolling would let the
 * decision reach backwards and change what the storm was always going to do.
 */
export function carriedWeather(call: WeatherCall): WeatherRoll {
  const event = WEATHER_EVENTS.find((e) => e.id === call.eventId);
  return {
    event: event!,
    severity: 'severe',
    draw: event?.draw ?? 1,
    cancelled: false,
    line: call.warning,
  };
}

/** Which severe events have prose written for them. */
export function hasCallLines(eventId: Id): boolean {
  return Boolean(WEATHER_CALL_LINES[eventId]);
}
