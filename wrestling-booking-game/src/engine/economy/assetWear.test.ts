import { describe, it, expect } from 'vitest';
import {
  newAssetCondition,
  wearAsset,
  assetEffectiveness,
  assetHasFailed,
  repairCost,
  repairAsset,
  conditionLabel,
} from './showBudget';
import { defaultWorldSettings } from '../world/settings';
import { productionAssetById, PRODUCTION_ASSETS } from '../../data/production';

const settings = defaultWorldSettings();

/** Run an asset for `shows` weeks. */
function after(shows: number) {
  let state = newAssetCondition('bigScreen');
  for (let i = 0; i < shows; i++) state = wearAsset(state, settings);
  return state;
}

describe('gear wears out', () => {
  it('starts as new', () => {
    const fresh = newAssetCondition('bigScreen');
    expect(fresh.condition).toBe(100);
    expect(fresh.showsUsed).toBe(0);
    expect(assetEffectiveness(fresh, settings)).toBe(1);
  });

  it('loses condition every single show', () => {
    expect(after(10).condition).toBeLessThan(after(5).condition);
    expect(after(10).showsUsed).toBe(10);
  });

  it('still works fine through the first year', () => {
    expect(assetEffectiveness(after(52), settings)).toBeGreaterThan(0.6);
    expect(assetHasFailed(after(52), settings)).toBe(false);
  });

  it('is noticeably degraded by year two', () => {
    expect(assetEffectiveness(after(104), settings)).toBeLessThan(assetEffectiveness(after(52), settings) - 0.15);
  });

  it('is in real trouble by year three', () => {
    // Long enough to forget about, short enough to bite a promotion that
    // keeps buying and never maintains.
    expect(assetEffectiveness(after(156), settings)).toBeLessThan(0.35);
    expect(assetHasFailed(after(156), settings)).toBe(false);
  });

  it('eventually fails outright and does nothing at all', () => {
    const dead = after(100000);
    expect(assetHasFailed(dead, settings)).toBe(true);
    expect(assetEffectiveness(dead, settings)).toBe(0);
    expect(conditionLabel(dead, settings)).toBe('Failed');
  });

  it('never goes below zero condition', () => {
    expect(after(100000).condition).toBe(0);
  });

  it('degrades gently at first and then quickly', () => {
    const early = assetEffectiveness(after(10), settings) - assetEffectiveness(after(30), settings);
    const late = assetEffectiveness(after(120), settings) - assetEffectiveness(after(140), settings);
    expect(late).toBeGreaterThan(early);
  });
});

describe('repairs', () => {
  const screen = productionAssetById('bigScreen')!;

  it('cost nothing on something that is already new', () => {
    expect(repairCost(newAssetCondition('bigScreen'), screen.cost, settings)).toBe(0);
  });

  it('cost more the longer you leave it', () => {
    expect(repairCost(after(120), screen.cost, settings)).toBeGreaterThan(repairCost(after(40), screen.cost, settings));
  });

  it('stay cheaper than buying it again', () => {
    // Otherwise nobody would ever repair anything.
    expect(repairCost(after(150), screen.cost, settings)).toBeLessThan(screen.cost);
  });

  it('are a real bill on an expensive rig', () => {
    expect(repairCost(after(52), screen.cost, settings)).toBeGreaterThan(10000);
  });

  it('put it back to new', () => {
    const fixed = repairAsset(after(150));
    expect(fixed.condition).toBe(100);
    expect(assetEffectiveness(fixed, settings)).toBe(1);
    // It remembers how hard it has worked, even once repaired.
    expect(fixed.showsUsed).toBe(150);
  });
});

describe('condition in words', () => {
  it('walks down the ladder as it wears', () => {
    expect(conditionLabel(after(0), settings)).toBe('As new');
    expect(conditionLabel(after(50), settings)).toBe('Serviceable');
    expect(conditionLabel(after(100), settings)).toBe('Worn');
    expect(conditionLabel(after(150), settings)).toBe('Held together with tape');
    expect(conditionLabel(after(100000), settings)).toBe('Failed');
  });
});

describe('the counterweight to buying your way up', () => {
  it('makes a fully kitted promotion carry a serious maintenance bill', () => {
    // Everything bought at once wears out at once, which is the trap.
    const yearlyBill = PRODUCTION_ASSETS.reduce((sum, asset) => sum + repairCost(after(52), asset.cost, settings), 0);
    expect(yearlyBill).toBeGreaterThan(settings.startingCash);
  });
});
