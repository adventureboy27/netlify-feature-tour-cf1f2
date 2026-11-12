// Turning a chosen option into changes.
//
// Events return Effects; this resolves an option into the concrete list to
// apply, including rolling any gamble. The store does the mutating — this
// stays pure so the outcome of a decision is testable without a world.
//
// A conversation is a sequence of these calls, one per choice, always keyed
// by (nodeId, optionId) — 'root' is the event's opening beat, anything else
// is an EventNode reached by a previous option's `next`. Most options still
// terminate on the first call, exactly as before branching existed; `next`
// is what makes some of them not.

import type { Rng } from '../rng';
import { chance } from '../rng';
import type { Id, WorldSettings } from '../types';
import type { CreativeEvent, EventEffect, EventSubjects } from './types';

export interface ResolvedOutcome {
  effects: EventEffect[];
  /** Null when the option was not a gamble. */
  gambleSucceeded: boolean | null;
  /** How it went, for a conversation that ends here. Null when it doesn't. */
  summary: string | null;
  /** The node to advance to, for a conversation that isn't over yet. Null when it is. */
  next: Id | null;
}

export function resolveOption(
  rng: Rng,
  event: CreativeEvent,
  nodeId: Id | 'root',
  optionId: string,
  subjects: EventSubjects,
  settings: WorldSettings,
): ResolvedOutcome {
  const options = nodeId === 'root' ? event.options : event.nodes?.[nodeId]?.options;
  const option = options?.find((o) => o.id === optionId);
  if (!option) throw new Error(`No option ${optionId} on event ${event.id} node ${nodeId}`);

  const effects = [...option.effects(subjects, settings)];
  let gambleSucceeded: boolean | null = null;
  let next = option.next;

  if (option.gamble) {
    gambleSucceeded = chance(rng, option.gamble.chance(subjects));
    effects.push(...(gambleSucceeded ? option.gamble.onSuccess : option.gamble.onFailure)(subjects, settings));
    next = gambleSucceeded
      ? (option.gamble.nextOnSuccess ?? option.next)
      : (option.gamble.nextOnFailure ?? option.next);
  }

  if (next) return { effects, gambleSucceeded, summary: null, next };

  const summary =
    gambleSucceeded === null
      ? option.gains
      : gambleSucceeded
        ? `It worked. ${option.gains}`
        : `It did not work. ${option.costs}`;
  return { effects, gambleSucceeded, summary, next: null };
}
