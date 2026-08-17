// The office notices.
//
// Everything in this game that somebody does wrong has been free. A manager
// caught cheating costs his client the match and nothing else. A wrestler who
// works stiff hurts somebody and goes out again next week. There was no such
// thing as a record of it, so a repeat offender was indistinguishable from
// somebody who did it once.
//
// This is the file that remembers. Three rungs, and you go up them:
//
//   1. A **violation** on file. Nothing happens. It is on file.
//   2. A **fine**, which comes out of what they are paid.
//   3. A **suspension**, which is the only one that hurts a booker as much as
//      it hurts the wrestler — a suspended man cannot be on your card, and
//      you are the one who has to rebook around him.
//
// Escalation is per person and does not reset on a schedule. A man with three
// on file is a man with three on file, and the fourth costs more than the
// third did.
//
// ---------------------------------------------------------------------------
// Except for one thing
//
// Hurting somebody on purpose skips the ladder. It is not a worse version of
// working stiff; it is a different act, and a promotion that fined a man for
// it and put him back out the following week would be a promotion nobody
// sane would work for. It goes straight to a suspension, and a long one.
//
// This applies to managers exactly as it applies to wrestlers — they have
// contracts and wages now, so a fine has something to come out of and a
// suspension has something to interrupt.

import { clamp } from '../rng';
import type { Id, WorldSettings } from '../types';

export type ViolationKind =
  /** Caught cheating at ringside. See sim/ringside.ts. */
  | 'cheating'
  /** Working far stiffer than the match called for. */
  | 'stiffWork'
  /** Hurting somebody on purpose. The one that skips the ladder. */
  | 'deliberateInjury'
  /** Did not turn up. */
  | 'noShow'
  /** Everything else the office had to hear about. */
  | 'conduct';

const VIOLATION_LABELS: Record<ViolationKind, string> = {
  cheating: 'Caught interfering',
  stiffWork: 'Working unnecessarily stiff',
  deliberateInjury: 'Deliberately injuring an opponent',
  noShow: 'Missing a booking',
  conduct: 'Conduct',
};

export interface Violation {
  kind: ViolationKind;
  week: number;
  /** What actually happened, in a sentence. §0 — never a bare enum. */
  note: string;
}

export interface DisciplineRecord {
  violations: Violation[];
  /** Everything they have ever been fined, cumulative. */
  finesPaid: number;
  /** Null when they are free to work. */
  suspendedUntilWeek: number | null;
}

export function emptyDiscipline(): DisciplineRecord {
  return { violations: [], finesPaid: 0, suspendedUntilWeek: null };
}

/** How many are already on file — what decides how hard the next one lands. */
export function priors(record: DisciplineRecord): number {
  return record.violations.length;
}

export type Sanction =
  | { kind: 'warned'; note: string }
  | { kind: 'fined'; amount: number; note: string }
  | { kind: 'suspended'; weeks: number; amount: number; note: string };

/**
 * What the office does about it.
 *
 * The ladder is by *count*, not by kind — a fourth cheating charge is a
 * suspension the same as a fourth of anything else, because what the office is
 * responding to by then is the pattern rather than the act.
 *
 * Deliberate injury is the exception and does not queue.
 */
