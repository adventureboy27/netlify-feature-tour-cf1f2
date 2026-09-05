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

  it('dropping a slot entirely from both arrays is not the same as scoring it 0', () => {
    // The distinction state/store.ts's broadcast-dropout handling depends on
    // (see sim/broadcast.ts): a match nobody at home saw still happened, and
    // is not the same thing as an unfilled slot. Excluding it from both the
    // ratings and the weights leaves the show judged only on what actually
    // aired, rather than judging it as if that slot had gone empty.
    const ratings = [90, 90, 90, 90, 90, 90];
    const weights = TV_SLOT_WEIGHTS;
    const scoredZero = [...ratings];
    scoredZero[2] = null as unknown as number;
    const excluded = computeShowRating(
      ratings.filter((_, i) => i !== 2),
      weights.filter((_, i) => i !== 2),
    );
    const zeroed = computeShowRating(scoredZero, weights);
    expect(excluded).toBeCloseTo(90, 5);
    expect(excluded).toBeGreaterThan(zeroed);
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

  describe('fallProportional', () => {
    // Real defaults: ratingLadderFallMultiplier 0.4, ratingLadderFallProportional 0.05.
    it('leaves an ordinary, small gap falling close to the old flat rate', () => {
      // Gap of 15 (docs/BALANCE.md's own "ordinary shows shed fifteen points"
      // example): 15 * 0.05 = 0.75, close to (if a touch more than) the flat
      // term's own 0.4, so an ordinary dip is still a gentle, gradual thing.
      expect(stepCompanyRatingTowardTarget(95, 80, 1, false, 0.4, 0.05)).toBe(94.25);
    });

    it('makes a huge, sustained gap correct far faster than the flat rate alone would', () => {
      // The played-save number this was built for: a company sitting at 99
      // while the shows it has actually been running deserve a 20.
      const flatOnly = stepCompanyRatingTowardTarget(99, 20, 1, false, 0.4, 0);
      const withProportional = stepCompanyRatingTowardTarget(99, 20, 1, false, 0.4, 0.05);
      expect(flatOnly).toBe(98.6);
      expect(withProportional).toBeCloseTo(95.05, 5);
      expect(withProportional).toBeLessThan(flatOnly - 3);
    });

    it('never overshoots the target even when the proportional term would blow past it', () => {
      expect(stepCompanyRatingTowardTarget(20.5, 20, 1, false, 0.4, 1.5)).toBe(20);
    });

    it('doubles on a PPV, same as the flat term', () => {
      const tv = stepCompanyRatingTowardTarget(99, 20, 1, false, 0.4, 0.05);
      const ppv = stepCompanyRatingTowardTarget(99, 20, 1, true, 0.4, 0.05);
      expect(99 - ppv).toBeCloseTo((99 - tv) * 2, 5);
    });
  });
});
