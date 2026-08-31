import { describe, it, expect } from 'vitest';
import { nostalgicSigningWeight } from './nostalgia';
import { defaultWorldSettings } from './settings';
import { generateWrestler } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

function person(seed: string, over: Partial<Wrestler> = {}): Wrestler {
  const base = generateWrestler(rngFromSeed(seed), new Set(), { currentYear: 2030 });
  return { ...base, role: 'wrestler', age: 30, careerHighPopularity: base.popularity, ...over };
}

describe('nostalgicSigningWeight', () => {
  it('is always positive, even for a rookie who never had a career high above where they are now', () => {
    const rookie = person('rookie', { popularity: 20, careerHighPopularity: 20, age: 22 });
    expect(nostalgicSigningWeight(rookie, settings)).toBeGreaterThan(0);
  });

  it('scores a faded former star well above a same-age wrestler who was never bigger', () => {
    const fadedStar = person('faded', { popularity: 25, careerHighPopularity: 85, age: 40 });
    const neverPeaked = person('plain', { popularity: 25, careerHighPopularity: 25, age: 40 });
    expect(nostalgicSigningWeight(fadedStar, settings)).toBeGreaterThan(nostalgicSigningWeight(neverPeaked, settings));
  });

  it('scores an older wrestler above an identical younger one', () => {
    const older = person('older', { popularity: 40, careerHighPopularity: 40, age: 45 });
    const younger = person('younger', { popularity: 40, careerHighPopularity: 40, age: 24 });
    expect(nostalgicSigningWeight(older, settings)).toBeGreaterThan(nostalgicSigningWeight(younger, settings));
  });

  it('scores a deeper fade higher than a shallow one off the same peak', () => {
    const deepFade = person('deep', { popularity: 15, careerHighPopularity: 90, age: 40 });
    const shallowFade = person('shallow', { popularity: 75, careerHighPopularity: 90, age: 40 });
    expect(nostalgicSigningWeight(deepFade, settings)).toBeGreaterThan(nostalgicSigningWeight(shallowFade, settings));
  });

  it('never lets a below-floor age pull the weight down — it is a floor, not a penalty', () => {
    const young = person('young', { popularity: 30, careerHighPopularity: 30, age: 18 });
    // Well below nostalgicAgeFloor — should score the same as sitting exactly on it.
    const onFloor = person('onFloor', { popularity: 30, careerHighPopularity: 30, age: settings.nostalgicAgeFloor });
    expect(nostalgicSigningWeight(young, settings)).toBe(nostalgicSigningWeight(onFloor, settings));
  });
});
