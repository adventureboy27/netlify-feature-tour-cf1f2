import { describe, it, expect } from 'vitest';
import {
  exportRoster,
  parseRoster,
  applyRosterEntry,
  serializeRoster,
  ROSTER_FORMAT,
} from './roster-io';
import { generateWrestlers } from '../generate/wrestler';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';
import { APPEARANCE_TRAIT_RANGES } from '../generate/appearance';

const settings = defaultWorldSettings();

function someWrestlers(count = 3) {
  return generateWrestlers(rngFromSeed('roster-io'), count, { currentYear: settings.startingYear });
}

describe('taking a roster out', () => {
  it('writes every wrestler with what makes them who they are', () => {
    const roster = someWrestlers(3);
    const file = exportRoster(roster, 'test');
    expect(file.format).toBe(ROSTER_FORMAT);
    expect(file.wrestlers).toHaveLength(3);
    expect(file.wrestlers[0]!.name).toBe(roster[0]!.name);
    expect(file.wrestlers[0]!.charisma).toBe(roster[0]!.charisma);
    expect(file.wrestlers[0]!.appearance).toBeDefined();
  });

  it('carries no ids or world state — a roster belongs to no save', () => {
    const file = exportRoster(someWrestlers(2));
    for (const entry of file.wrestlers) {
      expect(entry).not.toHaveProperty('id');
      expect(entry).not.toHaveProperty('contract');
      expect(entry).not.toHaveProperty('promotionId');
      expect(entry).not.toHaveProperty('titleReigns');
    }
  });

  it('round-trips through text', () => {
    const file = exportRoster(someWrestlers(4), 'round trip');
    const back = parseRoster(serializeRoster(file));
    expect(back.problems).toEqual([]);
    expect(back.entries.map((e) => e.name)).toEqual(file.wrestlers.map((w) => w.name));
  });

  it('is pretty-printed, because people edit these by hand', () => {
    expect(serializeRoster(exportRoster(someWrestlers(1)))).toContain('\n');
  });
});

