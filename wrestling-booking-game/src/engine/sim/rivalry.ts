// Rivalries — booking-game-design.md §12.5.
//
// A rivalry carries two independent numbers, and the difference between them
// is the whole system.
//
//   heat       what the crowd feels. Drives gates, gates grudge stipulations,
//              pays off at the blowoff. This is the number the booker is
//              trying to build.
//
//   shootHeat  what the two of them actually feel. Invisible to the audience.
//              Makes the match better — a fight nobody is pulling reads as
//              electric — and makes everything around it worse: injuries,
//              morale, and eventually people who refuse to work together.
//
// A worked feud is heat with no shootHeat: a story the promotion is telling,
// and it costs nothing but booking time. A shoot is the reverse, and it
// arrives whether the booker wanted it or not (§12.5 routes 2 and 4 — a
// backstage fight, a stiff shot, an injury caused).
//
// The decision the system exists to create: you find out two of your talent
// genuinely hate each other. That match will be the best thing on the show.
// It will also hurt them, and it does not stop when the bell rings. Do you
// book it?
//
// THE CRUCIAL RULE (§12.5): heat is not granted by booking, it is earned by
// reception. Every gain is scaled by how well the segment landed, so a
// booker cannot manufacture a main-event feud out of two jobbers by
// repetition. Get them over first.

import { clamp } from '../rng';
import type { Id, Rivalry, RivalryOrigin, FinishType, WorldSettings } from '../types';
import { isNonDecisiveFinish } from './finish';

/**
 * §12.5: `heatMultiplier = clamp((segmentRating - 35) / 40, 0.0, 1.6)`.
 *
 * A 1-star match between two nobodies moves nothing. Below rating 35 the
 * multiplier is zero — not small, zero. That is the rule that stops heat
 * being farmable.
 */
export function heatMultiplier(segmentRating: number): number {
  return clamp((segmentRating - 35) / 40, 0, 1.6);
}

export function createRivalry(
  id: Id,
  participantIds: Id[],
  origin: RivalryOrigin,
  week: number,
  startingHeat: number,
): Rivalry {
  return {
    id,
    participantIds: [...participantIds],
    origin,
    // A shoot starts with no crowd heat at all — nobody outside the locker
    // room knows yet. That is the booker's opportunity and their problem.
    heat: origin === 'worked' ? clamp(startingHeat, 0, 100) : 0,
    shootHeat: origin === 'shoot' ? clamp(startingHeat, 0, 100) : 0,
    startWeek: week,
    lastAdvancedWeek: week,
    matchesContested: 0,
    blowoffBooked: false,
    resolvedWeek: null,
  };
}

/** The rivalry between exactly this set of people, if there is one running. */
export function findRivalry(rivalries: readonly Rivalry[], participantIds: readonly Id[]): Rivalry | undefined {
  const wanted = new Set(participantIds);
  return rivalries.find(
    (r) =>
      r.resolvedWeek === null &&
      r.participantIds.length === wanted.size &&
      r.participantIds.every((id) => wanted.has(id)),
  );
}

/** Every unresolved rivalry any of these wrestlers is currently in. */
export function activeRivalriesFor(rivalries: readonly Rivalry[], wrestlerIds: readonly Id[]): Rivalry[] {
  const wanted = new Set(wrestlerIds);
  return rivalries.filter((r) => r.resolvedWeek === null && r.participantIds.some((id) => wanted.has(id)));
}

// ---------------------------------------------------------------- rating

/**
 * What a rivalry is worth to a match.
 *
 * Crowd heat is the bulk of it and `matchRating` already folds that in from
 * the raw `rivalryHeat` it is handed. Shoot heat adds on top at a steeper
 * rate per point, separately — this is the trap. The best match on your card
 * is two people who want to hurt each other, and the game will happily let
 * you keep booking it.
 *
 * There used to be a `rivalryRatingBonus` here that added the two halves for
 * a preview panel that was never built. Removed rather than left: a second
 * way to compute a number the sim already computes is a place for the two to
 * drift apart.
 */

/** The bad-blood half — rating that exists only because the fight is real. */
export function shootRatingBonus(rivalry: Rivalry | undefined, settings: WorldSettings): number {
  if (!rivalry || rivalry.resolvedWeek !== null) return 0;
  return (rivalry.shootHeat / 100) * settings.shootHeatRatingBonus;
}

/** Injury multiplier from real animosity. 1.0 for a purely worked feud. */
export function shootInjuryMultiplier(rivalry: Rivalry | undefined, settings: WorldSettings): number {
  if (!rivalry || rivalry.resolvedWeek !== null) return 1;
  return 1 + (rivalry.shootHeat / 100) * (settings.shootHeatInjuryMultAtMax - 1);
}

/** Morale both parties shed per week while a shoot rivalry is live. */
export function shootMoraleCostPerWeek(rivalry: Rivalry, settings: WorldSettings): number {
  if (rivalry.resolvedWeek !== null) return 0;
  return (rivalry.shootHeat / 100) * settings.shootHeatMoralePerWeekAtMax;
}

// ---------------------------------------------------------------- movement

export interface MatchHeatContext {
  segmentRating: number;
  finish: FinishType;
  /** A grudge stipulation was booked and someone won it decisively. */
  isDecisiveBlowoff: boolean;
  settings: WorldSettings;
}

