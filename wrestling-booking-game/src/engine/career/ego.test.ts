// Success has to be able to cost you the company. These hold that line.

import { describe, it, expect } from 'vitest';
import {
  targetEgo,
  driftEgo,
  egoLabel,
  contractDemand,
  clauseUpkeep,
  blocksDeckStacking,
  egoFriction,
} from './ego';
import { defaultWorldSettings } from '../world/settings';
import { createStandardContract, askingRate } from '../economy/contracts';
import { generateWrestler } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Wrestler, TitleReignRecord } from '../types';

const settings = defaultWorldSettings();
const ctx = { rosterPeakPopularity: 90, currentWeek: 100, settings };

function w(over: Partial<Wrestler> = {}): Wrestler {
  const base = generateWrestler(rngFromSeed('ego'), new Set());
  return { ...base, contract: createStandardContract(base, settings, 2000), ...over };
}

const reign = (endWeek: number | null): TitleReignRecord => ({
  titleId: 't',
  promotionId: 'p',
  holderIds: ['x'],
  holderAges: [30],
  wonFromIds: null,
  wonByMethod: 'match',
  startWeek: 1,
  endWeek,
  endMethod: endWeek === null ? null : 'lostMatch',
});

describe('ego grows out of the things a booker wants', () => {
  it('rises with how over they are, relative to the roster', () => {
    const star = targetEgo(w({ popularity: 88, attitude: 55 }), 'mainEventer', ctx);
    const jobber = targetEgo(w({ popularity: 20, attitude: 55 }), 'enhancement', ctx);
    expect(star).toBeGreaterThan(jobber);
  });

  it('rises with holding a title', () => {
    const base = { popularity: 70, attitude: 55, momentum: 50 };
    const champion = targetEgo(w({ ...base, titleReigns: [reign(null)] }), 'mainEventer', ctx);
    const not = targetEgo(w({ ...base, titleReigns: [] }), 'mainEventer', ctx);
    expect(champion).toBeGreaterThan(not);
  });

  it('rises with a career of them', () => {
    const base = { popularity: 70, attitude: 55 };
    const decorated = targetEgo(w({ ...base, titleReigns: [reign(10), reign(20), reign(30), reign(40)] }), 'mainEventer', ctx);
    const green = targetEgo(w({ ...base, titleReigns: [] }), 'mainEventer', ctx);
    expect(decorated).toBeGreaterThan(green);
  });

  it('inflates faster on a bad attitude and slower on a professional', () => {
    const base = { popularity: 80, titleReigns: [reign(null)] };
    expect(targetEgo(w({ ...base, attitude: 10 }), 'draw', ctx)).toBeGreaterThan(
      targetEgo(w({ ...base, attitude: 95 }), 'draw', ctx),
    );
  });

  it('is comparative — the biggest fish in a small pond still knows it', () => {
    const smallPond = { rosterPeakPopularity: 45, currentWeek: 100, settings };
    expect(targetEgo(w({ popularity: 45, attitude: 55 }), 'mainEventer', smallPond)).toBeGreaterThan(
      targetEgo(w({ popularity: 45, attitude: 55 }), 'midcarder', ctx),
    );
  });
});

describe('ego drifts rather than jumping', () => {
  it('does not turn somebody into a prima donna in one night', () => {
    expect(driftEgo(20, 90, settings) - 20).toBeLessThan(10);
  });

  it('rises faster than it falls — you spend longer bringing them down', () => {
    const up = driftEgo(50, 90, settings) - 50;
    const down = 50 - driftEgo(50, 10, settings);
    expect(up).toBeGreaterThan(down);
  });

  it('gets there eventually, in both directions', () => {
    let rising = 10;
    for (let i = 0; i < 100; i++) rising = driftEgo(rising, 85, settings);
    expect(rising).toBeGreaterThan(80);

    let falling = 90;
    for (let i = 0; i < 200; i++) falling = driftEgo(falling, 15, settings);
    expect(falling).toBeLessThan(20);
  });

  it('stays inside 0-100', () => {
    expect(driftEgo(0, -50, settings)).toBeGreaterThanOrEqual(0);
    expect(driftEgo(100, 200, settings)).toBeLessThanOrEqual(100);
  });

  it('describes itself in words', () => {
    expect(egoLabel(10)).toBe('No trouble');
    expect(egoLabel(40)).toBe('Knows their worth');
    expect(egoLabel(65)).toBe('Difficult');
    expect(egoLabel(90)).toBe('Running the place');
  });
});

