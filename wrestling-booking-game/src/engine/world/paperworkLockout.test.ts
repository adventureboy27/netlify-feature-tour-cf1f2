import { describe, it, expect } from 'vitest';
import {
  eligibleForPaperworkLockout,
  rollPaperworkFreezes,
  paperworkLockoutStartLine,
  paperworkLockoutEndLine,
} from './paperworkLockout';
import { defaultWorldSettings } from './settings';
import { generateWrestlers } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

function roster(count: number, seed = 'paperwork'): Wrestler[] {
  return generateWrestlers(rngFromSeed(seed), count);
}

describe('eligibleForPaperworkLockout', () => {
  it('never fires before the week gate', () => {
    expect(eligibleForPaperworkLockout(settings.paperworkLockoutEarliestWeek - 1, false, settings)).toBe(false);
  });

  it('never re-fires while one is already running', () => {
    expect(eligibleForPaperworkLockout(settings.paperworkLockoutEarliestWeek, true, settings)).toBe(false);
  });

  it('fires once the gate clears and nothing is already running', () => {
    expect(eligibleForPaperworkLockout(settings.paperworkLockoutEarliestWeek, false, settings)).toBe(true);
  });
});

describe('rollPaperworkFreezes', () => {
  it('never freezes anybody at share 0', () => {
    const zero = { ...settings, paperworkLockoutFreezeShare: 0 };
    const candidates = roster(30);
    expect(rollPaperworkFreezes(rngFromSeed('none'), candidates, zero)).toHaveLength(0);
  });

  it('always freezes everybody at share 1', () => {
    const always = { ...settings, paperworkLockoutFreezeShare: 1 };
    const candidates = roster(30);
    expect(rollPaperworkFreezes(rngFromSeed('all'), candidates, always).sort()).toEqual(
      candidates.map((w) => w.id).sort(),
    );
  });

  it('lands roughly at the configured share over a real sample', () => {
    const candidates = roster(400);
    const frozen = rollPaperworkFreezes(rngFromSeed('sample'), candidates, settings);
    const share = frozen.length / candidates.length;
    expect(share).toBeGreaterThan(settings.paperworkLockoutFreezeShare - 0.1);
    expect(share).toBeLessThan(settings.paperworkLockoutFreezeShare + 0.1);
  });

  it('only ever returns ids that were actually in the candidate pool', () => {
    const candidates = roster(50);
    const ids = new Set(candidates.map((w) => w.id));
    const frozen = rollPaperworkFreezes(rngFromSeed('subset'), candidates, settings);
    for (const id of frozen) expect(ids.has(id)).toBe(true);
  });
});

describe('the wire lines', () => {
  it('say something real, both starting and ending', () => {
    expect(paperworkLockoutStartLine(20, 30, 6).length).toBeGreaterThan(20);
    expect(paperworkLockoutStartLine(20, 30, 6)).toContain('6');
    expect(paperworkLockoutEndLine().length).toBeGreaterThan(20);
  });
});
