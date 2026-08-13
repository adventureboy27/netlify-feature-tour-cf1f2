// Somebody starts a wrestling company.
//
// The business could already die — a promotion runs out of money, folds, and
// its roster is auctioned off (world/auction.ts). What it could not do was be
// born. Measured over eight simulated years on default settings:
//
//     y1  7 companies alive, 148 people signed,  48 free agents
//     y3  4 companies alive,  76 people signed, 105 free agents
//     y5  4 companies alive,  67 people signed, 101 free agents
//
// Three promotions went under in year three and nothing replaced them. Fifty-
// eight wrestlers went into a pool that has no employer left to drain it, and
// the schools kept producing into it, because `workingPopulation` counted
// anybody who was not retired — including the hundred people nobody could
// hire. The business had more than half its active talent unemployed and a
// school still telling it it was short-handed.
//
// So this is the other half of the cycle. When the business has more talent
// than it has places to put it, somebody with money looks at all those
// unemployed wrestlers and opens a promotion. That is what actually happens,
// it is self-limiting in exactly the right way — a glut creates employers,
// employers absorb the glut — and it means a save that runs thirty years still
// has a business in it at the end.

import type { Rng } from '../rng';
import { chance, pick, randInt } from '../rng';
import type { Id, Promotion, PromotionArchetype, Wrestler, WorldSettings } from '../types';
import { isFinished } from '../career/status';
import { PROMOTION_ARCHETYPES, styleProfileFor } from '../../data/promotionIdentity';
import { scheduleForRival } from './schedule';

export interface OpeningContext {
  /** Companies still trading, the player's included. */
  alive: readonly Promotion[];
  /** Everybody able to work and employed by nobody. */
  unemployed: number;
  /** Names already used in this world, so a new one is not a duplicate. */
  takenNames: ReadonlySet<string>;
  currentWeek: number;
}

/**
 * Is there room, and a reason, for somebody to start a company?
 *
 * Two gates and they are different questions. There has to be *talent going
 * spare* — nobody opens a promotion into a market where every decent wrestler
 * is already under contract — and there has to be room on the map, because a
 * business with fifteen promotions in it is not a business, it is a list.
 */
export function roomForAnother(ctx: OpeningContext, settings: WorldSettings): boolean {
  if (!settings.newPromotionsEnabled) return false;
  if (ctx.alive.length >= settings.promotionCountMax) return false;
  return ctx.unemployed >= settings.newPromotionUnemployedTrigger;
}

/**
 * How likely it is this week. Rises with the size of the glut, so a business
 * drowning in unemployed wrestlers gets a new company quickly and one with a
 * mild surplus gets one eventually.
 */
export function openingChance(ctx: OpeningContext, settings: WorldSettings): number {
  if (!roomForAnother(ctx, settings)) return 0;
  const surplus = ctx.unemployed - settings.newPromotionUnemployedTrigger;
  const pressure = Math.min(1, surplus / settings.newPromotionPressureRange);
  return settings.newPromotionChanceBase + pressure * settings.newPromotionChanceRange;
}

export function rollOpening(rng: Rng, ctx: OpeningContext, settings: WorldSettings): boolean {
  return chance(rng, openingChance(ctx, settings));
}

/**
 * A name for a company that did not exist last week.
 *
 * Generated rather than taken from the fixed list in data/, because that list
 * is spent at world creation and a save that runs long enough would otherwise
 * run out of companies to found.
 */
const FIRST = [
  'Iron', 'Crown', 'Vanguard', 'Summit', 'Anvil', 'Beacon', 'Frontier', 'Liberty',
  'Meridian', 'Bastion', 'Cobalt', 'Sovereign', 'Titan', 'Union', 'Apex', 'Keystone',
];
const SECOND = [
  'Championship Wrestling', 'Pro Wrestling', 'Wrestling Alliance', 'Wrestling Federation',
  'Grappling Company', 'Wrestling Union', 'Athletic Commission', 'Wrestling Club',
];

export function newPromotionName(rng: Rng, taken: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < 80; attempt++) {
    const name = `${pick(rng, FIRST)} ${pick(rng, SECOND)}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
  // The name space is exhausted, which takes a very long save. Number it.
  return `Independent Wrestling ${taken.size}`;
}

/**
 * A company on its first day.
 *
 * Small, poor, and regional. It starts at the bottom of the ladder and has to
 * climb like anybody else — a new promotion arriving fully formed would be a
 * rival that had not earned anything, and it would flatten the ranking.
 */
export function foundPromotion(
  rng: Rng,
  ctx: OpeningContext,
  territoryIds: readonly Id[],
  settings: WorldSettings,
): Promotion {
  const archetype: PromotionArchetype = pick(rng, PROMOTION_ARCHETYPES);
  const rating = randInt(rng, settings.newPromotionRatingMin, settings.newPromotionRatingMax);
  const home = territoryIds.length > 0 ? pick(rng, [...territoryIds]) : 'territory-unassigned';

  // Hoisted in exactly the order the object literal used to evaluate them —
  // the id's draw and then the name's — because reordering two rng draws here
  // would move every seeded world downstream of a company being founded.
  const id = `rival-new-${ctx.currentWeek}-${randInt(rng, 1000, 9999)}`;
  const name = newPromotionName(rng, ctx.takenNames);

  return {
    id,
    name,
    identity: archetype,
    ppvCalendar: [],
    isPlayer: false,
    rating,
    // Somebody's savings, not a war chest.
    bankBalance: randInt(rng, settings.newPromotionCashMin, settings.newPromotionCashMax),
    rosterIds: [],
    titleIds: [],
    ownedTerritoryIds: [],
    homeTerritoryId: home,
    styleProfile: styleProfileFor(archetype),
    bookingCredibility: 50,
    reputation: rating,
    hardcoreSaturation: 0,
    recentShowQuality: rating,
    weeksInTheRed: 0,
    closedWeek: null,
    ownerId: `owner-new-${ctx.currentWeek}`,
    ownerPersonality: 'traditionalist',
    // One night a week and one big show a year. Somebody's first promotion
    // does not run a monthly pay-per-view, and the schedule saying so is the
    // same statement as the bank balance saying so.
    schedule: scheduleForRival(rng, { name, rating, identity: archetype }, [], settings),
  };
}

/**
 * Who they open the doors with.
 *
 * They shop where the glut is — the unemployed — and they take the cheap end
 * of it, because a new company cannot outbid anybody. Sorted by what they can
 * plausibly get rather than by who is best.
 */
export function foundingRoster(
  unemployed: readonly Wrestler[],
  settings: WorldSettings,
): Wrestler[] {
  return [...unemployed]
    .filter((w) => !w.deceased && !isFinished(w) && w.role === 'wrestler')
    // Nobody a bigger company would have kept. A new promotion is built out
    // of people the business has passed over, which is exactly right.
    .sort((a, b) => a.popularity - b.popularity)
    .slice(0, settings.newPromotionRosterSize);
}

/** How the paper reports somebody hanging out a shingle. */
export function openingLine(promotion: Promotion, roster: number): string {
  return `${promotion.name} have opened their doors out of ${promotion.homeTerritoryId === 'territory-unassigned' ? 'nowhere in particular' : 'the territory'}, with ${roster} wrestlers signed and not much else. Somebody thinks there is money in all this unemployed talent.`;
}
