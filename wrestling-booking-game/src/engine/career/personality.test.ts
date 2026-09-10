// Who somebody is, and what it costs the booker.
//
// The thing this system exists to fix, measured before it was built: a
// twenty-six-person locker room at a company rated in the seventies with two
// and a half million in the bank, and every single person in it drifting to
// the same number. Nothing in the room wanted different things, so nothing the
// booker did could suit one person and not another.
//
// So the test that matters is not "does a trait apply" — it is "do two people
// given the same week end up in different places".

import { describe, expect, it } from 'vitest';
import {
  TRAITS,
  drawTraits,
  hasTrait,
  injuryProneness,
  leverWeight,
  moodSpread,
  setPointShift,
  traitById,
  traitLine,
  traitReasons,
  traitsOf,
  wantsRest,
  type TraitId,
  type TraitSubject,
} from './personality';
import { defaultWorldSettings } from '../world/settings';
import { rngFromSeed } from '../rng';

const settings = defaultWorldSettings();

function person(...traits: TraitId[]) {
  return { traits };
}

function subject(over: Partial<TraitSubject> = {}): TraitSubject {
  return {
    id: 'w1',
    morale: 55,
    popularity: 50,
    weeklyPay: 500,
    worth: 500,
    weeksStraight: 0,
    injuries: 0,
    attached: null,
    promotionName: 'Ironbelt Wrestling',
    ...over,
  };
}

describe('the pool itself', () => {
  it('is written as people, with something to say to a booker about each', () => {
    for (const trait of TRAITS) {
      expect(trait.name.length, trait.id).toBeGreaterThan(3);
      expect(trait.blurb.length, trait.id).toBeGreaterThan(30);
      expect(trait.weight, trait.id).toBeGreaterThan(0);
    }
  });

  it('never contradicts itself', () => {
    // Grateful For The Work and Never Satisfied is not a person.
    for (const trait of TRAITS) {
      for (const other of trait.excludes ?? []) {
        expect(traitById(other), `${trait.id} excludes a trait that does not exist`).toBeTruthy();
        // Exclusion has to be mutual or the draw order decides who is real.
        expect(traitById(other)!.excludes ?? [], `${other} does not exclude ${trait.id} back`).toContain(trait.id);
      }
    }
  });

  it('does nothing at all to somebody who drew none', () => {
    const nobody = { traits: [] };
    expect(setPointShift(nobody)).toBe(0);
    expect(leverWeight(nobody, 'spotlight', settings)).toBe(1);
    expect(injuryProneness(nobody)).toBe(1);
    expect(moodSpread(nobody)).toBe(1);
    expect(traitLine(nobody)).toBeNull();
  });
});

describe('drawing them', () => {
  it('gives everybody at least one and nobody three', () => {
    for (let i = 0; i < 200; i++) {
      const drawn = drawTraits(rngFromSeed(`draw${i}`).next, settings);
      expect(drawn.length).toBeGreaterThanOrEqual(1);
      expect(drawn.length).toBeLessThanOrEqual(2);
    }
  });

  it('never draws two that contradict each other', () => {
    for (let i = 0; i < 300; i++) {
      const rng = rngFromSeed(`pair${i}`);
      const drawn = drawTraits(() => rng.next(), settings);
      for (const id of drawn) {
        for (const banned of traitById(id)?.excludes ?? []) {
          expect(drawn, `${id} drawn with ${banned}`).not.toContain(banned);
        }
      }
    }
  });

  it('spreads across the whole pool rather than favouring one', () => {
    // A pool where nine traits never come up is a pool with one trait in it.
    const seen = new Set<TraitId>();
    for (let i = 0; i < 400; i++) {
      const rng = rngFromSeed(`spread${i}`);
      for (const id of drawTraits(() => rng.next(), settings)) seen.add(id);
    }
    expect(seen.size).toBe(TRAITS.length);
  });
});

