import { describe, expect, it } from 'vitest';
import {
  advance,
  blowOff,
  blowOffQuality,
  investment,
  isLive,
  neglect,
  readyToBlowOff,
  recap,
  stageForInvestment,
  standing,
  storylineBetween,
  storylinesFor,
  whatItNeeds,
  worthNaming,
  type Storyline,
  type StorylineBeat,
} from './storyline';
import { BEAT_WEIGHTS, type StorylineBeatKind } from '../../data/storylineBeats';
import { defaultWorldSettings } from './settings';
import type { Rivalry } from '../types';

const settings = defaultWorldSettings();

function arc(over: Partial<Storyline> = {}): Storyline {
  return {
    id: 'sl1',
    name: 'Bad Blood: Quist and Halvorsen',
    participantIds: ['a', 'b'],
    rivalryId: 'r1',
    stage: 'opening',
    startWeek: 10,
    lastAdvancedWeek: 10,
    beats: [],
    neglectedWeeks: 0,
    resolvedWeek: null,
    payoff: null,
    ...over,
  };
}

function beat(kind: StorylineBeatKind, week = 11): StorylineBeat {
  return { week, kind, text: `Something happened (${kind}).` };
}

/** Book enough of a story to reach a given stage. */
function built(kinds: StorylineBeatKind[], over: Partial<Storyline> = {}): Storyline {
  let story = arc(over);
  kinds.forEach((kind, i) => {
    story = advance(story, beat(kind, 11 + i), settings);
  });
  return story;
}

describe('an arc has a shape', () => {
  it('starts as something the crowd has barely noticed', () => {
    expect(arc().stage).toBe('opening');
    expect(standing(arc())).toBe('Just started');
    expect(readyToBlowOff(arc())).toBe(false);
  });

  it('builds through the things the booker actually books', () => {
    const story = built(['match', 'promo', 'match']);
    expect(story.stage).toBe('building');
    expect(story.beats).toHaveLength(3);
  });

  it('comes to the boil once enough has genuinely happened', () => {
    const story = built(['match', 'promo', 'confrontation', 'match', 'interference', 'match', 'promo']);
    expect(story.stage).toBe('boiling');
    expect(readyToBlowOff(story)).toBe(true);
  });

  it('takes about two months of television, not a fortnight', () => {
    // A feud built in three weeks is a feud nobody believed in. One event a
    // week should not reach the boil before a couple of months.
    let story = arc();
    let weeks = 0;
    while (story.stage !== 'boiling' && weeks < 52) {
      weeks += 1;
      story = advance(story, beat('match', 10 + weeks), settings);
    }
    expect(weeks).toBeGreaterThanOrEqual(6);
  });

  it('never blows itself off by accident', () => {
    // Only blowOff() ends a story. A pile of matches keeps it boiling.
    const story = built(Array(12).fill('match') as StorylineBeatKind[]);
    expect(story.stage).toBe('boiling');
    expect(isLive(story)).toBe(true);
  });
});

describe('what each thing is worth', () => {
  it('makes a match the meat of it', () => {
    expect(BEAT_WEIGHTS.match).toBeGreaterThan(BEAT_WEIGHTS.promo);
  });

  it('makes two people in a room worth more than one people talking', () => {
    expect(BEAT_WEIGHTS.confrontation).toBeGreaterThan(BEAT_WEIGHTS.promo);
  });

  it('makes unfinished business the strongest thing of all', () => {
    // A screwjob is the engine of every feud ever run.
    expect(BEAT_WEIGHTS.interference).toBeGreaterThan(BEAT_WEIGHTS.match);
  });

  it('adds up to the investment the stages read', () => {
    const story = built(['match', 'promo']);
    expect(investment(story)).toBe(BEAT_WEIGHTS.match + BEAT_WEIGHTS.promo);
    expect(stageForInvestment(investment(story), settings)).toBe(story.stage);
  });
});

describe('neglect', () => {
  it('is survivable for a week or two — a week off is not a crisis', () => {
    let story = built(['match', 'promo']);
    story = neglect(story, 20, settings);
    story = neglect(story, 21, settings);
    expect(isLive(story)).toBe(true);
    expect(story.stage).not.toBe('fizzled');
  });

  it('kills a story left alone long enough, and says so', () => {
    let story = built(['match', 'promo', 'match']);
    for (let i = 0; i < settings.storylineFizzleWeeks; i++) {
      story = neglect(story, 20 + i, settings);
    }
    expect(story.stage).toBe('fizzled');
    expect(isLive(story)).toBe(false);
    expect(story.payoff).toBeTruthy();
    expect(story.resolvedWeek).not.toBeNull();
  });

  it('is reset by anything at all — a promo keeps it breathing', () => {
    let story = built(['match']);
    story = neglect(story, 20, settings);
    story = neglect(story, 21, settings);
    expect(story.neglectedWeeks).toBe(2);
    story = advance(story, beat('promo', 22), settings);
    expect(story.neglectedWeeks).toBe(0);
  });

  it('cannot kill something already settled', () => {
    const done = arc({ stage: 'blownOff', resolvedWeek: 30 });
    expect(neglect(done, 40, settings)).toEqual(done);
  });
});

