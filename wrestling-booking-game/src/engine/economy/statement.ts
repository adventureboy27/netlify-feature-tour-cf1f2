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

export type RevenueKind =
  | 'gate'
  | 'merch'
  | 'concessions'
  | 'television'
  | 'sponsor'
  | 'houseShows'
  | 'other';
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
  | 'overhead'
  | 'perks'
  | 'stock'
  /** Money the company took at the door and gave away — see world/impromptu.ts. */
  | 'charity'
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
  concessions: 'Concessions',
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
  overhead: 'Running the office',
  perks: 'Contract extras',
  stock: 'Stock and stands',
  charity: 'To the family',
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
    const opening = Math.round(this.openingBalance);
    const closing = Math.round(closingBalance);

    const revenue = round(this.revenue, REVENUE_LABELS);
    const expenses = round(this.expenses, EXPENSE_LABELS);

    // Reconcile against the bank before totalling.
    //
    // The statement's job is to explain the balance, and the balance is the
    // fact — so whatever the bank actually did this week is what the sheet has
    // to add up to. A week runs money through a long list of paths, and one of
    // them forgetting to declare itself must never produce a statement whose
    // own closing figure contradicts its own lines. Anything left over lands
    // on Other, which is honestly what it is.
    //
    // Both Other lines come out first, so what remains is only the money that
    // named itself; whatever the bank did beyond that is Other by definition.
    // Netting the two also keeps Other off both sides of one week, which tells
    // a reader nothing.
    take(revenue, 'other');
    take(expenses, 'other');
    const other = closing - opening - (total(revenue) - total(expenses));
    if (other > 0) revenue.push({ kind: 'other', label: REVENUE_LABELS.other, amount: other });
    else if (other < 0) expenses.push({ kind: 'other', label: EXPENSE_LABELS.other, amount: -other });

    // Biggest first inside each block: the useful reading is which line is the
    // problem, and sorting by size answers that at a glance.
    revenue.sort((a, b) => b.amount - a.amount);
    expenses.sort((a, b) => b.amount - a.amount);

    const totalRevenue = total(revenue);
    const totalExpenses = total(expenses);

    return {
      week: this.week,
      openingBalance: opening,
      revenue,
      expenses,
      totalRevenue,
      totalExpenses,
      net: totalRevenue - totalExpenses,
      closingBalance: closing,
    };
  }
}

function round<K extends string>(
  amounts: ReadonlyMap<K, number>,
  labels: Record<K, string>,
): StatementLine<K>[] {
  return [...amounts.entries()]
    .map(([kind, amount]) => ({ kind, label: labels[kind], amount: Math.round(amount) }))
    .filter((l) => l.amount !== 0);
}

function total(lines: readonly StatementLine<string>[]): number {
  return lines.reduce((s, l) => s + l.amount, 0);
}

/** Pull a line out of the list and hand back its amount. Zero if it was absent. */
function take<K extends string>(lines: StatementLine<K>[], kind: K): number {
  const at = lines.findIndex((l) => l.kind === kind);
  if (at < 0) return 0;
  return lines.splice(at, 1)[0]!.amount;
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
