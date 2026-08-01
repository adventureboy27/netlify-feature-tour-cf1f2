import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rng';
import { generateName } from './name';
import { isBlockedName } from '../../data/blocklist';

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
