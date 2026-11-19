import { describe, expect, it } from 'vitest';
import { audienceRatingBonus, audienceTarget, audienceWords, driftAudience } from './audience';
import { AUDIENCE } from '../../data/audience';
import { SPONSORS, sponsorById } from '../../data/sponsors';
import type { Wrestler } from '../types';

const cereal = sponsorById('nationalBrand')!;
const drink = sponsorById('beerBrand')!;
const local = sponsorById('localBusiness')!;
const flyerFace = { style: 'highFlyer', alignment: 80 } as Pick<Wrestler, 'style' | 'alignment'>;
const brawlerHeel = { style: 'bruiser', alignment: -80 } as Pick<Wrestler, 'style' | 'alignment'>;
const hardcoreHeel = { style: 'hardcore', alignment: -70 } as Pick<Wrestler, 'style' | 'alignment'>;
const showmanFace = { style: 'showman', alignment: 70 } as Pick<Wrestler, 'style' | 'alignment'>;

describe("who's watching", () => {
  it('the cereal brings families in, the sports drink an older crowd, a local business nobody in particular', () => {
    expect(cereal.audience).toBe('family');
    expect(drink.audience).toBe('grownUp');
    expect(audienceTarget([cereal])).toBeLessThan(AUDIENCE.neutral);
    expect(audienceTarget([drink])).toBeGreaterThan(AUDIENCE.neutral);
    expect(audienceTarget([local])).toBe(AUDIENCE.neutral);
    expect(audienceTarget([])).toBe(AUDIENCE.neutral);
  });

  it('changes over a couple of months, not overnight — and drifts back once they are gone', () => {
    let age: number = AUDIENCE.neutral;
    age = driftAudience(age, [drink]);
    // One week moves it a little, nowhere near the target.
    expect(age).toBeGreaterThan(AUDIENCE.neutral);
    expect(age).toBeLessThan(AUDIENCE.neutral + 5);
    for (let w = 1; w < 9; w++) age = driftAudience(age, [drink]);
    // After about two months, most of the way there.
    expect(age).toBeGreaterThan(AUDIENCE.neutral + AUDIENCE.sponsorPush * 0.45);
    for (let w = 0; w < 40; w++) age = driftAudience(age, []);
    expect(Math.abs(age - AUDIENCE.neutral)).toBeLessThan(1);
  });

  it('a mixed crowd tilts nothing', () => {
    expect(audienceRatingBonus([flyerFace, brawlerHeel], 3, AUDIENCE.neutral)).toBe(0);
  });

  it('families reward the flyers and the good guys; grown-ups the brawlers, the villains and the violence', () => {
    const family = 15;
    const grownUp = 85;
    expect(audienceRatingBonus([flyerFace, showmanFace], 0, family)).toBeGreaterThan(0);
    expect(audienceRatingBonus([flyerFace, showmanFace], 0, grownUp)).toBeLessThan(0);
    expect(audienceRatingBonus([brawlerHeel, hardcoreHeel], 4, grownUp)).toBeGreaterThan(0);
    expect(audienceRatingBonus([brawlerHeel, hardcoreHeel], 4, family)).toBeLessThan(0);
    // The same match, more violent, plays better to the grown-ups and worse to the families.
    expect(audienceRatingBonus([flyerFace, brawlerHeel], 5, grownUp)).toBeGreaterThan(audienceRatingBonus([flyerFace, brawlerHeel], 0, grownUp));
    expect(audienceRatingBonus([flyerFace, brawlerHeel], 5, family)).toBeLessThan(audienceRatingBonus([flyerFace, brawlerHeel], 0, family));
  });

  it('is a tilt, not a takeover: never more than a few points either way', () => {
    for (const age of [0, 10, 90, 100]) {
      for (const cast of [[flyerFace, showmanFace], [brawlerHeel, hardcoreHeel]]) {
        expect(Math.abs(audienceRatingBonus(cast, 5, age))).toBeLessThanOrEqual(AUDIENCE.ratingWeight * 1.5 + 1e-9);
      }
    }
  });

  it('is said in words, from families to grown-ups', () => {
    expect(audienceWords(AUDIENCE.neutral)).toBe('A mixed crowd');
    expect(audienceWords(AUDIENCE.floor)).toMatch(/famil/i);
    expect(audienceWords(AUDIENCE.ceiling)).toMatch(/grown-up/i);
  });

  it('every sponsor that leans one way says so, and only those two do', () => {
    expect(SPONSORS.filter((s) => s.audience).map((s) => s.id).sort()).toEqual(['beerBrand', 'nationalBrand']);
  });
});
