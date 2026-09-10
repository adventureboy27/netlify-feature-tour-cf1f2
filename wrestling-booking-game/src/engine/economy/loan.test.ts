import { describe, it, expect } from 'vitest';
import { loanTermsFor, buildLoan, loanCooldownCleared } from './loan';
import { defaultWorldSettings } from '../world/settings';

const settings = defaultWorldSettings();

describe('pricing a loan', () => {
  it('sizes the ceiling against current payroll', () => {
    const terms = loanTermsFor(1, 10_000, settings);
    expect(terms.ceiling).toBe(10_000 * settings.loanCeilingWeeks1st);
  });

  it('never sizes below the minimum ceiling, even for a tiny payroll', () => {
    const terms = loanTermsFor(1, 1, settings);
    expect(terms.ceiling).toBe(settings.loanMinimumCeiling);
  });

  it('the tiers are ordered small < medium < large, all under the ceiling', () => {
    const terms = loanTermsFor(1, 20_000, settings);
    expect(terms.tiers.small).toBeLessThan(terms.tiers.medium);
    expect(terms.tiers.medium).toBeLessThan(terms.tiers.large);
    expect(terms.tiers.large).toBeLessThanOrEqual(terms.ceiling);
  });

  it('every attempt past the third is treated identically to the third', () => {
    const third = loanTermsFor(3, 20_000, settings);
    const fifth = loanTermsFor(5, 20_000, settings);
    expect(fifth).toEqual({ ...third, attemptNumber: 5 });
  });

  it('escalates: less money, worse repayment, more strikes each time', () => {
    const first = loanTermsFor(1, 20_000, settings);
    const second = loanTermsFor(2, 20_000, settings);
    const third = loanTermsFor(3, 20_000, settings);

    expect(second.ceiling).toBeLessThan(first.ceiling);
    expect(third.ceiling).toBeLessThan(second.ceiling);

    expect(second.repaymentMultiple).toBeGreaterThan(first.repaymentMultiple);
    expect(third.repaymentMultiple).toBeGreaterThan(second.repaymentMultiple);

    expect(second.cooldownWeeks).toBeGreaterThan(first.cooldownWeeks);
    expect(third.cooldownWeeks).toBeGreaterThan(second.cooldownWeeks);

    expect(second.mandateStrikes).toBeGreaterThan(first.mandateStrikes);
    expect(third.mandateStrikes).toBeGreaterThan(second.mandateStrikes);
  });
});

describe('building the actual loan', () => {
  it('owes more than was borrowed, and the weekly payment clears it exactly on schedule', () => {
    const terms = loanTermsFor(1, 20_000, settings);
    const loan = buildLoan('medium', terms, 10);

    expect(loan.borrowed).toBe(terms.tiers.medium);
    expect(loan.totalOwed).toBeGreaterThan(loan.borrowed);
    expect(loan.weeksRemaining).toBe(terms.repaymentWeeks);
    // Rounded to a whole dollar each week, so the total can drift by at most
    // a dollar per week from what is nominally owed.
    expect(Math.abs(loan.weeklyPayment * loan.weeksRemaining - loan.totalOwed)).toBeLessThanOrEqual(loan.weeksRemaining);
  });

  it('never produces a zero or negative weekly payment', () => {
    const terms = loanTermsFor(1, 1, settings);
    const loan = buildLoan('small', terms, 1);
    expect(loan.weeklyPayment).toBeGreaterThan(0);
  });
});

describe('the cooldown', () => {
  it('the very first loan needs no cooldown at all', () => {
    expect(loanCooldownCleared(0, 0, settings)).toBe(true);
  });

  it('a second loan is blocked until the first loan\'s cooldown has run', () => {
    expect(loanCooldownCleared(1, 0, settings)).toBe(false);
    expect(loanCooldownCleared(1, settings.loanCooldownWeeks1st - 1, settings)).toBe(false);
    expect(loanCooldownCleared(1, settings.loanCooldownWeeks1st, settings)).toBe(true);
  });

  it('the required wait grows after each loan taken', () => {
    const afterOne = settings.loanCooldownWeeks1st;
    const afterTwo = settings.loanCooldownWeeks2nd;
    expect(loanCooldownCleared(2, afterOne, settings)).toBe(false);
    expect(loanCooldownCleared(2, afterTwo, settings)).toBe(true);
  });
});
