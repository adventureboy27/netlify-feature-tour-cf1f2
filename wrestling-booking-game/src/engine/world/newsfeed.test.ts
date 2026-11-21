import { describe, it, expect } from 'vitest';
import { showLede, verdictLine, type NewsContext } from './newsfeed';
import { defaultWorldSettings } from './settings';

const settings = defaultWorldSettings();

function ctxFor(over: Partial<NewsContext> = {}): NewsContext {
  return {
    titleChanges: [],
    incidents: [],
    bestMatch: { winnerNames: ['Doomsday'], loserNames: ['Wren Stillwater'], stars: 3 },
    showRating: 60,
    showStars: 3,
    settings,
    ...over,
  };
}

describe('what the night leads with', () => {
  it('leads with a belt changing hands', () => {
    const lede = showLede(
      ctxFor({
        titleChanges: [{ titleName: 'Southside Heavyweight Title', championNames: ['Doomsday'] }],
        incidents: ['Somebody turned on somebody else.'],
        bestMatch: { winnerNames: ['A'], loserNames: ['B'], stars: 5 },
      }),
    );
    expect(lede[0]!.kind).toBe('titleChange');
    expect(lede[0]!.text).toContain('Southside Heavyweight Title');
    expect(lede[0]!.text).toContain('Doomsday');
  });

  it('puts something nobody booked above a great match', () => {
    const lede = showLede(
      ctxFor({
        incidents: ['The referee got flattened.'],
        bestMatch: { winnerNames: ['A'], loserNames: ['B'], stars: 5 },
      }),
    );
    expect(lede[0]!.kind).toBe('incident');
    expect(lede[1]!.kind).toBe('match');
  });

  it('names a tag team properly', () => {
    const lede = showLede(
      ctxFor({ titleChanges: [{ titleName: 'Tag Team Titles', championNames: ['Boomtown', 'Doyle Voss'] }] }),
    );
    expect(lede[0]!.text).toContain('Boomtown & Doyle Voss');
  });

  it('leads with the match of the night when nothing bigger happened', () => {
    const lede = showLede(ctxFor({ bestMatch: { winnerNames: ['A'], loserNames: ['B'], stars: 4.5 } }));
    expect(lede[0]!.kind).toBe('match');
    expect(lede[0]!.text).toContain('4.5 stars');
  });

  it('does not call an ordinary match the story of the night', () => {
    const lede = showLede(ctxFor({ bestMatch: { winnerNames: ['A'], loserNames: ['B'], stars: 3 } }));
    expect(lede.every((item) => item.kind !== 'match')).toBe(true);
  });

  it('always says something, even on a night nothing happened', () => {
    const lede = showLede(ctxFor({ bestMatch: null }));
    expect(lede).toHaveLength(1);
    expect(lede[0]!.kind).toBe('verdict');
    expect(lede[0]!.text.length).toBeGreaterThan(0);
  });

  it('is a lede, not a list', () => {
    const lede = showLede(
      ctxFor({
        titleChanges: [
          { titleName: 'A Belt', championNames: ['One'] },
          { titleName: 'B Belt', championNames: ['Two'] },
          { titleName: 'C Belt', championNames: ['Three'] },
          { titleName: 'D Belt', championNames: ['Four'] },
        ],
        incidents: ['Something happened.'],
      }),
    );
    expect(lede).toHaveLength(settings.newsLedeLength);
  });
});

describe('the verdict line', () => {
  it('reads the night', () => {
    expect(verdictLine(ctxFor({ showRating: 90, showStars: 4.5 }))).toContain('talking about');
    expect(verdictLine(ctxFor({ showRating: 20, showStars: 1 }))).toContain('generous');
    expect(verdictLine(ctxFor({ showRating: 55, showStars: 3 }))).toBe('A 3-star night.');
  });
});
