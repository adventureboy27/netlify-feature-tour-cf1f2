// People die.
//
// This is a wrestling game set over decades, and the business has a history
// with this. Handled soberly: no gore, no spectacle, no in-ring deaths. It
// happens between shows, it is announced, and the name goes on a wall.
//
// The curve is deliberately gentle in the years somebody is actually
// wrestling and steepens well after — the point is that a save which runs
// thirty years has a memorial page with real names on it, not that the
// roster gets culled.

import type { Rng } from '../rng';
import { clamp } from '../rng';
import type { DeathCause, Passing, Wrestler, WorldSettings } from '../types';

/**
 * Annual probability that this person does not see the next year. Age does
 * most of the work; a body that has been through it does the rest.
 */
export function annualDeathChance(w: Wrestler, settings: WorldSettings): number {
  if (!settings.deathsEnabled) return 0;

  // Doubling every `deathAgeDoubling` years past the base age — and halving
  // on the same clock below it. Clamping the exponent at zero made the curve
  // flat under 45, so a twenty-year-old died at exactly a forty-four-year-
  // old's rate. Over a long save that put a steady stream of kids on the
  // memorial wall, which is not the business this is modelling.
  const fromBase = (w.age - settings.deathBaseAge) / settings.deathAgeDoubling;
  const fromAge = Math.max(
    // A floor, because accidents happen to the young too — just rarely.
    settings.deathYoungFloor,
    settings.deathBaseChance * Math.pow(2, fromBase),
  );

  // The road: hard living, hard matches, and a body that never recovered.
  const wear = clamp((100 - w.health) / 100, 0, 1) * settings.deathHealthWeight;

  return clamp(fromAge + fromAge * wear, 0, settings.deathChanceCap);
}

/**
 * Anybody who can die. A manager is not a Wrestler — different type, no ring
 * stats — but the curve is the same one: it reads an age and how worn out a
 * body is, and a manager has both even if the game only tracks the first.
 */
export interface Mortal {
  id: string;
  name: string;
  age: number;
  health: number;
}

/**
 * A death for somebody who is not a wrestler.
 *
 * Managers lived in a separate collection that mortality never walked, so a
 * career manager could not die — which broke the rule that every death in the
 * business is reported, whoever it was and whoever they worked for.
 */
export function rollMortalDeath(
  rng: Rng,
  person: Mortal,
  week: number,
  settings: WorldSettings,
): Passing | null {
  const asIf = { id: person.id, age: person.age, health: person.health } as Wrestler;
  if (rng.next() >= annualDeathChance(asIf, settings)) return null;
  return { wrestlerId: person.id, cause: causeFor(rng, asIf, settings), age: person.age, week };
}

/** Rolled once a year, alongside retirement. */
export function rollDeath(rng: Rng, w: Wrestler, week: number, settings: WorldSettings): Passing | null {
  if (rng.next() >= annualDeathChance(w, settings)) return null;
  return { wrestlerId: w.id, cause: causeFor(rng, w, settings), age: w.age, week };
}

function causeFor(rng: Rng, w: Wrestler, settings: WorldSettings): DeathCause {
  if (w.age >= settings.deathOldAge) return 'age';
  const roll = rng.next();
  if (w.health < 40) return roll < 0.5 ? 'theRoad' : 'heart';
  if (roll < 0.35) return 'illness';
  if (roll < 0.7) return 'heart';
  return 'accident';
}

export const DEATH_CAUSE_TEXT: Record<DeathCause, string> = {
  illness: 'after an illness',
  accident: 'in an accident',
  heart: 'suddenly, of a heart attack',
  theRoad: 'after years on the road caught up with them',
  age: 'peacefully, at home',
};
