
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rng';
import { generateName } from './name';
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