describe('what they weight', () => {
  it('makes the card position nearly irrelevant to one and everything to another', () => {
    const grateful = leverWeight(person('gratefulForTheWork'), 'spotlight', settings);
    const hungry = leverWeight(person('wantsTheSpotlight'), 'spotlight', settings);
    expect(grateful).toBeLessThan(0.5);
    expect(hungry).toBeGreaterThan(1.5);
  });

  it('lets a man lose to anybody as long as the money is right', () => {
    // The Nash. Losing barely registers; being underpaid is the whole world.
    const nash = person('inItForTheMoney');
    expect(leverWeight(nash, 'winning', settings)).toBeLessThan(0.25);
    expect(leverWeight(nash, 'money', settings)).toBeGreaterThan(2);
  });

  it('compounds two traits but will not let them run away', () => {
    const both = leverWeight(person('wantsTheSpotlight', 'gratefulForTheWork'), 'spotlight', settings);
    // These two exclude each other in the draw; the cap still has to hold if
    // anything ever puts them together.
    expect(both).toBeLessThanOrEqual(settings.traitLeverCap);
  });

  it('never flips the sign of a week', () => {
    // A trait decides how much a good week was worth, never whether it was one.
    for (const trait of TRAITS) {
      for (const weight of Object.values(trait.weighs ?? {})) {
        expect(weight, trait.id).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('where they settle', () => {
  it('makes some people hard to make unhappy and some hard to please', () => {
    expect(setPointShift(person('gratefulForTheWork'))).toBeGreaterThan(8);
    expect(setPointShift(person('neverSatisfied'))).toBeLessThan(-8);
    expect(setPointShift(person('noTimeForTheOffice'))).toBeLessThan(0);
  });
});

describe('what they say about a particular week', () => {
  it('reads its own contract, and only that one does', () => {
    const under = traitReasons(person('inItForTheMoney'), subject({ weeklyPay: 300, worth: 600 }), settings);
    const over = traitReasons(person('inItForTheMoney'), subject({ weeklyPay: 900, worth: 600 }), settings);
    expect(under[0]!.delta).toBeLessThan(0);
    expect(over[0]!.delta).toBeGreaterThan(0);
    // Somebody else on the same terrible deal has nothing to say about it.
    expect(traitReasons(person('gratefulForTheWork'), subject({ weeklyPay: 300, worth: 600 }), settings)).toEqual([]);
  });

  it('says nothing when the money is about right', () => {
    expect(traitReasons(person('inItForTheMoney'), subject({ weeklyPay: 505, worth: 500 }), settings)).toEqual([]);
  });

  it('misses somebody by name, and stops the moment they are on the same shows', () => {
    const apart = traitReasons(
      person('somebodyAtHome'),
      subject({ attached: { name: 'Reyna Fairbanks', hereToo: false } }),
      settings,
    );
    const together = traitReasons(
      person('somebodyAtHome'),
      subject({ attached: { name: 'Reyna Fairbanks', hereToo: true } }),
      settings,
    );
    expect(apart[0]!.text).toContain('Reyna Fairbanks');
    expect(apart[0]!.delta).toBeLessThan(0);
    expect(together[0]!.delta).toBeGreaterThan(0);
  });

  it('counts the weeks on the road for the one who wanted them to stop', () => {
    const fine = traitReasons(person('wantsMoreTimeOff'), subject({ weeksStraight: 4 }), settings);
    const worn = traitReasons(person('wantsMoreTimeOff'), subject({ weeksStraight: 14 }), settings);
    expect(fine).toEqual([]);
    expect(worn[0]!.delta).toBeLessThan(0);
    expect(worn[0]!.text).toContain('14 weeks');
  });

  it('is the file itself that wears a fragile one down', () => {
    const early = traitReasons(person('madeOfGlass'), subject({ injuries: 1 }), settings);
    const later = traitReasons(person('madeOfGlass'), subject({ injuries: 6 }), settings);
    expect(early).toEqual([]);
    expect(later[0]!.delta).toBeLessThan(0);
  });

  it('names the company for the one who cannot stand it', () => {
    const said = traitReasons(person('noTimeForTheOffice'), subject(), settings);
    expect(said[0]!.text).toContain('Ironbelt Wrestling');
    // The cost is the set point, not a weekly hit — otherwise it would be
    // charged twice for the same grievance.
    expect(said[0]!.delta).toBe(0);
  });

  it('gives every reason a sentence, always', () => {
    // §0: a trait that moved the number silently is exactly the off-screen
    // change the whole game is written to prevent.
    const everything = person('inItForTheMoney', 'madeOfGlass');
    const said = traitReasons(
      everything,
      subject({ weeklyPay: 200, worth: 800, injuries: 8, weeksStraight: 20 }),
      settings,
    );
    expect(said.length).toBeGreaterThan(0);
    for (const reason of said) expect(reason.text.length).toBeGreaterThan(10);
  });
});

describe('the odd ones out', () => {
  it('turns time off into the good news for exactly one kind of person', () => {
    expect(wantsRest(person('wantsMoreTimeOff'))).toBe(true);
    expect(wantsRest(person('wantsTheSpotlight'))).toBe(false);
  });

  it('breaks a fragile body more often than anybody else', () => {
    expect(injuryProneness(person('madeOfGlass'))).toBeGreaterThan(1);
    expect(injuryProneness(person('gratefulForTheWork'))).toBe(1);
  });

  it('spreads a mood in both directions and only from the two who do', () => {
    expect(moodSpread(person('lockerRoomLeader'))).toBeGreaterThan(1);
    expect(moodSpread(person('poison'))).toBeGreaterThan(1);
    expect(moodSpread(person('neverSatisfied'))).toBe(1);
  });
});

describe('what the card says', () => {
  it('names them, and keeps the order stable', () => {
    expect(traitLine(person('gratefulForTheWork'))).toBe('Grateful for the work');
    const both = traitLine(person('madeOfGlass', 'gratefulForTheWork'));
    expect(both).toBe(traitLine(person('gratefulForTheWork', 'madeOfGlass')));
  });

  it('answers what somebody has without a search', () => {
    expect(hasTrait(person('poison'), 'poison')).toBe(true);
    expect(hasTrait(person('poison'), 'lockerRoomLeader')).toBe(false);
    expect(traitsOf(person('poison', 'madeOfGlass'))).toHaveLength(2);
  });
});
