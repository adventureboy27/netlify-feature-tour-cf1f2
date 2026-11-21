// The rule this file holds: doing it once is a note in a file, doing it four
// times costs you a spot on the card — and hurting somebody on purpose skips
// every rung of that ladder.

import { describe, expect, it } from 'vitest';
import { defaultWorldSettings } from '../world/settings';
import {
  applySanction,
  emptyDiscipline,
  isSuspended,
  priors,
  recordLabel,
  reoffendWeight,
  sanctionFor,
  suspensionLine,
  tickSuspension,
  weeksLeft,
  type DisciplineRecord,
  type ViolationKind,
} from './discipline';

const settings = defaultWorldSettings();
const RATE = 1000;

function after(kinds: ViolationKind[], week = 10): DisciplineRecord {
  const record = emptyDiscipline();
  for (const kind of kinds) {
    applySanction(record, kind, sanctionFor(record, kind, RATE, settings), week);
  }
  return record;
}

describe('the ladder', () => {
  it('starts with a note in a file and nothing else', () => {
    expect(sanctionFor(emptyDiscipline(), 'cheating', RATE, settings).kind).toBe('warned');
  });

  it('starts costing money once it is a habit', () => {
    const record = after(['cheating', 'cheating']);
    expect(sanctionFor(record, 'cheating', RATE, settings).kind).toBe('fined');
  });

  it('costs a spot on the card once it is a pattern', () => {
    const record = after(['cheating', 'cheating', 'conduct', 'conduct']);
    expect(sanctionFor(record, 'cheating', RATE, settings).kind).toBe('suspended');
  });

  it('escalates by count rather than by kind', () => {
    // By the fourth, what the office is responding to is the pattern rather
    // than the act.
    const mixed = after(['cheating', 'noShow', 'conduct', 'stiffWork']);
    expect(sanctionFor(mixed, 'noShow', RATE, settings).kind).toBe('suspended');
  });

  it('makes each one after that longer than the last', () => {
    const four = after(['cheating', 'cheating', 'conduct', 'conduct']);
    const first = sanctionFor(four, 'conduct', RATE, settings);
    applySanction(four, 'conduct', first, 10);
    const second = sanctionFor(four, 'conduct', RATE, settings);
    if (first.kind !== 'suspended' || second.kind !== 'suspended') throw new Error('expected suspensions');
    expect(second.weeks).toBeGreaterThan(first.weeks);
  });

  it('never resets on a schedule — a file is a file', () => {
    const record = after(['cheating', 'cheating', 'conduct'], 1);
    expect(priors(record)).toBe(3);
    expect(sanctionFor(record, 'conduct', RATE, settings).kind).not.toBe('warned');
  });
});

describe('hurting somebody on purpose', () => {
  it('skips every rung, first time', () => {
    // Not a worse version of working stiff. A different act.
    const sanction = sanctionFor(emptyDiscipline(), 'deliberateInjury', RATE, settings);
    expect(sanction.kind).toBe('suspended');
    if (sanction.kind === 'suspended') {
      expect(sanction.weeks).toBeGreaterThanOrEqual(settings.disciplineInjurySuspensionWeeks);
      expect(sanction.amount).toBeGreaterThan(0);
    }
  });

  it('is worse than a fourth offence of anything else', () => {
    const straightIn = sanctionFor(emptyDiscipline(), 'deliberateInjury', RATE, settings);
    const habitual = sanctionFor(after(['conduct', 'conduct', 'conduct', 'conduct']), 'conduct', RATE, settings);
    if (straightIn.kind !== 'suspended' || habitual.kind !== 'suspended') throw new Error('expected suspensions');
    expect(straightIn.weeks).toBeGreaterThan(habitual.weeks);
  });

  it('gets worse again for somebody who has done it before', () => {
    const record = after(['deliberateInjury']);
    const again = sanctionFor(record, 'deliberateInjury', RATE, settings);
    if (again.kind !== 'suspended') throw new Error('expected a suspension');
    expect(again.weeks).toBeGreaterThan(settings.disciplineInjurySuspensionWeeks);
  });
});

