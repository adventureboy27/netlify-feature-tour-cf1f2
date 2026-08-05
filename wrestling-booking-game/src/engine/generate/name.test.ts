
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rng';
import { generateName, isTooSimilar, normalizeName, editDistance } from './name';
import { rollDebutAge, MINIMUM_DEBUT_AGE } from './wrestler';
import { isBlockedName } from '../../data/blocklist';
import { FEMININE_FIRST_NAMES, MASCULINE_FIRST_NAMES, NAME_TITLES } from '../../data/names';

describe('generateName', () => {
  it('never returns a blocklisted name', () => {
    const rng = mulberry32(1);
    const existing = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const name = generateName(rng, existing);
      existing.add(name.toLowerCase());
      expect(isBlockedName(name)).toBe(false);
    }
  });

  it('never repeats a name already in the existing set', () => {
    const rng = mulberry32(2);
    const existing = new Set<string>();
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const name = generateName(rng, existing);
      const key = name.toLowerCase();
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      existing.add(key);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = generateName(mulberry32(123), new Set());
    const b = generateName(mulberry32(123), new Set());
    expect(a).toBe(b);
  });
});

describe('names follow the person', () => {
  it('draws a woman’s ring name from the feminine pool', () => {
    const rng = mulberry32(99);
    const used = new Set<string>();
    let matched = 0;
    let twoPart = 0;

    for (let i = 0; i < 200; i++) {
      const name = generateName(rng, used, 'f');
      used.add(name.trim().toLowerCase());
      const first = name.split(/\s+/)[0]!;
      // Epithet names ("Wreckage") have no first name to check.
      if (!name.includes(' ')) continue;
      twoPart++;
      if (FEMININE_FIRST_NAMES.includes(first) || NAME_TITLES.includes(first)) matched++;
    }

    expect(twoPart).toBeGreaterThan(20);
    expect(matched / twoPart).toBeGreaterThan(0.6);
  });

  it('keeps the two pools apart', () => {
    const rng = mulberry32(1234);
    const used = new Set<string>();
    const feminineOnly = FEMININE_FIRST_NAMES.filter((n) => !MASCULINE_FIRST_NAMES.includes(n));

    let leaked = 0;
    for (let i = 0; i < 200; i++) {
      const name = generateName(rng, used, 'm');
      used.add(name.trim().toLowerCase());
      if (feminineOnly.includes(name.split(/\s+/)[0]!)) leaked++;
    }
    expect(leaked).toBe(0);
  });
});

describe('names that are merely similar', () => {
  it('rejects a shared surname — two Quinteros read as brothers', () => {
    expect(isTooSimilar('Tamsin Quintero', new Set(['briar quintero']))).toBe(true);
  });

  it('rejects a typo away from an existing name', () => {
    expect(isTooSimilar('Blackoutt', new Set(['blackout']))).toBe(true);
    expect(isTooSimilar('Wreckage', new Set(['wreckage']))).toBe(true);
  });

  it('rejects a one-word name buried inside a two-word one', () => {
    expect(isTooSimilar('Wreckage Jones', new Set(['wreckage']))).toBe(true);
    expect(isTooSimilar('Wreckage', new Set(['wreckage jones']))).toBe(true);
  });

  it('ignores "the" and punctuation when comparing', () => {
    expect(normalizeName('The Enforcer')).toBe('enforcer');
    expect(isTooSimilar('The Enforcer', new Set(['enforcer']))).toBe(true);
  });

  it('allows two genuinely different names', () => {
    expect(isTooSimilar('Briar Quintero', new Set(['hollis jencks', 'zane frost']))).toBe(false);
  });

  it('allows a shared first name when the surnames differ', () => {
    expect(isTooSimilar('Briar Quintero', new Set(['briar hollis']))).toBe(false);
  });

  it('caps the edit distance work instead of measuring precisely', () => {
    expect(editDistance('abc', 'abc', 2)).toBe(0);
    expect(editDistance('abc', 'abd', 2)).toBe(1);
    expect(editDistance('abc', 'xyzabc', 2)).toBeGreaterThan(2);
  });

  it('never generates a similar name when there is room not to', () => {
    const rng = mulberry32(7);
    const used = new Set<string>();
    for (let i = 0; i < 120; i++) {
      const name = generateName(rng, used, i % 4 === 0 ? 'f' : 'm');
      expect(isTooSimilar(name, used)).toBe(false);
      used.add(name.trim().toLowerCase());
    }
  });
});

describe('when somebody started', () => {
  it('never puts anybody in the ring before eighteen', () => {
    const rng = mulberry32(21);
    for (let i = 0; i < 500; i++) {
      expect(rollDebutAge(rng, 40)).toBeGreaterThanOrEqual(MINIMUM_DEBUT_AGE);
    }
  });

  it('starts most people young but keeps real late starters', () => {
    const rng = mulberry32(22);
    const ages = Array.from({ length: 2000 }, () => rollDebutAge(rng, 45));
    const young = ages.filter((a) => a <= 24).length / ages.length;
    const late = ages.filter((a) => a >= 25).length / ages.length;

    expect(young).toBeGreaterThan(0.6);
    expect(late).toBeGreaterThan(0.1);
    expect(Math.max(...ages)).toBeGreaterThan(30);
  });

  it('never debuts somebody after the age they are now', () => {
    const rng = mulberry32(23);
    for (let i = 0; i < 200; i++) {
      const age = 19;
      expect(rollDebutAge(rng, age)).toBeLessThanOrEqual(age);
    }
  });
});
