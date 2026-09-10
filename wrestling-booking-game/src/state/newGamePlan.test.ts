import { describe, it, expect } from 'vitest';
import { resolveNewGamePlan, type SlotDraft } from './newGamePlan';
import { rngFromSeed } from '../engine/rng';
import type { RosterEntry } from '../engine/world/roster-io';

describe('resolving a new-game plan', () => {
  it('when nobody imports, every slot just generates — the file is never asked for', () => {
    const slots: SlotDraft[] = [
      { name: 'A', mode: 'generate' },
      { name: 'B', mode: 'generate' },
    ];
    const result = resolveNewGamePlan(slots, 0, null, rngFromSeed('x'));
    expect(result.problems).toEqual([]);
    expect(result.plan).toEqual({
      slots: [
        { name: 'A', roster: 'generate' },
        { name: 'B', roster: 'generate' },
      ],
      playerIndex: 0,
    });
  });

  it('refuses to build a plan when a slot needs a file and none was given', () => {
    const slots: SlotDraft[] = [{ name: 'A', mode: 'import' }];
    const result = resolveNewGamePlan(slots, 0, null, rngFromSeed('x'));
    expect(result.plan).toBeNull();
    expect(result.problems[0]).toContain('Upload a roster file');
  });

  it('matches company groups to import slots by name', () => {
    const slots: SlotDraft[] = [
      { name: 'ECW', mode: 'import' },
      { name: 'WCW', mode: 'import' },
      { name: 'Made Up FC', mode: 'generate' },
    ];
    const file: RosterEntry[] = [
      { name: 'Dutch', company: 'ECW' },
      { name: 'Reina', company: 'ECW' },
      { name: 'Colossal', company: 'WCW' },
    ];
    const result = resolveNewGamePlan(slots, 2, file, rngFromSeed('x'));
    expect(result.problems).toEqual([]);
    const plan = result.plan!;
    expect(plan.playerIndex).toBe(2);
    expect(plan.slots[0]).toEqual({ name: 'ECW', roster: [file[0], file[1]] });
    expect(plan.slots[1]).toEqual({ name: 'WCW', roster: [file[2]] });
    expect(plan.slots[2]).toEqual({ name: 'Made Up FC', roster: 'generate' });
  });

  it('matching is case-insensitive', () => {
    const slots: SlotDraft[] = [{ name: 'ecw', mode: 'import' }];
    const file: RosterEntry[] = [{ name: 'Dutch', company: 'ECW' }];
    const result = resolveNewGamePlan(slots, 0, file, rngFromSeed('x'));
    expect(result.plan!.slots[0]!.roster).toEqual(file);
  });

  it('splits an untagged file evenly across every import slot', () => {
    const slots: SlotDraft[] = [
      { name: 'A', mode: 'import' },
      { name: 'B', mode: 'import' },
    ];
    const file: RosterEntry[] = Array.from({ length: 10 }, (_, i) => ({ name: `W${i}`, gender: 'm' as const }));
    const result = resolveNewGamePlan(slots, 0, file, rngFromSeed('split'));
    expect(result.problems).toEqual([]);
    const plan = result.plan!;
    const a = plan.slots[0]!.roster;
    const b = plan.slots[1]!.roster;
    expect(Array.isArray(a) && Array.isArray(b)).toBe(true);
    expect((a as RosterEntry[]).length + (b as RosterEntry[]).length).toBe(10);
  });

  it('falls back to generate, with a note, when an import slot matches no company — and leaves that company unimported rather than misattributing it', () => {
    const slots: SlotDraft[] = [{ name: 'Nonexistent Co', mode: 'import' }];
    const file: RosterEntry[] = [{ name: 'Dutch', company: 'ECW' }];
    const result = resolveNewGamePlan(slots, 0, file, rngFromSeed('x'));
    expect(result.plan!.slots[0]).toEqual({ name: 'Nonexistent Co', roster: 'generate' });
    expect(result.problems.some((p) => p.includes('Nonexistent Co'))).toBe(true);
    expect(result.problems.some((p) => p.includes('ECW'))).toBe(true);
  });

  it('folds an untagged leftover in with an otherwise-grouped file onto unmatched slots', () => {
    const slots: SlotDraft[] = [
      { name: 'ECW', mode: 'import' },
      { name: 'Nobody Matches This', mode: 'import' },
    ];
    const file: RosterEntry[] = [
      { name: 'Dutch', company: 'ECW' },
      { name: 'Loose Cannon' }, // untagged
    ];
    const result = resolveNewGamePlan(slots, 0, file, rngFromSeed('x'));
    expect(result.plan!.slots[0]).toEqual({ name: 'ECW', roster: [file[0]] });
    expect(result.plan!.slots[1]).toEqual({ name: 'Nobody Matches This', roster: [file[1]] });
  });

  it('accounts for everyone across the whole plan, exactly once', () => {
    const slots: SlotDraft[] = [
      { name: 'ECW', mode: 'import' },
      { name: 'Free For All', mode: 'import' },
      { name: 'Generated Co', mode: 'generate' },
    ];
    const file: RosterEntry[] = [
      { name: 'Dutch', company: 'ECW' },
      { name: 'Loner1' },
      { name: 'Loner2' },
      { name: 'Loner3' },
    ];
    const result = resolveNewGamePlan(slots, 2, file, rngFromSeed('accounting'));
    const rostered = result.plan!.slots.flatMap((s) => (Array.isArray(s.roster) ? s.roster : []));
    expect(rostered.map((e) => e.name).sort()).toEqual(['Dutch', 'Loner1', 'Loner2', 'Loner3'].sort());
  });
});
