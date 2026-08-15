// The weekly statement.
//
// The properties that matter are arithmetic ones — the books have to balance,
// and the lines have to add up to the totals. If a statement can lie about
// where the money went it is worse than no statement at all.

import { describe, expect, it } from 'vitest';
import {
  StatementBuilder,
  biggestExpense,
  statementLine,
  runningNet,
  weeksOfRunway,
  type WeeklyStatement,
} from './statement';

function week(net: number, w = 1): WeeklyStatement {
  const b = new StatementBuilder(w, 0);
  if (net >= 0) b.earn('gate', net);
  else b.spend('payroll', -net);
  return b.build(net);
}

describe('the books balance', () => {
  it('adds its own lines up', () => {
    const b = new StatementBuilder(4, 50_000);
    b.earn('gate', 21_000);
    b.earn('merch', 4_000);
    b.spend('payroll', 13_000);
    b.spend('venue', 2_500);
    const s = b.build(59_500);

    expect(s.totalRevenue).toBe(25_000);
    expect(s.totalExpenses).toBe(15_500);
    expect(s.net).toBe(9_500);
    expect(s.revenue.reduce((t, l) => t + l.amount, 0)).toBe(s.totalRevenue);
    expect(s.expenses.reduce((t, l) => t + l.amount, 0)).toBe(s.totalExpenses);
  });

  it('rolls repeat entries into one line', () => {
    // A two-show week earns a gate twice and must not print Gate twice.
    const b = new StatementBuilder(1, 0);
    b.earn('gate', 1_000);
    b.earn('gate', 2_500);
    const s = b.build(3_500);
    expect(s.revenue).toHaveLength(1);
    expect(s.revenue[0]!.amount).toBe(3_500);
  });

  it('takes an expense as a cost however it is signed', () => {
    // Callers pass costs around as both positives and negatives depending on
    // where in the store they are; the sign is this module's business.
    const b = new StatementBuilder(1, 0);
    b.spend('payroll', 900);
    b.spend('venue', -400);
    const s = b.build(-1_300);
    expect(s.totalExpenses).toBe(1_300);
    expect(s.net).toBe(-1_300);
  });

  it('leaves out anything that did not happen', () => {
    const b = new StatementBuilder(1, 0);
    b.earn('gate', 0);
    b.spend('fines', 0);
    b.earn('merch', Number.NaN);
    const s = b.build(0);
    expect(s.revenue).toHaveLength(0);
    expect(s.expenses).toHaveLength(0);
    expect(s.net).toBe(0);
  });

  it('records where the week started and finished', () => {
    const b = new StatementBuilder(9, 12_345);
    b.earn('television', 5_000);
    const s = b.build(17_345);
    expect(s.openingBalance).toBe(12_345);
    expect(s.closingBalance).toBe(17_345);
    expect(s.week).toBe(9);
  });
});

describe('reading the week at a glance', () => {
  it('puts the biggest cost at the top, because that is the useful line', () => {
    const b = new StatementBuilder(1, 0);
    b.spend('venue', 2_000);
    b.spend('payroll', 14_000);
    b.spend('travel', 500);
    const s = b.build(-16_500);
    expect(s.expenses[0]!.kind).toBe('payroll');
    expect(biggestExpense(s)!.kind).toBe('payroll');
  });

  it('sorts revenue the same way', () => {
    const b = new StatementBuilder(1, 0);
    b.earn('merch', 3_000);
    b.earn('gate', 20_000);
    const s = b.build(23_000);
    expect(s.revenue[0]!.kind).toBe('gate');
  });

  it('has nothing to point at on a week with no costs', () => {
    expect(biggestExpense(week(500))).toBeNull();
  });

  it('says whether the week was up or down, and what took the money', () => {
    const b = new StatementBuilder(1, 0);
    b.earn('gate', 5_000);
    b.spend('payroll', 9_000);
    const s = b.build(-4_000);
    const line = statementLine(s);
    expect(line).toMatch(/Down/);
    expect(line).toMatch(/Payroll/);
  });

  it('says so when a week broke even', () => {
    expect(statementLine(week(0))).toMatch(/even/);
  });
});

describe('the trend, not the snapshot', () => {
  const history = [week(-2_000, 1), week(-1_000, 2), week(-3_000, 3), week(-2_000, 4)];

  it('adds up the recent weeks only', () => {
    expect(runningNet(history, 2)).toBe(-5_000);
    expect(runningNet(history, 99)).toBe(-8_000);
    expect(runningNet([], 4)).toBe(0);
  });

  it('works out how long the money lasts at the current burn', () => {
    // Averaging -2,000 a week against 10,000 in the bank is five weeks.
    expect(weeksOfRunway(history, 10_000, 4)).toBe(5);
  });

  it('reports no runway at all for a company making money', () => {
    expect(weeksOfRunway([week(4_000, 1), week(6_000, 2)], 10_000, 4)).toBeNull();
  });

  it('says nothing before there is anything to say', () => {
    expect(weeksOfRunway([], 10_000, 4)).toBeNull();
  });

  it('never reports negative weeks left', () => {
    expect(weeksOfRunway(history, -50_000, 4)).toBe(0);
  });
});
