// Whether the other companies can afford to keep going.
//
// The player's books are modelled in detail — venue, ticket price, merch,
// production, wear — because the player makes all of those decisions. A rival
// makes none of them, so modelling their books to the same depth would be
// inventing numbers. Instead their economics are the *summary* of the same
// forces: how many people want to see them (standing), how good their shows
// have been lately, and what their roster costs.
//
// The result behaves the same way the player's does, which is what matters:
// a promotion that puts on bad shows with an expensive roster loses money,
// and if it keeps doing it, it dies.
//
// Dying is deliberately slow. A rival needs a long, uninterrupted run of
// losses before the doors close — a bad quarter is survivable, a bad three
// years is not — and the business never drops below a floor of companies,
// because a world with one promotion in it is not a world.

import { clamp } from '../rng';
import type { Promotion, Wrestler, WorldSettings } from '../types';

export interface RivalWeek {
  revenue: number;
  costs: number;
  net: number;
}

/**
 * A week's business for a promotion the player does not run.
 *
 * Revenue rises steeply with standing — the gap between a regional company
 * and a national one is not linear — and is modulated by how good their
 * recent shows have been. Costs are payroll plus an overhead that scales with
 * how big an operation they are running.
 */
export function rivalWeek(
  promotion: Promotion,
  roster: readonly Wrestler[],
  settings: WorldSettings,
): RivalWeek {
  const standing = clamp(promotion.rating, 0, 100) / 100;
  const form = clamp(promotion.recentShowQuality, 0, 100) / 100;

  // Weighted toward form rather than standing, for the same reason the
  // player's own demand is: what you have been putting on lately draws more
  // people than what you used to be. It also keeps the ladder from carrying a
  // badly run company forever — a promotion coasting on an old reputation
  // while running bad shows loses money, which is the point.
  const draw = standing * (1 - settings.rivalRevenueFormWeight) + form * settings.rivalRevenueFormWeight;
  const revenue = Math.pow(draw, settings.rivalRevenueCurve) * settings.rivalRevenueScale;

  const payroll = roster.reduce((sum, w) => sum + (w.contract?.weeklyRate ?? 0), 0);
  const overhead = settings.rivalOverheadBase + roster.length * settings.rivalOverheadPerHead;

  const costs = payroll + overhead;
  return { revenue, costs, net: revenue - costs };
}

export type FoldRisk = 'healthy' | 'struggling' | 'inTrouble' | 'closing';

/** How close a company is to the end, for the player to read on the chart. */
export function foldRisk(weeksInTheRed: number, settings: WorldSettings): FoldRisk {
  const grace = settings.rivalBankruptcyGraceWeeks;
  if (weeksInTheRed === 0) return 'healthy';
  if (weeksInTheRed < grace * 0.5) return 'struggling';
  if (weeksInTheRed < grace) return 'inTrouble';
  return 'closing';
}

export const FOLD_RISK_LABELS: Record<FoldRisk, string> = {
  healthy: 'Doing fine',
  struggling: 'Losing money',
  inTrouble: 'In real trouble',
  closing: 'About to close',
};

export interface FoldCheckContext {
  weeksInTheRed: number;
  bankBalance: number;
  /** How many companies are still open, including this one. */
  companiesOpen: number;
  settings: WorldSettings;
}

/**
 * Is this the week the doors close? Three things all have to be true, which
 * is what keeps it rare: they have to be out of money, they have to have been
 * out of money for a long time, and the business has to be able to spare
 * them.
 */
export function shouldFold(ctx: FoldCheckContext): boolean {
  if (!ctx.settings.rivalsCanGoBankrupt) return false;
  if (ctx.companiesOpen <= ctx.settings.minimumPromotions) return false;
  if (ctx.bankBalance >= 0) return false;
  return ctx.weeksInTheRed > ctx.settings.rivalBankruptcyGraceWeeks;
}

// ---------------------------------------------------------------------------
// A struggling rival's own version of what the player can do — not the same
// numbers (the player asked for that directly: "not dollar against dollar"),
// but the same shape of behaviour, so a rival in trouble is something the
// player can actually watch happen rather than a bank figure that quietly
// resets itself. Dying stays exactly as slow as it always was — nothing here
// changes shouldFold or the grace period above; it only makes the run-up to
// it visible.

/**
 * Struggling enough to start cutting costs — the same point `foldRisk`
 * already starts reading "In real trouble" on the chart the player sees, so
 * a booker watching a rival's fold-risk label is watching the same signal
 * that is about to start costing that rival its own people.
 */
export function shouldTrimPayroll(weeksInTheRed: number, settings: WorldSettings): boolean {
  return weeksInTheRed >= settings.rivalBankruptcyGraceWeeks * settings.rivalTrimAtGraceShare;
}

/** Who a struggling rival lets go first — the cheapest, so a real story loses the least. */
export function cheapestToRelease(roster: readonly Wrestler[]): Wrestler | null {
  if (roster.length === 0) return null;
  return roster.reduce((cheapest, w) =>
    (w.contract?.weeklyRate ?? 0) < (cheapest.contract?.weeklyRate ?? 0) ? w : cheapest,
  );
}
