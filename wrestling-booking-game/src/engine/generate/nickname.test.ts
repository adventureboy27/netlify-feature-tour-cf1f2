import { describe, it, expect } from 'vitest';
import { rngFromSeed } from '../rng';
import { defaultWorldSettings } from '../world/settings';
import {
  hasEarnedNickname,
  nicknameSource,
  generateNickname,
  rollForNickname,
  billedAs,
} from './nickname';
import { generateWrestlers } from './wrestler';
import { MAIN_EVENT_NICKNAMES } from '../../data/nicknames';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();
const ctx = { currentYear: 1985, settings };

function someone(overrides: Partial<Wrestler> = {}): Wrestler {
  const rng = rngFromSeed('nickname-fixture');
  const [w] = generateWrestlers(rng, 1, { currentYear: 1985 });
  return Object.assign(w!, { debutYear: 1975, popularity: 60, nickname: undefined }, overrides);
}

describe('earning a nickname', () => {
  it('gives a rookie nothing, however over they are', () => {
    expect(hasEarnedNickname(someone({ debutYear: 1984, popularity: 95 }), ctx)).toBe(false);
  });

  it('gives a long-serving nobody nothing either', () => {
    const journeyman = someone({ debutYear: 1970, popularity: 20, careerHighPopularity: 25, titleReigns: [] });
    expect(hasEarnedNickname(journeyman, ctx)).toBe(false);
  });

  it('counts a former champion even if they have fallen off', () => {
    const faded = someone({
      popularity: 30,
      careerHighPopularity: 35,
      titleReigns: [
        {
          titleId: 't',
          holderIds: ['x'],
          wonFromIds: null,
          wonByMethod: 'match' as const,
          startWeek: 1,
          endWeek: 40,
          endMethod: 'lostMatch' as const,
        },
      ],
    });
    expect(hasEarnedNickname(faded, ctx)).toBe(true);
  });

  it('never renames somebody who already has one', () => {
    expect(hasEarnedNickname(someone({ nickname: 'The Ace', popularity: 90 }), ctx)).toBe(false);
  });
});

describe('what the nickname is about', () => {
  it('picks the quality that stands furthest above the rest', () => {
    const talker = someone({ charisma: 95, strength: 40, skill: 40, agility: 40, toughness: 40, ego: 20, alignment: 0 });
    expect(nicknameSource(talker, ctx)).toBe('mic');

    const bruiser = someone({ charisma: 30, strength: 96, skill: 40, agility: 30, toughness: 50, ego: 20, alignment: 0 });
    expect(nicknameSource(bruiser, ctx)).toBe('power');
  });

  it('lets a monstrous ego define somebody who is otherwise ordinary', () => {
    const prima = someone({ charisma: 50, strength: 50, skill: 50, agility: 50, toughness: 50, ego: 95, alignment: 0 });
    expect(nicknameSource(prima, ctx)).toBe('ego');
  });

  it('does not treat a normal ego as a defining trait', () => {
    const level = someone({ charisma: 72, strength: 50, skill: 50, agility: 50, toughness: 50, ego: 40, alignment: 0 });
    expect(nicknameSource(level, ctx)).not.toBe('ego');
  });
});

describe('handing them out', () => {
  it('reaches for the grand names only for a genuine draw', () => {
    const rng = rngFromSeed('grand');
    const star = someone({ popularity: 95 });
    const names = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const name = generateNickname(rng, star, new Set(), ctx);
      if (name) names.add(name);
    }
    expect([...names].some((n) => MAIN_EVENT_NICKNAMES.includes(n))).toBe(true);

    const midcarder = someone({ popularity: 58 });
    const midNames = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const name = generateNickname(rng, midcarder, new Set(), ctx);
      if (name) midNames.add(name);
    }
    expect([...midNames].some((n) => MAIN_EVENT_NICKNAMES.includes(n))).toBe(false);
  });

  it('never hands out a name somebody else already has', () => {
    const rng = rngFromSeed('unique');
    const taken = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const name = generateNickname(rng, someone({ popularity: 70 }), taken, ctx);
      if (!name) continue;
      expect(taken.has(name)).toBe(false);
      taken.add(name);
    }
    expect(taken.size).toBeGreaterThan(5);
  });

  it('arrives slowly — years of eligible weeks, not one', () => {
    const rng = rngFromSeed('slow');
    let awarded = 0;
    const weeks = 52 * 3;
    for (let week = 0; week < weeks; week++) {
      if (rollForNickname(rng, someone({ popularity: 70 }), new Set(), ctx)) awarded++;
    }
    // ~2% a week: over three years of eligibility a handful land, and the
    // great majority of weeks pass with nothing happening.
    expect(awarded).toBeGreaterThan(0);
    expect(awarded / weeks).toBeLessThan(0.06);
  });

  it('bills them the way the announcer would', () => {
    expect(billedAs(someone({ name: 'Ray Colt', nickname: 'The Enforcer' }))).toBe('“The Enforcer” Ray Colt');
    expect(billedAs(someone({ name: 'Ray Colt', nickname: undefined }))).toBe('Ray Colt');
  });
});