describe('what they ask for when the deal runs down', () => {
  const base = w({ popularity: 85, attitude: 40 });
  const rate = askingRate(base, settings);

  it('asks for more money the bigger their ego', () => {
    const humble = contractDemand({ ...base, ego: 10 }, rate, 'mainEventer', settings);
    const monster = contractDemand({ ...base, ego: 95 }, rate, 'draw', settings);
    expect(monster.weeklyRate).toBeGreaterThan(humble.weeklyRate * 1.5);
  });

  it('asks for nothing but money at low ego', () => {
    expect(contractDemand({ ...base, ego: 10 }, rate, 'midcarder', settings).clauses).toEqual([]);
  });

  it('starts asking for clauses as they climb', () => {
    expect(contractDemand({ ...base, ego: 40 }, rate, 'upperCard', settings).clauses.length).toBeGreaterThan(0);
  });

  it('asks for creative control only at the very top, and only if that is what he wants', () => {
    // Ego is still the gate, but it is no longer the only one: a man whose
    // body has frightened him asks for the cover instead, whatever his ego
    // entitles him to. Held at a low self-preservation so this tests the ego
    // ladder rather than the appetite — the appetite has its own tests.
    // Shown against a man whose appetite reserves nothing, so the ego ladder
    // is the only thing deciding — the appetite has its own tests below.
    const middling = { ...base, selfPreservation: 58 };
    expect(contractDemand({ ...middling, ego: 50 }, rate, 'upperCard', settings).clauses).not.toContain(
      'creativeControl',
    );
    expect(contractDemand({ ...middling, ego: 95 }, rate, 'draw', settings).clauses).toContain('creativeControl');
  });

  it('asks a frightened man for cover rather than for control, at the same ego', () => {
    const frightened = { ...base, ego: 95, selfPreservation: 95 };
    const clauses = contractDemand(frightened, rate, 'draw', settings).clauses;
    expect(clauses).toContain('healthInsurance');
    expect(clauses).not.toContain('creativeControl');
  });

  it('asks for injury insurance well before creative control', () => {
    const midding = contractDemand({ ...base, ego: 45 }, rate, 'upperCard', settings);
    expect(midding.clauses).toContain('healthInsurance');
  });

  it('never asks for the whole list at once', () => {
    const demand = contractDemand({ ...base, ego: 100 }, rate, 'draw', settings);
    expect(demand.clauses.length).toBeLessThanOrEqual(settings.egoMaxClauseAsks);
  });

  it('tells the player exactly what each clause will cost them', () => {
    const demand = contractDemand({ ...base, ego: 95 }, rate, 'draw', settings);
    expect(demand.clauseCosts).toHaveLength(demand.clauses.length);
    for (const entry of demand.clauseCosts) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.cost.length).toBeGreaterThan(0);
    }
  });

  it('makes a big name likelier to walk over a refusal', () => {
    const draw = contractDemand({ ...base, ego: 80 }, rate, 'draw', settings);
    const midcarder = contractDemand({ ...base, ego: 80 }, rate, 'midcarder', settings);
    expect(draw.walkRisk).toBeGreaterThan(midcarder.walkRisk);
    expect(draw.walkRisk).toBeLessThan(1);
  });
});

describe('who they are changes what the same ego actually asks for', () => {
  // Before this, an In It For The Money draw and a Grateful For The Work draw
  // with identical ego asked for the identical raise and walked away from a
  // refusal at the identical rate. Neither of those was true to the trait.
  const base = w({ popularity: 85, attitude: 40, ego: 70 });
  const rate = askingRate(base, settings);

  it('pushes the rate ask hardest for the one who is only here for the money', () => {
    const ordinary = contractDemand({ ...base, traits: [] }, rate, 'draw', settings);
    const mercenary = contractDemand({ ...base, traits: ['inItForTheMoney'] }, rate, 'draw', settings);
    expect(mercenary.weeklyRate).toBeGreaterThan(ordinary.weeklyRate);
  });

  it('leaves a Grateful For The Work draw asking for the plain ego-driven number', () => {
    // The trait's `money` lever weight is 1, same as anybody who did not draw
    // In It For The Money — so it is not a discount, just not a markup.
    const ordinary = contractDemand({ ...base, traits: [] }, rate, 'draw', settings);
    const grateful = contractDemand({ ...base, traits: ['gratefulForTheWork'] }, rate, 'draw', settings);
    expect(grateful.weeklyRate).toBe(ordinary.weeklyRate);
  });

  it('makes a loyal veteran far less likely to walk over the same refusal', () => {
    const ordinary = contractDemand({ ...base, traits: [] }, rate, 'draw', settings).walkRisk;
    const grateful = contractDemand({ ...base, traits: ['gratefulForTheWork'] }, rate, 'draw', settings).walkRisk;
    expect(grateful).toBeLessThan(ordinary);
  });

  it('makes the restless ones far more likely to walk, at the same ego', () => {
    const ordinary = contractDemand({ ...base, traits: [] }, rate, 'draw', settings).walkRisk;
    for (const trait of ['neverSatisfied', 'wantsTheSpotlight', 'noTimeForTheOffice'] as const) {
      const said = contractDemand({ ...base, traits: [trait] }, rate, 'draw', settings).walkRisk;
      expect(said, trait).toBeGreaterThan(ordinary);
    }
  });

  it('never lets the multiplier push walk risk past a real ceiling', () => {
    const stacked = contractDemand(
      { ...base, ego: 100, traits: ['neverSatisfied', 'wantsTheSpotlight'] },
      rate,
      'draw',
      settings,
    );
    expect(stacked.walkRisk).toBeLessThanOrEqual(0.95);
  });
});

