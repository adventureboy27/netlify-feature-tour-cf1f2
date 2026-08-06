// The things that were not on the card.
//
// A promotion where the only thing that ever happens is the match finishing
// is a spreadsheet. What people remember about a year of wrestling is the
// night somebody's tag partner turned on them, the night a manager cost
// their own client the belt, the night the referee got flattened and nobody
// knew who had won. Those are the stories, and none of them can be booked —
// which is exactly why they belong here rather than in the card builder.
//
// Two rules hold the whole system together:
//
//   1. AN INCIDENT NEVER CHANGES WHO WON. The sim picks the winner (§0, and
//      it is not negotiable). An incident reads what the sim already produced
//      and reacts to it. "The manager cost them the match" only ever fires on
//      a match the sim already ended in interference — the incident names the
//      culprit, it does not reach back and change the result.
//
//   2. EVERY INCIDENT IS CONDITIONAL. Nothing fires out of nowhere. A turn
//      needs a partnership to betray; a shoot needs real animosity already in
//      the room; a returning face needs somebody off television to return.
//      That is what keeps them feeling like consequences of the world rather
//      than dice.
//
// Incidents produce EventEffects — the same closed set the creative-event
// library uses — so the store already knows how to apply every one of them,
// and an incident can only express something the game can actually do.

import type { Rng } from '../rng';
import { chance, weightedPick } from '../rng';
import type { EventEffect } from '../events/types';
import type { FinishType, Id, WorldSettings, Wrestler } from '../types';
import { INCIDENTS, type IncidentDefinition } from '../../data/incidents';

/** What just happened in the ring, as much of it as an incident can see. */
export interface IncidentContext {
  week: number;
  isMainEvent: boolean;
  rating: number;
  finish: FinishType;
  titleOnTheLine: boolean;
  titleChanged: boolean;
  /** The name of the belt, when there was one. */
  titleName: string | null;
  competitors: { wrestler: Wrestler; side: number }[];
  winnerIds: Id[];
  loserIds: Id[];
  /**
   * Managers at ringside and whose corner they were in. Managers are not
   * wrestlers — they have their own type in data/ringsidePool.ts — so only
   * what an incident needs of them comes through: who they are and whose side
   * they were on.
   */
  managers: { id: Id; name: string; forSide: number }[];
  /** Whether an official was assigned, rather than a wrestler in the shirt. */
  hasReferee: boolean;
  /** Teams and stables with more than one member in this match. */
  groups: { id: Id; name: string; memberIds: Id[] }[];
  /** People in this match who genuinely dislike each other. */
  enemies: [Id, Id][];
  /** Existing feud between people in this match. */
  heat: number;
  shootHeat: number;
  /**
   * People who were not booked tonight and have a reason to walk out anyway —
   * a live feud with somebody in this match. Anybody merely off the card is
   * not a story, and letting them run in turned this into the only incident
   * that ever happened.
   */
  availableReturns: Wrestler[];
  settings: WorldSettings;
}

/** Something that happened that nobody booked. */
export interface Incident {
  id: string;
  /** The line the newsfeed runs. */
  headline: string;
  effects: EventEffect[];
  /** Somebody who was not on the card and is now part of the story. */
  involvedIds: Id[];
}

export function winners(ctx: IncidentContext): Wrestler[] {
  return ctx.competitors.filter((c) => ctx.winnerIds.includes(c.wrestler.id)).map((c) => c.wrestler);
}

export function losers(ctx: IncidentContext): Wrestler[] {
  return ctx.competitors.filter((c) => ctx.loserIds.includes(c.wrestler.id)).map((c) => c.wrestler);
}

/** Which way somebody would turn, given where they currently stand. */
export function turnToward(w: Wrestler): 'face' | 'heel' {
  return w.alignment >= 0 ? 'heel' : 'face';
}

/** Groups with at least two members in this match — the ones with something to break. */
export function groupsInPlay(ctx: IncidentContext): { id: Id; name: string; memberIds: Id[] }[] {
  const inMatch = new Set(ctx.competitors.map((c) => c.wrestler.id));
  return ctx.groups.filter((g) => g.memberIds.filter((id) => inMatch.has(id)).length >= 2);
}

/** Everything that could happen after this match, in the order they are defined. */
export function eligibleIncidents(ctx: IncidentContext): IncidentDefinition[] {
  return INCIDENTS.filter((definition) => definition.when(ctx));
}

/**
 * Roll for one incident after a match.
 *
 * Deliberately at most one. Two wild things on the same match is not twice as
 * memorable, it is a cartoon — and it makes the one that mattered harder to
 * see in the write-up.
 */
export function rollIncident(rng: Rng, ctx: IncidentContext): Incident | null {
  const eligible = eligibleIncidents(ctx);
  if (eligible.length === 0) return null;

  // The main event is where the wild things happen, because that is where the
  // people who can carry a story are.
  const odds =
    ctx.settings.incidentChance *
    (ctx.isMainEvent ? ctx.settings.incidentMainEventMultiplier : 1) *
    (ctx.titleOnTheLine ? ctx.settings.incidentTitleMultiplier : 1);
  if (!chance(rng, Math.min(ctx.settings.incidentChanceCap, odds))) return null;

  const definition = weightedPick(
    rng,
    eligible.map((d) => [d, d.weight] as const),
  );
  return definition.build(ctx, rng);
}
