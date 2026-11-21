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

  it('leaves the identity-only bonus untouched when no taste is passed', () => {
    // Every caller before fan taste existed keeps behaving byte-for-byte
    // the same — this is the whole reason currentTaste is optional.
    const withTaste = houseStyleRatingBonus(
      [worker('hardcore')],
      'hardcore',
      settings,
      { hardcore: 50 },
    );
    const without = houseStyleRatingBonus([worker('hardcore')], 'hardcore', settings);
    expect(withTaste).toBe(without);
  });

  it('rewards a style the crowd has genuinely come to love, on top of identity', () => {
    const loved = houseStyleRatingBonus([worker('luchador')], 'hardcore', settings, { luchador: 95 });
    const neutralTaste = houseStyleRatingBonus([worker('luchador')], 'hardcore', settings, { luchador: 50 });
    expect(loved).toBeGreaterThan(neutralTaste);
  });

  it('costs a style the crowd has genuinely gone cold on', () => {
    const cold = houseStyleRatingBonus([worker('hardcore')], 'hardcore', settings, { hardcore: 5 });
    const neutralTaste = houseStyleRatingBonus([worker('hardcore')], 'hardcore', settings, { hardcore: 50 });
    expect(cold).toBeLessThan(neutralTaste);
  });

  it('treats a style missing from the taste record as neutral, not zero', () => {
    const missing = houseStyleRatingBonus([worker('giant')], 'territory', settings, {});
    const explicitNeutral = houseStyleRatingBonus([worker('giant')], 'territory', settings, { giant: 50 });
    expect(missing).toBe(explicitNeutral);
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
