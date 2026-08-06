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

/** §14: appearanceFee = weeklyRate * roleMultiplier * incentiveMultiplier * payPerViewMultiplier. */
export function computeAppearanceFee(ctx: AppearanceFeeContext): number {
  let fee = ctx.contract.weeklyRate * (ctx.role === 'competitor' ? 1.0 : 0.5);
  if (ctx.isMainEvent && hasClause(ctx.contract.clauses, 'incentive')) fee *= 1.25;
  if (ctx.isPPV && hasClause(ctx.contract.clauses, 'payPerView')) fee *= 2.0;
  return fee;
}

/** §14: `downside` clause holders who weren't booked still collect 50% of their rate. */
export function computeDownsideGuarantee(contract: Contract): number {
  return hasClause(contract.clauses, 'downside') ? contract.weeklyRate * 0.5 : 0;
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
