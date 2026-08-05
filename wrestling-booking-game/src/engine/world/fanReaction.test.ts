import { describe, it, expect } from 'vitest';
import { generateFanReaction, crowdVerdict, approvalShare, type FanReactionContext } from './fanReaction';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';

const settings = defaultWorldSettings();

function ctxFor(over: Partial<FanReactionContext> = {}): FanReactionContext {
  return {
    showRating: 60,
    promotionName: 'Southside Championship Wrestling',
    bestMatch: { rating: 85, winnerName: 'Doomsday', loserName: 'Wren Stillwater' },
    worstMatch: { rating: 20, winnerName: 'Zero', loserName: 'Cutthroat' },
    settings,
    ...over,
  };
}

const feed = (over: Partial<FanReactionContext> = {}, seed = 'fans') =>
  generateFanReaction(rngFromSeed(seed), ctxFor(over));

describe('the shape of the feed', () => {
  it('produces a full feed', () => {
    const tweets = feed();
    // The requested count, plus at most one appended dissenter.
    expect(tweets.length).toBeGreaterThanOrEqual(settings.fanTweetsPerShow);
    expect(tweets.length).toBeLessThanOrEqual(settings.fanTweetsPerShow + 1);
  });

  it('never uses the same handle twice in one night', () => {
    const handles = feed().map((t) => t.handle);
    expect(new Set(handles).size).toBe(handles.length);
  });

  it('never repeats itself', () => {
    const texts = feed().map((t) => t.text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('fills in every placeholder', () => {
    for (let i = 0; i < 40; i++) {
      for (const tweet of feed({ showRating: i * 2.5 }, `fill-${i}`)) {
        expect(tweet.text).not.toMatch(/\{[a-z]+\}/);
      }
    }
  });
});

describe('the tone follows the show', () => {
  it('is mostly praise after a great night', () => {
    const tweets = feed({ showRating: 92 }, 'great');
    const praise = tweets.filter((t) => t.tone === 'praise').length;
    const criticism = tweets.filter((t) => t.tone === 'criticism').length;
    expect(praise).toBeGreaterThan(criticism);
  });

  it('is mostly complaints after a bad one', () => {
    const tweets = feed({ showRating: 15 }, 'bad');
    const praise = tweets.filter((t) => t.tone === 'praise').length;
    const criticism = tweets.filter((t) => t.tone === 'criticism').length;
    expect(criticism).toBeGreaterThan(praise);
  });

  it('never lets the room agree unanimously', () => {
    for (const rating of [5, 25, 50, 75, 98]) {
      const tweets = feed({ showRating: rating }, `split-${rating}`);
      const tones = new Set(tweets.map((t) => t.tone));
      expect(tones.size).toBeGreaterThan(1);
    }
    // The approval share is clamped away from both extremes.
    expect(approvalShare(100, settings)).toBeLessThan(1);
    expect(approvalShare(0, settings)).toBeGreaterThan(0);
  });

  it('always includes somebody arguing with everybody else', () => {
    for (const rating of [10, 45, 90]) {
      const tweets = feed({ showRating: rating }, `contra-${rating}`);
      expect(tweets.some((t) => t.tone === 'contrarian')).toBe(true);
    }
  });

  it('gives the contrarian take less engagement than the popular one', () => {
    const tweets = feed({ showRating: 88 }, 'likes');
    const contrarian = tweets.filter((t) => t.tone === 'contrarian');
    const popular = tweets.filter((t) => t.tone === 'praise');
    if (contrarian.length && popular.length) {
      const avg = (list: typeof tweets) => list.reduce((sum, t) => sum + t.likes, 0) / list.length;
      expect(avg(contrarian)).toBeLessThan(avg(popular));
    }
  });
});

describe('what they talk about', () => {
  it('leads with a belt changing hands', () => {
    const tweets = feed({
      showRating: 70,
      titleChanges: [{ titleName: 'Southside Heavyweight Title', championName: 'Doomsday' }],
    });
    const opener = tweets.slice(0, 2).map((t) => t.text).join(' ');
    expect(/Southside Heavyweight Title|CHAMPION|Doomsday/.test(opener)).toBe(true);
  });

  it('names the people who were in the best and worst matches', () => {
    const text = feed({ showRating: 80 }, 'names').map((t) => t.text).join(' ');
    expect(/Doomsday|Wren Stillwater|Cutthroat|Zero/.test(text)).toBe(true);
  });

  it('asks for things as well as reacting', () => {
    const tones = new Set(feed({ showRating: 75 }, 'demands').map((t) => t.tone));
    expect(tones.has('demand') || tones.has('praise')).toBe(true);
  });

  it('copes with a show where nothing stood out', () => {
    const tweets = feed({ bestMatch: null, worstMatch: null }, 'empty');
    expect(tweets.length).toBeGreaterThan(0);
    for (const tweet of tweets) expect(tweet.text).not.toMatch(/\{[a-z]+\}/);
  });
});

describe('the verdict line', () => {
  it('reads the room', () => {
    expect(crowdVerdict(95)).toContain('lost its mind');
    expect(crowdVerdict(75)).toBe('They loved it.');
    expect(crowdVerdict(50)).toContain('Split');
    expect(crowdVerdict(10)).toContain('furious');
  });
});
