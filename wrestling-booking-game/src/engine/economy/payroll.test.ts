import { describe, expect, it } from 'vitest';
import { computeAppearanceFee, computeDownsideGuarantee, computeWeeklyExpenses, computeShowExpenseSplit } from './payroll';
import type { Contract } from '../types';

function baseContract(overrides: Partial<Contract> = {}): Contract {
  return {
    type: 'fullTime',
    weeklyRate: 1000,
    weeksRemaining: 20,
    totalWeeks: 52,
    clauses: [],
    signedYear: 2026,
    ...overrides,
  };
}

describe('computeAppearanceFee', () => {
  it('pays competitors full rate and everyone else half', () => {
    const contract = baseContract();
    expect(computeAppearanceFee({ contract, role: 'competitor', isMainEvent: false, isPPV: false })).toBe(1000);
    expect(computeAppearanceFee({ contract, role: 'referee', isMainEvent: false, isPPV: false })).toBe(500);
  });

  it('applies the incentive clause bonus only in the main event', () => {
    const contract = baseContract({ clauses: ['incentive'] });
    expect(computeAppearanceFee({ contract, role: 'competitor', isMainEvent: true, isPPV: false })).toBe(1250);
    expect(computeAppearanceFee({ contract, role: 'competitor', isMainEvent: false, isPPV: false })).toBe(1000);
  });

  it('doubles the fee on PPV with the payPerView clause', () => {
    const contract = baseContract({ clauses: ['payPerView'] });
    expect(computeAppearanceFee({ contract, role: 'competitor', isMainEvent: false, isPPV: true })).toBe(2000);
    expect(computeAppearanceFee({ contract, role: 'competitor', isMainEvent: false, isPPV: false })).toBe(1000);
  });

  it('stacks incentive and payPerView clauses on a PPV main event', () => {
    const contract = baseContract({ clauses: ['incentive', 'payPerView'] });
    expect(computeAppearanceFee({ contract, role: 'competitor', isMainEvent: true, isPPV: true })).toBeCloseTo(2500, 5);
  });
});

describe('computeDownsideGuarantee', () => {
  it('pays half rate for downside-clause holders, zero otherwise', () => {
    expect(computeDownsideGuarantee(baseContract({ clauses: ['downside'] }))).toBe(500);
    expect(computeDownsideGuarantee(baseContract())).toBe(0);
  });
});

describe('computeWeeklyExpenses', () => {
  it('scales with net worth and territory count', () => {
    expect(computeWeeklyExpenses(100_000, 0.02, 0)).toBeCloseTo(2000, 5);
    expect(computeWeeklyExpenses(100_000, 0.02, 1)).toBeCloseTo(2200, 5);
  });
});

describe('computeShowExpenseSplit', () => {
  it('pays everything when under the cap', () => {
    const split = computeShowExpenseSplit(3000, 10000, 50);
    expect(split.payable).toBe(3000);
    expect(split.deferred).toBe(0);
  });

  it('caps payable at the given percent of revenue and defers the rest', () => {
    const split = computeShowExpenseSplit(8000, 10000, 50);
    expect(split.payable).toBe(5000);
    expect(split.deferred).toBe(3000);
  });
});
