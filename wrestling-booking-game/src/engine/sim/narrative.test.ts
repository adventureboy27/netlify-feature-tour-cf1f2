import { describe, it, expect } from 'vitest';
import { generateBeats, beatCount, type NarrativeContext } from './narrative';
import { rngFromSeed } from '../rng';
import { generateWrestlers } from '../generate/wrestler';
import { createStartingTitles } from '../../data/titles';
import { stipulationById } from '../../data/stipulations';
import type { Wrestler } from '../types';

function pair(): [Wrestler, Wrestler] {
  const [a, b] = generateWrestlers(rngFromSeed('narrative'), 2, { currentYear: 1985 });
  return [a!, b!];
}

function ctxFor(over: Partial<NarrativeContext> = {}): NarrativeContext {
  const [a, b] = pair();
  return {
    winnerMembers: [a],
    loserMembers: [b],
    finish: 'cleanPin',
    stars: 3,
    rating: 60,
    ...over,
  };
}

function reel(over: Partial<NarrativeContext> = {}, seed = 'reel') {
  return generateBeats(rngFromSeed(seed), ctxFor(over));
}

describe('how long the reel runs', () => {
  it('gives a squash almost nothing to say', () => {
    expect(beatCount(ctxFor({ rating: 12 }))).toBe(3);
    expect(reel({ rating: 12 }).length).toBeLessThanOrEqual(3);
  });

  it('gives a classic room to breathe', () => {
    expect(beatCount(ctxFor({ rating: 92 }))).toBeGreaterThan(beatCount(ctxFor({ rating: 40 })));
    expect(reel({ rating: 92 }).length).toBeGreaterThan(reel({ rating: 40 }).length);
  });

  it('pays the main event and a title match an extra beat each', () => {
    const plain = beatCount(ctxFor({ rating: 70 }));
    const main = beatCount(ctxFor({ rating: 70, isMainEvent: true }));
    const titled = beatCount(ctxFor({ rating: 70, titles: createStartingTitles('p', 'Atlas Pro', 'athletic') }));
    expect(main).toBe(plain + 1);
    expect(titled).toBe(plain + 1);
  });

  it('never runs away with itself', () => {
    const huge = reel({
      rating: 100,
      isMainEvent: true,
      titles: createStartingTitles('p', 'Atlas Pro', 'athletic'),
      shootHeat: 100,
    });
    expect(huge.length).toBeLessThanOrEqual(8);
  });

  it('always opens and always finishes', () => {
    for (const rating of [5, 30, 55, 75, 95]) {
      const beats = reel({ rating });
      expect(beats[0]!.kind).toBe('openingExchange');
      expect(beats.some((b) => b.kind === 'finish')).toBe(true);
    }
  });
});

describe('what the reel talks about', () => {
  it('says what the match was for when a belt was on it', () => {
    const titles = createStartingTitles('p', 'Southside Championship Wrestling', 'territory');
    const text = reel({ rating: 75, titles }).map((b) => b.text).join(' ');
    expect(text).toContain(titles[0]!.name);
  });

  it('reads as a fight when the animosity is real', () => {
    const worked = reel({ rating: 75, shootHeat: 0 }).map((b) => b.text).join(' ');
    const shoot = reel({ rating: 75, shootHeat: 90 }).map((b) => b.text).join(' ');
    expect(shoot).not.toBe(worked);
    expect(/properly|separate them|wrestling match|settled/.test(shoot)).toBe(true);
  });

  it('never repeats a line inside one match', () => {
    for (let i = 0; i < 40; i++) {
      const beats = reel({ rating: 90, isMainEvent: true, shootHeat: 60 }, `dupes-${i}`);
      const texts = beats.map((b) => b.text);
      expect(new Set(texts).size).toBe(texts.length);
    }
  });

  it('fills in every placeholder', () => {
    for (let i = 0; i < 60; i++) {
      const titles = createStartingTitles('p', 'Atlas Pro', 'athletic');
      const beats = reel({ rating: 95, isMainEvent: true, titles, shootHeat: 80 }, `fill-${i}`);
      for (const beat of beats) expect(beat.text).not.toMatch(/\{[a-z]+\}/);
    }
  });

  it('still lets a stipulation describe its own finish', () => {
    const beats = reel({ rating: 60, finish: 'knockout', stipulation: stipulationById('tables') ?? null });
    const finish = beats.find((b) => b.kind === 'finish')!;
    expect(finish.text.toLowerCase()).toContain('table');
  });

  it('uses the winner’s style for the control beat', () => {
    const [a, b] = pair();
    const highFlyer = { ...a, style: 'highFlyer' as const };
    const text = generateBeats(rngFromSeed('style'), {
      winnerMembers: [highFlyer],
      loserMembers: [b],
      finish: 'cleanPin',
      stars: 4,
      rating: 80,
    })
      .map((beat) => beat.text)
      .join(' ');
    expect(/top rope|dive/.test(text)).toBe(true);
  });
});
