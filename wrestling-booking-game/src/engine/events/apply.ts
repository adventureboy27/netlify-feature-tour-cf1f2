// Turning a chosen option into changes.
//
// Events return Effects; this resolves an option into the concrete list to
// apply, including rolling any gamble. The store does the mutating — this
// stays pure so the outcome of a decision is testable without a world.

import type { Rng } from '../rng';
import { chance } from '../rng';
import type { WorldSettings } from '../types';
import type { CreativeEvent, EventEffect, EventSubjects } from './types';

export interface ResolvedOutcome {
  effects: EventEffect[];
  /** Null when the option was not a gamble. */
  gambleSucceeded: boolean | null;
  /** One line telling the player how it went. */
  summary: string;
}

export function resolveOption(
  rng: Rng,
  event: CreativeEvent,
  optionId: string,
  subjects: EventSubjects,
  settings: WorldSettings,
): ResolvedOutcome {
  const option = event.options.find((o) => o.id === optionId);
  if (!option) throw new Error(`No option ${optionId} on event ${event.id}`);

  const effects = [...option.effects(subjects, settings)];

  if (!option.gamble) {
    return { effects, gambleSucceeded: null, summary: option.gains };
  }

  const succeeded = chance(rng, option.gamble.chance(subjects));
  effects.push(...(succeeded ? option.gamble.onSuccess : option.gamble.onFailure)(subjects, settings));

  return {
    effects,
    gambleSucceeded: succeeded,
    summary: succeeded ? `It worked. ${option.gains}` : `It did not work. ${option.costs}`,
  };
}
