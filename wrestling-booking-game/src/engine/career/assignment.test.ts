// The weeks nobody is booked for.
//
// Two things this has to get right, and they pull against each other. It has
// to actually develop a roster — `potentials` and `growthRate` had sat on
// Wrestler since the first commit without a single reader, so nobody in this
// game had ever improved at anything. And it has to cost nothing in attention:
// a booker who never opens the screen must still get a roster that grows.

import { describe, expect, it } from 'vitest';
import {
  ASSIGNMENTS,
  assignmentById,
  assignmentLine,
  assignmentOf,
  autoAssignment,
  learningRate,
  weekOff,
} from './assignment';
import { defaultWorldSettings } from '../world/settings';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

function person(over: Partial<Wrestler> = {}): Wrestler {
  return {
    id: 'w1',
    name: 'Somebody',
    age: 26,
    growthRate: 1,
    strength: 50,
    skill: 50,
    agility: 50,
    stamina: 50,
    ringIQ: 50,
    charisma: 50,
    popularity: 50,
    health: 100,
    energy: 100,
    morale: 55,
    gimmickFreshness: 80,
    consecutiveWeeksWorked: 0,
    injury: null,
    traits: [],
    potentials: { strength: 90, skill: 90, agility: 90, stamina: 90, charisma: 90 },
    ...over,
  } as unknown as Wrestler;
}

describe('the office deciding for you', () => {
  it('sends somebody hurt home, whatever else is true about them', () => {
    expect(autoAssignment(person({ injury: { weeksRemaining: 4 } as never }), settings)).toBe('rest');
    expect(autoAssignment(person({ health: 30, ringIQ: 10 }), settings)).toBe('rest');
  });

  it('puts somebody who gets lost out there in the ring', () => {
    expect(autoAssignment(person({ ringIQ: 20 }), settings)).toBe('ring');
  });

  it('leaves the ordinary week to the gym rather than the ring', () => {
    // The threshold has to sit below the middle of the roster or ring work
    // becomes the default for everybody and nobody ever trains.
    expect(autoAssignment(person({ ringIQ: 52 }), settings)).toBe('gym');
  });

  it('builds everybody else', () => {
    expect(autoAssignment(person({ ringIQ: 80 }), settings)).toBe('gym');
  });

  it('does not quietly hand Wants More Time Off a standing excuse', () => {
    // It had one, and it was wrong twice: the trait already takes more morale
    // from a week at home and already charges the road when they are worked,
    // and over two measured years the override was the second largest reason
    // anybody rested at all — ahead of being worn out. Looking after that
    // person is the booker's call, on the panel.
    const worn = person({ traits: ['wantsMoreTimeOff'] as never, consecutiveWeeksWorked: 12, ringIQ: 80 });
    expect(autoAssignment(worn, settings)).toBe('gym');
    // Hurt is still hurt, whoever they are.
    expect(autoAssignment({ ...worn, health: 20 }, settings)).toBe('rest');
  });

  it('is what happens when the booker has never touched anything', () => {
    const untouched = person({ ringIQ: 20 });
    expect(assignmentOf(untouched, settings)).toBe('ring');
    expect(assignmentOf({ ...untouched, assignment: 'auto' }, settings)).toBe('ring');
  });

  it('does what it was told the moment it is told', () => {
    expect(assignmentOf(person({ ringIQ: 20, assignment: 'appearances' }), settings)).toBe('appearances');
  });

  it('says whose choice it was, so nobody thinks they pinned thirty people', () => {
    expect(assignmentLine(person(), settings)).toContain('office');
    expect(assignmentLine(person({ assignment: 'rest' }), settings)).not.toContain('office');
  });
});

describe('who improves, and how fast', () => {
  it('reads growthRate, which nothing in the game ever had', () => {
    const gifted = learningRate(person({ growthRate: 1.6 }), settings);
    const plodder = learningRate(person({ growthRate: 0.4 }), settings);
    expect(gifted).toBeGreaterThan(plodder);
  });

  it('is a young person’s game', () => {
    expect(learningRate(person({ age: 22 }), settings)).toBeGreaterThan(
      learningRate(person({ age: 33 }), settings),
    );
  });

  it('stops entirely at some point, or every veteran roster becomes a young one', () => {
    expect(learningRate(person({ age: 45 }), settings)).toBe(0);
  });
});

