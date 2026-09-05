// Selling off owned production gear at a distress discount — the last lever
// in the bankruptcy rework, after the loan and after a rival's blind buyout
// offer. Only on the table while an active loan means the promotion is
// genuinely struggling (same gate as buyout.ts), and deliberately not a fair
// resale: see fireSaleValue. See docs/BACKLOG.md's "Bankruptcy rework" note
// for where this came from.

import type { ProductionAsset, WorldSettings } from '../types';
import type { AssetCondition } from './showBudget';
import { assetEffectiveness } from './showBudget';

/**
 * The training facility is a school, not show-night gear — it stays out of
 * this even in a genuine emergency (see its `fireSaleEligible: false` in
 * data/production.ts). Everything else the promotion can own is fair game.
 */
export function fireSaleEligible(asset: ProductionAsset): boolean {
  return asset.fireSaleEligible !== false;
}

/**
 * What the booker actually gets for it. Condition-scaled — a neglected rig
 * fetches less, the same curve repairCost already uses — times a hard
 * distress fraction on top, because this is a fire sale, not a fair resale.
 */
export function fireSaleValue(
  asset: ProductionAsset,
  condition: AssetCondition | undefined,
  settings: WorldSettings,
): number {
  const effectiveness = condition ? assetEffectiveness(condition, settings) : 1;
  return Math.max(0, Math.round(asset.cost * effectiveness * settings.fireSaleValueFraction));
}
