// The production ladder, and the truck that gates it.
//
// The rules a booker would notice being broken: you start on a mat, you cannot
// skip rungs, you cannot own more than fits on the truck, and the top of the
// ladder is worth far more than the bottom.

import { describe, expect, it } from 'vitest';
import { defaultWorldSettings } from '../world/settings';
import {
  HAULAGE,
  PRODUCTION_LADDER,
  haulageById,
  nextHaulage,
  rungById,
  haulUsed,
  fitsOnTruck,
  ladderStatus,
  nextRung,
  productionEffects,
  productionUpkeepPerShow,
  productionLabel,
} from './production';

const settings = defaultWorldSettings();
const pickup = haulageById('pickup')!;
const boxTruck = haulageById('boxTruck')!;
const semi = haulageById('semi')!;
const fleet = haulageById('fleet')!;
const RICH = 100_000_000;

describe('you start on the floor', () => {
  it('owns nothing, and says so in words', () => {
    expect(productionLabel([], settings)).toBe('A mat on a gym floor');
    expect(productionEffects([]).showRating).toBe(0);
    expect(productionUpkeepPerShow([])).toBe(0);
  });

  it('starts on a pickup that costs nothing to buy', () => {
    expect(HAULAGE[0]!.id).toBe('pickup');
    expect(HAULAGE[0]!.cost).toBe(0);
  });

  it('points at mat and ropes as the first thing to want', () => {
    expect(nextRung([])!.id).toBe('matRopes');
  });
});

describe('the ladder is an order, not a menu', () => {
  it('names the rung below for everything except the first', () => {
    expect(PRODUCTION_LADDER[0]!.requires).toBeNull();
    for (const rung of PRODUCTION_LADDER.slice(1)) {
      expect(rung.requires).not.toBeNull();
      expect(rungById(rung.requires!)).toBeDefined();
    }
  });

  it('never lets a rung require something above it', () => {
    // A cycle or a forward reference would make part of the ladder unreachable.
    const order = PRODUCTION_LADDER.map((r) => r.id);
    for (const [i, rung] of PRODUCTION_LADDER.entries()) {
      if (!rung.requires) continue;
      expect(order.indexOf(rung.requires)).toBeLessThan(i);
    }
  });

  it('refuses to sell a video wall to somebody with a mat', () => {
    const status = ladderStatus([], fleet, RICH);
    const screen = status.find((s) => s.rung.id === 'screen')!;
    expect(screen.blocked).toBe('needsRung');
    expect(screen.note).toMatch(/first/);
  });

  it('opens exactly one rung at a time', () => {
    const ready = ladderStatus([], fleet, RICH).filter((s) => s.blocked === null);
    expect(ready).toHaveLength(1);
    expect(ready[0]!.rung.id).toBe('matRopes');
  });

  it('walks the whole way up when everything else allows it', () => {
    const owned: string[] = [];
    for (let i = 0; i < PRODUCTION_LADDER.length; i++) {
      const next = nextRung(owned);
      expect(next, `stalled after ${owned.length} rungs`).not.toBeNull();
      owned.push(next!.id);
    }
    expect(owned).toHaveLength(PRODUCTION_LADDER.length);
    expect(nextRung(owned)).toBeNull();
  });
});

describe('everything has to fit on the truck', () => {
  it('will not load a professional ring onto a pickup', () => {
    // The pickup carries the mat and essentially nothing else, which is the
    // whole reason haulage is the gate on the ladder rather than scenery.
    const status = ladderStatus(['matRopes'], pickup, RICH);
    const ring = status.find((s) => s.rung.id === 'ring')!;
    expect(ring.blocked).toBe('needsTruck');
    expect(ring.note).toMatch(/fit/);
  });

  it('lets the same purchase through once the truck is bigger', () => {
    const status = ladderStatus(['matRopes'], boxTruck, RICH);
    expect(status.find((s) => s.rung.id === 'ring')!.blocked).toBeNull();
  });

  it('counts what is already loaded', () => {
    expect(haulUsed([])).toBe(0);
    expect(haulUsed(['matRopes', 'ring'])).toBe(
      rungById('matRopes')!.haulSpace + rungById('ring')!.haulSpace,
    );
  });

  it('cannot fit the whole ladder on anything but the fleet', () => {
    const everything = PRODUCTION_LADDER.map((r) => r.id);
    const total = haulUsed(everything);
    expect(total).toBeGreaterThan(semi.capacity);
    expect(total).toBeLessThanOrEqual(fleet.capacity);
  });

  it('climbs the trucks in order and stops at the top', () => {
    expect(nextHaulage('pickup')!.id).toBe('boxTruck');
    expect(nextHaulage('boxTruck')!.id).toBe('semi');
    expect(nextHaulage('semi')!.id).toBe('fleet');
    expect(nextHaulage('fleet')).toBeNull();
  });

  it('gets dearer to buy and dearer to keep, every rung', () => {
    for (let i = 1; i < HAULAGE.length; i++) {
      expect(HAULAGE[i]!.cost).toBeGreaterThan(HAULAGE[i - 1]!.cost);
      expect(HAULAGE[i]!.upkeepPerWeek).toBeGreaterThan(HAULAGE[i - 1]!.upkeepPerWeek);
      expect(HAULAGE[i]!.capacity).toBeGreaterThan(HAULAGE[i - 1]!.capacity);
    }
  });
});

