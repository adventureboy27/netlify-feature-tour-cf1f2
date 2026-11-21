import { describe, it, expect } from 'vitest';
import {
  heatMultiplier,
  createRivalry,
  findRivalry,
  activeRivalriesFor,
  shootInjuryMultiplier,
  shootRatingBonus,
  shootMoraleCostPerWeek,
  heatFromMatch,
  applyHeatChange,
  decayRivalry,
  leanIntoShoot,
  heatLabel,
  shootLabel,
} from './rivalry';
import { stipulationById, stipulationRequirementsMet } from '../../data/stipulations';
import { defaultWorldSettings } from '../world/settings';
import type { Rivalry } from '../types';

const settings = defaultWorldSettings();

/**
 * The live grudge gate: a Flaming Tables match is the hardest thing on the
 * list to earn, and it is earned by crowd heat on the feud.
 */
function grudgeStipulationIsLegal(rivalryHeat: number): boolean {
  return stipulationRequirementsMet(stipulationById('flamingTables')!, {
    participants: [
      { popularity: 60, toughness: 60, charisma: 60, appearance: { mask: 1 } },
      { popularity: 60, toughness: 60, charisma: 60, appearance: { mask: 1 } },
    ] as never,
    rivalryHeat,
    matchTimeLimitMinutes: 20,
    // Flaming Tables is gear-gated now (data/matchProps.ts) — owning a
    // table here so this stays a test of the heat gate specifically.
    ownedGearUnits: 1,
  });
}

const worked = (over: Partial<Rivalry> = {}): Rivalry => ({
  ...createRivalry('r1', ['a', 'b'], 'worked', 1, 40),
  ...over,
});
const shoot = (over: Partial<Rivalry> = {}): Rivalry => ({
  ...createRivalry('r2', ['a', 'b'], 'shoot', 1, 60),
  ...over,
});

describe('heatMultiplier — heat is earned by reception, not by booking', () => {
  it('is exactly zero below the §12.5 floor', () => {
    expect(heatMultiplier(35)).toBe(0);
    expect(heatMultiplier(20)).toBe(0);
    expect(heatMultiplier(0)).toBe(0);
  });

  it('caps at 1.6', () => {
    expect(heatMultiplier(200)).toBe(1.6);
    expect(heatMultiplier(99)).toBe(1.6);
  });

  it('scales linearly between', () => {
    expect(heatMultiplier(55)).toBeCloseTo(0.5, 5);
    expect(heatMultiplier(75)).toBeCloseTo(1.0, 5);
  });

  it('means two jobbers cannot be booked into a main-event feud', () => {
    // Ten weeks of a 30-rated match between two nobodies.
    let rivalry = worked({ heat: 0 });
    for (let week = 2; week <= 11; week++) {
      const change = heatFromMatch(rivalry, {
        segmentRating: 30,
        finish: 'cleanPin',
        isDecisiveBlowoff: false,
        settings,
      });
      rivalry = applyHeatChange(rivalry, change, week);
    }
    expect(rivalry.heat).toBe(0);
    expect(grudgeStipulationIsLegal(rivalry.heat)).toBe(false);
  });

  it('lets two over talents build a real feud over a couple of months', () => {
    let rivalry = worked({ heat: 0 });
    for (let week = 2; week <= 11; week++) {
      const change = heatFromMatch(rivalry, {
        segmentRating: 78,
        finish: 'disqualification', // screwjob finishes build faster
        isDecisiveBlowoff: false,
        settings,
      });
      rivalry = applyHeatChange(rivalry, change, week);
    }
    // Asserted against the gate the game actually uses — `heatRequirement` on
    // the stipulation itself, checked by `stipulationRequirementsMet`. There
    // used to be a second, global threshold in rivalry.ts that nothing read.
    expect(grudgeStipulationIsLegal(rivalry.heat)).toBe(true);
  });
});

describe('worked vs shoot', () => {
  it('starts a worked feud with crowd heat and no bad blood', () => {
    const r = createRivalry('r', ['a', 'b'], 'worked', 1, 25);
    expect(r.heat).toBe(25);
    expect(r.shootHeat).toBe(0);
  });

  it('starts a shoot with bad blood the crowd knows nothing about', () => {
    const r = createRivalry('r', ['a', 'b'], 'shoot', 1, 60);
    expect(r.heat).toBe(0);
    expect(r.shootHeat).toBe(60);
  });

  it('makes a shoot the better match and the more dangerous one', () => {
    const sameCrowdHeat = 50;
    const clean = worked({ heat: sameCrowdHeat, shootHeat: 0 });
    const nasty = worked({ heat: sameCrowdHeat, shootHeat: 80 });

    // The crowd-heat half is identical, so the whole difference is the bad
    // blood — which is exactly the trap the system is built around.
    expect(shootRatingBonus(nasty, settings)).toBeGreaterThan(shootRatingBonus(clean, settings));
    expect(shootInjuryMultiplier(nasty, settings)).toBeGreaterThan(shootInjuryMultiplier(clean, settings));
    expect(shootMoraleCostPerWeek(nasty, settings)).toBeGreaterThan(shootMoraleCostPerWeek(clean, settings));
  });

  it('costs a purely worked feud nothing backstage', () => {
    const r = worked({ heat: 100, shootHeat: 0 });
    expect(shootInjuryMultiplier(r, settings)).toBe(1);
    expect(shootMoraleCostPerWeek(r, settings)).toBe(0);
  });

  it('pays nothing for a rivalry that has been resolved', () => {
    const done = worked({ heat: 90, resolvedWeek: 12 });
    expect(shootRatingBonus(done, settings)).toBe(0);
    expect(shootInjuryMultiplier(done, settings)).toBe(1);
    expect(shootMoraleCostPerWeek(done, settings)).toBe(0);
  });
});

