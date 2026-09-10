import { describe, expect, it } from 'vitest';
import { computeTvRatings } from './tvRatings';
import { defaultWorldSettings } from './settings';

const settings = defaultWorldSettings();

describe('computeTvRatings', () => {
  it('is empty when nobody is on the air', () => {
    expect(
      computeTvRatings([{ promotionId: 'a', showRating: 60, companyRating: 60, broadcast: false }], settings),
    ).toEqual([]);
  });

  it('skips anybody not broadcasting, but rates everybody who is', () => {
    const results = computeTvRatings(
      [
        { promotionId: 'a', showRating: 60, companyRating: 60, broadcast: true },
        { promotionId: 'b', showRating: 40, companyRating: 40, broadcast: false },
      ],
      settings,
    );
    expect(results.map((r) => r.promotionId)).toEqual(['a']);
  });

  it('gives owned production a real, additive bonus — the field this test locks in', () => {
    // The bug this closes: cameras/productionTruck/advertising declared a
    // tvRating effect that nothing ever read. Same showRating/companyRating,
    // only the bonus differs.
    const base = computeTvRatings(
      [{ promotionId: 'a', showRating: 55, companyRating: 55, broadcast: true }],
      settings,
    )[0]!;
    const withGear = computeTvRatings(
      [{ promotionId: 'a', showRating: 55, companyRating: 55, broadcast: true, tvRatingBonus: 1.5 }],
      settings,
    )[0]!;
    expect(withGear.rating).toBeGreaterThan(base.rating);
    expect(withGear.rating - base.rating).toBeCloseTo(1.5, 1);
  });

  it('never lets the bonus push a rating past the ceiling', () => {
    const result = computeTvRatings(
      [{ promotionId: 'a', showRating: 100, companyRating: 100, broadcast: true, tvRatingBonus: 999 }],
      settings,
    )[0]!;
    expect(result.rating).toBe(settings.tvRatingCeiling);
  });

  it('never lets the rating go negative even with nothing else going for it', () => {
    const result = computeTvRatings(
      [{ promotionId: 'a', showRating: 0, companyRating: 0, broadcast: true }],
      settings,
    )[0]!;
    expect(result.rating).toBeGreaterThanOrEqual(0);
  });

  it('splits share across everybody broadcasting, roughly summing to 100', () => {
    const results = computeTvRatings(
      [
        { promotionId: 'a', showRating: 60, companyRating: 60, broadcast: true },
        { promotionId: 'b', showRating: 50, companyRating: 50, broadcast: true },
      ],
      settings,
    );
    const totalShare = results.reduce((sum, r) => sum + r.share, 0);
    expect(totalShare).toBeCloseTo(100, 0);
  });

  it('rewards a better show and a bigger name with a bigger share', () => {
    const results = computeTvRatings(
      [
        { promotionId: 'strong', showRating: 80, companyRating: 80, broadcast: true },
        { promotionId: 'weak', showRating: 30, companyRating: 30, broadcast: true },
      ],
      settings,
    );
    const strong = results.find((r) => r.promotionId === 'strong')!;
    const weak = results.find((r) => r.promotionId === 'weak')!;
    expect(strong.share).toBeGreaterThan(weak.share);
  });
});
