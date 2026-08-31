// The major-story registry — a weekly sibling to incidents.ts's per-match
// one. A pool of rare, world-tier stories (the merger, succession, and
// whatever gets added after them), each with its own eligibility and
// weekly odds; at most one rolled per week, so two headlines never land the
// same week and bury each other.
//
// Deliberately metadata-only. Each story's real logic stays in its own
// small pure module (engine/world/merger.ts, engine/world/succession.ts) —
// this only decides *whether* and *which*. Applying the winner is the
// store's job, the same boundary every other engine module in this game
// respects.

import type { Rng } from '../rng';
import { chance, weightedPick } from '../rng';
import type { Id, Promotion, WorldSettings } from '../types';
import type { WireKind } from '../world/wire';
import { WORLD_STORIES, type WorldStoryDefinition } from '../../data/worldStories';

export interface WorldStoryContext {
  week: number;
  livingRivals: readonly Promotion[];
  mergerHappened: boolean;
  successionHappenedFor: readonly Id[];
  settings: WorldSettings;
}

export type { WorldStoryDefinition, WireKind as WorldStoryCategory };

export function eligibleWorldStories(ctx: WorldStoryContext): WorldStoryDefinition[] {
  return WORLD_STORIES.filter((d) => d.eligible(ctx));
}

/**
 * Roll for one major story. Each eligible story gets its own independent
 * weekly roll at its own odds; if more than one comes up the same week,
 * weight breaks the tie.
 */
export function rollWorldStory(rng: Rng, ctx: WorldStoryContext): WorldStoryDefinition | null {
  const eligible = eligibleWorldStories(ctx);
  const ready = eligible.filter((d) => chance(rng, d.chancePerWeek(ctx.settings)));
  if (ready.length === 0) return null;
  return weightedPick(rng, ready.map((d) => [d, d.weight] as const));
}
