import { describe, expect, it } from 'vitest';
import { howHeWent, whatHeLeaves, whoHeWas } from './epitaph';
import type { Title, Wrestler } from '../types';

const TITLES = [
  { id: 't1', name: 'The Southside Heavyweight Championship' },
  { id: 't2', name: 'The Southside Tag Team Championship' },
  { id: 't3', name: 'The Territorial Cup' },
] as Title[];

function man(over: Partial<Wrestler> = {}): Wrestler {
  return {
    id: 'w1',
    name: 'Earl Mercer',
    debutYear: 2000,
    careerStatus: 'midcarder',
    titleReigns: [],
    record: { wins: 0, losses: 0, draws: 0 },
    career: {
      streak: 0,
      bestWinStreak: 0,
      worstLosingStreak: 0,
      longestInjuryWeeks: 0,
      youngestMatchAge: null,
      oldestMatchAge: null,
      bestMatchRating: null,
      worstMatchRating: null,
      matches: 0,
    },
    injuryHistory: [],
    ...over,
  } as Wrestler;
}

const ctx = { currentWeek: 1040, currentYear: 2020, titles: TITLES };

describe('who he was, in one clause', () => {
  it('leads with the hall when he is in it', () => {
    expect(whoHeWas(man({ careerStatus: 'hallOfFamer' }), 2020)).toBe('Hall of Fame');
  });

  it('counts the reigns when there were several', () => {
    const reigns = [1, 2, 3, 4].map((i) => ({ titleId: 't1', startWeek: i * 10, endWeek: i * 10 + 5 }));
    expect(whoHeWas(man({ titleReigns: reigns as never }), 2020)).toBe('4-time champion');
  });

  it('has something to say about a man who never won anything', () => {
    // The one that matters. Most of a roster never holds a belt, and the wall
    // must not read as a judgement on them for it.
    const said = whoHeWas(man({ career: { ...man().career, matches: 300 } }), 2020);
    expect(said).toBeTruthy();
    expect(said).not.toContain('champion');
  });
});

describe('what he leaves', () => {
  it('names the belts rather than counting them', () => {
    const left = whatHeLeaves(
      man({
        titleReigns: [
          { titleId: 't1', startWeek: 100, endWeek: 200 },
          { titleId: 't2', startWeek: 300, endWeek: 340 },
        ] as never,
      }),
      ctx,
    );
    expect(left.join(' ')).toContain('Southside Heavyweight');
    expect(left.join(' ')).toContain('Tag Team');
  });

  it('says how long he carried one when it was a real run', () => {
    const left = whatHeLeaves(man({ titleReigns: [{ titleId: 't1', startWeek: 100, endWeek: 300 }] as never }), ctx);
    expect(left.join(' ')).toMatch(/200 weeks carrying/);
  });

  it('still has something for a man with no belts and no highlights', () => {
    const left = whatHeLeaves(man({ record: { wins: 120, losses: 300, draws: 4 } }), ctx);
    expect(left.length).toBeGreaterThan(0);
    expect(left.join(' ')).toContain('120-300-4');
  });

  it('is a short list, never a wall of statistics', () => {
    const everything = man({
      careerStatus: 'hallOfFamer',
      titleReigns: [1, 2, 3, 4, 5].map((i) => ({ titleId: 't1', startWeek: i, endWeek: i + 100 })) as never,
      record: { wins: 900, losses: 100, draws: 20 },
      career: { ...man().career, bestMatchRating: 96, youngestMatchAge: 19, matches: 2000 },
      injuryHistory: [1, 2, 3, 4, 5].map(() => ({ workedThroughIt: true })) as never,
    });
    expect(whatHeLeaves(everything, ctx).length).toBeLessThanOrEqual(4);
  });
});

describe('how he went', () => {
  it('says it plainly when the company was what killed him', () => {
    const killed = man({
      injuryHistory: [{ workedThroughIt: true }] as never,
      deceased: { wrestlerId: 'w1', cause: 'accident', age: 34, week: 500 },
    });
    expect(howHeWent(killed, 'An accident.')).toContain('did not come back');
  });

  it('leaves an ordinary passing alone', () => {
    const passed = man({ deceased: { wrestlerId: 'w1', cause: 'heart', age: 68, week: 500 } });
    // The cause text is written to follow "has died"; on its own under a name
    // it has to read as a sentence.
    expect(howHeWent(passed, 'suddenly, of a heart attack')).toBe('Died suddenly, of a heart attack.');
  });
});
