// The pool itself — see engine/sim/worldStories.ts for the roll mechanism.
// Adding a new major story means adding one entry here and one small pure
// module under engine/world/, not touching the roll or the store's dispatch
// shape.

import type { WorldStoryContext } from '../engine/sim/worldStories';
import type { WireKind } from '../engine/world/wire';
import type { WorldSettings } from '../engine/types';
import { eligibleForMerger } from '../engine/world/merger';
import { eligibleForSuccession } from '../engine/world/succession';

export interface WorldStoryDefinition {
  id: string;
  /** Which Breaking News lane this reports under. */
  category: WireKind;
  /** Relative weight against other stories eligible the same week. */
  weight: number;
  chancePerWeek(settings: WorldSettings): number;
  eligible(ctx: WorldStoryContext): boolean;
}

export const WORLD_STORIES: WorldStoryDefinition[] = [
  {
    id: 'merger',
    category: 'business',
    weight: 5,
    chancePerWeek: (s) => s.mergerChancePerWeek,
    eligible: (ctx) => eligibleForMerger(ctx.week, ctx.livingRivals, ctx.mergerHappened, ctx.settings),
  },
  {
    id: 'succession',
    category: 'ownership',
    weight: 5,
    chancePerWeek: (s) => s.successionChancePerWeek,
    eligible: (ctx) => eligibleForSuccession(ctx.week, ctx.livingRivals, ctx.successionHappenedFor, ctx.settings),
  },
];

export function worldStoryDefinitionById(id: string): WorldStoryDefinition | undefined {
  return WORLD_STORIES.find((d) => d.id === id);
}
