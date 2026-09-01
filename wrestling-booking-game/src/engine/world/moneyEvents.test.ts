import { describe, expect, it } from 'vitest';
import { rngFromSeed } from '../rng';
import { defaultWorldSettings } from './settings';
import { eligibleForMoneyEvent, MONEY_EVENTS, moneyEventAmount, pickMoneyEvent } from './moneyEvents';

const settings = defaultWorldSettings();

describe('eligibleForMoneyEvent', () => {
  it('is closed before the earliest week and open on and after it', () => {
    expect(eligibleForMoneyEvent(settings.moneyEventEarliestWeek - 1, settings)).toBe(false);
    expect(eligibleForMoneyEvent(settings.moneyEventEarliestWeek, settings)).toBe(true);
    expect(eligibleForMoneyEvent(settings.moneyEventEarliestWeek + 50, settings)).toBe(true);
  });
});

describe('pickMoneyEvent', () => {
  it('always returns a real entry from the pool', () => {
    for (let i = 0; i < 200; i++) {
      const picked = pickMoneyEvent(rngFromSeed(`t:${i}`));
      expect(MONEY_EVENTS.some((e) => e.id === picked.id)).toBe(true);
    }
  });

  it('produces both windfalls and setbacks over enough rolls', () => {
    const picks = Array.from({ length: 300 }, (_, i) => pickMoneyEvent(rngFromSeed(`spread:${i}`)));
    expect(picks.some((p) => p.sign === 1)).toBe(true);
    expect(picks.some((p) => p.sign === -1)).toBe(true);
  });

  it('every line() call produces real text with the amount in it', () => {
    for (const def of MONEY_EVENTS) {
      const line = def.line(1234);
      expect(line.length).toBeGreaterThan(20);
      expect(line).toContain('1,234');
    }
  });
});

describe('moneyEventAmount', () => {
  it('never goes below the floor or above the ceiling, at any bank balance', () => {
    const balances = [-500_000, -1, 0, 1, 500, 20_000, 300_000, 2_500_000, 25_000_000];
    for (const bank of balances) {
      for (let i = 0; i < 20; i++) {
        const amount = moneyEventAmount(rngFromSeed(`amt:${bank}:${i}`), bank, settings);
        expect(amount).toBeGreaterThanOrEqual(settings.moneyEventMinAmount);
        expect(amount).toBeLessThanOrEqual(settings.moneyEventMaxAmount);
      }
    }
  });

  it('a struggling or negative balance still gets a proportionate, non-trivial amount', () => {
    const amount = moneyEventAmount(rngFromSeed('poor'), -10_000, settings);
    expect(amount).toBeGreaterThan(settings.moneyEventMinAmount * 0.5);
  });

  it('a huge bank balance is still capped, not a fraction of a fortune', () => {
    const amount = moneyEventAmount(rngFromSeed('rich'), 10_000_000, settings);
    expect(amount).toBe(settings.moneyEventMaxAmount);
  });

  it('is deterministic for the same seed', () => {
    const a = moneyEventAmount(rngFromSeed('same'), 100_000, settings);
    const b = moneyEventAmount(rngFromSeed('same'), 100_000, settings);
    expect(a).toBe(b);
  });

  it('rounds to the same $25 the rest of the economy uses', () => {
    for (let i = 0; i < 30; i++) {
      const amount = moneyEventAmount(rngFromSeed(`round:${i}`), 150_000, settings);
      expect(amount % 25).toBe(0);
    }
  });
});
