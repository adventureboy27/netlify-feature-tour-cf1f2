import { describe, it, expect } from 'vitest';
import { isEligible, hallOfFameScore, annualInductions, citationFor } from './hallOfFame';
import { defaultWorldSettings } from '../world/settings';
import { rngFromSeed } from '../rng';
import { generateWrestlers } from '../generate/wrestler';
import type { TitleReignRecord, Wrestler } from '../types';

const settings = defaultWorldSettings();
const ctx = { currentWeek: 520, currentYear: 2000, settings };

function reigns(count: number, weeksEach: number): TitleReignRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    titleId: `t${i}`,
    holderIds: ['x'],
    wonFromIds: null,
    wonByMethod: 'match' as const,
    startWeek: i * 60,
    endWeek: i * 60 + weeksEach,
    endMethod: 'lostMatch' as const,
  }));
}

function career(overrides: Partial<Wrestler> = {}): Wrestler {
  const [w] = generateWrestlers(rngFromSeed('hof-fixture'), 1, { currentYear: 2000 });
  return Object.assign(w!, {
    careerStatus: 'retired' as const,
    debutYear: 1980,
    careerHighPopularity: 60,
    titleReigns: [],
    hallOfFameWeek: undefined,
    deceased: undefined,
    ...overrides,
  });
}

describe('who can go in', () => {
  it('will not consider an active wrestler', () => {
    expect(isEligible(career({ careerStatus: 'mainEventer' }), ctx)).toBe(false);
  });

  it('considers anyone retired', () => {
    expect(isEligible(career(), ctx)).toBe(true);
  });

  it('considers somebody who has died straight away', () => {
    const gone = career({
      careerStatus: 'mainEventer',
      deceased: { wrestlerId: 'x', cause: 'heart', age: 44, week: 400 },
    });
    expect(isEligible(gone, ctx)).toBe(true);
  });

  it('never inducts the same person twice', () => {
    expect(isEligible(career({ hallOfFameWeek: 100 }), ctx)).toBe(false);
  });
});

describe('the case for them', () => {
  it('rates a drawing card above a long ordinary career', () => {
    const draw = hallOfFameScore(career({ careerHighPopularity: 95, titleReigns: reigns(2, 40) }), ctx);
    const journeyman = hallOfFameScore(career({ careerHighPopularity: 45, debutYear: 1970 }), ctx);
    expect(draw).toBeGreaterThan(journeyman);
  });

  it('keeps a twenty-year midcarder out', () => {
    const lifer = career({ careerHighPopularity: 48, debutYear: 1978, titleReigns: reigns(1, 20) });
    expect(hallOfFameScore(lifer, ctx)).toBeLessThan(settings.hofScoreThreshold);
  });

  it('lets a short brilliant career in', () => {
    const phenomenon = career({
      careerHighPopularity: 96,
      debutYear: 1993,
      titleReigns: reigns(4, 60),
    });
    expect(hallOfFameScore(phenomenon, ctx)).toBeGreaterThanOrEqual(settings.hofScoreThreshold);
  });
});

describe('the annual class', () => {
  it('takes the best cases first and caps the intake', () => {
    const candidates = [
      career({ id: 'a', careerHighPopularity: 99, titleReigns: reigns(6, 80) }),
      career({ id: 'b', careerHighPopularity: 92, titleReigns: reigns(5, 70) }),
      career({ id: 'c', careerHighPopularity: 88, titleReigns: reigns(4, 60) }),
    ];
    const class1 = annualInductions(candidates, ctx);
    expect(class1).toHaveLength(settings.hofInductionsPerYear);
    expect(class1[0]!.wrestlerId).toBe('a');
  });

  it('inducts nobody in a year with no case', () => {
    expect(annualInductions([career({ careerHighPopularity: 30 })], ctx)).toHaveLength(0);
  });

  it('says what they went in for', () => {
    const champion = career({ careerHighPopularity: 90, titleReigns: reigns(5, 80) });
    expect(citationFor(champion, ctx)).toContain('5-time champion');
  });

  it('can be switched off', () => {
    const off = { ...ctx, settings: { ...settings, hallOfFameEnabled: false } };
    expect(annualInductions([career({ careerHighPopularity: 99, titleReigns: reigns(6, 80) })], off)).toHaveLength(0);
  });
});