describe('the blow-off', () => {
  const ready = built(['match', 'promo', 'confrontation', 'match', 'interference', 'match', 'promo']);

  it('pays most when the story was told and the match delivered', () => {
    const good = blowOffQuality(ready, 85, ready.lastAdvancedWeek, settings);
    const thin = blowOffQuality(arc(), 85, 10, settings);
    expect(good).toBeGreaterThan(thin);
  });

  it('pays almost nothing for settling something nobody was told about', () => {
    // The player is free to do this. It is simply not worth much.
    const rushed = blowOffQuality(arc(), 60, 10, settings);
    expect(rushed).toBeLessThan(0.7);
    expect(rushed).toBeGreaterThan(0);
  });

  it('is worth less the longer a ready story is sat on', () => {
    const now = blowOffQuality(ready, 80, ready.lastAdvancedWeek, settings);
    const later = blowOffQuality(ready, 80, ready.lastAdvancedWeek + 12, settings);
    expect(later).toBeLessThan(now);
  });

  it('still rewards a bad match at the end of a great story, and vice versa', () => {
    const greatStoryBadMatch = blowOffQuality(ready, 20, ready.lastAdvancedWeek, settings);
    const noStoryGreatMatch = blowOffQuality(arc(), 95, 10, settings);
    expect(greatStoryBadMatch).toBeGreaterThan(0);
    expect(noStoryGreatMatch).toBeGreaterThan(0);
  });

  it('writes what happened, in words that match how it went', () => {
    const great = blowOff(ready, 30, 'Aaron Quist', 1.4, settings);
    const poor = blowOff(ready, 30, 'Aaron Quist', 0.3, settings);
    expect(great.payoff).toContain('Aaron Quist');
    expect(poor.payoff).toContain('Aaron Quist');
    expect(great.payoff).not.toBe(poor.payoff);
    expect(great.stage).toBe('blownOff');
    expect(isLive(great)).toBe(false);
  });
});

describe('what the crowd is waiting for', () => {
  it('asks for talking when there has been none', () => {
    expect(whatItNeeds(built(['match']), 12, settings)).toMatch(/said a word|talk/i);
  });

  it('asks for a match when there has been nothing but talking', () => {
    expect(whatItNeeds(built(['promo', 'promo']), 13, settings)).toMatch(/ring|fighting/i);
  });

  it('says plainly when a ready story is ready', () => {
    const ready = built(['match', 'promo', 'confrontation', 'match', 'interference', 'match', 'promo']);
    expect(whatItNeeds(ready, ready.lastAdvancedWeek, settings)).toMatch(/ready/i);
  });

  it('says when they are being left to forget it', () => {
    const story = built(['match', 'promo']);
    expect(whatItNeeds(story, story.lastAdvancedWeek + settings.storylineColdWeeks, settings)).toMatch(
      /forget/i,
    );
  });

  it('never tells the booker what not to do', () => {
    // CLAUDE.md: the game never warns before a bad decision. This describes
    // the crowd; it does not give instructions against anything.
    const cases = [
      arc(),
      built(['match']),
      built(['promo', 'promo']),
      built(['match', 'promo', 'confrontation', 'match', 'interference', 'match', 'promo']),
    ];
    for (const story of cases) {
      const line = whatItNeeds(story, story.lastAdvancedWeek + 1, settings);
      expect(line, line).not.toMatch(/\bdo not\b|\bdon't\b|\bavoid\b|\bshould not\b|\bwarning\b/i);
      expect(line.length).toBeGreaterThan(15);
    }
  });

  it('has something to say at every stage, including the dead ones', () => {
    for (const stage of ['opening', 'building', 'boiling', 'blownOff', 'fizzled'] as const) {
      const line = whatItNeeds(arc({ stage, payoff: 'They settled it in a cage and neither one shook hands.' }), 20, settings);
      expect(line.length, stage).toBeGreaterThan(10);
      expect(standing(arc({ stage })).length, stage).toBeGreaterThan(3);
    }
  });
});

describe('finding them', () => {
  it('reads an arc back as the story it is', () => {
    const story = built(['match', 'promo', 'match']);
    expect(recap(story)).toHaveLength(3);
    expect(recap(story)[0]).toContain('match');
  });

  it('finds the live arcs somebody is in and ignores the dead ones', () => {
    const live = arc({ id: 'live', participantIds: ['a', 'b'] });
    const dead = arc({ id: 'dead', participantIds: ['a', 'c'], stage: 'fizzled' });
    expect(storylinesFor([live, dead], ['a']).map((s) => s.id)).toEqual(['live']);
  });

  it('finds the arc between exactly these two', () => {
    const live = arc({ participantIds: ['a', 'b'] });
    expect(storylineBetween([live], ['b', 'a'])?.id).toBe('sl1');
    expect(storylineBetween([live], ['a', 'c'])).toBeUndefined();
  });
});

describe('when the office suggests naming one', () => {
  const rivalry = (over: Partial<Rivalry> = {}): Rivalry => ({
    id: 'r1',
    participantIds: ['a', 'b'],
    origin: 'worked',
    heat: 60,
    shootHeat: 0,
    startWeek: 5,
    lastAdvancedWeek: 10,
    matchesContested: 3,
    blowoffBooked: false,
    resolvedWeek: null,
    ...over,
  });

  it('suggests one for a feud with real heat and no story on it', () => {
    expect(worthNaming(rivalry(), [], settings)).toBe(true);
  });

  it('leaves a cold feud alone — most are just two people being booked', () => {
    expect(worthNaming(rivalry({ heat: 10 }), [], settings)).toBe(false);
  });

  it('does not suggest one that already exists', () => {
    expect(worthNaming(rivalry(), [arc({ rivalryId: 'r1' })], settings)).toBe(false);
    // But a fizzled arc leaves the feud free to be named again.
    expect(worthNaming(rivalry(), [arc({ rivalryId: 'r1', stage: 'fizzled' })], settings)).toBe(true);
  });

  it('never suggests one for something already settled', () => {
    expect(worthNaming(rivalry({ resolvedWeek: 12 }), [], settings)).toBe(false);
  });
});
