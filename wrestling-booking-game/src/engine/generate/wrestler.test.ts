import { describe, expect, it } from 'vitest';
import { mulberry32, rngFromSeed } from '../rng';
import { generateWrestler, generateWrestlers } from './wrestler';
import { defaultWorldSettings } from '../world/settings';

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

describe('the division split', () => {
  // This was a hard 0.78 toward men, buried in `generateWrestler` where only
  // the player's own opening roster ever overrode it — so the whole business
  // came out 244 men to 56 women however `womensRosterShare` was tuned.
  const settings = defaultWorldSettings();

  it('reads the setting rather than a number of its own', () => {
    const mostlyWomen = generateWrestlers(rngFromSeed('w'), 200, {
      settings: { ...settings, womensRosterShare: 0.9 },
    });
    const women = mostlyWomen.filter((w) => w.gender === 'f').length;
    expect(women).toBeGreaterThan(mostlyWomen.length * 0.75);

    const mostlyMen = generateWrestlers(rngFromSeed('m'), 200, {
      settings: { ...settings, womensRosterShare: 0.1 },
    });
    expect(mostlyMen.filter((w) => w.gender === 'f').length).toBeLessThan(mostlyMen.length * 0.25);
  });

  it('comes out near even on the default, over a big enough population', () => {
    const everybody = generateWrestlers(rngFromSeed('all'), 400, { settings });
    const women = everybody.filter((w) => w.gender === 'f').length;
    expect(women).toBeGreaterThan(160);
    expect(women).toBeLessThan(240);
  });

  it('builds an exact split when asked, so a small roster is never lopsided', () => {
    // The reason `divisionShare` exists: rolled per head, a fourteen-person
    // roster produced a two-woman division in four seeds out of five.
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const roster = generateWrestlers(rngFromSeed(seed), 14, {
        settings,
        divisionShare: settings.womensRosterShare,
        divisionFloor: settings.womensDivisionFloor,
      });
      expect(roster.filter((w) => w.gender === 'f').length).toBe(7);
    }
  });

  it('still honours the floor for a company too small to halve', () => {
    const tiny = generateWrestlers(rngFromSeed('t'), 6, {
      settings,
      divisionShare: 0.1,
      divisionFloor: settings.womensDivisionFloor,
    });
    expect(tiny.filter((w) => w.gender === 'f').length).toBeGreaterThanOrEqual(3);
  });
});
