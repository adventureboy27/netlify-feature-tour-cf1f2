import { describe, it, expect } from 'vitest';
import {
  retirementPressure,
  rollRetirement,
  retire,
  rollComeback,
  unfinishedBusiness,
  unretire,
} from './retirement';
import { annualDeathChance, rollDeath } from './mortality';
import { defaultWorldSettings } from '../world/settings';
import { rngFromSeed } from '../rng';
import { generateWrestlers } from '../generate/wrestler';
import { createRivalry } from '../sim/rivalry';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();
const ctx = { currentYear: 2000, settings };

function someone(overrides: Partial<Wrestler> = {}): Wrestler {
  const [w] = generateWrestlers(rngFromSeed('retire-fixture'), 1, { currentYear: 2000 });
  return Object.assign(w!, {
    age: 30,
    debutYear: 1985,
    health: 90,
    popularity: 55,
    careerHighPopularity: 60,
    injury: null,
    careerStatus: 'midcarder' as const,
    ...overrides,
  });
}

describe('wanting out', () => {
  it('leaves a healthy thirty-year-old alone', () => {
    expect(retirementPressure(someone(), ctx)).toBeLessThan(0.2);
  });

  it('builds with age', () => {
    const younger = retirementPressure(someone({ age: 40 }), ctx);
    const older = retirementPressure(someone({ age: 50 }), ctx);
    expect(older).toBeGreaterThan(younger);
  });

  it('takes a wrecked body seriously at any age', () => {
    const broken = retirementPressure(someone({ age: 33, health: 20 }), ctx);
    expect(broken).toBeGreaterThan(retirementPressure(someone({ age: 33 }), ctx));
  });

  it('treats a career-threatening injury as its own reason to stop', () => {
    const hurt = someone({
      age: 32,
      injury: {
        severity: 'careerThreatening',
        description: 'Neck',
        sufferedWeek: 1,
        totalWeeks: 60,
        weeksRemaining: 52,
        permanentStatLoss: {},
        earlyReturnWeeksUsed: 0,
      },
    });
    expect(retirementPressure(hurt, ctx)).toBeGreaterThan(retirementPressure(someone({ age: 32 }), ctx));
  });

  it('keeps somebody who is still drawing in the business longer', () => {
    const drawing = retirementPressure(someone({ age: 45, popularity: 90, careerHighPopularity: 92 }), ctx);
    const finished = retirementPressure(someone({ age: 45, popularity: 25, careerHighPopularity: 92 }), ctx);
    expect(drawing).toBeLessThan(finished);
  });

  it('does not let a rookie retire', () => {
    const rookie = someone({ age: 24, debutYear: 1999, health: 10 });
    const call = rollRetirement(rngFromSeed('rookie'), rookie, ctx);
    expect(call.retiring).toBe(false);
  });

  it('is not a roll at all past the hard age', () => {
    expect(rollRetirement(rngFromSeed('old'), someone({ age: 56 }), ctx).retiring).toBe(true);
  });

  it('takes their contract with them', () => {
    const w = someone();
    w.promotionId = 'player-promotion';
    retire(w);
    expect(w.careerStatus).toBe('retired');
    expect(w.contract).toBeNull();
    expect(w.promotionId).toBeNull();
  });
});

describe('coming back', () => {
  it('needs a real score, not a worked one', () => {
    const w = someone({ careerStatus: 'retired', age: 45 });
    const worked = createRivalry('r1', [w.id, 'other'], 'worked', 1, 90);
    expect(
      unfinishedBusiness(w, { currentYear: 2000, rivalries: [worked], settings }),
    ).toBeNull();

    const shoot = { ...worked, shootHeat: 80 };
    expect(unfinishedBusiness(w, { currentYear: 2000, rivalries: [shoot], settings })?.id).toBe('r1');
  });

  it('brings people back far more often when there is a score', () => {
    const rng = rngFromSeed('comeback');
    const w = someone({ careerStatus: 'retired', age: 45 });
    const shoot = { ...createRivalry('r1', [w.id, 'other'], 'shoot', 1, 60), shootHeat: 95 };

    let withScore = 0;
    let without = 0;
    for (let i = 0; i < 200; i++) {
      if (rollComeback(rng, w, { currentYear: 2000, rivalries: [shoot], settings }).returning) withScore++;
      if (rollComeback(rng, w, { currentYear: 2000, rivalries: [], settings }).returning) without++;
    }
    expect(withScore).toBeGreaterThan(without * 3);
  });

  it('leaves the very old retired', () => {
    const w = someone({ careerStatus: 'retired', age: 70 });
    const shoot = { ...createRivalry('r1', [w.id, 'other'], 'shoot', 1, 60), shootHeat: 100 };
    expect(rollComeback(rngFromSeed('x'), w, { currentYear: 2000, rivalries: [shoot], settings }).returning).toBe(false);
  });

  it('never returns somebody who never retired', () => {
    expect(rollComeback(rngFromSeed('y'), someone(), { currentYear: 2000, rivalries: [], settings }).returning).toBe(
      false,
    );
  });

  it('brings them back in one piece, but not as they were', () => {
    const w = someone({ careerStatus: 'retired', health: 30, momentum: 0 });
    unretire(w, settings);
    expect(w.careerStatus).toBe('veteran');
    expect(w.health).toBeGreaterThanOrEqual(settings.comebackStartingHealth);
    expect(w.momentum).toBeGreaterThan(0);
  });
});

describe('mortality', () => {
  it('is negligible for somebody in their working years', () => {
    expect(annualDeathChance(someone({ age: 30 }), settings)).toBeLessThan(0.002);
  });

  it('climbs steeply with age', () => {
    const at50 = annualDeathChance(someone({ age: 50 }), settings);
    const at80 = annualDeathChance(someone({ age: 80 }), settings);
    expect(at80).toBeGreaterThan(at50 * 4);
  });

  it('is worse for a body that has been through it', () => {
    expect(annualDeathChance(someone({ age: 55, health: 15 }), settings)).toBeGreaterThan(
      annualDeathChance(someone({ age: 55, health: 95 }), settings),
    );
  });

  it('can be switched off entirely', () => {
    expect(annualDeathChance(someone({ age: 90 }), { ...settings, deathsEnabled: false })).toBe(0);
  });

  it('records who, when, and how old', () => {
    // Forced: a certainty rather than a wait for the dice.
    const certain = { ...settings, deathBaseChance: 1, deathChanceCap: 1 };
    const w = someone({ age: 81 });
    const passing = rollDeath(rngFromSeed('passing'), w, 520, certain);
    expect(passing).toMatchObject({ wrestlerId: w.id, age: 81, week: 520 });
    expect(passing!.cause).toBe('age');
  });
});
