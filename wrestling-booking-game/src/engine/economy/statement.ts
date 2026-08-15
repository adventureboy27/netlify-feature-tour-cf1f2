// The weekly statement: everything that came in, everything that went out, and
// what is left.
//
// The game moved a lot of money and never showed anybody the books. Payroll
// came off, a gate went on, a manager took his cut, a truck cost something, and
// the only visible number was a bank balance that had changed since last week
// for reasons the player had to infer. A management game owes the player an
// answer to "where did it all go".
//
// Deliberately a plain P&L rather than a chart. Lines, in the order an accountant
// would put them, with the biggest expense first inside each block — because the
// useful reading is "the payroll is the problem" or "the truck is the problem",
// and a pie chart hides exactly that.

export type RevenueKind = 'gate' | 'merch' | 'television' | 'sponsor' | 'houseShows' | 'other';
export type ExpenseKind =
  | 'payroll'
  | 'production'
  | 'haulage'
  | 'venue'
  | 'travel'
  | 'agents'
  | 'medical'
  | 'fines'
  | 'entries'
  | 'other';

export interface StatementLine<K extends string> {
  kind: K;
  /** What to call it on the page. */
  label: string;
  amount: number;
}

export interface WeeklyStatement {
  week: number;
  openingBalance: number;
  revenue: StatementLine<RevenueKind>[];
  expenses: StatementLine<ExpenseKind>[];
  totalRevenue: number;
  totalExpenses: number;
  /** Revenue minus expenses. The number that matters. */
  net: number;
  closingBalance: number;
}

const REVENUE_LABELS: Record<RevenueKind, string> = {
  gate: 'Gate',
  merch: 'Merchandise',
  television: 'Television',
  sponsor: 'Sponsors',
  houseShows: 'House shows',
  other: 'Other',
};

const EXPENSE_LABELS: Record<ExpenseKind, string> = {
  payroll: 'Payroll',
  production: 'Production',
  haulage: 'Haulage',
  venue: 'Venue',
  travel: 'Travel',
  agents: 'Managers’ cuts',
  medical: 'Medical',
  fines: 'Fines and settlements',
  entries: 'Entry fees',
  other: 'Other',
};

/**
 * A statement builder, because the week's money arrives from a dozen places in
 * the store and nobody wants to thread a growing object through all of them.
 *
 * Amounts are accumulated by kind, so calling `earn('gate', ...)` twice on a
 * two-show week produces one Gate line rather than two.
 */
export class StatementBuilder {
  private readonly revenue = new Map<RevenueKind, number>();
  private readonly expenses = new Map<ExpenseKind, number>();

  constructor(
    private readonly week: number,
    private readonly openingBalance: number,
  ) {}

  earn(kind: RevenueKind, amount: number): void {
    if (!Number.isFinite(amount) || amount === 0) return;
    this.revenue.set(kind, (this.revenue.get(kind) ?? 0) + amount);
  }

  /** Always called with a positive number; the sign is this module's business. */
  spend(kind: ExpenseKind, amount: number): void {
    if (!Number.isFinite(amount) || amount === 0) return;
    this.expenses.set(kind, (this.expenses.get(kind) ?? 0) + Math.abs(amount));
  }

  build(closingBalance: number): WeeklyStatement {
    // Biggest first inside each block: the useful reading is which line is the
    // problem, and sorting by size answers that at a glance.
    const revenue = [...this.revenue.entries()]
      .map(([kind, amount]) => ({ kind, label: REVENUE_LABELS[kind], amount: Math.round(amount) }))
      .filter((l) => l.amount !== 0)
      .sort((a, b) => b.amount - a.amount);

    const expenses = [...this.expenses.entries()]
      .map(([kind, amount]) => ({ kind, label: EXPENSE_LABELS[kind], amount: Math.round(amount) }))
      .filter((l) => l.amount !== 0)
      .sort((a, b) => b.amount - a.amount);

    const totalRevenue = revenue.reduce((s, l) => s + l.amount, 0);
    const totalExpenses = expenses.reduce((s, l) => s + l.amount, 0);

    return {
      week: this.week,
      openingBalance: Math.round(this.openingBalance),
      revenue,
      expenses,
      totalRevenue,
      totalExpenses,
      net: totalRevenue - totalExpenses,
      closingBalance: Math.round(closingBalance),
    };
  }
}

/** The single biggest thing bleeding money this week, for the summary line. */
export function biggestExpense(statement: WeeklyStatement): StatementLine<ExpenseKind> | null {
  return statement.expenses[0] ?? null;
}

/**
 * How the week reads, in one sentence.
 *
 * States what happened. It does not advise, and it does not warn about next
 * week — §0. A booker who is losing money is told he is losing money and what
 * the largest line was, and what he does about it is his business.
 */
export function statementLine(statement: WeeklyStatement): string {
  const worst = biggestExpense(statement);
  const money = (n: number) => `$${Math.abs(n).toLocaleString()}`;

  if (statement.net === 0) return 'The week broke exactly even.';
  if (statement.net > 0) {
    return `Up ${money(statement.net)} on the week${worst ? `, with ${worst.label.toLowerCase()} the biggest cost at ${money(worst.amount)}` : ''}.`;
  }
  return `Down ${money(statement.net)} on the week${worst ? `. ${worst.label} took ${money(worst.amount)}` : ''}.`;
}

/** Net across the last `weeks` statements — the trend, not the snapshot. */
export function runningNet(history: readonly WeeklyStatement[], weeks: number): number {
  return history.slice(-weeks).reduce((sum, s) => sum + s.net, 0);
}

/**
 * Weeks of runway at the current burn, or null if the company is profitable.
 *
 * Reported rather than warned about. The number is on the statement screen for
 * anybody who goes looking; nothing pops up to tell a booker he is in trouble.
 */
export function weeksOfRunway(
  history: readonly WeeklyStatement[],
  bank: number,
  sampleWeeks: number,
): number | null {
  const recent = history.slice(-sampleWeeks);
  if (recent.length === 0) return null;
  const averageNet = recent.reduce((s, x) => s + x.net, 0) / recent.length;
  if (averageNet >= 0) return null;
  return Math.max(0, Math.floor(bank / -averageNet));
}
