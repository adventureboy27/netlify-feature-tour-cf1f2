// What somebody is in a position to ask for.
//
// Two properties have to hold together or the feature is wrong in one of two
// obvious ways: a name past its prime must get cheaper, and a veteran who can
// still work must not. Either one alone is a worse game than neither.

import { describe, expect, it } from 'vitest';
import { craftOf, negotiatingLeverage, leverageLine, leverageReason, afterLeverage } from './leverage';
import { defaultWorldSettings } from '../world/settings';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

const man = (over: Partial<Wrestler>): Wrestler =>
  ({
    id: 'w', name: 'Somebody', age: 30,
    skill: 60, agility: 60, stamina: 60, strength: 60,
    popularity: 70, careerHighPopularity: 70,
    ...over,
  }) as Wrestler;

// The benchmark is absolute now, so the helper simply hands over settings.
const ctx = () => settings;

describe('a wrestler in their prime', () => {
  it('is untouched by any of this', () => {
    expect(negotiatingLeverage(man({ age: 27 }), ctx())).toBe(1);
    expect(negotiatingLeverage(man({ age: settings.veteranAge }), ctx())).toBe(1);
  });
});

describe('a name past its prime', () => {
  const faded = (age: number) => man({ age, skill: 40, agility: 30, stamina: 35, strength: 45 });

  it('gets cheaper every year, which is the whole point', () => {
    expect(negotiatingLeverage(faded(45), ctx())).toBeLessThan(negotiatingLeverage(faded(40), ctx()));
    expect(negotiatingLeverage(faded(50), ctx())).toBeLessThan(negotiatingLeverage(faded(45), ctx()));
  });

  it('is on roughly half its money by the mid-forties', () => {
    const at45 = negotiatingLeverage(faded(45), ctx());
    expect(at45).toBeLessThan(0.7);
    expect(at45).toBeGreaterThan(0.3);
  });

  it('never works for nothing', () => {
    expect(negotiatingLeverage(faded(70), ctx())).toBeGreaterThanOrEqual(settings.leverageFloor);
  });
});

describe('a veteran who can still go', () => {
  // The other half, and the reason this is not an age tax. Same age, same
  // fame — the difference is entirely whether he can still work.
  const stillLethal = (age: number) => man({ age, skill: 92, agility: 78, stamina: 85, strength: 88 });
  const doneWithIt = (age: number) => man({ age, skill: 40, agility: 30, stamina: 35, strength: 45 });

  it('keeps his money at an age that would gut somebody else', () => {
    // Asserted on both sides rather than as a ratio: the claim is that at the
    // same age one of them keeps nearly all of his price and the other loses
    // half, and a ratio hides which half of that stopped being true.
    expect(negotiatingLeverage(stillLethal(48), ctx())).toBeGreaterThan(settings.leverageStrongAt - 0.05);
    expect(negotiatingLeverage(doneWithIt(48), ctx())).toBeLessThan(settings.leverageWeakAt + 0.05);
  });

  it('is worth nearly full price if he is still an elite worker', () => {
    const elite = man({ age: 50, skill: 90, agility: 84, stamina: 86, strength: 88 });
    expect(craftOf(elite)).toBeGreaterThanOrEqual(settings.leverageEliteCraft);
    expect(negotiatingLeverage(elite, ctx())).toBeGreaterThan(0.9);
  });

  it('measures ability rather than fame, because fame is what a veteran has too much of', () => {
    const famousAndFinished = man({ age: 46, popularity: 99, careerHighPopularity: 99, skill: 35, agility: 25, stamina: 30, strength: 40 });
    expect(negotiatingLeverage(famousAndFinished, ctx())).toBeLessThan(settings.leverageFairAt);
  });
});

describe('coming back', () => {
  it('is the weakest position in the business', () => {
    const back = man({ age: 40, comebackWeek: 300, skill: 55, agility: 45, stamina: 50, strength: 55 });
    const never = man({ age: 40, skill: 55, agility: 45, stamina: 50, strength: 55 });
    expect(negotiatingLeverage(back, ctx())).toBeLessThan(negotiatingLeverage(never, ctx()));
  });

  it('pays the discount even when he came back able to work', () => {
    // Measured first as the other way round, and it was wrong: the craft floor
    // cancelled the comeback entirely, so a returning legend who could still
    // go asked exactly what he asked before he retired. Being able to work is
    // why a booker takes him back; it is not why he gets his old rate.
    const back = man({ age: 39, comebackWeek: 300, skill: 90, agility: 85, stamina: 88, strength: 86 });
    const never = man({ age: 39, skill: 90, agility: 85, stamina: 88, strength: 86 });
    expect(negotiatingLeverage(back, ctx())).toBeLessThan(negotiatingLeverage(never, ctx()));
    expect(negotiatingLeverage(back, ctx())).toBeLessThan(settings.leverageFairAt);
  });

  it('is still worth more than a comeback with nothing left', () => {
    const ableBack = man({ age: 44, comebackWeek: 300, skill: 90, agility: 85, stamina: 88, strength: 86 });
    const spentBack = man({ age: 44, comebackWeek: 300, skill: 35, agility: 25, stamina: 30, strength: 40 });
    expect(negotiatingLeverage(ableBack, ctx())).toBeGreaterThan(negotiatingLeverage(spentBack, ctx()));
  });
});

describe('saying it', () => {
  it('describes the position and never advises on it — §0', () => {
    for (const l of [1, 0.8, 0.6, 0.3]) {
      const line = leverageLine(l, settings);
      expect(line).not.toMatch(/\d/);
      expect(line.toLowerCase()).not.toMatch(/should|offer him|do not|avoid/);
    }
  });

  it('stays quiet about somebody who is simply in their prime', () => {
    expect(leverageReason(man({ age: 28 }), ctx())).toBeNull();
  });

  it('names the comeback ahead of the birthday', () => {
    const back = man({ age: 44, comebackWeek: 300, skill: 40, agility: 30, stamina: 35, strength: 45 });
    expect(leverageReason(back, ctx())).toMatch(/walked away once/i);
  });

  it('blames the years when there is nothing else to blame', () => {
    const old = man({ age: 47, skill: 40, agility: 30, stamina: 35, strength: 45 });
    expect(leverageReason(old, ctx())).toMatch(/phone/i);
  });
});

describe('the money', () => {
  it('rounds to the same twenty-five as everything else', () => {
    expect(afterLeverage(1_000, 0.53) % 25).toBe(0);
  });

  it('leaves a full position exactly alone', () => {
    expect(afterLeverage(4_000, 1)).toBe(4_000);
  });
});
