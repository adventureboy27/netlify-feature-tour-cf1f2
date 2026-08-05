import { describe, it, expect } from 'vitest';
import { houseStyleRatingBonus, violenceTolerancePenalty } from './houseStyle';
import { defaultWorldSettings } from '../world/settings';
import type { Wrestler, WrestlingStyle } from '../types';

const settings = defaultWorldSettings();

function worker(style: WrestlingStyle, secondaryStyle?: WrestlingStyle) {
  return { style, secondaryStyle } as Pick<Wrestler, 'style' | 'secondaryStyle'>;
}

describe('house style fit', () => {
  it('rewards a card that suits the company', () => {
    const bonus = houseStyleRatingBonus([worker('hardcore'), worker('bruiser')], 'hardcore', settings);
    expect(bonus).toBeCloseTo(settings.houseStyleRatingWeight);
  });

  it('punishes a card that clashes with it', () => {
    expect(houseStyleRatingBonus([worker('technical'), worker('submission')], 'hardcore', settings)).toBeLessThan(0);
  });

  it('is neutral on a style the company has no opinion about', () => {
    expect(houseStyleRatingBonus([worker('highFlyer')], 'hardcore', settings)).toBe(0);
  });

  it('lets one out-of-place worker in a six-man barely register', () => {
    const fitting = [worker('hardcore'), worker('bruiser'), worker('striker')];
    const withOutsider = [...fitting, worker('technical'), worker('bruiser'), worker('striker')];
    const dilution = houseStyleRatingBonus(withOutsider, 'hardcore', settings);
    const singles = houseStyleRatingBonus([worker('technical'), worker('technical')], 'hardcore', settings);
    expect(dilution).toBeGreaterThan(singles);
  });

  it('does not let a second style wipe out a bad primary', () => {
    // Someone billed as a technician who can also brawl is still a technician
    // in a deathmatch company.
    const bonus = houseStyleRatingBonus([worker('technical', 'hardcore')], 'hardcore', settings);
    expect(bonus).toBeLessThanOrEqual(0);
  });

  it('gives nothing either way for an empty match', () => {
    expect(houseStyleRatingBonus([], 'territory', settings)).toBe(0);
  });
});

describe('violence tolerance', () => {
  it('costs nothing when the card stays inside what the room will take', () => {
    // Level 2 of 5 is 40% — under every archetype's tolerance but old school's.
    expect(violenceTolerancePenalty([2, 2, 2], 'hardcore', settings)).toBe(0);
  });

  it('punishes a bloodbath in front of an old-school crowd', () => {
    const oldSchool = violenceTolerancePenalty([5, 5, 5], 'oldSchool', settings);
    const deathmatch = violenceTolerancePenalty([5, 5, 5], 'hardcore', settings);
    expect(oldSchool).toBeLessThan(0);
    expect(oldSchool).toBeLessThan(deathmatch);
  });

  it('scales with how far past the line you went', () => {
    const some = violenceTolerancePenalty([3], 'oldSchool', settings);
    const more = violenceTolerancePenalty([5], 'oldSchool', settings);
    expect(more).toBeLessThan(some);
  });
});
