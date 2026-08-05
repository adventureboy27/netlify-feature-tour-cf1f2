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

  // Doubling every `deathAgeDoubling` years past the base age. Gentle at 40,
  // real at 70, high at 90.
  const over = Math.max(0, w.age - settings.deathBaseAge);
  const fromAge = settings.deathBaseChance * Math.pow(2, over / settings.deathAgeDoubling);

  // The road: hard living, hard matches, and a body that never recovered.
  const wear = clamp((100 - w.health) / 100, 0, 1) * settings.deathHealthWeight;

  return clamp(fromAge + fromAge * wear, 0, settings.deathChanceCap);
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
