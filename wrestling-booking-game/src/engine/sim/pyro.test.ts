import { describe, expect, it } from 'vitest';
import { rngFromSeed } from '../rng';
import { rollPyroBurn, type PyroWorker } from './pyro';
import { defaultWorldSettings } from '../world/settings';

const settings = defaultWorldSettings();
const workers: PyroWorker[] = [
  { id: 'w1', name: 'Solar Reid' },
  { id: 'w2', name: 'Baron Gaines' },
];

/** How often, across many shows, with pyro fired and this much equipment. */
function rate(pyroActive: boolean, equipmentInjuryReduction = 0, runs = 3000): number {
  let fires = 0;
  for (let i = 0; i < runs; i++) {
    if (rollPyroBurn(rngFromSeed(`pyro${i}`), workers, pyroActive, equipmentInjuryReduction, settings)) fires += 1;
  }
  return fires / runs;
}

describe('the entrance pyro', () => {
  it('never fires unless the show actually fired pyro', () => {
    expect(rate(false)).toBe(0);
  });

  it('never fires with nobody in the match', () => {
    expect(rollPyroBurn(rngFromSeed('empty'), [], true, 0, settings)).toBeNull();
  });

  it('fires sometimes when pyro is active, and is rare', () => {
    const r = rate(true);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(0.05);
  });

  it('better equipment makes it fire less often, without erasing it entirely', () => {
    const bare = rate(true, 0);
    const equipped = rate(true, 0.6);
    expect(equipped).toBeLessThan(bare);
    // Never fully switched off — see hardcode of "1 -" rather than a cap at 1.
    expect(equipped).toBeGreaterThan(0);
  });

  it('names who caught it and says what the crowd saw', () => {
    const found = Array.from({ length: 2000 }, (_, i) =>
      rollPyroBurn(rngFromSeed(`named${i}`), workers, true, 0, settings),
    ).find(Boolean);
    expect(found).toBeTruthy();
    expect(found!.text).toContain(found!.workerName);
    expect(found!.text).not.toMatch(/\{who\}/);
    expect(found!.ratingCost).toBe(settings.pyroBurnRatingCost);
  });

  it('leaves a real mark sometimes, and a scare the rest of the time', () => {
    const found = Array.from({ length: 3000 }, (_, i) =>
      rollPyroBurn(rngFromSeed(`hurt${i}`), workers, true, 0, settings),
    ).filter(Boolean);
    expect(found.length).toBeGreaterThan(0);
    const hurt = found.filter((b) => b!.hurtSomebody);
    expect(hurt.length).toBeGreaterThan(0);
    expect(hurt.length).toBeLessThan(found.length);
  });
});
