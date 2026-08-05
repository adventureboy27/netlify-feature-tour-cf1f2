import { describe, it, expect } from 'vitest';
import { workingPopulation, graduateCount, graduateClass } from './academy';
import { defaultWorldSettings } from '../world/settings';
import { rngFromSeed } from '../rng';
import { generateWrestlers } from '../generate/wrestler';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

function population(count: number, overrides: Partial<Wrestler> = {}): Wrestler[] {
  return generateWrestlers(rngFromSeed('academy'), count, { currentYear: 2000 }).map((w) => ({ ...w, ...overrides }));
}

describe('who counts as working', () => {
  it('leaves out the retired and the dead', () => {
    const people = [
      ...population(5),
      ...population(3, { careerStatus: 'retired' }),
      ...population(2, { deceased: { wrestlerId: 'x', cause: 'age', age: 80, week: 1 } }),
    ];
    expect(workingPopulation(people)).toBe(5);
  });
});

describe('the intake', () => {
  it('shuts the doors when the business is full', () => {
    const rng = rngFromSeed('full');
    for (let i = 0; i < 20; i++) {
      expect(graduateCount(rng, settings.worldPopulationMax + 5, settings)).toBe(0);
    }
  });

  it('opens them when it is short', () => {
    const rng = rngFromSeed('short');
    const counts = Array.from({ length: 10 }, () => graduateCount(rng, settings.worldPopulationMin - 8, settings));
    expect(counts.every((c) => c > 0)).toBe(true);
    expect(Math.max(...counts)).toBeLessThanOrEqual(settings.academyMaxGraduates);
  });

  it('lets the population wander rather than pinning it', () => {
    const rng = rngFromSeed('middle');
    const inside = Math.round((settings.worldPopulationMin + settings.worldPopulationMax) / 2);
    const counts = Array.from({ length: 30 }, () => graduateCount(rng, inside, settings));
    expect(counts.some((c) => c === 0)).toBe(true);
    expect(counts.some((c) => c > 0)).toBe(true);
  });
});

describe('a graduating class', () => {
  it('comes out young, unsigned and with no record', () => {
    const { wrestlers, freeAgents } = graduateClass(rngFromSeed('class'), 3, 2000, settings);
    expect(wrestlers).toHaveLength(3);
    expect(freeAgents).toHaveLength(3);
    for (const w of wrestlers) {
      expect(w.age).toBeGreaterThanOrEqual(settings.academyDebutAgeMin);
      expect(w.age).toBeLessThanOrEqual(settings.academyDebutAgeMax);
      expect(w.debutYear).toBe(2000);
      expect(w.careerStatus).toBe('rookie');
      expect(w.contract).toBeNull();
      expect(w.titleReigns).toHaveLength(0);
      expect(w.record).toEqual({ wins: 0, losses: 0, draws: 0 });
    }
    expect(freeAgents.every((a) => a.reason === 'schoolGraduate')).toBe(true);
  });

  it('produces nothing when nobody graduates', () => {
    expect(graduateClass(rngFromSeed('none'), 0, 2000, settings).wrestlers).toHaveLength(0);
  });
});
