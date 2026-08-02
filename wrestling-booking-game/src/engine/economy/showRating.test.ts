import { describe, expect, it } from 'vitest';
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
  });
});

describe('targetCompanyRatingForStars', () => {
  it('matches the table anchors exactly', () => {
    expect(targetCompanyRatingForStars(1)).toBe(60);
    expect(targetCompanyRatingForStars(2)).toBe(70);
    expect(targetCompanyRatingForStars(3)).toBe(80);
    expect(targetCompanyRatingForStars(4)).toBe(90);
    expect(targetCompanyRatingForStars(5)).toBe(100);
  });

  it('interpolates linearly between anchors for half-stars', () => {
    expect(targetCompanyRatingForStars(1.5)).toBeCloseTo(65, 5);
    expect(targetCompanyRatingForStars(4.5)).toBeCloseTo(95, 5);
  });

  it('clamps below 1 star and above 5 stars', () => {
    expect(targetCompanyRatingForStars(0)).toBe(60);
    expect(targetCompanyRatingForStars(6)).toBe(100);
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