describe('leanIntoShoot', () => {
  it('is the only way real animosity ever draws money', () => {
    const before = shoot({ shootHeat: 80, heat: 0 });
    const after = leanIntoShoot(before, settings);
    expect(after.heat).toBeGreaterThan(0);
  });

  it('makes the bad blood worse, not better', () => {
    const before = shoot({ shootHeat: 50, heat: 0 });
    const after = leanIntoShoot(before, settings);
    expect(after.shootHeat).toBeGreaterThan(before.shootHeat);
  });
});

describe('decay', () => {
  it('sheds crowd interest at §12.5\'s 3/week when not advanced', () => {
    const r = decayRivalry(worked({ heat: 50, lastAdvancedWeek: 1 }), 2, settings);
    expect(r.heat).toBe(50 - settings.rivalryHeatDecayPerWeek);
  });

  it('does not decay a rivalry advanced this week', () => {
    const r = worked({ heat: 50, lastAdvancedWeek: 5 });
    expect(decayRivalry(r, 5, settings).heat).toBe(50);
  });

  it('lets crowd heat evaporate while real animosity persists for a year', () => {
    let r = worked({ heat: 90, shootHeat: 90, lastAdvancedWeek: 0 });
    for (let week = 1; week <= 52; week++) r = decayRivalry(r, week, settings);
    expect(r.heat).toBe(0);
    expect(r.shootHeat).toBeGreaterThan(50);
  });

  it('never goes negative or leaves a resolved rivalry', () => {
    expect(decayRivalry(worked({ heat: 1, lastAdvancedWeek: 0 }), 9, settings).heat).toBe(0);
    const resolved = worked({ heat: 40, resolvedWeek: 3 });
    expect(decayRivalry(resolved, 10, settings)).toBe(resolved);
  });
});

describe('blowoff', () => {
  it('cashes crowd heat out into popularity for the winner and ends the feud', () => {
    const r = worked({ heat: 80 });
    const change = heatFromMatch(r, {
      segmentRating: 80,
      finish: 'cleanPin',
      isDecisiveBlowoff: true,
      settings,
    });
    expect(change.resolved).toBe(true);
    expect(change.blowoffPopularityGain).toBeCloseTo(80 * settings.rivalryBlowoffPopularityFactor, 5);

    const after = applyHeatChange(r, change, 20);
    expect(after.heat).toBe(0);
    expect(after.resolvedWeek).toBe(20);
  });

  it('pays out proportionally — a cold feud blows off for almost nothing', () => {
    const cold = heatFromMatch(worked({ heat: 10 }), {
      segmentRating: 80,
      finish: 'cleanPin',
      isDecisiveBlowoff: true,
      settings,
    });
    const hot = heatFromMatch(worked({ heat: 95 }), {
      segmentRating: 80,
      finish: 'cleanPin',
      isDecisiveBlowoff: true,
      settings,
    });
    expect(hot.blowoffPopularityGain).toBeGreaterThan(cold.blowoffPopularityGain * 5);
  });
});

describe('non-decisive finishes', () => {
  it('build more heat than a clean win — unfinished business sells the rematch', () => {
    const r = worked({ heat: 20 });
    const ctx = { segmentRating: 75, isDecisiveBlowoff: false, settings } as const;
    const clean = heatFromMatch(r, { ...ctx, finish: 'cleanPin' });
    const screwjob = heatFromMatch(r, { ...ctx, finish: 'disqualification' });
    expect(screwjob.heatDelta).toBeGreaterThan(clean.heatDelta);
  });
});

describe('lookup', () => {
  const rivalries = [
    createRivalry('r1', ['a', 'b'], 'worked', 1, 30),
    createRivalry('r2', ['c', 'd'], 'shoot', 1, 50),
    { ...createRivalry('r3', ['e', 'f'], 'worked', 1, 30), resolvedWeek: 4 },
  ];

  it('finds a rivalry regardless of the order the names come in', () => {
    expect(findRivalry(rivalries, ['b', 'a'])?.id).toBe('r1');
  });

  it('ignores resolved rivalries and partial matches', () => {
    expect(findRivalry(rivalries, ['e', 'f'])).toBeUndefined();
    expect(findRivalry(rivalries, ['a', 'c'])).toBeUndefined();
    expect(findRivalry(rivalries, ['a'])).toBeUndefined();
  });

  it('lists everything a wrestler is currently mixed up in', () => {
    expect(activeRivalriesFor(rivalries, ['a']).map((r) => r.id)).toEqual(['r1']);
    expect(activeRivalriesFor(rivalries, ['e']).map((r) => r.id)).toEqual([]);
  });
});

describe('labels — never a raw number', () => {
  it('walks the crowd-interest ladder', () => {
    expect(heatLabel(0)).toBe("Nobody's biting");
    expect(heatLabel(25)).toBe('A flicker of interest');
    expect(heatLabel(50)).toBe("They're starting to care");
    expect(heatLabel(75)).toBe('Real heat');
    expect(heatLabel(95)).toBe('White hot');
  });

  it('walks the backstage ladder', () => {
    expect(shootLabel(0)).toBe('Professional');
    expect(shootLabel(30)).toBe('Frosty');
    expect(shootLabel(60)).toBe('Bad blood');
    expect(shootLabel(90)).toBe('Somebody is getting hurt');
  });

  it('labels every value in range', () => {
    for (let heat = 0; heat <= 100; heat++) {
      expect(heatLabel(heat)).toBeTruthy();
      expect(shootLabel(heat)).toBeTruthy();
    }
  });
});
