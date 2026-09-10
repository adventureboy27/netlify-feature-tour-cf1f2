import { describe, it, expect } from 'vitest';
import { truckBreakdownFrom, resolveTruckCall } from './truckBreakdown';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';

const settings = defaultWorldSettings();

describe('whether the truck breaks down at all', () => {
  it('almost never raises the call at the default rare chance', () => {
    let raised = 0;
    for (let i = 0; i < 200; i++) {
      if (truckBreakdownFrom(rngFromSeed(`week-${i}`), i, 'town-1', 'Mill Valley', settings)) raised++;
    }
    expect(raised).toBeGreaterThan(0);
    expect(raised).toBeLessThan(30);
  });

  it('never raises the call when the chance is zero', () => {
    const zero = { ...settings, truckBreakdownChancePerWeek: 0 };
    for (let i = 0; i < 30; i++) {
      expect(truckBreakdownFrom(rngFromSeed(`never-${i}`), i, 'town-1', 'Mill Valley', zero)).toBeNull();
    }
  });

  it('carries the town name into the warning', () => {
    const always = { ...settings, truckBreakdownChancePerWeek: 1 };
    const call = truckBreakdownFrom(rngFromSeed('text'), 10, 'town-1', 'Mill Valley', always);
    expect(call!.warning).toContain('Mill Valley');
  });
});

describe('what the call cost', () => {
  const baseCall = {
    week: 10,
    territoryId: 'town-1',
    territoryName: 'Mill Valley',
    warning: 'test warning',
  };

  it('calling it off never runs the show, and costs morale and merch', () => {
    const outcome = resolveTruckCall(baseCall, 'cancelShow', rngFromSeed('safe'), settings);
    expect(outcome.ran).toBe(false);
    expect(outcome.moraleDelta).toBeLessThan(0);
    expect(outcome.merchShare).toBeLessThan(1);
    expect(outcome.injuryMultiplier).toBe(1);
  });

  it('holding it on the arena floor always runs the show, with real extra injury danger', () => {
    const outcome = resolveTruckCall(baseCall, 'arenaFloor', rngFromSeed('nuclear'), settings);
    expect(outcome.ran).toBe(true);
    expect(outcome.injuryMultiplier).toBeGreaterThan(1);
  });

  it('the rating swing on the arena floor can land either direction', () => {
    const swings = new Set<boolean>();
    for (let i = 0; i < 30; i++) {
      const outcome = resolveTruckCall(baseCall, 'arenaFloor', rngFromSeed(`swing-${i}`), settings);
      swings.add(outcome.ratingSwing >= 0);
    }
    expect(swings.has(true)).toBe(true);
    expect(swings.has(false)).toBe(true);
  });

  it('every outcome carries a real line for the wire', () => {
    expect(resolveTruckCall(baseCall, 'cancelShow', rngFromSeed('l1'), settings).line.length).toBeGreaterThan(0);
    expect(resolveTruckCall(baseCall, 'arenaFloor', rngFromSeed('l2'), settings).line.length).toBeGreaterThan(0);
  });
});
