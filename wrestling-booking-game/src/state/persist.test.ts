import { describe, it, expect, beforeEach } from 'vitest';
import { saveGame, loadGame, savedGameSummary, clearSave } from './persist';
import { createInitialWorld } from './world';
import { rngFromSeed, rngFromState } from '../engine/rng';
import { defaultWorldSettings } from '../engine/world/settings';

// jsdom is not on for these tests, so stand in a minimal localStorage.
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
});

function world() {
  const settings = defaultWorldSettings();
  return createInitialWorld(rngFromSeed(settings.seed), settings);
}

describe('saving a game', () => {
  it('round-trips the world', () => {
    const original = world();
    expect(saveGame(original, 1234)).toBe(true);

    const loaded = loadGame();
    expect(loaded?.world.promotion.name).toBe(original.promotion.name);
    expect(loaded?.world.promotion.rosterIds).toHaveLength(original.promotion.rosterIds.length);
    expect(loaded?.world.titles).toHaveLength(original.titles.length);
    expect(loaded?.rngState).toBe(1234);
  });

  it('summarises the slot without needing the world', () => {
    const original = world();
    original.week = 42;
    saveGame(original, 0);
    expect(savedGameSummary()).toEqual({ promotionName: original.promotion.name, week: 42 });
  });

  it('reports nothing when the slot is empty', () => {
    clearSave();
    expect(loadGame()).toBeNull();
    expect(savedGameSummary()).toBeNull();
  });

  it('refuses a save from a schema it does not understand', () => {
    localStorage.setItem('wbg.save.v1', JSON.stringify({ schema: 99, world: {} }));
    expect(loadGame()).toBeNull();
  });

  it('survives a corrupted slot instead of throwing', () => {
    localStorage.setItem('wbg.save.v1', 'not json {');
    expect(loadGame()).toBeNull();
  });

  it('resumes the random stream where it stopped', () => {
    const live = rngFromSeed('resume-me');
    for (let i = 0; i < 10; i++) live.next();

    const resumed = rngFromState(live.state!());
    expect(resumed.next()).toBe(live.next());
  });
});
