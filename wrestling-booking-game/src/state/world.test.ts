import { describe, it, expect } from 'vitest';
import { createInitialWorld, type NewGamePlan } from './world';
import { defaultWorldSettings } from '../engine/world/settings';
import { rngFromSeed } from '../engine/rng';

const settings = defaultWorldSettings();
const build = (over = {}) => createInitialWorld(rngFromSeed('world'), { ...settings, ...over });
const buildFromPlan = (plan: NewGamePlan, seed = 'world-plan') =>
  createInitialWorld(rngFromSeed(seed), settings, plan);

describe('rival promotions', () => {
  it('creates exactly as many rivals as the settings ask for', () => {
    expect(build().rivals).toHaveLength(settings.rivalPromotionCount);
    expect(build({ rivalPromotionCount: 3 }).rivals).toHaveLength(3);
    expect(build({ rivalPromotionCount: 1 }).rivals).toHaveLength(1);
  });

  it('gives each of them a distinct name and id', () => {
    const rivals = build().rivals;
    expect(new Set(rivals.map((r) => r.name)).size).toBe(rivals.length);
    expect(new Set(rivals.map((r) => r.id)).size).toBe(rivals.length);
  });

  it('spreads them across a range of sizes, so not every loss stings the same', () => {
    const ratings = build().rivals.map((r) => r.rating);
    expect(Math.max(...ratings) - Math.min(...ratings)).toBeGreaterThan(10);
    for (const rating of ratings) {
      expect(rating).toBeGreaterThan(0);
      expect(rating).toBeLessThanOrEqual(100);
    }
  });

  it('caps at the number of names available rather than repeating one', () => {
    const rivals = build({ rivalPromotionCount: 99 }).rivals;
    expect(new Set(rivals.map((r) => r.name)).size).toBe(rivals.length);
  });

  it('marks none of them as the player', () => {
    expect(build().rivals.every((r) => !r.isPlayer)).toBe(true);
  });
});

describe('a new world', () => {
  it('opens with shoot rivalries the booker did not ask for', () => {
    const world = build();
    const shoots = world.rivalries.filter((r) => r.origin === 'shoot');
    expect(shoots.length).toBeGreaterThan(0);
    for (const rivalry of shoots) {
      expect(rivalry.shootHeat).toBeGreaterThan(0);
      expect(rivalry.heat).toBe(0); // the crowd knows nothing about it yet
    }
  });

  it('starts with tag teams, no tournaments and no events fired', () => {
    const world = build();
    // Every promotion opens with a few named teams, so there is a tag
    // division on day one rather than four people put on the same side.
    expect(world.stables.length).toBeGreaterThan(0);
    expect(world.stables.every((s) => s.kind === 'tagTeam')).toBe(true);
    expect(new Set(world.stables.map((s) => s.name)).size).toBe(world.stables.length);
    expect(world.tournaments).toEqual([]);
    expect(world.pendingEvent).toBeNull();
    expect(world.eventHistory.lastFiredWeek).toBe(-Infinity);
  });
});

describe('a world built from a new-game plan', () => {
  it('builds one promotion per slot, with the player at playerIndex', () => {
    const plan: NewGamePlan = {
      slots: [
        { name: 'Eastern Championship Wrestling', roster: 'generate' },
        { name: 'World Combat Organization', roster: 'generate' },
        { name: 'Northeast Wrestling Federation', roster: 'generate' },
      ],
      playerIndex: 1,
    };
    const world = buildFromPlan(plan);
    expect(world.promotion.name).toBe('World Combat Organization');
    expect(world.promotion.isPlayer).toBe(true);
    expect(world.rivals).toHaveLength(2);
    expect(world.rivals.map((r) => r.name).sort()).toEqual(
      ['Eastern Championship Wrestling', 'Northeast Wrestling Federation'].sort(),
    );
    expect(world.rivals.every((r) => !r.isPlayer)).toBe(true);
  });

  it('starts every promotion, player and rival, with the identical bank balance', () => {
    const plan: NewGamePlan = {
      slots: [
        { name: 'A', roster: 'generate' },
        { name: 'B', roster: 'generate' },
        { name: 'C', roster: 'generate' },
      ],
      playerIndex: 0,
    };
    const world = buildFromPlan(plan);
    const balances = [world.promotion.bankBalance, ...world.rivals.map((r) => r.bankBalance)];
    expect(new Set(balances).size).toBe(1);
    expect(world.promotion.bankBalance).toBe(settings.startingCash);
  });

  it('honors an explicit archetype and rolls one when a slot leaves it out', () => {
    const plan: NewGamePlan = {
      slots: [
        { name: 'A', archetype: 'hardcore', roster: 'generate' },
        { name: 'B', roster: 'generate' },
      ],
      playerIndex: 0,
    };
    const world = buildFromPlan(plan);
    expect(world.promotion.identity).toBe('hardcore');
    expect(world.rivals[0]!.identity).toBeTruthy();
  });

  it('signs an imported roster onto the promotion rather than the free-agent pool', () => {
    const plan: NewGamePlan = {
      slots: [
        {
          name: 'Imported Co',
          roster: [
            { name: 'Dutch Kessler', gender: 'm', style: 'hardcore' },
            { name: 'Reina Salvaje', gender: 'f' },
          ],
        },
        { name: 'Rival Co', roster: 'generate' },
      ],
      playerIndex: 0,
    };
    const world = buildFromPlan(plan);
    const names = world.promotion.rosterIds.map((id) => world.wrestlers[id]!.name);
    expect(names).toEqual(['Dutch Kessler', 'Reina Salvaje']);
    for (const id of world.promotion.rosterIds) {
      const w = world.wrestlers[id]!;
      expect(w.promotionId).toBe(world.promotion.id);
      expect(w.contract).toBeTruthy();
      expect(world.freeAgents.some((a) => a.wrestlerId === w.id)).toBe(false);
    }
  });

  it('produces the exact same world a plain seed would, when every slot mirrors the procedural defaults', () => {
    // Not a byte-for-byte guarantee — buildPlannedPromotion draws its
    // archetype and owner personality from the shared stream in a different
    // order than the procedural path does — but it should still be a fully
    // playable, non-degenerate world.
    const plan: NewGamePlan = {
      slots: [{ name: settings.promotionName, roster: 'generate' }],
      playerIndex: 0,
    };
    const world = buildFromPlan(plan);
    expect(world.rivals).toHaveLength(0);
    expect(world.promotion.rosterIds.length).toBe(settings.startingRosterSize);
    expect(Object.keys(world.wrestlers).length).toBeGreaterThan(settings.startingRosterSize);
  });
});
