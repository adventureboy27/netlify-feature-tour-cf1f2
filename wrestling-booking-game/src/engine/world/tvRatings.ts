// TV ratings — the number the whole business is judged by.
//
// Distinct from `Promotion.rating`, which is the 0-100 ladder position (§13).
// The ladder is where you *stand*; the TV rating is what you *drew this
// week*, and it moves show to show. Ratings are the scoreboard the player
// checks first and the thing rival promotions take from you.
//
// The model: every promotion competes for a finite viewing audience in the
// slots it broadcasts in. Head to head, the better show takes share from the
// worse one — so a rival's great week costs you rating even if your own show
// was fine. That is the part that makes rivals feel alive rather than
// decorative.

import { clamp } from '../rng';
import type { WorldSettings } from '../types';

export interface RatingEntrant {
  promotionId: string;
  /** This week's show quality, 0-100. */
  showRating: number;
  /** Ladder position, 0-100 — the audience you walked in with. */
  companyRating: number;
  /** Do they broadcast at all this week? */
  broadcast: boolean;
  /**
   * Flat rating points from owned production — cameras, a production truck,
   * advertising, guest talent, streaming. A camera crew makes the broadcast
   * itself better, on top of whatever the wrestling was worth; unlike
   * showRating, it never touches the audience split, only the number this
   * entrant's own broadcast prints. See data/production.ts and
   * engine/economy/production.ts's PRODUCTION_LADDER — every tvRating field
   * they declare summed into this at the call site.
   */
  tvRatingBonus?: number;
}

export interface RatingResult {
  promotionId: string;
  /** The headline number, e.g. 3.4. */
  rating: number;
  /** Percentage of the watching audience, 0-100. */
  share: number;
}

/**
 * Split the week's audience between everyone on the air.
 *
 * Draw is `companyRating` weighted by how good tonight's show was — an
 * established promotion coasts on reputation for a while, but a run of bad
 * shows bleeds real audience to whoever is opposite them.
 */
export function computeTvRatings(entrants: readonly RatingEntrant[], settings: WorldSettings): RatingResult[] {
  const onAir = entrants.filter((e) => e.broadcast);
  if (onAir.length === 0) return [];

  const draws = onAir.map((e) => {
    const reputation = e.companyRating / 100;
    const tonight = e.showRating / 100;
    // Reputation gets you sampled; the show decides whether they stay.
    const draw = reputation * (1 - settings.tvShowQualityWeight) + reputation * tonight * settings.tvShowQualityWeight;
    return Math.max(draw, 0.001);
  });

  const totalDraw = draws.reduce((a, b) => a + b, 0);

  return onAir.map((entrant, i) => {
    const share = (draws[i]! / totalDraw) * 100;
    // The whole market's rating scales with how much wrestling is worth
    // watching this week, so two great promotions opposite each other grow
    // the pie instead of only splitting it.
    const marketStrength = totalDraw / Math.max(onAir.length, 1);
    const rating = clamp(
      settings.tvRatingBase * (share / 100) * onAir.length * (0.6 + marketStrength) + (entrant.tvRatingBonus ?? 0),
      0,
      settings.tvRatingCeiling,
    );
    return { promotionId: entrant.promotionId, rating: Math.round(rating * 100) / 100, share: Math.round(share * 10) / 10 };
  });
}

/** §13-style word ladder for a TV rating, since bare numbers mean little. */
export type TvVerdict = 'Disaster' | 'Struggling' | 'Holding' | 'Healthy' | 'Hot' | 'Phenomenon';

export function tvVerdict(rating: number, settings: WorldSettings): TvVerdict {
  const t = rating / settings.tvRatingCeiling;
  if (t < 0.08) return 'Disaster';
  if (t < 0.2) return 'Struggling';
  if (t < 0.38) return 'Holding';
  if (t < 0.58) return 'Healthy';
  if (t < 0.8) return 'Hot';
  return 'Phenomenon';
}

// ------------------------------------------------------- the weekly chart

/**
 * A row on the week's ratings chart. Wrestling shows and network programmes
 * sit in the same list on purpose — where wrestling lands against the rest of
 * television is the clearest statement of how the business is doing, and
 * "fourth, behind two sitcoms" says something a bare number cannot.
 */
export interface ChartRow {
  rank: number;
  name: string;
  network: string;
  rating: number;
  kind: 'yours' | 'rivalWrestling' | 'network';
}

export interface ChartContext {
  /** Wrestling results from computeTvRatings. */
  wrestling: readonly RatingResult[];
  playerPromotionId: string;
  promotionName: (id: string) => string;
  /** Invented network programmes to fill out the chart. */
  networkShows: readonly { id: string; name: string; network: string; baseRating: number; volatility: number }[];
  /** Deterministic 0-1 stream, so a week's chart replays identically. */
  next: () => number;
}

/**
 * Build the week's chart. Network shows wobble around their base each week,
 * so a season finale can beat you on a night you did nothing wrong.
 */
export function buildRatingsChart(ctx: ChartContext): ChartRow[] {
  const rows: Omit<ChartRow, 'rank'>[] = [];

  for (const result of ctx.wrestling) {
    rows.push({
      name: ctx.promotionName(result.promotionId),
      network: 'Syndicated',
      rating: result.rating,
      kind: result.promotionId === ctx.playerPromotionId ? 'yours' : 'rivalWrestling',
    });
  }

  for (const show of ctx.networkShows) {
    // Centred wobble: +/- volatility, so the base rating is the expectation.
    const swing = (ctx.next() * 2 - 1) * show.volatility;
    rows.push({
      name: show.name,
      network: show.network,
      rating: Math.max(0, Math.round((show.baseRating + swing) * 10) / 10),
      kind: 'network',
    });
  }

  return rows
    .sort((a, b) => b.rating - a.rating)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

/** Where the player's show finished on the whole of television. */
export function playerChartPosition(chart: readonly ChartRow[]): ChartRow | undefined {
  return chart.find((row) => row.kind === 'yours');
}

/** Did we beat the biggest rival who was on opposite us? */
export function wonTheNight(results: readonly RatingResult[], promotionId: string): boolean {
  if (results.length < 2) return false;
  const best = results.reduce((a, b) => (b.rating > a.rating ? b : a));
  return best.promotionId === promotionId;
}
