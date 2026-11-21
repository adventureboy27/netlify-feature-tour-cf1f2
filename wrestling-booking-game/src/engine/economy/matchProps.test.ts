import { describe, it, expect } from 'vitest';
import {
  newPropUnit,
  idleWearUnit,
  useWearUnit,
  unitHasFailed,
  unitConditionLabel,
  propRepairCost,
  repairPropUnit,
  ownedUnitsForFamily,
  usableUnitsForFamily,
  unitBreakChance,
  aggregateBreakChance,
  spectacleBonus,
} from './matchProps';
import { defaultWorldSettings } from '../world/settings';
import { tierById } from '../../data/matchProps';

const settings = defaultWorldSettings();
const ladderWood = tierById('ladderWood')!;
const ladderProSpec = tierById('ladderProSpec')!;

describe('a fresh unit', () => {
  it('starts at full condition, never used', () => {
    const unit = newPropUnit('u1', 'ladder', 'ladderWood');
    expect(unit.condition).toBe(100);
    expect(unit.showsOwned).toBe(0);
    expect(unit.timesUsed).toBe(0);
  });
});

describe('use-vs-idle wear', () => {
  it('a unit that works a match wears out faster than one sitting in storage', () => {
    const unit = newPropUnit('u1', 'ladder', 'ladderWood');
    const idle = idleWearUnit(unit, ladderWood);
    const used = useWearUnit(unit, ladderWood);
    expect(used.condition).toBeLessThan(idle.condition);
  });

  it('both still count the show, only useWearUnit counts the use', () => {
    const unit = newPropUnit('u1', 'ladder', 'ladderWood');
    const idle = idleWearUnit(unit, ladderWood);
    const used = useWearUnit(unit, ladderWood);
    expect(idle.showsOwned).toBe(1);
    expect(idle.timesUsed).toBe(0);
    expect(used.showsOwned).toBe(1);
    expect(used.timesUsed).toBe(1);
  });

  it('a cheap tier wears faster than a pro-spec one under the same use', () => {
    const cheap = useWearUnit(newPropUnit('u1', 'ladder', 'ladderWood'), ladderWood);
    const proSpec = useWearUnit(newPropUnit('u2', 'ladder', 'ladderProSpec'), ladderProSpec);
    expect(cheap.condition).toBeLessThan(proSpec.condition);
  });

  it('a wearMultiplier makes a specific booking harder on the gear than the ordinary rate', () => {
    const plain = useWearUnit(newPropUnit('u1', 'tables', 'tableFolding'), tierById('tableFolding')!);
    const onFire = useWearUnit(newPropUnit('u2', 'tables', 'tableFolding'), tierById('tableFolding')!, 5);
    expect(onFire.condition).toBeLessThan(plain.condition);
  });

  it('never drops condition below zero', () => {
    let unit = newPropUnit('u1', 'tables', 'tableFolding');
    for (let i = 0; i < 20; i++) unit = useWearUnit(unit, tierById('tableFolding')!);
    expect(unit.condition).toBe(0);
  });
});

describe('failure and condition labels', () => {
  it('has not failed while fresh', () => {
    const unit = newPropUnit('u1', 'ladder', 'ladderWood');
    expect(unitHasFailed(unit, settings)).toBe(false);
    expect(unitConditionLabel(unit, settings)).toBe('As new');
  });

  it('fails once condition drops to the threshold', () => {
    const unit = { ...newPropUnit('u1', 'ladder', 'ladderWood'), condition: settings.propFailureThreshold };
    expect(unitHasFailed(unit, settings)).toBe(true);
    expect(unitConditionLabel(unit, settings)).toBe('Failed');
  });

  it('walks down the ladder as it wears', () => {
    expect(unitConditionLabel({ ...newPropUnit('u1', 'ladder', 'ladderWood'), condition: 90 }, settings)).toBe(
      'As new',
    );
    expect(unitConditionLabel({ ...newPropUnit('u1', 'ladder', 'ladderWood'), condition: 70 }, settings)).toBe(
      'Serviceable',
    );
    expect(unitConditionLabel({ ...newPropUnit('u1', 'ladder', 'ladderWood'), condition: 40 }, settings)).toBe(
      'Worn',
    );
    expect(unitConditionLabel({ ...newPropUnit('u1', 'ladder', 'ladderWood'), condition: 20 }, settings)).toBe(
      'Held together with tape',
    );
  });
});