describe('what agreed clauses actually cost', () => {
  it('charges a weekly premium for injury insurance', () => {
    const insured = w({ contract: { ...createStandardContract(w(), settings, 2000), clauses: ['healthInsurance'] } });
    const plain = w({ contract: { ...createStandardContract(w(), settings, 2000), clauses: [] } });
    expect(clauseUpkeep(insured, settings)).toBeGreaterThan(clauseUpkeep(plain, settings));
  });

  it('charges to fly them in', () => {
    const covered = w({ contract: { ...createStandardContract(w(), settings, 2000), clauses: ['travelCovered'] } });
    expect(clauseUpkeep(covered, settings)).toBe(settings.clauseTravelCost);
  });

  it('costs nothing for a plain deal', () => {
    expect(clauseUpkeep(w({ contract: { ...createStandardContract(w(), settings, 2000), clauses: [] } }), settings)).toBe(0);
  });



  it('makes creative control cost the deck-stacking levers, not the result', () => {
    // §0 is locked: the sim always picks the winner. Creative control does
    // not buy a win — it takes away the player's ability to tilt the odds.
    const controlled = w({ contract: { ...createStandardContract(w(), settings, 2000), clauses: ['creativeControl'] } });
    expect(blocksDeckStacking(controlled)).toBe(true);
    expect(blocksDeckStacking(w())).toBe(false);
  });
});

describe('a locker room full of people who know their worth', () => {
  it('drags on everybody', () => {
    const humble = Array.from({ length: 10 }, () => w({ ego: 10 }));
    const monsters = Array.from({ length: 10 }, () => w({ ego: 90 }));
    expect(egoFriction(monsters, settings)).toBeGreaterThan(egoFriction(humble, settings));
  });

  it('is nothing on an empty roster', () => {
    expect(egoFriction([], settings)).toBe(0);
  });
});

describe('the whole arc: build somebody and watch them get expensive', () => {
  it('turns a cheap midcarder into an expensive problem over a title run', () => {
    let star = w({ popularity: 45, attitude: 45, ego: 15, momentum: 50, titleReigns: [] });
    const startingCost = contractDemand(star, askingRate(star, settings), 'midcarder', settings);

    // Two years of pushing them: over, champion, main-eventing.
    star = { ...star, popularity: 88, momentum: 85, titleReigns: [reign(null), reign(50)] };
    for (let week = 0; week < 104; week++) {
      star = { ...star, ego: driftEgo(star.ego, targetEgo(star, 'draw', ctx), settings) };
    }

    const endingCost = contractDemand(star, askingRate(star, settings), 'draw', settings);

    expect(star.ego).toBeGreaterThan(60);
    expect(endingCost.weeklyRate).toBeGreaterThan(startingCost.weeklyRate * 3);
    expect(endingCost.clauses.length).toBeGreaterThan(0);
    expect(endingCost.walkRisk).toBeGreaterThan(startingCost.walkRisk);
  });

  it('brings them back down when they cool off', () => {
    let faded = w({ popularity: 30, attitude: 55, ego: 85, momentum: 20, titleReigns: [reign(50)] });
    for (let week = 0; week < 156; week++) {
      faded = { ...faded, ego: driftEgo(faded.ego, targetEgo(faded, 'fallenStar', ctx), settings) };
    }
    expect(faded.ego).toBeLessThan(40);
  });
});
