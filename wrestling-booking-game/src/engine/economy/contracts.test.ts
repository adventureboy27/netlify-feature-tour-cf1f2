import { describe, it, expect } from 'vitest';
import { askingRate, createStandardContract, STARTING_CONTRACT_WEEKS, weeklyWageBill, expireContracts, contractUrgency, renewalRate, willResign, splitRate, retainerShare, appearanceBill, fullWeeklyCost } from './contracts';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestler, generateWrestlers } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

function w(over: Partial<Wrestler> = {}): Wrestler {
  return { ...generateWrestler(rngFromSeed('c'), new Set()), ...over };
}

describe('a standard deal', () => {
  const contract = createStandardContract(w({ popularity: 50 }), settings, 2000);

  it('runs two years', () => {
    expect(contract.weeksRemaining).toBe(104);
    expect(contract.totalWeeks).toBe(STARTING_CONTRACT_WEEKS);
    expect(STARTING_CONTRACT_WEEKS).toBe(104);
  });

  it('carries no creative control and no bonuses — nothing to read twice', () => {
    expect(contract.clauses).toEqual([]);
  });

  it('is a plain full-time deal', () => {
    expect(contract.type).toBe('fullTime');
    expect(contract.weeklyRate).toBeGreaterThan(0);
  });
});

describe('what somebody costs', () => {
  it('pays for draw above everything else', () => {
    const star = w({ popularity: 95, skill: 40, agility: 40, stamina: 40, strength: 40 });
    const workhorse = w({ popularity: 25, skill: 95, agility: 95, stamina: 95, strength: 95 });
    expect(askingRate(star, settings)).toBeGreaterThan(askingRate(workhorse, settings));
  });

  it('charges more for young talent with a ceiling', () => {
    const base = { popularity: 45, skill: 55, agility: 55, stamina: 55, strength: 55 };
    const prospect = w({ ...base, age: 24, talent: 95 });
    const journeyman = w({ ...base, age: 34, talent: 95 });
    expect(askingRate(prospect, settings)).toBeGreaterThan(askingRate(journeyman, settings));
  });

  it('quotes round numbers', () => {
    for (let pop = 0; pop <= 100; pop += 7) {
      expect(askingRate(w({ popularity: pop }), settings) % 25).toBe(0);
    }
  });

  it('spans a sane range from jobber to draw', () => {
    const floor = askingRate(w({ popularity: 0, skill: 0, agility: 0, stamina: 0, strength: 0, talent: 0, age: 40 }), settings);
    const ceiling = askingRate(w({ popularity: 100, skill: 100, agility: 100, stamina: 100, strength: 100, talent: 100, age: 24 }), settings);
    expect(floor).toBeGreaterThan(0);
    expect(ceiling).toBeGreaterThan(floor * 8);
  });
});

describe('the wage bill', () => {
  it('is what a 30-strong roster actually costs every week', () => {
    const roster = generateWrestlers(rngFromSeed('roster'), 30).map((wr) => ({
      ...wr,
      contract: createStandardContract(wr, settings, 2000),
    }));
    const bill = weeklyWageBill(roster);
    expect(bill).toBeGreaterThan(0);
    // The whole point of fixing the null-contract bug: this has to be a real
    // number the promotion has to cover, not zero.
    expect(bill).toBeGreaterThan(settings.contractBaseWeeklyRate * roster.length);
  });

  it('ignores anyone without a deal', () => {
    expect(weeklyWageBill([w({ contract: null })])).toBe(0);
  });
});

