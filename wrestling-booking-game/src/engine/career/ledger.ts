// What somebody actually did, and where.
//
// `Wrestler.record` was three numbers — wins, losses, draws — accumulated
// across a whole life and never split by anything. Which meant the game could
// not answer a single question a wrestling record is *for*:
//
//   - what a man's record was in the company he made his name in
//   - what he did in the two years he spent somewhere else
//   - how a match that got stopped should be counted
//   - what he was paid, ever, by anyone
//   - how long he actually wrestled, as against how long he was employed
//
// That last one matters more than it looks. Somebody who wrestled fifteen
// years and then managed for ten has fifteen years in the ring, and a career
// page that says twenty-five is not rounding — it is wrong.
//
// ---------------------------------------------------------------------------
// Two sets of books
//
// Every match lands twice: once on the lifetime record and once on the stint
// with the company it happened at. Neither is derived from the other, because
// a lifetime total that is the sum of surviving stints quietly loses every
// match somebody worked for a promotion that has since folded and been
// garbage-collected.
//
// ---------------------------------------------------------------------------
// DNF
//
// A match stopped because somebody could not continue is not a loss, and
// scoring it as one has been quietly lying about every injury in the game. It
// is per *person*, not per match: the man who got hurt takes the DNF and the
// man standing takes the win, which is how every combat sport on earth records
// it.
//
// ---------------------------------------------------------------------------
// Managers
//
// A manager's record is the record of the people they were actually at
// ringside for, which means it needs no client roster to maintain: it accrues
// from the side they worked, and it stops the moment they stop being booked
// with somebody. A manager who moves companies starts a new stint like anybody
// else, and the clientele they had at the old one stays with the old one.

import type { Id, WorldSettings } from '../types';

export interface MatchRecord {
  wins: number;
  losses: number;
  draws: number;
  /** Stopped. An injury, or a night that came apart. Never a loss. */
  dnf: number;
}

export type LedgerRole = 'wrestler' | 'manager';

export function emptyRecord(): MatchRecord {
  return { wins: 0, losses: 0, draws: 0, dnf: 0 };
}

export type Outcome = 'win' | 'loss' | 'draw' | 'dnf';

export function credit(record: MatchRecord, outcome: Outcome): void {
  if (outcome === 'win') record.wins += 1;
  else if (outcome === 'loss') record.losses += 1;
  else if (outcome === 'draw') record.draws += 1;
  else record.dnf += 1;
}

/** Matches that produced a result. A DNF is not one. */
export function decided(record: MatchRecord): number {
  return record.wins + record.losses + record.draws;
}

export function appearances(record: MatchRecord): number {
  return decided(record) + record.dnf;
}

/**
 * Winning percentage, 0-1, over matches that were actually decided.
 *
 * Draws count as half, DNFs not at all — a man who was carried out on a
 * stretcher did not lose, and holding it against his percentage would make
 * every top-ten list a list of people who never got hurt.
 */
export function winRate(record: MatchRecord): number {
  const total = decided(record);
  if (total === 0) return 0;
  return (record.wins + record.draws * 0.5) / total;
}

/** How a record reads on a page. */
export function recordLine(record: MatchRecord): string {
  const base = `${record.wins}-${record.losses}-${record.draws}`;
  return record.dnf > 0 ? `${base} (${record.dnf} NC)` : base;
}

// ---------------------------------------------------------------------------
// A spell somewhere

export interface Stint {
  promotionId: Id;
  /**
   * Denormalised on purpose. A company can fold and be forgotten, and a
   * record that reads "1994-1998, [unknown]" is not a record.
   */
  promotionName: string;
  role: LedgerRole;
  joinedWeek: number;
  /** Null while they are still there. */
  leftWeek: number | null;
  /** Weeks actually served. Counted rather than subtracted, so a save that
   *  changes hands mid-week cannot invent tenure. */
  weeks: number;
  record: MatchRecord;
  /** Everything this company ever paid them. */
  earnings: number;
}

export interface Ledger {
  /** Every match, anywhere, as a wrestler. */
  lifetime: MatchRecord;
  /** Every match they worked a corner for, anywhere. */
  managing: MatchRecord;
  /** Everything anybody ever paid them. */
  earnings: number;
  /** Time in the ring, and time in a suit. Kept apart deliberately. */
  weeksAsWrestler: number;
  weeksAsManager: number;
  /** Newest last. Somebody can leave and come back; that is two stints. */
  stints: Stint[];
}

export function emptyLedger(): Ledger {
  return {
    lifetime: emptyRecord(),
    managing: emptyRecord(),
    earnings: 0,
    weeksAsWrestler: 0,
    weeksAsManager: 0,
    stints: [],
  };
}

/** The spell they are in right now, if any. */
export function openStint(ledger: Ledger): Stint | undefined {
  return ledger.stints.find((s) => s.leftWeek === null);
}

/**
 * They have signed somewhere.
 *
 * Closes whatever was open first — nobody is under contract in two places,
 * and a stint left open because a transfer took a shortcut would accrue
 * tenure at a company they left years ago.
 */
