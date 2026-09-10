// Standing on a circuit — who is the biggest deal on *this* loop.
//
// The world list (rankings.ts) answers "who is the biggest name in the
// business" and it is deliberately slow and career-weighted. It is also the
// same list for everybody, which means a territory act who sells out three
// towns every week never appears on it and the player has no way to express
// "I am the biggest thing on this loop and I would be nobody in the big
// rooms".
//
// A circuit standing is that missing position: the world score, adjusted by
// how much this particular scene wants what this particular wrestler is. A
// deathmatch worker is top five on The Hard Road and unranked in The Big
// Rooms, and both are true at once.
//
// The tuning here is load-bearing rather than cosmetic. Popularity has a
// wide spread and taste has a narrow one, so at a low weight the taste term
// is a rounding error and all four circuits return the same list in
// different orders — measured, before this was tuned: the same three people
// held the top of every circuit. circuits.test.ts pins the disagreement as a
// property so the data cannot drift back to that.

import type { Id, Territory, TerritoryPreferenceTag, Wrestler, WorldSettings } from '../types';
import { CIRCUITS, circuitById } from '../../data/circuits';
import { worldScore, type Ranked, type RankingContext } from './rankings';

/** Every tag a town can have an opinion about. */
const TAGS: TerritoryPreferenceTag[] = [
  'faces',
  'heels',
  'hardcore',
  'technical',
  'highFlying',
  'womensWrestling',
  'longMatches',
  'starPower',
];

export type CircuitTaste = Partial<Record<TerritoryPreferenceTag, number>>;

/**
 * What a scene wants, as the average of its towns.
 *
 * Averaged rather than summed so a circuit with more towns is not
 * automatically more opinionated than one with fewer — the number has to mean
 * the same thing on every list for the lists to be comparable.
 *
 * Takes live territories rather than the definitions so this still reads true
 * if a town's taste ever moves during a save.
 */
export function circuitTaste(circuitId: Id, territories: readonly Territory[]): CircuitTaste {
  const circuit = circuitById(circuitId);
  if (!circuit) return {};
  const towns = territories.filter((t) => circuit.territoryIds.includes(t.id));
  if (towns.length === 0) return {};

  const taste: CircuitTaste = {};
  for (const town of towns) {
    for (const tag of TAGS) {
      const weight = town.preferenceWeights[tag];
      if (weight === undefined) continue;
      taste[tag] = (taste[tag] ?? 0) + weight / towns.length;
    }
  }
  return taste;
}

/**
 * How strongly one wrestler embodies each thing a town can want, 0-1.
 *
 * This is the wrestler-shaped mirror of territories.ts's CardTraits, which
 * does the same job for a whole card. A card can be hardcore because of its
 * stipulations; a person is hardcore because of who they are.
 */
export function tasteTraits(wrestler: Wrestler, settings: WorldSettings): Record<TerritoryPreferenceTag, number> {
  const style = wrestler.style;
  return {
    faces: Math.max(0, wrestler.alignment) / 100,
    heels: Math.max(0, -wrestler.alignment) / 100,
    hardcore: style === 'hardcore' || style === 'bruiser' ? 1 : 0,
    technical: style === 'technical' || style === 'submission' ? 1 : 0,
    // A luchador or a high flyer is one by trade; anybody else can still be
    // spectacular enough to count for part of it.
    highFlying:
      style === 'highFlyer' || style === 'luchador'
        ? 1
        : Math.max(0, wrestler.agility - settings.circuitAgilityFloor) / (100 - settings.circuitAgilityFloor),
    womensWrestling: wrestler.gender === 'f' ? 1 : 0,
    longMatches: wrestler.stamina / 100,
    starPower: wrestler.popularity / 100,
  };
}

/**
 * How much this scene wants this person. Roughly -0.6..+0.9 in practice: a
 * perfect fit for a strongly-opinionated circuit, a bad one for its opposite.
 */
export function tasteFit(wrestler: Wrestler, taste: CircuitTaste, settings: WorldSettings): number {
  const traits = tasteTraits(wrestler, settings);
  let total = 0;
  for (const tag of TAGS) {
    const weight = taste[tag];
    if (weight === undefined) continue;
    total += weight * traits[tag];
  }
  return total;
}

/**
 * Standing on one circuit: what the business thinks of you, moved by what
 * this scene wants.
 *
 * Kept on the same 0-100-ish scale as worldScore so the two numbers can sit
 * beside each other on a screen without one of them lying.
 */
function circuitScore(
  wrestler: Wrestler,
  taste: CircuitTaste,
  ctx: RankingContext,
): number {
  return worldScore(wrestler, ctx) + tasteFit(wrestler, taste, ctx.settings) * ctx.settings.circuitTasteWeight;
}

/**
 * The list for one loop.
 *
 * Same eligibility as the world list — the dead, the retired and the injured
 * are not contenders for anything — so the two are read the same way.
 */
export function circuitRankings(
  everyone: readonly Wrestler[],
  circuitId: Id,
  territories: readonly Territory[],
  ctx: RankingContext,
): Ranked[] {
  const taste = circuitTaste(circuitId, territories);
  const beltOf = biggestBeltHeldBy(ctx);

  return everyone
    .filter((w) => w.promotionId !== null && !w.deceased && w.careerStatus !== 'retired' && !w.injury)
    .map((w) => ({ wrestlerId: w.id, score: circuitScore(w, taste, ctx), titleId: beltOf.get(w.id) ?? null }))
    .sort((a, b) => b.score - a.score)
    .slice(0, ctx.settings.circuitRankingSize)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

/** The most prestigious belt somebody holds — the one worth printing. */
function biggestBeltHeldBy(ctx: RankingContext): Map<Id, Id> {
  const beltOf = new Map<Id, Id>();
  for (const title of ctx.titles) {
    if (title.vacant) continue;
    for (const holder of title.currentHolderIds) {
      const current = beltOf.get(holder);
      const currentPrestige = current ? (ctx.titles.find((t) => t.id === current)?.prestige ?? 0) : -1;
      if (title.prestige > currentPrestige) beltOf.set(holder, title.id);
    }
  }
  return beltOf;
}

export interface CircuitStanding {
  circuitId: Id;
  circuitName: string;
  rank: number | null;
}

/**
 * Where one wrestler sits on every loop — the thing worth showing on a
 * profile, because the shape of it *is* the read on somebody. Top five in one
 * place and nowhere else is a specialist; middling everywhere is a utility
 * hand; top ten across the board is a genuine star.
 */
export function standingsFor(
  wrestlerId: Id,
  everyone: readonly Wrestler[],
  territories: readonly Territory[],
  ctx: RankingContext,
): CircuitStanding[] {
  return CIRCUITS.map((circuit) => {
    const list = circuitRankings(everyone, circuit.id, territories, ctx);
    return {
      circuitId: circuit.id,
      circuitName: circuit.name,
      rank: list.find((r) => r.wrestlerId === wrestlerId)?.rank ?? null,
    };
  });
}
