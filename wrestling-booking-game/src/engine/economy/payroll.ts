// Payroll and expenses, booking-game-design.md §14.
//
// DESIGN: §14's 50% expense cap ("total show expenses may never exceed
// 50% of show revenue... excess is deferred to the following week as
// debt") needs a persistent debt balance to carry the deferral across
// weeks — that's part of the fuller Finances system (bankruptcy grace
// weeks, loans) that lands with M5. computeShowExpenseSplit exposes both
// the capped amount actually payable now and the overflow, so callers can
// wire the deferral in once that state exists without changing this
// function's contract.

import type { Clause, Contract } from '../types';

export interface AppearanceFeeContext {
  contract: Contract;
  role: 'competitor' | 'manager' | 'referee' | 'roadAgent' | 'trainer';
  isMainEvent: boolean;
  isPPV: boolean;
}

function hasClause(clauses: Clause[], clause: Clause): boolean {
  return clauses.includes(clause);
}

/**
 * §14: appearanceFee = base * roleMultiplier * incentiveMultiplier * payPerViewMultiplier.
 *
 * The base is `perAppearance` — the half of a deal that is only paid when
 * somebody actually works. §14 wrote it against weeklyRate, which would have
 * meant a booked wrestler drew their full salary *and* the same again as a
 * fee, making a deep roster twice as ruinous rather than affordable. Re-based
 * onto the split; the multipliers below are §14's and unchanged.
 *
 * This function and computeDownsideGuarantee had no callers at all until now.
 * The store paid every contract its full weekly rate and nothing else, so
 * `incentive`, `payPerView` and `downside` were clauses you could negotiate,
 * pay upkeep on, and never once feel.
 */
export function computeAppearanceFee(ctx: AppearanceFeeContext): number {
  let fee = ctx.contract.perAppearance * (ctx.role === 'competitor' ? 1.0 : 0.5);
  if (ctx.isMainEvent && hasClause(ctx.contract.clauses, 'incentive')) fee *= 1.25;
  if (ctx.isPPV && hasClause(ctx.contract.clauses, 'payPerView')) fee *= 2.0;
  return fee;
}

/**
 * §14: `downside` clause holders who weren't booked still collect half.
 *
 * Half of the appearance money, on top of the retainer they draw anyway —
 * which is exactly what a downside guarantee is: you get paid whether or not
 * there is a spot for you.
 */
export function computeDownsideGuarantee(contract: Contract): number {
  return hasClause(contract.clauses, 'downside') ? contract.perAppearance * 0.5 : 0;
}

/** §14: weeklyExpenses = netWorth * 0.02 * (1 + 0.1 * territoriesOwned). */
export function computeWeeklyExpenses(netWorth: number, weeklyExpenseRate: number, territoriesOwned: number): number {
  return netWorth * weeklyExpenseRate * (1 + 0.1 * territoriesOwned);
}

export interface ShowExpenseSplit {
  payable: number; // capped at expenseCapPctOfRevenue% of revenue
  deferred: number; // the overflow — not yet persisted anywhere, see DESIGN note above
}

/** §14: "total show expenses may never exceed [cap]% of show revenue." */
export function computeShowExpenseSplit(totalExpenses: number, showRevenue: number, expenseCapPct: number): ShowExpenseSplit {
  const cap = showRevenue * (expenseCapPct / 100);
  const payable = Math.min(totalExpenses, cap);
  return { payable, deferred: totalExpenses - payable };
}