describe('serving it', () => {
  it('keeps somebody off the card until it is served', () => {
    const record = emptyDiscipline();
    applySanction(record, 'deliberateInjury', sanctionFor(record, 'deliberateInjury', RATE, settings), 10);
    expect(isSuspended(record, 10)).toBe(true);
    expect(isSuspended(record, 10 + settings.disciplineInjurySuspensionWeeks)).toBe(false);
    expect(weeksLeft(record, 11)).toBeGreaterThan(0);
  });

  it('does not shorten a sentence for offending again while sitting out', () => {
    const record = emptyDiscipline();
    applySanction(record, 'deliberateInjury', sanctionFor(record, 'deliberateInjury', RATE, settings), 10);
    const longSentence = record.suspendedUntilWeek!;
    applySanction(record, 'conduct', { kind: 'suspended', weeks: 1, amount: 0, note: 'x' }, 11);
    expect(record.suspendedUntilWeek).toBe(longSentence);
  });

  it('clears the moment it expires — a served suspension is served', () => {
    const record = emptyDiscipline();
    applySanction(record, 'conduct', { kind: 'suspended', weeks: 2, amount: 0, note: 'x' }, 10);
    expect(tickSuspension(record, 11)).toBe(false);
    expect(tickSuspension(record, 12)).toBe(true);
    expect(record.suspendedUntilWeek).toBeNull();
    expect(isSuspended(record, 12)).toBe(false);
  });

  it('treats somebody with no record as free to work', () => {
    expect(isSuspended(undefined, 5)).toBe(false);
    expect(weeksLeft(undefined, 5)).toBe(0);
  });
});

describe('money', () => {
  it('takes a fine out in weeks of pay, so it scales with what they earn', () => {
    const star = sanctionFor(after(['conduct', 'conduct']), 'conduct', 10_000, settings);
    const hand = sanctionFor(after(['conduct', 'conduct']), 'conduct', 500, settings);
    if (star.kind !== 'fined' || hand.kind !== 'fined') throw new Error('expected fines');
    expect(star.amount).toBeGreaterThan(hand.amount);
  });

  it('adds up everything they have ever paid', () => {
    const record = after(['conduct', 'conduct', 'conduct', 'conduct']);
    expect(record.finesPaid).toBeGreaterThan(0);
  });
});

describe('what the room says about it', () => {
  it('says nothing at all about a clean sheet', () => {
    expect(recordLabel(emptyDiscipline(), 10, settings)).toBeNull();
    expect(recordLabel(undefined, 10, settings)).toBeNull();
  });

  it('says somebody has form, and then that the file is long', () => {
    expect(recordLabel(after(['conduct']), 10, settings)).toBe('Has form');
    expect(recordLabel(after(['conduct', 'conduct', 'conduct', 'conduct']), 10, settings)).toContain('long file');
  });

  it('says out loud when somebody is off every card', () => {
    // §0: a wrestler vanishing from the card without a sentence is exactly
    // the thing that is not allowed.
    const record = emptyDiscipline();
    const sanction = sanctionFor(record, 'deliberateInjury', RATE, settings);
    applySanction(record, 'deliberateInjury', sanction, 10);
    expect(recordLabel(record, 11, settings)).toContain('Suspended');
    expect(suspensionLine('Duke Rawlins', sanction)).toContain('Duke Rawlins');
  });

  it('has no announcement to make about a fine', () => {
    expect(suspensionLine('x', { kind: 'fined', amount: 100, note: '' })).toBeNull();
  });
});

describe('who does it again', () => {
  it('reads a file as the only honest predictor there is', () => {
    expect(reoffendWeight(emptyDiscipline(), settings)).toBe(1);
    expect(reoffendWeight(after(['conduct', 'conduct']), settings)).toBeGreaterThan(1);
  });

  it('never runs away with itself', () => {
    const many = after(Array.from({ length: 40 }, () => 'conduct' as ViolationKind));
    expect(reoffendWeight(many, settings)).toBeLessThanOrEqual(3);
  });
});
