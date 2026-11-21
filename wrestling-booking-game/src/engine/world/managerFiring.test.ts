import { describe, it, expect } from 'vitest';
import { isClientInitiated, wouldEscalate, firingRivalryLine } from './managerFiring';
import { defaultWorldSettings } from '../world/settings';
import { rngFromSeed } from '../rng';
import type { SplitReason } from '../career/representation';

const settings = defaultWorldSettings();

describe('only a client walking out on his own man reads as personal', () => {
  it('is true for the two client-initiated reasons', () => {
    expect(isClientInitiated('notWorthTheCut')).toBe(true);
    expect(isClientInitiated('outgrewHim')).toBe(true);
  });

  it('is false for the two manager-initiated reasons', () => {
    expect(isClientInitiated('droppedForTheBook')).toBe(false);
    expect(isClientInitiated('notEarningEnough')).toBe(false);
  });

  it('never escalates a manager-initiated drop, however the dice land', () => {
    for (const reason of ['droppedForTheBook', 'notEarningEnough'] as SplitReason[]) {
      for (let i = 0; i < 20; i++) {
        expect(wouldEscalate(rngFromSeed(`t:${reason}:${i}`), reason, { ...settings, managerFiringRivalryChance: 1 })).toBe(
          false,
        );
      }
    }
  });

  it('always escalates a client-initiated split when the chance is 1', () => {
    for (const reason of ['notWorthTheCut', 'outgrewHim'] as SplitReason[]) {
      expect(wouldEscalate(rngFromSeed(`t:${reason}`), reason, { ...settings, managerFiringRivalryChance: 1 })).toBe(
        true,
      );
    }
  });

  it('never escalates when the chance is 0', () => {
    for (let i = 0; i < 20; i++) {
      expect(
        wouldEscalate(rngFromSeed(`z:${i}`), 'notWorthTheCut', { ...settings, managerFiringRivalryChance: 0 }),
      ).toBe(false);
    }
  });

  it('is seeded off the entity, not the shared stream — same seed, same answer', () => {
    const a = wouldEscalate(rngFromSeed('stable-seed'), 'outgrewHim', settings);
    const b = wouldEscalate(rngFromSeed('stable-seed'), 'outgrewHim', settings);
    expect(a).toBe(b);
  });
});

describe('the escalated line reads sharper than a quiet split', () => {
  it('names both people for each client-initiated reason', () => {
    for (const reason of ['notWorthTheCut', 'outgrewHim'] as SplitReason[]) {
      const line = firingRivalryLine(reason, 'The Client', 'The Manager');
      expect(line).toContain('The Client');
      expect(line).toContain('The Manager');
    }
  });
});
