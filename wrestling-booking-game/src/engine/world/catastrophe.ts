// A couple of times a year, something big and sudden hits somebody's show —
// weather severe enough to need a call, or a wrestler who never turns up.
// Both already existed as things that could happen to the *player's* card
// specifically. What was missing, per direct user feedback, was that they
// should be able to happen to anybody in the business, landed at random:
// "the events happen but the company they happen to need to be random...
// so the user can dodge a bullet if the rival's stadium roof caves in."
//
// So this rolls once, for the whole business, not once per promotion — the
// odds have to stay "a couple of times a year" no matter how many rivals are
// in the save. Whichever promotion it lands on is whose problem it is; the
// wire always says so either way (see resolveWeek's handling of the roll).

import type { Rng } from '../rng';
import { chance, pick } from '../rng';
import type { Id, WorldSettings } from '../types';
import { WEATHER_EVENTS } from '../../data/weather';
import type { WeatherRoll } from './seasons';
import { hasCallLines } from './weatherCall';

export type CatastropheKind = 'weather' | 'noShow';

export interface CatastropheRoll {
  kind: CatastropheKind;
  targetPromotionId: Id;
}

/** Does anything hit anybody this week, and whose show is it? */
export function rollCatastrophe(
  rng: Rng,
  promotionIds: readonly Id[],
  settings: WorldSettings,
): CatastropheRoll | null {
  if (promotionIds.length === 0) return null;
  if (!chance(rng, settings.catastropheWeeklyChance)) return null;
  const kind: CatastropheKind = chance(rng, 0.5) ? 'weather' : 'noShow';
  return { kind, targetPromotionId: pick(rng, promotionIds) };
}

/**
 * A severe weather roll built directly, for when the catastrophe system
 * (rather than the ordinary per-week forecast) decides tonight is the
 * night — same shape a natural severe roll produces, so it plugs into the
 * existing weatherCall.ts/resolveWeek machinery unchanged. Drawn only from
 * events with call-screen prose (weatherCall.ts's hasCallLines) since a
 * severe event with nothing written for it can't become a real decision.
 */
export function forcedSevereWeatherRoll(rng: Rng): WeatherRoll | null {
  const candidates = WEATHER_EVENTS.filter((e) => e.severity === 'severe' && hasCallLines(e.id));
  if (candidates.length === 0) return null;
  const event = pick(rng, candidates);
  return {
    event,
    severity: 'severe',
    draw: event.draw,
    cancelled: false,
    line: pick(rng, event.lines),
  };
}