export interface HeatChange {
  heatDelta: number;
  shootHeatDelta: number;
  /** Popularity the blowoff winner banks, §12.5. */
  blowoffPopularityGain: number;
  resolved: boolean;
}

/**
 * §12.5 heat movement: `+6` for a match between rivals, `+12` if the finish
 * was non-decisive — a screwjob leaves business unfinished and the crowd
 * wants the rematch. All of it scaled by reception.
 */
export function heatFromMatch(rivalry: Rivalry, ctx: MatchHeatContext): HeatChange {
  const { settings } = ctx;
  const multiplier = heatMultiplier(ctx.segmentRating);

  const base = isNonDecisiveFinish(ctx.finish)
    ? settings.rivalryHeatFromNonDecisiveFinish
    : settings.rivalryHeatFromMatch;

  const heatDelta = base * multiplier;

  // Working a real grudge in front of an audience vents some of it and feeds
  // the rest. Net: a shoot cools slightly when it's actually booked, which is
  // why the tempting answer to backstage heat is to keep putting them in the
  // ring — and why that stops working once the crowd stops caring.
  const shootHeatDelta = rivalry.shootHeat > 0 ? -settings.shootHeatDecayPerWeek * 2 * multiplier : 0;

  if (ctx.isDecisiveBlowoff) {
    return {
      heatDelta: -rivalry.heat, // cashed out
      shootHeatDelta,
      blowoffPopularityGain: rivalry.heat * settings.rivalryBlowoffPopularityFactor,
      resolved: true,
    };
  }

  return { heatDelta, shootHeatDelta, blowoffPopularityGain: 0, resolved: false };
}

/** Apply a HeatChange, returning a new Rivalry. Pure — callers own the store. */
export function applyHeatChange(rivalry: Rivalry, change: HeatChange, week: number): Rivalry {
  return {
    ...rivalry,
    heat: clamp(rivalry.heat + change.heatDelta, 0, 100),
    shootHeat: clamp(rivalry.shootHeat + change.shootHeatDelta, 0, 100),
    matchesContested: rivalry.matchesContested + 1,
    lastAdvancedWeek: week,
    resolvedWeek: change.resolved ? week : rivalry.resolvedWeek,
  };
}

/**
 * §12.5: "Heat decays 3/week if not advanced." Crowd interest is fickle;
 * real animosity is not, and sheds at a fraction of the rate. Leave a shoot
 * alone for a year and it is still mostly there.
 */
export function decayRivalry(rivalry: Rivalry, week: number, settings: WorldSettings): Rivalry {
  if (rivalry.resolvedWeek !== null) return rivalry;
  if (rivalry.lastAdvancedWeek >= week) return rivalry;

  return {
    ...rivalry,
    heat: clamp(rivalry.heat - settings.rivalryHeatDecayPerWeek, 0, 100),
    shootHeat: clamp(rivalry.shootHeat - settings.shootHeatDecayPerWeek, 0, 100),
  };
}

/**
 * Booking a shoot rivalry on purpose — pointing the camera at the real
 * thing. Converts a slice of the real animosity into crowd heat, which is
 * the only way a shoot ever draws money, and inflames what's left.
 */
export function leanIntoShoot(rivalry: Rivalry, settings: WorldSettings): Rivalry {
  const converted = rivalry.shootHeat * settings.shootLeanInConversion;
  return {
    ...rivalry,
    heat: clamp(rivalry.heat + converted, 0, 100),
    // Making it public does not calm anyone down.
    shootHeat: clamp(rivalry.shootHeat + converted * 0.5, 0, 100),
  };
}

// ---------------------------------------------------------------- display

/**
 * §12.5: "Rivalry heat is also displayed with a crowd-interest label
 * ('nobody's biting,' 'they're starting to care,' 'white hot') rather than a
 * raw number." Same locked rule as the odds words.
 */
export type HeatLabel =
  | "Nobody's biting"
  | 'A flicker of interest'
  | "They're starting to care"
  | 'Real heat'
  | 'White hot';

const HEAT_BANDS: [maxHeat: number, label: HeatLabel][] = [
  [15, "Nobody's biting"],
  [35, 'A flicker of interest'],
  [60, "They're starting to care"],
  [82, 'Real heat'],
  [100, 'White hot'],
];

export function heatLabel(heat: number): HeatLabel {
  for (const [max, label] of HEAT_BANDS) {
    if (heat <= max) return label;
  }
  return 'White hot';
}

/** Backstage temperature, shown only to the booker — the crowd never sees this. */
export type ShootLabel = 'Professional' | 'Frosty' | 'Bad blood' | 'Somebody is getting hurt';

export function shootLabel(shootHeat: number): ShootLabel {
  if (shootHeat <= 10) return 'Professional';
  if (shootHeat <= 40) return 'Frosty';
  if (shootHeat <= 75) return 'Bad blood';
  return 'Somebody is getting hurt';
}

// §12.5's grudge-stipulation gate used to live here as one global threshold.
// It is enforced per stipulation instead — `heatRequirement` in
// data/stipulations.ts, checked by `stipulationRequirementsMet`, which is
// live and finer-grained. Two gates on the same rule, one of them dead, is
// how a Loser Leaves Town match ends up legal in one code path and not the
// other.