export function join(
  ledger: Ledger,
  promotionId: Id,
  promotionName: string,
  role: LedgerRole,
  week: number,
): void {
  leave(ledger, week);
  ledger.stints.push({
    promotionId,
    promotionName,
    role,
    joinedWeek: week,
    leftWeek: null,
    weeks: 0,
    record: emptyRecord(),
    earnings: 0,
  });
}

/** They have gone. Harmless when there is nothing open. */
export function leave(ledger: Ledger, week: number): void {
  const open = openStint(ledger);
  if (open) open.leftWeek = week;
}

/**
 * A week served, counted once.
 *
 * Role is taken from the stint rather than from the wrestler's current role,
 * so somebody who turns manager mid-spell does not retroactively convert
 * their wrestling years — the years already banked stay banked.
 */
export function tickWeek(ledger: Ledger): void {
  const open = openStint(ledger);
  if (!open) return;
  open.weeks += 1;
  if (open.role === 'wrestler') ledger.weeksAsWrestler += 1;
  else ledger.weeksAsManager += 1;
}

/** A match, on both sets of books at once. */
export function creditMatch(ledger: Ledger, outcome: Outcome, as: LedgerRole = 'wrestler'): void {
  credit(as === 'wrestler' ? ledger.lifetime : ledger.managing, outcome);
  const open = openStint(ledger);
  if (open && open.role === as) credit(open.record, outcome);
}

/** Money, on both sets of books at once. */
export function creditPay(ledger: Ledger, amount: number): void {
  if (!Number.isFinite(amount) || amount === 0) return;
  ledger.earnings += amount;
  const open = openStint(ledger);
  if (open) open.earnings += amount;
}

// ---------------------------------------------------------------------------
// Reading it back

/** Everything they ever did at one company, across every spell there. */
export function totalsFor(ledger: Ledger, promotionId: Id): {
  record: MatchRecord;
  earnings: number;
  weeks: number;
  spells: number;
} {
  const mine = ledger.stints.filter((s) => s.promotionId === promotionId);
  const record = emptyRecord();
  let earnings = 0;
  let weeks = 0;
  for (const stint of mine) {
    record.wins += stint.record.wins;
    record.losses += stint.record.losses;
    record.draws += stint.record.draws;
    record.dnf += stint.record.dnf;
    earnings += stint.earnings;
    weeks += stint.weeks;
  }
  return { record, earnings, weeks, spells: mine.length };
}

/** The company they gave the most of their career to. */
export function homeCompany(ledger: Ledger): { promotionId: Id; promotionName: string; weeks: number } | null {
  const byCompany = new Map<Id, { promotionName: string; weeks: number }>();
  for (const stint of ledger.stints) {
    const found = byCompany.get(stint.promotionId);
    if (found) found.weeks += stint.weeks;
    else byCompany.set(stint.promotionId, { promotionName: stint.promotionName, weeks: stint.weeks });
  }
  let best: { promotionId: Id; promotionName: string; weeks: number } | null = null;
  for (const [promotionId, entry] of byCompany) {
    if (!best || entry.weeks > best.weeks) best = { promotionId, ...entry };
  }
  return best;
}

/** Years in the ring, not years employed. */
export function yearsWrestling(ledger: Ledger, settings: WorldSettings): number {
  void settings;
  return ledger.weeksAsWrestler / 52;
}

export function yearsManaging(ledger: Ledger, settings: WorldSettings): number {
  void settings;
  return ledger.weeksAsManager / 52;
}

/** How a spell reads on a career page — no dates, per the calendar rule. */
export function stintLine(stint: Stint, settings: WorldSettings): string {
  const startYear = settings.startingYear + Math.floor(stint.joinedWeek / 52);
  const endYear =
    stint.leftWeek === null ? null : settings.startingYear + Math.floor(stint.leftWeek / 52);
  const span = endYear === null ? `${startYear}-present` : startYear === endYear ? `${startYear}` : `${startYear}-${endYear}`;
  return `${stint.promotionName}, ${span} — ${recordLine(stint.record)}`;
}

/**
 * Who a manager has actually been working with, and how many.
 *
 * Derived from the corners they worked rather than from a client list,
 * because there is no client list — a manager is at ringside or they are not,
 * and that is exactly the relationship the player can see and change. It also
 * gives the rule for free: the moment a wrestler stops being booked with
 * them, they stop being a client.
 */
export function clientsOf(
  cornersWorked: readonly { managerId: Id; wrestlerIds: readonly Id[]; week: number }[],
  managerId: Id,
  currentWeek: number,
  settings: WorldSettings,
): Id[] {
  const since = currentWeek - settings.ledgerClientWindowWeeks;
  const seen = new Set<Id>();
  for (const corner of cornersWorked) {
    if (corner.managerId !== managerId || corner.week < since) continue;
    for (const id of corner.wrestlerIds) seen.add(id);
  }
  return [...seen];
}