describe('contracts running down', () => {
  it('ticks every deal a week and reports the ones that ran out', () => {
    const roster = [
      w({ id: 'a', contract: { ...createStandardContract(w(), settings, 2000), weeksRemaining: 1 } }),
      w({ id: 'b', contract: { ...createStandardContract(w(), settings, 2000), weeksRemaining: 50 } }),
      w({ id: 'c', contract: null }),
    ];
    expect(expireContracts(roster)).toEqual(['a']);
    expect(roster[1]!.contract!.weeksRemaining).toBe(49);
  });

  it('describes urgency in words', () => {
    const make = (weeksRemaining: number) => ({ ...createStandardContract(w(), settings, 2000), weeksRemaining });
    expect(contractUrgency(make(100))).toBe('Secure');
    expect(contractUrgency(make(40))).toBe('Comfortable');
    expect(contractUrgency(make(12))).toBe('Running down');
    expect(contractUrgency(make(3))).toBe('Expiring');
    expect(contractUrgency(null)).toBe('Expiring');
  });
});

describe('renewals', () => {
  it('never comes in below what they are on now', () => {
    const veteran = w({ popularity: 20, contract: { ...createStandardContract(w(), settings, 2000), weeklyRate: 2000 } });
    expect(renewalRate(veteran, settings)).toBeGreaterThanOrEqual(2000);
  });

  it('costs more for someone who got over since they signed', () => {
    const risen = w({ popularity: 90, contract: { ...createStandardContract(w(), settings, 2000), weeklyRate: 300 } });
    expect(renewalRate(risen, settings)).toBeGreaterThan(300 * 2);
  });

  it('is bought with booking as well as money', () => {
    const paid = w({ popularity: 60, morale: 20, momentum: 20 });
    const happy = w({ popularity: 60, morale: 95, momentum: 95 });
    const rate = renewalRate(paid, settings);
    expect(willResign(happy, rate, settings)).toBeGreaterThan(willResign(paid, rate, settings));
  });

  it('makes a lowball offer unlikely to land', () => {
    const target = w({ popularity: 70, morale: 50, momentum: 50 });
    const fair = renewalRate(target, settings);
    expect(willResign(target, fair * 0.2, settings)).toBeLessThan(willResign(target, fair, settings));
  });
});

describe('the two halves of a deal', () => {
  const settings = defaultWorldSettings();
  const makeOne = (popularity: number) => {
    const [w] = generateWrestlers(rngFromSeed(`pay-${popularity}`), 1);
    return { ...w!, popularity };
  };

  it('splits into a retainer and an appearance fee that add up to the ask', () => {
    const w = makeOne(50);
    const { weeklyRate, perAppearance } = splitRate(w, settings);
    expect(weeklyRate).toBeGreaterThan(0);
    expect(perAppearance).toBeGreaterThan(0);
    // Rounded to the nearest five either side, so allow the rounding.
    expect(weeklyRate + perAppearance).toBeCloseTo(askingRate(w, settings), -1);
  });

  it('guarantees a star more and makes an undercard hand work for it', () => {
    // Leverage buys guarantees. This is what lets a promotion carry a deep
    // roster of cheap hands and still be ruined by a deep roster of stars.
    expect(retainerShare(makeOne(90), settings)).toBeGreaterThan(retainerShare(makeOne(10), settings));
  });

  it('makes carrying depth far cheaper than working it', () => {
    // The bug this locks: everybody drew a full weekly wage whether booked or
    // not, so a thirty-four person roster cost thirty-four wages against a
    // card that uses about fourteen. Carrying anybody spare was punished, and
    // the optimal roster was the smallest one that could fill a card.
    const roster = Array.from({ length: 34 }, (_, i) => makeOne(30 + (i % 50)));
    const contracted = roster.map((w) => ({ ...w, contract: createStandardContract(w, settings, 2026) }));
    const retainers = weeklyWageBill(contracted);
    const everyoneWorking = retainers + appearanceBill(contracted);
    expect(retainers).toBeLessThan(everyoneWorking * 0.5);
  });

  it('pays somebody booked every week roughly their full asking price', () => {
    const w = makeOne(65);
    const contracted = { ...w, contract: createStandardContract(w, settings, 2026) };
    expect(fullWeeklyCost(contracted)).toBeCloseTo(askingRate(w, settings), -1);
  });
});