describe('a week in the gym', () => {
  it('moves the physical stats and nothing else', () => {
    const week = weekOff(person(), 'gym', settings);
    expect(week.strength).toBeGreaterThan(0);
    expect(week.agility).toBeGreaterThan(0);
    expect(week.stamina).toBeGreaterThan(0);
    expect(week.ringIQ).toBe(0);
    expect(week.popularity).toBe(0);
  });

  it('will not push anybody past their ceiling', () => {
    const maxed = person({ strength: 90, potentials: { strength: 90, skill: 90, agility: 90, stamina: 90, charisma: 90 } as never });
    expect(weekOff(maxed, 'gym', settings).strength).toBe(0);
    // And slows down as it gets close, rather than stopping dead at the line.
    const nearly = weekOff(person({ strength: 85 }), 'gym', settings).strength;
    const miles = weekOff(person({ strength: 30 }), 'gym', settings).strength;
    expect(nearly).toBeLessThan(miles);
  });

  it('is not a rest week', () => {
    expect(weekOff(person(), 'gym', settings).energy).toBeLessThan(0);
  });
});

describe('a week in the ring', () => {
  it('is the only thing that moves ring intelligence', () => {
    for (const kind of ASSIGNMENTS) {
      const week = weekOff(person(), kind.id, settings);
      if (kind.id === 'ring') expect(week.ringIQ).toBeGreaterThan(0);
      else expect(week.ringIQ, kind.id).toBe(0);
    }
  });

  it('has no ceiling handed to it, because knowing what to do is learned', () => {
    // Deliberately not gated on `potentials` — that is the difference between
    // this and workrate, and the whole reason ring IQ is its own number.
    const capped = person({ ringIQ: 40, potentials: { strength: 41, skill: 41, agility: 41, stamina: 41, charisma: 41 } as never });
    expect(weekOff(capped, 'ring', settings).ringIQ).toBeGreaterThan(0);
  });

  it('gets slower the closer somebody is to knowing it all', () => {
    expect(weekOff(person({ ringIQ: 95 }), 'ring', settings).ringIQ).toBeLessThan(
      weekOff(person({ ringIQ: 25 }), 'ring', settings).ringIQ,
    );
  });
});

describe('a week on appearances', () => {
  it('sells them to people who have not seen a show, and pays a little', () => {
    const week = weekOff(person(), 'appearances', settings);
    expect(week.popularity).toBeGreaterThan(0);
    expect(week.earned).toBeGreaterThan(0);
  });

  it('is worth more from somebody who can talk', () => {
    expect(weekOff(person({ charisma: 95 }), 'appearances', settings).popularity).toBeGreaterThan(
      weekOff(person({ charisma: 10 }), 'appearances', settings).popularity,
    );
  });

  it('wears the act out, which is the cost', () => {
    // An appearance is exposure, and exposure is exactly what makes a gimmick
    // stale. Getting over for free would make this strictly better than the
    // gym for everybody.
    expect(weekOff(person(), 'appearances', settings).freshnessCost).toBeGreaterThan(0);
    for (const kind of ASSIGNMENTS) {
      if (kind.id === 'appearances') continue;
      expect(weekOff(person(), kind.id, settings).freshnessCost, kind.id).toBe(0);
    }
  });
});

describe('a week at home', () => {
  it('is the only one that mends anybody', () => {
    for (const kind of ASSIGNMENTS) {
      const week = weekOff(person({ health: 40 }), kind.id, settings);
      if (kind.id === 'rest') expect(week.health).toBeGreaterThan(0);
      else expect(week.health, kind.id).toBeLessThanOrEqual(0);
    }
  });

  it('is the only one that helps a mood', () => {
    expect(weekOff(person(), 'rest', settings).morale).toBeGreaterThan(0);
    expect(weekOff(person(), 'gym', settings).morale).toBe(0);
  });

  it('improves nothing at all, which is the trade', () => {
    const week = weekOff(person(), 'rest', settings);
    expect(week.strength).toBe(0);
    expect(week.ringIQ).toBe(0);
    expect(week.popularity).toBe(0);
  });

  it('is worth more to the two people it is actually aimed at', () => {
    const ordinary = weekOff(person(), 'rest', settings);
    const wanted = weekOff(person({ traits: ['wantsMoreTimeOff'] as never }), 'rest', settings);
    const fragile = weekOff(person({ traits: ['madeOfGlass'] as never }), 'rest', settings);
    expect(wanted.morale).toBeGreaterThan(ordinary.morale);
    expect(fragile.health).toBeGreaterThan(ordinary.health);
  });
});

describe('every week says what it was', () => {
  it('gives the card a sentence, whatever they were doing', () => {
    // §0: a stat that moved is owed a reason, and "he was in the gym" is it.
    for (const kind of ASSIGNMENTS) {
      const week = weekOff(person(), kind.id, settings);
      expect(week.note, kind.id).toBeTruthy();
      expect(assignmentById(kind.id)!.blurb.length, kind.id).toBeGreaterThan(20);
    }
  });

  it('is small enough that a fortnight of it changes nothing much', () => {
    // The card has to stay the game. Anything felt in two weeks would make
    // the gym worth more than the show.
    const week = weekOff(person({ strength: 40 }), 'gym', settings);
    expect(week.strength).toBeLessThan(2);
  });
});