export function sanctionFor(
  record: DisciplineRecord,
  kind: ViolationKind,
  weeklyRate: number,
  settings: WorldSettings,
): Sanction {
  const s = settings;
  const name = VIOLATION_LABELS[kind];

  if (kind === 'deliberateInjury') {
    // Not a worse version of working stiff. A different act.
    const weeks = s.disciplineInjurySuspensionWeeks + priors(record) * s.disciplineRepeatWeeks;
    const amount = Math.round(weeklyRate * s.disciplineInjuryFineWeeks);
    return {
      kind: 'suspended',
      weeks,
      amount,
      note: `${name}. Suspended ${weeks} weeks and fined. There is no version of this the office lets go.`,
    };
  }

  const before = priors(record);
  if (before < s.disciplineWarnUntil) {
    return { kind: 'warned', note: `${name}. On file, and nothing else — this time.` };
  }
  if (before < s.disciplineFineUntil) {
    const amount = Math.round(weeklyRate * s.disciplineFineWeeks);
    return { kind: 'fined', amount, note: `${name}. Fined, with ${before} already on file.` };
  }

  const weeks = s.disciplineSuspensionWeeks + (before - s.disciplineFineUntil) * s.disciplineRepeatWeeks;
  return {
    kind: 'suspended',
    weeks,
    amount: Math.round(weeklyRate * s.disciplineFineWeeks),
    note: `${name}, with ${before} already on file. Suspended ${weeks} weeks.`,
  };
}

/** Write it down and carry out whatever it was. Mutates, like the rest of the sim. */
export function applySanction(
  record: DisciplineRecord,
  kind: ViolationKind,
  sanction: Sanction,
  week: number,
): void {
  record.violations.push({ kind, week, note: sanction.note });
  if (sanction.kind === 'fined') record.finesPaid += sanction.amount;
  if (sanction.kind === 'suspended') {
    record.finesPaid += sanction.amount;
    // Whichever is longer. A man already sitting out does not get a shorter
    // sentence for offending again while he sits.
    const until = week + sanction.weeks;
    record.suspendedUntilWeek = Math.max(record.suspendedUntilWeek ?? 0, until);
  }
}

/** Can they work this week? */
export function isSuspended(record: DisciplineRecord | undefined, week: number): boolean {
  if (!record || record.suspendedUntilWeek === null) return false;
  return week < record.suspendedUntilWeek;
}

/** Weeks left, for the roster card. */
export function weeksLeft(record: DisciplineRecord | undefined, week: number): number {
  if (!isSuspended(record, week)) return 0;
  return Math.max(0, (record!.suspendedUntilWeek ?? 0) - week);
}

/** Clears the moment it expires — a served suspension is served. */
export function tickSuspension(record: DisciplineRecord, week: number): boolean {
  if (record.suspendedUntilWeek === null) return false;
  if (week < record.suspendedUntilWeek) return false;
  record.suspendedUntilWeek = null;
  return true;
}

/**
 * How the room reads somebody's file, in words rather than a count (§0).
 *
 * Only speaks when there is something to say — most people have a clean
 * sheet, and a label on everybody makes the one that matters invisible.
 */
export function recordLabel(
  record: DisciplineRecord | undefined,
  week: number,
  settings: WorldSettings,
): string | null {
  if (!record) return null;
  if (isSuspended(record, week)) return `Suspended, ${weeksLeft(record, week)} weeks left`;
  const count = priors(record);
  if (count === 0) return null;
  if (count >= settings.disciplineFineUntil) return 'A long file at the office';
  return 'Has form';
}

/** What a suspension costs the promotion, said out loud. */
export function suspensionLine(name: string, sanction: Sanction): string | null {
  if (sanction.kind !== 'suspended') return null;
  return `${name} has been suspended for ${sanction.weeks} weeks, and is off every card until it is served.`;
}

export interface Disciplined {
  discipline?: DisciplineRecord;
  id: Id;
}

/** Fill one in on first touch, like the ledger. */
export function disciplineOf(person: Disciplined): DisciplineRecord {
  if (!person.discipline) person.discipline = emptyDiscipline();
  return person.discipline;
}

/**
 * How likely somebody is to do it again.
 *
 * Not used to punish — used by the world to decide whether a wrestler with a
 * temper actually loses it. Somebody with a file is somebody it has happened
 * to before, which is the only honest predictor there is.
 */
export function reoffendWeight(
  record: DisciplineRecord | undefined,
  settings: WorldSettings,
): number {
  if (!record) return 1;
  return clamp(1 + priors(record) * settings.disciplineReoffendWeight, 1, 3);
}
