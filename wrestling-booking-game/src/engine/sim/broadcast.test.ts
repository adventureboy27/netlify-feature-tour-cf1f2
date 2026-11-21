import { describe, expect, it } from 'vitest';
import { rngFromSeed } from '../rng';
import { rollBroadcastDropout, broadcastDropoutLine } from './broadcast';
import { defaultWorldSettings } from '../world/settings';

const settings = defaultWorldSettings();

/** How often, across many shows, with this many eligible match slots. */
function rate(eligibleSlots: number[], equipmentInjuryReduction = 0, runs = 3000): number {
  let drops = 0;
  for (let i = 0; i < runs; i++) {
    if (rollBroadcastDropout(rngFromSeed(`show${i}`), eligibleSlots, equipmentInjuryReduction, settings) !== null) {
      drops += 1;
    }
  }
  return drops / runs;
}

describe('the broadcast', () => {
  it('never drops with nothing on the card to drop', () => {
    expect(rate([])).toBe(0);
  });

  it('drops sometimes, and is rare rather than routine', () => {
    const r = rate([0, 1, 2, 3]);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(0.15);
  });

  it('better production gear cuts the rate, without ever erasing it', () => {
    const bare = rate([0, 1, 2, 3], 0);
    const equipped = rate([0, 1, 2, 3], 0.6);
    expect(equipped).toBeLessThan(bare);
    expect(equipped).toBeGreaterThan(0);
  });

  it('only ever picks a slot that was actually eligible', () => {
    const eligible = [1, 3, 5];
    for (let i = 0; i < 2000; i++) {
      const slot = rollBroadcastDropout(rngFromSeed(`pick${i}`), eligible, 0, settings);
      if (slot !== null) expect(eligible).toContain(slot);
    }
  });

  it('says which match it happened in, with no leftover placeholder', () => {
    const line = broadcastDropoutLine(rngFromSeed('line'), 'Solar Reid and Baron Gaines');
    expect(line).toContain('Solar Reid and Baron Gaines');
    expect(line).not.toMatch(/\{match\}/);
    expect(line.length).toBeGreaterThan(15);
  });

  it('varies its line across shows', () => {
    const lines = new Set<string>();
    for (let i = 0; i < 30; i++) lines.add(broadcastDropoutLine(rngFromSeed(`vary${i}`), 'a match'));
    expect(lines.size).toBeGreaterThan(1);
  });
});
