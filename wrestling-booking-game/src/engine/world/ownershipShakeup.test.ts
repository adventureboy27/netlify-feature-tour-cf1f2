import { describe, it, expect } from 'vitest';
import { pickShakeupReleases } from './ownershipShakeup';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';

const settings = defaultWorldSettings();

describe('picking who gets shed', () => {
  it('never picks more than the roster has', () => {
    const roster = ['a', 'b'];
    const picked = pickShakeupReleases(rngFromSeed('small'), roster, settings);
    expect(picked.length).toBeLessThanOrEqual(roster.length);
  });

  it('stays within the configured min and max', () => {
    const roster = Array.from({ length: 20 }, (_, i) => `w${i}`);
    for (let i = 0; i < 20; i++) {
      const picked = pickShakeupReleases(rngFromSeed(`roll-${i}`), roster, settings);
      expect(picked.length).toBeGreaterThanOrEqual(settings.shakeupReleaseMin);
      expect(picked.length).toBeLessThanOrEqual(settings.shakeupReleaseMax);
    }
  });

  it('never picks the same person twice', () => {
    const roster = Array.from({ length: 20 }, (_, i) => `w${i}`);
    const picked = pickShakeupReleases(rngFromSeed('unique'), roster, settings);
    expect(new Set(picked).size).toBe(picked.length);
  });

  it('is empty for an empty roster', () => {
    expect(pickShakeupReleases(rngFromSeed('empty'), [], settings)).toEqual([]);
  });
});