describe('nothing in a file is trusted', () => {
  it('refuses something that is not JSON without throwing', () => {
    const result = parseRoster('this is not json {{{');
    expect(result.entries).toEqual([]);
    expect(result.problems[0]).toContain('not even JSON');
  });

  it('refuses JSON that is not a roster', () => {
    expect(parseRoster('[1,2,3]').entries).toEqual([]);
    expect(parseRoster('"hello"').entries).toEqual([]);
    expect(parseRoster('{"wrestlers":"lots"}').entries).toEqual([]);
  });

  it('skips entries with no name and says which', () => {
    const result = parseRoster(
      JSON.stringify({ format: 1, wrestlers: [{ name: 'Real' }, { name: '  ' }, { charisma: 90 }] }),
    );
    expect(result.entries.map((e) => e.name)).toEqual(['Real']);
    expect(result.problems).toHaveLength(2);
  });

  it('keeps only the first of a duplicated name', () => {
    const result = parseRoster(
      JSON.stringify({ format: 1, wrestlers: [{ name: 'Doomsday', charisma: 90 }, { name: 'doomsday', charisma: 10 }] }),
    );
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.charisma).toBe(90);
    expect(result.problems[0]).toContain('more than once');
  });

  it('clamps every number instead of trusting it', () => {
    const result = parseRoster(
      JSON.stringify({
        format: 1,
        wrestlers: [{ name: 'Cheater', charisma: 9999, popularity: -50, age: 3, alignment: 5000 }],
      }),
    );
    const entry = result.entries[0]!;
    expect(entry.charisma).toBe(100);
    expect(entry.popularity).toBe(0);
    expect(entry.age).toBe(18);
    expect(entry.alignment).toBe(100);
  });

  it('drops nonsense rather than substituting a number for it', () => {
    // An unreadable field has to come back undefined so generation fills it.
    // Substituting a default here is how every sparse entry became the same
    // 50-across mannequin.
    const result = parseRoster(
      JSON.stringify({
        format: 1,
        wrestlers: [{ name: 'Nonsense', charisma: 'lots', age: null, popularity: {}, alignment: [] }],
      }),
    );
    const entry = result.entries[0]!;
    expect(entry.charisma).toBeUndefined();
    expect(entry.age).toBeUndefined();
    expect(entry.popularity).toBeUndefined();
    expect(entry.alignment).toBeUndefined();
  });

  it('leaves out what a file did not mention', () => {
    const result = parseRoster(JSON.stringify({ format: 1, wrestlers: [{ name: 'Just A Name' }] }));
    const entry = result.entries[0]!;
    expect(entry.name).toBe('Just A Name');
    expect(entry.charisma).toBeUndefined();
    expect(entry.gender).toBeUndefined();
    expect(entry.age).toBeUndefined();
  });

  it('will not let a file ask for a sprite the atlas cannot cut', () => {
    const result = parseRoster(
      JSON.stringify({ format: 1, wrestlers: [{ name: 'Impossible', appearance: { hairStyle: 900, skinTone: -4 } }] }),
    );
    const appearance = result.entries[0]!.appearance!;
    expect(appearance.hairStyle).toBe(APPEARANCE_TRAIT_RANGES.hairStyle - 1);
    expect(appearance.skinTone).toBe(0);
  });

  it('ignores appearance keys it does not recognise', () => {
    const result = parseRoster(
      JSON.stringify({ format: 1, wrestlers: [{ name: 'Odd', appearance: { notATrait: 5, hairStyle: 2 } }] }),
    );
    expect(result.entries[0]!.appearance).not.toHaveProperty('notATrait');
    expect(result.entries[0]!.appearance!.hairStyle).toBe(2);
  });

  it('warns about a file from a newer game but still reads what it can', () => {
    const result = parseRoster(JSON.stringify({ format: 99, wrestlers: [{ name: 'From the future' }] }));
    expect(result.entries).toHaveLength(1);
    expect(result.problems[0]).toContain('newer version');
  });
});

describe('putting one in', () => {
  it('produces a complete wrestler from an entry with only a name', () => {
    const [base] = someWrestlers(1);
    // Straight through the parser, the way a real import goes — that is where
    // the mannequin bug lived, not in the merge.
    const parsed = parseRoster(JSON.stringify({ format: 1, wrestlers: [{ name: 'Just A Name' }] }));
    const merged = applyRosterEntry(base!, parsed.entries[0]!);
    expect(merged.name).toBe('Just A Name');
    // Everything else is whatever generation rolled, so they are a real
    // wrestler rather than a bland average of one.
    expect(merged.charisma).toBe(base!.charisma);
    expect(merged.strength).toBe(base!.strength);
    expect(merged.age).toBe(base!.age);
    expect(merged.gender).toBe(base!.gender);
    expect(merged.appearance).toEqual(base!.appearance);
  });

  it('lets the file override what it specifies', () => {
    const [base] = someWrestlers(1);
    const merged = applyRosterEntry(base!, { name: 'Custom', charisma: 91, age: 41, alignment: -80 });
    expect(merged.charisma).toBe(91);
    expect(merged.age).toBe(41);
    expect(merged.alignment).toBe(-80);
    // Crowd reaction follows alignment, or an imported heel gets cheered.
    expect(merged.crowdReaction).toBe(-80);
  });

  it('keeps the id it was generated with rather than anything a file claims', () => {
    const [base] = someWrestlers(1);
    const merged = applyRosterEntry(base!, { name: 'Impostor' } as never);
    expect(merged.id).toBe(base!.id);
  });

  it('merges a partial appearance over the generated one', () => {
    const [base] = someWrestlers(1);
    const merged = applyRosterEntry(base!, { name: 'Half A Look', appearance: { hairStyle: 3 } });
    expect(merged.appearance.hairStyle).toBe(3);
    // Untouched traits survive.
    expect(merged.appearance.skinTone).toBe(base!.appearance.skinTone);
  });
});
