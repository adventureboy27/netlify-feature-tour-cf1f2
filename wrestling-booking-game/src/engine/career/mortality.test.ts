import { describe, it, expect } from 'vitest';
import { annualDeathChance, rollDeath, DEATH_CAUSE_TEXT } from './mortality';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestler } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

function person(over: Partial<Wrestler> = {}): Wrestler {
  return { ...generateWrestler(rngFromSeed('m'), new Set()), health: 100, ...over };
}

describe('the age curve', () => {
  it('makes the young far safer than the middle-aged', () => {
    // The bug this replaced: the exponent was clamped at zero below the base
    // age, so a twenty-year-old died at exactly a forty-four-year-old's rate
    // and a long save put a steady stream of kids on the memorial wall.
    expect(annualDeathChance(person({ age: 22 }), settings)).toBeLessThan(
      annualDeathChance(person({ age: 44 }), settings) / 2,
    );
  });

  it('climbs the whole way up, with no flat stretch', () => {
    const ages = [20, 30, 40, 50, 60, 70, 80];
    const odds = ages.map((age) => annualDeathChance(person({ age }), settings));
    for (let i = 1; i < odds.length; i++) {
      expect(odds[i]!).toBeGreaterThan(odds[i - 1]!);
    }
  });

  it('still lets an accident take somebody young', () => {
    // Rare, but never zero — a floor rather than a wall.
    expect(annualDeathChance(person({ age: 19 }), settings)).toBeGreaterThan(0);
    expect(annualDeathChance(person({ age: 19 }), settings)).toBeGreaterThanOrEqual(settings.deathYoungFloor);
  });

  it('keeps a young death genuinely rare across a full roster and a decade', () => {
    // Forty wrestlers in their twenties, ten years. This should be an event,
    // not a feature of every save.
    const odds = annualDeathChance(person({ age: 25 }), settings);
    expect(odds * 40 * 10).toBeLessThan(1.5);
  });

  it('doubles roughly on the settings clock past the base age', () => {
    const base = annualDeathChance(person({ age: settings.deathBaseAge }), settings);
    const doubled = annualDeathChance(
      person({ age: settings.deathBaseAge + settings.deathAgeDoubling }),
      settings,
    );
    expect(doubled / base).toBeCloseTo(2, 1);
  });

  it('makes a wrecked body worse at any age', () => {
    expect(annualDeathChance(person({ age: 55, health: 20 }), settings)).toBeGreaterThan(
      annualDeathChance(person({ age: 55, health: 100 }), settings),
    );
  });

  it('never becomes a certainty, however old and broken', () => {
    expect(annualDeathChance(person({ age: 105, health: 0 }), settings)).toBeLessThanOrEqual(
      settings.deathChanceCap,
    );
  });

  it('is off entirely when the world says so', () => {
    expect(annualDeathChance(person({ age: 90 }), { ...settings, deathsEnabled: false })).toBe(0);
  });
});

describe('what it says', () => {
  it('gives every cause a sentence rather than a bare token', () => {
    // The write-up said "died at 25. accident" until this map was actually
    // used — the rule is that it says how it happened.
    for (const text of Object.values(DEATH_CAUSE_TEXT)) {
      expect(text.length).toBeGreaterThan(8);
      expect(text).not.toMatch(/^[a-z]+$/);
    }
  });

  it('takes the old peacefully and can take the young in an accident', () => {
    const rng = rngFromSeed('cause');
    const causes = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const passing = rollDeath(rng, person({ age: 30, health: 90 }), 10, { ...settings, deathBaseChance: 1 });
      if (passing) causes.add(passing.cause);
    }
    expect(causes.size).toBeGreaterThan(1);

    // The cap means one roll is not a certainty even at a hundred, so keep
    // asking until it lands.
    let old = null;
    for (let i = 0; i < 200 && !old; i++) {
      old = rollDeath(rng, person({ age: settings.deathOldAge + 5 }), 10, { ...settings, deathBaseChance: 1 });
    }
    expect(old?.cause).toBe('age');
  });
});
