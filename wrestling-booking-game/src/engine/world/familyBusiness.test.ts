import { describe, it, expect } from 'vitest';
import {
  eligibleForFamilyBusiness,
  generateFamilyBusinessSignee,
  familyBusinessWage,
  familyBusinessTitleWinSurge,
  familyBusinessArrivesLine,
  familyBusinessExtendedLine,
  familyBusinessWinsTitleLine,
  familyBusinessGracefulExitLine,
  familyBusinessBustExitLine,
} from './familyBusiness';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';

const settings = defaultWorldSettings();

describe('eligibleForFamilyBusiness', () => {
  it('never fires before the week gate', () => {
    expect(eligibleForFamilyBusiness(settings.familyBusinessEarliestWeek - 1, false, settings)).toBe(false);
  });

  it('never re-fires while one is already living its story', () => {
    expect(eligibleForFamilyBusiness(settings.familyBusinessEarliestWeek, true, settings)).toBe(false);
  });

  it('fires once the gate clears and nobody is already living it', () => {
    expect(eligibleForFamilyBusiness(settings.familyBusinessEarliestWeek, false, settings)).toBe(true);
  });
});

describe('generateFamilyBusinessSignee', () => {
  it('produces a real bust — every core stat and popularity under the configured ceiling', () => {
    for (let i = 0; i < 20; i++) {
      const signee = generateFamilyBusinessSignee(rngFromSeed(`bust-${i}`), new Set(), 2026, settings);
      expect(signee.strength).toBeLessThanOrEqual(settings.familyBusinessStatCeiling);
      expect(signee.skill).toBeLessThanOrEqual(settings.familyBusinessStatCeiling);
      expect(signee.agility).toBeLessThanOrEqual(settings.familyBusinessStatCeiling);
      expect(signee.stamina).toBeLessThanOrEqual(settings.familyBusinessStatCeiling);
      expect(signee.popularity).toBeLessThanOrEqual(settings.familyBusinessStatCeiling);
    }
  });

  it('starts entitled — ego lands near the configured starting value', () => {
    const signee = generateFamilyBusinessSignee(rngFromSeed('ego'), new Set(), 2026, settings);
    expect(signee.ego).toBeGreaterThanOrEqual(settings.familyBusinessStartingEgo - 10);
    expect(signee.ego).toBeLessThanOrEqual(100);
  });

  it('is otherwise a complete, valid wrestler — unsigned, no contract, a fresh career', () => {
    const signee = generateFamilyBusinessSignee(rngFromSeed('shape'), new Set(), 2026, settings);
    expect(signee.promotionId).toBeNull();
    expect(signee.contract).toBeNull();
    expect(signee.careerStatus).toBe('rookie');
    expect(signee.titleReigns).toEqual([]);
    expect(signee.record).toEqual({ wins: 0, losses: 0, draws: 0 });
    expect(signee.name.length).toBeGreaterThan(0);
  });
});

describe('familyBusinessWage', () => {
  it('scales as a real multiple of the top earner, rounded to the nearest 25', () => {
    const wage = familyBusinessWage(2000, settings);
    expect(wage).toBeGreaterThan(2000);
    expect(wage % 25).toBe(0);
  });

  it('grows and shrinks with the top earner rather than being a flat number', () => {
    expect(familyBusinessWage(4000, settings)).toBeGreaterThan(familyBusinessWage(1000, settings));
  });
});

describe('familyBusinessTitleWinSurge', () => {
  it('returns the configured flat bump on every core stat', () => {
    const surge = familyBusinessTitleWinSurge(settings);
    expect(surge.strength).toBe(settings.familyBusinessStatBump);
    expect(surge.skill).toBe(settings.familyBusinessStatBump);
    expect(surge.agility).toBe(settings.familyBusinessStatBump);
    expect(surge.stamina).toBe(settings.familyBusinessStatBump);
  });
});

describe('the wire lines', () => {
  it('say something real and name the person given', () => {
    expect(familyBusinessArrivesLine('Casey Vale', 3500).length).toBeGreaterThan(20);
    expect(familyBusinessArrivesLine('Casey Vale', 3500)).toContain('Casey Vale');
    expect(familyBusinessExtendedLine('Casey Vale')).toContain('Casey Vale');
    expect(familyBusinessWinsTitleLine('Casey Vale', 'World Title')).toContain('Casey Vale');
    expect(familyBusinessWinsTitleLine('Casey Vale', 'World Title')).toContain('World Title');
    expect(familyBusinessGracefulExitLine('Casey Vale', 'World Title')).toContain('Casey Vale');
    expect(familyBusinessBustExitLine('Casey Vale')).toContain('Casey Vale');
  });
});
