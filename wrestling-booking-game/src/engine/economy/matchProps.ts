// Match hardware inventory — real per-unit wear for the props a stipulation
// actually needs (a ladder, a cage, a table), as opposed to
// economy/showBudget.ts's AssetCondition, which tracks one condition per
// owned production-asset *type*. This tracks one condition per owned *unit*,
// because a promotion can own several of the same prop at once and each one
// wears out on its own — see data/matchProps.ts for the family/tier data
// this operates on.
//
// Same taper curve, same failure-threshold idiom, same repair-for-a-fraction-
// of-cost shape as showBudget.ts's AssetCondition — deliberately not
// reinvented, just applied per-unit.

import { clamp } from '../rng';
import type { Id, WorldSettings } from '../types';
import type { MatchPropTier } from '../../data/matchProps';

export interface OwnedPropUnit {
  id: Id;
  familyId: Id;
  tierId: Id;
  /** 0-100. Below propFailureThreshold the unit cannot be used at all. */
  condition: number;
  showsOwned: number;
  timesUsed: number;
}

export function newPropUnit(id: Id, familyId: Id, tierId: Id): OwnedPropUnit {
  return { id, familyId, tierId, condition: 100, showsOwned: 0, timesUsed: 0 };
}

/** A show's worth of wear on a unit that sat in storage tonight. */
export function idleWearUnit(unit: OwnedPropUnit, tier: MatchPropTier): OwnedPropUnit {
  return { ...unit, condition: clamp(unit.condition - tier.idleWearPerShow, 0, 100), showsOwned: unit.showsOwned + 1 };
}

/**
 * A show's worth of wear on a unit that was actually in a match tonight.
 * `wearMultiplier` lets a specific booking be harder on the gear than the
 * tier's ordinary rate — see Stipulation.gearWearMultiplier: a table that's
 * literally on fire in a Flaming Tables match wears out far faster than the
 * same table in a plain Tables Match, even though it's the same tier.
 */
export function useWearUnit(unit: OwnedPropUnit, tier: MatchPropTier, wearMultiplier = 1): OwnedPropUnit {
  return {
    ...unit,
    condition: clamp(unit.condition - tier.useWearPerMatch * wearMultiplier, 0, 100),
    showsOwned: unit.showsOwned + 1,
    timesUsed: unit.timesUsed + 1,
  };
}

export function unitHasFailed(unit: OwnedPropUnit, settings: WorldSettings): boolean {
  return unit.condition <= settings.propFailureThreshold;
}

/** Words, never a number (§0) — same bands as showBudget.ts's conditionLabel. */
export type ConditionLabel = 'As new' | 'Serviceable' | 'Worn' | 'Held together with tape' | 'Failed';

export function unitConditionLabel(unit: OwnedPropUnit, settings: WorldSettings): ConditionLabel {
  if (unitHasFailed(unit, settings)) return 'Failed';
  if (unit.condition >= 85) return 'As new';
  if (unit.condition >= 60) return 'Serviceable';
  if (unit.condition >= 35) return 'Worn';
  return 'Held together with tape';
}

/** What it costs to put a worn unit back to new. Scales with how bad it got. */
export function propRepairCost(unit: OwnedPropUnit, tier: MatchPropTier, settings: WorldSettings): number {
  const missing = (100 - unit.condition) / 100;
  return Math.round(tier.cost * missing * settings.propRepairCostFraction);
}

export function repairPropUnit(unit: OwnedPropUnit): OwnedPropUnit {
  return { ...unit, condition: 100 };
}

export function ownedUnitsForFamily(units: readonly OwnedPropUnit[], familyId: Id): OwnedPropUnit[] {
  return units.filter((u) => u.familyId === familyId);
}

/** Owned units of this family that haven't failed outright. */
export function usableUnitsForFamily(
  units: readonly OwnedPropUnit[],
  familyId: Id,
  settings: WorldSettings,
): OwnedPropUnit[] {
  return ownedUnitsForFamily(units, familyId).filter((u) => !unitHasFailed(u, settings));
}

/**
 * Per-unit odds *this specific unit* is the one that gives out tonight, if
 * it's assigned to the match. Cheap gear (qualityFactor near 1) and worn
 * gear (low condition) both push this up; nothing pushes it to certainty.
 */
export function unitBreakChance(unit: OwnedPropUnit, tier: MatchPropTier, settings: WorldSettings): number {
  return clamp(settings.propBreakChanceAtWorst * tier.qualityFactor * (1 - unit.condition / 100), 0, 1);
}

/**
 * "Something breaks tonight" — every unit assigned to the match stacked the
 * same way productionEffects() stacks injuryReduction: 1 - product(1 - x_i).
 * More units in play is a real, compounding cost, not a free bonus.
 */
export function aggregateBreakChance(
  unitsInPlay: readonly { unit: OwnedPropUnit; tier: MatchPropTier }[],
  settings: WorldSettings,
): number {
  let chance = 0;
  for (const { unit, tier } of unitsInPlay) {
    const p = unitBreakChance(unit, tier, settings);
    chance = 1 - (1 - chance) * (1 - p);
  }
  return chance;
}

/**
 * Rating bump for putting on a bigger spectacle — diminishing per extra
 * unit, so four ladders is not simply four times better than one.
 */
export function spectacleBonus(unitsInPlay: number, settings: WorldSettings): number {
  if (unitsInPlay <= 1) return 0;
  return settings.gearUnitsSpectacleBonusPerExtra * (unitsInPlay - 1) ** settings.gearUnitsSpectacleBonusCurve;
}