describe('repairs', () => {
  it('cost nothing on a unit that is already new', () => {
    expect(propRepairCost(newPropUnit('u1', 'ladder', 'ladderWood'), ladderWood, settings)).toBe(0);
  });

  it('cost more the further gone the unit is', () => {
    const worn = { ...newPropUnit('u1', 'ladder', 'ladderWood'), condition: 60 };
    const wrecked = { ...newPropUnit('u1', 'ladder', 'ladderWood'), condition: 10 };
    expect(propRepairCost(wrecked, ladderWood, settings)).toBeGreaterThan(propRepairCost(worn, ladderWood, settings));
  });

  it('stay cheaper than buying it again', () => {
    const wrecked = { ...newPropUnit('u1', 'ladder', 'ladderWood'), condition: 1 };
    expect(propRepairCost(wrecked, ladderWood, settings)).toBeLessThan(ladderWood.cost);
  });

  it('puts a unit back to full condition without resetting its history', () => {
    const worn = { ...newPropUnit('u1', 'ladder', 'ladderWood'), condition: 20, showsOwned: 40, timesUsed: 12 };
    const fixed = repairPropUnit(worn);
    expect(fixed.condition).toBe(100);
    expect(fixed.showsOwned).toBe(40);
    expect(fixed.timesUsed).toBe(12);
  });
});

describe('inventory lookups', () => {
  it('filters by family', () => {
    const units = [newPropUnit('u1', 'ladder', 'ladderWood'), newPropUnit('u2', 'tables', 'tableFolding')];
    expect(ownedUnitsForFamily(units, 'ladder')).toHaveLength(1);
    expect(ownedUnitsForFamily(units, 'tables')).toHaveLength(1);
  });

  it('usableUnitsForFamily excludes failed units', () => {
    const good = newPropUnit('u1', 'ladder', 'ladderWood');
    const failed = { ...newPropUnit('u2', 'ladder', 'ladderWood'), condition: settings.propFailureThreshold };
    expect(usableUnitsForFamily([good, failed], 'ladder', settings)).toEqual([good]);
  });
});

describe('break chance', () => {
  it('is higher for cheap, worn gear than for fresh, top-tier gear', () => {
    const worn = { ...newPropUnit('u1', 'ladder', 'ladderWood'), condition: 20 };
    const fresh = newPropUnit('u2', 'ladder', 'ladderProSpec');
    expect(unitBreakChance(worn, ladderWood, settings)).toBeGreaterThan(unitBreakChance(fresh, ladderProSpec, settings));
  });

  it('never reaches certainty', () => {
    const wrecked = { ...newPropUnit('u1', 'ladder', 'ladderWood'), condition: 0 };
    expect(unitBreakChance(wrecked, ladderWood, settings)).toBeLessThan(1);
  });

  it('stacks across units in play, but never reaches certainty either', () => {
    const wrecked = { ...newPropUnit('u1', 'ladder', 'ladderWood'), condition: 0 };
    const unitsInPlay = [
      { unit: wrecked, tier: ladderWood },
      { unit: { ...wrecked, id: 'u2' }, tier: ladderWood },
      { unit: { ...wrecked, id: 'u3' }, tier: ladderWood },
      { unit: { ...wrecked, id: 'u4' }, tier: ladderWood },
    ];
    const one = aggregateBreakChance([unitsInPlay[0]!], settings);
    const four = aggregateBreakChance(unitsInPlay, settings);
    expect(four).toBeGreaterThan(one);
    expect(four).toBeLessThan(1);
  });
});

describe('spectacle bonus', () => {
  it('is zero for a single unit', () => {
    expect(spectacleBonus(1, settings)).toBe(0);
    expect(spectacleBonus(0, settings)).toBe(0);
  });

  it('grows with more units, but with diminishing returns per extra one', () => {
    const two = spectacleBonus(2, settings);
    const four = spectacleBonus(4, settings);
    expect(four).toBeGreaterThan(two);
    // Diminishing returns: the jump from 1->2 is worth more than the
    // per-unit average of the jump from 2->4.
    const firstStep = two - spectacleBonus(1, settings);
    const perUnitLater = (four - two) / 2;
    expect(perUnitLater).toBeLessThan(firstStep);
  });
});
