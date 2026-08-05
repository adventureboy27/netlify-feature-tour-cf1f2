import { describe, it, expect } from 'vitest';
import { createInitialWorld } from './world';
import { defaultWorldSettings } from '../engine/world/settings';
import { rngFromSeed } from '../engine/rng';

const settings = defaultWorldSettings();
const build = (over = {}) => createInitialWorld(rngFromSeed('world'), { ...settings, ...over });

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
