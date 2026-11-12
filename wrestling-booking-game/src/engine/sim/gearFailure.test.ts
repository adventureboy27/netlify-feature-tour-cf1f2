import { describe, expect, it } from 'vitest';
import { rngFromSeed } from '../rng';
import { rollGearFailure, type GearUnitInPlay } from './gearFailure';

describe('naming which unit gave out', () => {
  it('never fires on empty input', () => {
    expect(rollGearFailure(rngFromSeed('empty'), [])).toBeNull();
  });

  it('always names one of the units in play', () => {
    const units: GearUnitInPlay[] = [
      { id: 'u1', name: 'Wooden Ladder', condition: 50 },
      { id: 'u2', name: 'Aluminum Ladder', condition: 50 },
    ];
    const result = rollGearFailure(rngFromSeed('name'), units);
    expect(result).not.toBeNull();
    expect(['u1', 'u2']).toContain(result!.unitId);
  });

  it('the text says what happened and names the unit', () => {
    const units: GearUnitInPlay[] = [{ id: 'u1', name: 'Wooden Ladder', condition: 10 }];
    const result = rollGearFailure(rngFromSeed('text'), units);
    expect(result!.text.toLowerCase()).toContain('wooden ladder');
    expect(result!.text.length).toBeGreaterThan(0);
  });

  it('is weighted toward whichever unit was worn worst', () => {
    const units: GearUnitInPlay[] = [
      { id: 'good', name: 'Pro-Spec Ladder', condition: 95 },
      { id: 'bad', name: 'Wooden Ladder', condition: 5 },
    ];
    const counts = { good: 0, bad: 0 };
    for (let i = 0; i < 2000; i++) {
      const result = rollGearFailure(rngFromSeed(`weighted${i}`), units);
      if (result?.unitId === 'good') counts.good += 1;
      if (result?.unitId === 'bad') counts.bad += 1;
    }
    expect(counts.bad).toBeGreaterThan(counts.good);
  });

  it('a single unit is always named', () => {
    const units: GearUnitInPlay[] = [{ id: 'only', name: 'Rented Panels', condition: 40 }];
    const result = rollGearFailure(rngFromSeed('solo'), units);
    expect(result!.unitId).toBe('only');
  });
});
