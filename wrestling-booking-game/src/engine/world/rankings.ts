// Rankings.
//
// Two different questions, and they need two different answers:
//
//   Contenders — who is next for the belt *in this promotion*. Recent form
//   first, because a ranking that never moves is not a ranking. This is the
//   one that tells a booker who the crowd would accept in the main event.
//
//   The world list — who is the biggest deal in the business, anywhere. Slow,
//   career-weighted, and cross-promotional, so it settles arguments the
//   contender list cannot: your world champion against theirs.
//
// Champions are listed but ranked separately — a champion is not a contender
// for their own belt, and burying them in the same list makes both lists
// worse.

import type { Id, Title, Wrestler, WorldSettings } from '../types';
import { weeksAsChampion } from '../career/status';

export interface Ranked {
  wrestlerId: Id;
  rank: number;
  score: number;
  /** Belt they hold in the promotion being ranked, if any. */
  titleId: Id | null;
}

export interface RankingContext {
  currentWeek: number;
  titles: readonly Title[];
  settings: WorldSettings;
}

function winPercentage(w: Wrestler): number {
  const total = w.record.wins + w.record.losses + w.record.draws;
  if (total === 0) return 0.5;
  return (w.record.wins + w.record.draws * 0.5) / total;
}

/**
 * Contender score, 0-100. Weighted toward what has happened lately: form and
 * momentum move it week to week, popularity keeps a real draw near the top
 * through a bad month, and nothing else counts.
 */
export function contenderScore(w: Wrestler, ctx: RankingContext): number {
  const s = ctx.settings;
  return (
    (w.momentum / 100) * s.rankMomentumWeight +
    winPercentage(w) * s.rankFormWeight +
    (w.popularity / 100) * s.rankPopularityWeight
  );
}

/**
 * Standing in the business as a whole. Career-long, so it moves slowly and a
 * hot streak does not put a rookie above a ten-year draw.
 */
export function worldScore(w: Wrestler, ctx: RankingContext): number {
  const s = ctx.settings;
  const reigns = Math.min(1, w.titleReigns.length / s.rankReignsForFullCredit);
  const weeksHeld = Math.min(1, weeksAsChampion(w, ctx.currentWeek) / s.rankChampionWeeksForFullCredit);

  return (
    (w.popularity / 100) * s.worldRankPopularityWeight +
    (w.careerHighPopularity / 100) * s.worldRankPeakWeight +
    reigns * s.worldRankReignsWeight +
    weeksHeld * s.worldRankChampionWeeksWeight +
    winPercentage(w) * s.worldRankFormWeight
  );
}

function rank(
  wrestlers: readonly Wrestler[],
  score: (w: Wrestler) => number,
  titleFor: (w: Wrestler) => Id | null,
  limit: number,
): Ranked[] {
  return wrestlers
    .filter((w) => !w.deceased && w.careerStatus !== 'retired' && !w.injury)
    .map((w) => ({ wrestlerId: w.id, score: score(w), titleId: titleFor(w) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

/**
 * Who is next for the belt. Champions are excluded — they are the thing being
 * ranked toward, not a rung on the ladder.
 */
export function contenderRankings(
  roster: readonly Wrestler[],
  promotionId: Id,
  ctx: RankingContext,
): Ranked[] {
  const championIds = new Set(
    ctx.titles
      .filter((t) => t.promotionId === promotionId && !t.vacant)
      .flatMap((t) => t.currentHolderIds),
  );

  return rank(
    roster.filter((w) => !championIds.has(w.id)),
    (w) => contenderScore(w, ctx),
    () => null,
    ctx.settings.contenderRankingSize,
  );
}

/** The biggest names in the business, wherever they work. */
export function worldRankings(everyone: readonly Wrestler[], ctx: RankingContext): Ranked[] {
  const beltOf = new Map<Id, Id>();
  for (const title of ctx.titles) {
    if (title.vacant) continue;
    // The most prestigious belt somebody holds is the one worth showing.
    for (const holder of title.currentHolderIds) {
      const current = beltOf.get(holder);
      const currentPrestige = current ? (ctx.titles.find((t) => t.id === current)?.prestige ?? 0) : -1;
      if (title.prestige > currentPrestige) beltOf.set(holder, title.id);
    }
  }

  return rank(
    everyone.filter((w) => w.promotionId !== null),
    (w) => worldScore(w, ctx),
    (w) => beltOf.get(w.id) ?? null,
    ctx.settings.worldRankingSize,
  );
}

/** Where one wrestler sits on a list, or null if they are off it. */
export function positionOf(rankings: readonly Ranked[], wrestlerId: Id): number | null {
  return rankings.find((r) => r.wrestlerId === wrestlerId)?.rank ?? null;
}
