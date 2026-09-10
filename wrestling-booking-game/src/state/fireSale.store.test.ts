// Selling owned production gear at a distress discount — the last resort
// after the loan and the buyout offer. See engine/economy/fireSale.ts.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';
import { newAssetCondition } from '../engine/economy/showBudget';

const activeLoan = {
  attemptNumber: 1,
  tier: 'small' as const,
  borrowed: 10_000,
  totalOwed: 13_000,
  weeklyPayment: 500,
  weeksRemaining: 26,
  startedWeek: 1,
};

function newGame() {
  useGameStore.getState().newGame({
    ...defaultWorldSettings(),
    seed: 'fire-sale-1',
    startingRosterSize: 14,
    ownerMandatesEnabled: false,
  });
}

beforeEach(newGame);

describe('selling gear to keep the lights on', () => {
  it('does nothing while the promotion is not actually struggling', () => {
    useGameStore.setState((s) => {
      const world = s.world!;
      world.ownedAssetIds = ['ringUpgrade'];
      world.assetConditions = [newAssetCondition('ringUpgrade')];
      world.activeLoan = null; // no loan running — not a fire sale, just an asset sale
    });
    const before = useGameStore.getState().world!.promotion.bankBalance;
    useGameStore.getState().sellProductionAsset('ringUpgrade');
    const world = useGameStore.getState().world!;
    expect(world.ownedAssetIds).toContain('ringUpgrade');
    expect(world.promotion.bankBalance).toBe(before);
  });

  it('sells an owned, eligible asset for a hard fraction of its value once a loan is active', () => {
    useGameStore.setState((s) => {
      const world = s.world!;
      world.ownedAssetIds = ['ringUpgrade'];
      world.assetConditions = [newAssetCondition('ringUpgrade')];
      world.activeLoan = activeLoan;
    });
    const before = useGameStore.getState().world!.promotion.bankBalance;
    useGameStore.getState().sellProductionAsset('ringUpgrade');
    const world = useGameStore.getState().world!;
    expect(world.ownedAssetIds).not.toContain('ringUpgrade');
    expect(world.assetConditions.some((c) => c.assetId === 'ringUpgrade')).toBe(false);
    expect(world.promotion.bankBalance).toBeGreaterThan(before);
    expect(world.promotion.bankBalance - before).toBeLessThan(32_000); // ringUpgrade's full cost
    expect(world.weeklyNews.some((n) => n.text.includes('sold off'))).toBe(true);
  });

  it('will not sell the training facility even mid-crisis', () => {
    useGameStore.setState((s) => {
      const world = s.world!;
      world.ownedAssetIds = ['trainingFacility'];
      world.assetConditions = [newAssetCondition('trainingFacility')];
      world.activeLoan = activeLoan;
    });
    const before = useGameStore.getState().world!.promotion.bankBalance;
    useGameStore.getState().sellProductionAsset('trainingFacility');
    const world = useGameStore.getState().world!;
    expect(world.ownedAssetIds).toContain('trainingFacility');
    expect(world.promotion.bankBalance).toBe(before);
  });

  it('does nothing for an asset the promotion does not actually own', () => {
    useGameStore.setState((s) => {
      const world = s.world!;
      world.ownedAssetIds = [];
      world.activeLoan = activeLoan;
    });
    const before = useGameStore.getState().world!.promotion.bankBalance;
    useGameStore.getState().sellProductionAsset('ringUpgrade');
    expect(useGameStore.getState().world!.promotion.bankBalance).toBe(before);
  });

  it('can be switched off entirely', () => {
    useGameStore.setState((s) => {
      const world = s.world!;
      world.ownedAssetIds = ['ringUpgrade'];
      world.assetConditions = [newAssetCondition('ringUpgrade')];
      world.activeLoan = activeLoan;
      world.settings.fireSaleEnabled = false;
    });
    const before = useGameStore.getState().world!.promotion.bankBalance;
    useGameStore.getState().sellProductionAsset('ringUpgrade');
    const world = useGameStore.getState().world!;
    expect(world.ownedAssetIds).toContain('ringUpgrade');
    expect(world.promotion.bankBalance).toBe(before);
  });
});