describe('money still has to be there', () => {
  it('says plainly when it cannot be covered', () => {
    const status = ladderStatus([], boxTruck, 10);
    expect(status[0]!.blocked).toBe('cannotAfford');
  });

  it('reports what is already owned as owned', () => {
    const status = ladderStatus(['matRopes'], boxTruck, RICH);
    expect(status.find((s) => s.rung.id === 'matRopes')!.owned).toBe(true);
  });
});

describe('what the climb is worth', () => {
  const everything = PRODUCTION_LADDER.map((r) => r.id);

  it('is worth more at the top than at the bottom', () => {
    const bottom = productionEffects(['matRopes']);
    const top = productionEffects(everything);
    expect(top.showRating).toBeGreaterThan(bottom.showRating);
    expect(top.attendanceMultiplier).toBeGreaterThan(bottom.attendanceMultiplier);
    expect(top.tvRating).toBeGreaterThan(bottom.tvRating);
  });

  it('never makes the ring completely safe', () => {
    // Shields stack but must not reach certainty — a safer ring is not a safe
    // one, and an injury system that can be switched off is not a system.
    expect(productionEffects(everything).injuryReduction).toBeLessThan(1);
    expect(productionEffects(everything).injuryReduction).toBeGreaterThan(0);
  });

  it('costs more to put on the further up you are', () => {
    expect(productionUpkeepPerShow(everything)).toBeGreaterThan(
      productionUpkeepPerShow(['matRopes']),
    );
  });

  it('describes itself in words rather than a number', () => {
    const labels = [
      productionLabel([], settings),
      productionLabel(['matRopes', 'ring'], settings),
      productionLabel(['matRopes', 'ring', 'sound', 'lights', 'cameras'], settings),
      productionLabel(everything, settings),
    ];
    expect(new Set(labels).size).toBe(4);
    expect(labels[3]).toMatch(/arena/i);
    expect(labels.join(' ')).not.toMatch(/[0-9]/);
  });

  it('ignores anything it does not recognise', () => {
    expect(productionEffects(['nonsense']).showRating).toBe(0);
    expect(haulUsed(['nonsense'])).toBe(0);
  });
});

describe('the shape of the ladder', () => {
  it('gets dearer as it goes up', () => {
    // Not strictly monotonic — pyro is a smaller cheque than a video wall —
    // but the top half must cost meaningfully more than the bottom half.
    const half = Math.floor(PRODUCTION_LADDER.length / 2);
    const bottom = PRODUCTION_LADDER.slice(0, half).reduce((s, r) => s + r.cost, 0);
    const top = PRODUCTION_LADDER.slice(half).reduce((s, r) => s + r.cost, 0);
    expect(top).toBeGreaterThan(bottom * 3);
  });

  it('puts pyro last, because it is the thing everybody remembers', () => {
    expect(PRODUCTION_LADDER[PRODUCTION_LADDER.length - 1]!.id).toBe('pyro');
  });

  it('takes real money to finish', () => {
    const total = PRODUCTION_LADDER.reduce((s, r) => s + r.cost, 0);
    const trucks = HAULAGE.reduce((s, h) => s + h.cost, 0);
    expect(total + trucks).toBeGreaterThan(1_000_000);
  });
});

describe('fitsOnTruck', () => {
  it('is exact at the boundary rather than approximate', () => {
    const rung = rungById('matRopes')!;
    const tight = { ...pickup, capacity: rung.haulSpace };
    expect(fitsOnTruck([], rung, tight)).toBe(true);
    expect(fitsOnTruck([], rung, { ...tight, capacity: rung.haulSpace - 1 })).toBe(false);
  });
});
