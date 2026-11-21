import { describe, expect, it } from 'vitest';
import { starQuote } from './starQuote';
import { STAR_VERDICTS } from '../../data/starQuotes';

const verdictOf = (stars: number) => (STAR_VERDICTS.find((b) => stars < b.below) ?? STAR_VERDICTS[STAR_VERDICTS.length - 1]!).lines;

describe('the line under the stars', () => {
  it('opens with a verdict that fits how many stars it got', () => {
    for (const stars of [0.5, 1.5, 2.75, 3.5, 4.25, 4.75, 5]) {
      const quote = starQuote(stars, [], 'seed');
      expect(verdictOf(stars).some((v) => quote.startsWith(v))).toBe(true);
    }
  });

  it('gives the biggest real reason: what helped a good match, what hurt a bad one', () => {
    const breakdown = [
      { label: 'Popularity', value: 20 },
      { label: 'Pair chemistry', value: 4 },
      { label: 'Boredom', value: -6 },
      { label: 'Finish', value: 2 },
    ];
    expect(starQuote(4, breakdown, 'a')).toMatch(/click|chemistry/i);
    expect(starQuote(1.5, breakdown, 'a')).toMatch(/too long/i);
  });

  it('says no reason at all rather than one that barely mattered', () => {
    const quote = starQuote(3.5, [{ label: 'Pair chemistry', value: 0.4 }], 'b');
    expect(verdictOf(3.5)).toContain(quote);
  });

  it('says the same thing every time the same match is watched', () => {
    const breakdown = [{ label: 'Finish', value: 3 }];
    expect(starQuote(4, breakdown, 'same')).toBe(starQuote(4, breakdown, 'same'));
  });
});
