// The pool itself — see engine/sim/worldStories.ts for the roll mechanism.
// Adding a new major story means adding one entry here and one small pure
// module under engine/world/, not touching the roll or the store's dispatch
// shape.

import type { WorldStoryContext } from '../engine/sim/worldStories';
import type { WireKind } from '../engine/world/wire';
import type { WorldSettings } from '../engine/types';
import { eligibleForMerger } from '../engine/world/merger';
import { eligibleForSuccession } from '../engine/world/succession';
import { eligibleForNetworkRealignment } from '../engine/world/networkRealignment';
import { eligibleForOwnerRivalry } from '../engine/world/ownerRivalry';
import { eligibleForRogueTurn } from '../engine/world/rogueTurn';
import { eligibleForScandal } from '../engine/world/scandal';
import { eligibleForBreakaway } from '../engine/world/breakawayPromotion';
import { eligibleForFarewellTour } from '../engine/world/farewellTour';
import { eligibleForPricingWar } from '../engine/world/pricingWar';
import { eligibleForPaperworkLockout } from '../engine/world/paperworkLockout';

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
  {
    id: 'networkRealignment',
    category: 'business',
    weight: 4,
    chancePerWeek: (s) => s.networkRealignmentChancePerWeek,
    eligible: (ctx) => eligibleForNetworkRealignment(ctx.week, ctx.livingRivals, ctx.settings),
  },
  {
    id: 'ownerRivalry',
    category: 'ownership',
    weight: 4,
    chancePerWeek: (s) => s.ownerRivalryChancePerWeek,
    eligible: (ctx) => eligibleForOwnerRivalry(ctx.week, ctx.livingRivals, ctx.settings),
  },
  {
    id: 'rogueTurn',
    category: 'business',
    weight: 3,
    chancePerWeek: (s) => s.rogueChancePerWeek,
    eligible: (ctx) =>
      eligibleForRogueTurn(ctx.week, ctx.livingRivals, ctx.happenedFor['rogueTurn'] ?? [], ctx.settings),
  },
  {
    id: 'scandal',
    category: 'ownership',
    weight: 4,
    chancePerWeek: (s) => s.scandalChancePerWeek,
    eligible: (ctx) =>
      eligibleForScandal(ctx.week, ctx.livingRivals, ctx.happenedFor['scandal'] ?? [], ctx.settings),
  },
  {
    id: 'breakawayPromotion',
    category: 'ownership',
    weight: 3,
    chancePerWeek: (s) => s.breakawayChancePerWeek,
    eligible: (ctx) =>
      eligibleForBreakaway(ctx.week, ctx.livingRivals, ctx.happenedFor['breakawayPromotion'] ?? [], ctx.settings),
  },
  {
    id: 'farewellTour',
    category: 'talent',
    weight: 3,
    chancePerWeek: (s) => s.farewellTourChancePerWeek,
    eligible: (ctx) => eligibleForFarewellTour(ctx.week, (ctx.happenedFor['farewellTour'] ?? []).length > 0, ctx.settings),
  },
  {
    id: 'pricingWar',
    category: 'business',
    weight: 3,
    chancePerWeek: (s) => s.pricingWarChancePerWeek,
    eligible: (ctx) => eligibleForPricingWar(ctx.week, ctx.livingRivals, ctx.pricingWarActive, ctx.settings),
  },
  {
    id: 'paperworkLockout',
    category: 'business',
    weight: 3,
    chancePerWeek: (s) => s.paperworkLockoutChancePerWeek,
    eligible: (ctx) => eligibleForPaperworkLockout(ctx.week, ctx.paperworkLockoutActive, ctx.settings),
  },
];

export function worldStoryDefinitionById(id: string): WorldStoryDefinition | undefined {
  return WORLD_STORIES.find((d) => d.id === id);
}
