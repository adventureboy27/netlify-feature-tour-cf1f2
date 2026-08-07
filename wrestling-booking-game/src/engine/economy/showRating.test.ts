import { describe, expect, it } from 'vitest';
import { defaultWorldSettings } from '../world/settings';
import { computeShowRating, ratingToStars, targetCompanyRatingForStars, stepCompanyRatingTowardTarget, TV_SLOT_WEIGHTS } from './showRating';

describe('computeShowRating', () => {
  it('averages to the flat rating when every segment scores the same', () => {
    const ratings = TV_SLOT_WEIGHTS.map(() => 70);
    expect(computeShowRating(ratings, TV_SLOT_WEIGHTS)).toBeCloseTo(70, 5);
  });

  it('treats an unfilled segment as a 0 against the full denominator', () => {
    const full = TV_SLOT_WEIGHTS.map(() => 80);
    const withGap = [80, 80, 80, 80, 80, null];
    expect(computeShowRating(withGap, TV_SLOT_WEIGHTS)).toBeLessThan(computeShowRating(full, TV_SLOT_WEIGHTS));
  });

  it('weights the main event slot more heavily than the opener', () => {
    const strongOpener = [100, 50, 50, 50, 50, 50];
    const strongMainEvent = [50, 50, 50, 50, 50, 100];
    expect(computeShowRating(strongMainEvent, TV_SLOT_WEIGHTS)).toBeGreaterThan(computeShowRating(strongOpener, TV_SLOT_WEIGHTS));
  });
});

describe('ratingToStars', () => {
  it('converts 0-100 to 0-5 in half-star steps', () => {
    expect(ratingToStars(100)).toBe(5);
    expect(ratingToStars(0)).toBe(0);
    expect(ratingToStars(50)).toBe(2.5);
    // Quarter stars: 3.75 and 4 are different bookings.
    expect(ratingToStars(75)).toBe(3.75);
    expect(ratingToStars(85)).toBe(4.25);
    expect(ratingToStars(5)).toBe(0.25);
    for (let r = 0; r <= 100; r += 0.5) expect((ratingToStars(r) * 4) % 1).toBe(0);
  });
});

const settings = defaultWorldSettings();

describe('targetCompanyRatingForStars', () => {
  it('matches the configured anchors exactly', () => {
    for (const [stars, target] of settings.ratingLadderAnchors) {
      expect(targetCompanyRatingForStars(stars, settings)).toBeCloseTo(target, 5);
    }
  });

  it('interpolates linearly between anchors for half-stars', () => {
    expect(targetCompanyRatingForStars(1.5, settings)).toBeCloseTo(23.5, 5);
    expect(targetCompanyRatingForStars(4.5, settings)).toBeCloseTo(87.5, 5);
  });

  it('clamps below the first anchor and above the last', () => {
    expect(targetCompanyRatingForStars(0, settings)).toBe(15);
    expect(targetCompanyRatingForStars(6, settings)).toBe(100);
  });

  it('uses the whole rating range, not just the top of it', () => {
    // The bug this locks: the shipped table ran 60 to 100, so the worst show
    // the sim can produce still dragged a promotion up to 60/100 and an
    // ordinary three-star night was worth 80. Being bad at the game could not
    // be expressed, and a bad month cost nothing.
    const worst = targetCompanyRatingForStars(1, settings);
    const ordinary = targetCompanyRatingForStars(3, settings);
    expect(worst).toBeLessThan(25);
    expect(ordinary).toBeLessThan(60);
  });

  it('rises the whole way and never plateaus', () => {
    let previous = -1;
    for (let stars = 1; stars <= 5; stars += 0.25) {
      const target = targetCompanyRatingForStars(stars, settings);
      expect(target, `${stars} stars`).toBeGreaterThan(previous);
      previous = target;
    }
  });

  it('makes the last stretch the hardest, so great is further from good than good is from ordinary', () => {
    const ordinaryToGood = targetCompanyRatingForStars(4, settings) - targetCompanyRatingForStars(3, settings);
    const goodToGreat = targetCompanyRatingForStars(5, settings) - targetCompanyRatingForStars(4, settings);
    const poorToOrdinary = targetCompanyRatingForStars(3, settings) - targetCompanyRatingForStars(2, settings);
    expect(ordinaryToGood).toBeGreaterThan(poorToOrdinary);
    expect(goodToGreat).toBeGreaterThanOrEqual(ordinaryToGood);
  });
});

describe('stepCompanyRatingTowardTarget', () => {
  it('moves 1 point/week toward the target on a normal show', () => {
    expect(stepCompanyRatingTowardTarget(50, 80, 1, false)).toBe(51);
    expect(stepCompanyRatingTowardTarget(50, 20, 1, false)).toBe(49);
  });

  it('moves 2 points after a PPV', () => {
    expect(stepCompanyRatingTowardTarget(50, 80, 1, true)).toBe(52);
  });

  it('never overshoots the target', () => {
    expect(stepCompanyRatingTowardTarget(79.5, 80, 1, false)).toBe(80);
    expect(stepCompanyRatingTowardTarget(79.5, 80, 1, true)).toBe(80);
  });

  it('holds steady once at the target', () => {
    expect(stepCompanyRatingTowardTarget(80, 80, 1, false)).toBe(80);
  });
});
