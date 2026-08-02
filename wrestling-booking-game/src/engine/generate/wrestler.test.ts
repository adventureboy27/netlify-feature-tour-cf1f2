import { describe, expect, it } from 'vitest';
import { mulberry32, rngFromSeed } from '../rng';
import { generateWrestler, generateWrestlers } from './wrestler';

const STAT_KEYS = ['strength', 'skill', 'agility', 'stamina', 'popularity', 'attitude', 'charisma', 'coachability', 'toughness', 'talent'] as const;

describe('generateWrestler', () => {
  it('keeps every core stat within 5-99', () => {
    const rng = mulberry32(1);
    const existing = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const w = generateWrestler(rng, existing);
      for (const key of STAT_KEYS) {
        const value = w[key];
        expect(value).toBeGreaterThanOrEqual(5);
        expect(value).toBeLessThanOrEqual(99);
      }
      expect(w.age).toBeGreaterThanOrEqual(19);
      expect(w.age).toBeLessThanOrEqual(52);
    }
  });

  it('assigns a unique id to every wrestler', () => {
    const rng = mulberry32(2);
    const existing = new Set<string>();
    const ids = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const w = generateWrestler(rng, existing);
      expect(ids.has(w.id)).toBe(false);
      ids.add(w.id);
    }
  });

  it('never reuses a name across calls sharing the existingNames set', () => {
    const rng = mulberry32(3);
    const existing = new Set<string>();
    const names = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const w = generateWrestler(rng, existing);
      const key = w.name.toLowerCase();
      expect(names.has(key)).toBe(false);
      names.add(key);
    }
  });

  it('keeps alignment consistent with crowdReaction at generation time', () => {
    const rng = mulberry32(4);
    const existing = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const w = generateWrestler(rng, existing);
      expect(w.crowdReaction).toBe(w.alignment);
    }
  });

  it('produces a gimmick compatible with the rolled alignment', () => {
    const rng = mulberry32(5);
    const existing = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const w = generateWrestler(rng, existing);
      if (w.alignment >= 15) expect(w.gimmick.alignmentLean).not.toBe('heel');
      if (w.alignment <= -15) expect(w.gimmick.alignmentLean).not.toBe('face');
    }
  });

  it('gives every wrestler a finisher and 2-4 signatures', () => {
    const rng = mulberry32(6);
    const existing = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const w = generateWrestler(rng, existing);
      expect(w.moveSet.finisher.name.length).toBeGreaterThan(0);
      expect(w.moveSet.signatures.length).toBeGreaterThanOrEqual(2);
      expect(w.moveSet.signatures.length).toBeLessThanOrEqual(4);
    }
  });
});

describe('generateWrestlers', () => {
  it('generates the requested count with no duplicate ids or names', () => {
    const rng = rngFromSeed('test-seed');
    const roster = generateWrestlers(rng, 300);
    expect(roster).toHaveLength(300);
    expect(new Set(roster.map((w) => w.id)).size).toBe(300);
    expect(new Set(roster.map((w) => w.name.toLowerCase())).size).toBe(300);
  });

  it('is deterministic for a given seed', () => {
    const rosterA = generateWrestlers(rngFromSeed('determinism-check'), 50);
    const rosterB = generateWrestlers(rngFromSeed('determinism-check'), 50);
    expect(rosterA.map((w) => w.name)).toEqual(rosterB.map((w) => w.name));
    expect(rosterA.map((w) => w.popularity)).toEqual(rosterB.map((w) => w.popularity));
  });
});
