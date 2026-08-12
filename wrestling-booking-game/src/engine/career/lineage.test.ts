import { describe, expect, it } from 'vitest';
import { rngFromSeed } from '../rng';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestler } from '../generate/wrestler';
import type { Wrestler } from '../types';
import {
  asSecondGeneration,
  childName,
  childrenOf,
  couldHaveAChildInTheBusiness,
  debutLine,
  eligibleParents,
  familyNameOf,
  hasProvenIt,
  inheritedStanding,
  inheritedTowns,
  lineageLabel,
  nameBurden,
  patienceLeft,
  resemblance,
  rollParent,
  weeklyLineage,
} from './lineage';

const settings = defaultWorldSettings();
const ctx = { currentYear: 2030, currentWeek: 1200 };

function makeWrestler(seed: string, over: Partial<Wrestler> = {}): Wrestler {
  const base = generateWrestler(rngFromSeed(seed), new Set(), { currentYear: 2030 });
  return { ...base, ...over };
}

/** Somebody finished, big, and long enough ago to have a grown child. */
function legend(seed = 'legend', over: Partial<Wrestler> = {}): Wrestler {
  return makeWrestler(seed, {
    name: 'Duke Ashcombe',
    careerStatus: 'hallOfFamer',
    careerHighPopularity: 90,
    debutYear: 2000,
    ...over,
  });
}

describe('who could have a kid in the business', () => {
  it('wants a career that is over, big, and a generation back', () => {
    expect(couldHaveAChildInTheBusiness(legend(), ctx, settings)).toBe(true);
  });

  it('refuses somebody still working', () => {
    expect(couldHaveAChildInTheBusiness(legend('a', { careerStatus: 'mainEventer' }), ctx, settings)).toBe(false);
  });

  it('refuses somebody nobody remembers', () => {
    expect(couldHaveAChildInTheBusiness(legend('b', { careerHighPopularity: 30 }), ctx, settings)).toBe(false);
  });

  it('refuses somebody who debuted last year — no child of theirs is 19', () => {
    expect(couldHaveAChildInTheBusiness(legend('c', { debutYear: 2029 }), ctx, settings)).toBe(false);
  });

  it('takes the dead as readily as the retired', () => {
    const gone = legend('d', {
      careerStatus: 'mainEventer',
      deceased: { wrestlerId: 'w1', cause: 'age', age: 71, week: 1100 },
    });
    expect(couldHaveAChildInTheBusiness(gone, ctx, settings)).toBe(true);
  });

  it('goes quiet entirely when the setting is off', () => {
    expect(couldHaveAChildInTheBusiness(legend(), ctx, { ...settings, secondGenerationEnabled: false })).toBe(false);
    expect(rollParent(rngFromSeed('off'), [legend()], ctx, { ...settings, secondGenerationEnabled: false })).toBeNull();
  });
});

describe('eligible parents', () => {
  it('offers the biggest names first', () => {
    const pool = [
      legend('small', { name: 'Small Name', careerHighPopularity: 70 }),
      legend('huge', { name: 'Huge Name', careerHighPopularity: 95 }),
      legend('mid', { name: 'Mid Name', careerHighPopularity: 80 }),
    ];
    expect(eligibleParents(pool, ctx, settings).map((w) => w.name)).toEqual(['Huge Name', 'Mid Name', 'Small Name']);
  });

  it('stops offering somebody once they have enough children working', () => {
    const parent = legend('p');
    const kids: Wrestler[] = [];
    for (let i = 0; i < settings.secondGenMaxChildren; i++) {
      kids.push(
        makeWrestler(`kid-${i}`, {
          lineage: {
            parentId: parent.id,
            parentName: parent.name,
            familyName: 'Ashcombe',
            inheritedAt: 1000,
            inheritedStanding: 40,
            provenBy: null,
          },
        }),
      );
    }
    expect(childrenOf(parent.id, kids)).toHaveLength(settings.secondGenMaxChildren);
    expect(eligibleParents([parent, ...kids], ctx, settings)).toEqual([]);
  });

  it('returns nobody in a young world, which is the normal state', () => {
    // Everybody working, nobody finished — a save in its first few years.
    const young = ['a', 'b', 'c'].map((s) => makeWrestler(s, { careerStatus: 'mainEventer', debutYear: 2028 }));
    expect(eligibleParents(young, ctx, settings)).toEqual([]);
    expect(rollParent(rngFromSeed('young'), young, ctx, settings)).toBeNull();
  });
});

describe('the name', () => {
  it('hands down a surname', () => {
    expect(familyNameOf('Duke Ashcombe')).toEqual({ surname: 'Ashcombe', act: 'Duke Ashcombe' });
  });

  it('hands down the whole act when there is no surname to give', () => {
    expect(familyNameOf('Blackout')).toEqual({ surname: null, act: 'Blackout' });
  });

  it('builds a name that reads as family', () => {
    const name = childName(rngFromSeed('name'), legend(), 'm', new Set());
    expect(name.endsWith(' Ashcombe')).toBe(true);
    expect(name).not.toBe('Duke Ashcombe');
  });

  it('makes a one-word act into a junior', () => {
    const parent = legend('solo', { name: 'Blackout' });
    expect(childName(rngFromSeed('n2'), parent, 'm', new Set())).toBe('Blackout Jr.');
  });

  it('never reuses a name already in the business', () => {
    const parent = legend('solo', { name: 'Blackout' });
    const taken = new Set(['blackout jr.']);
    expect(childName(rngFromSeed('n3'), parent, 'm', taken)).toBe('Blackout II');
  });

  it('takes a feminine first name for a daughter', () => {
    const name = childName(rngFromSeed('daughter'), legend(), 'f', new Set());
    expect(name.endsWith(' Ashcombe')).toBe(true);
  });
});

describe('what the name is worth', () => {
  it('is a slice of the parent peak, capped', () => {
    expect(inheritedStanding(legend('x', { careerHighPopularity: 90 }), settings)).toBe(41);
    // A 99-popularity legend's kid still does not debut as a main eventer.
    expect(inheritedStanding(legend('y', { careerHighPopularity: 99 }), settings)).toBeLessThanOrEqual(
      settings.secondGenInheritedCap,
    );
  });

  it('opens them well above a graduate but well below the top', () => {
    const parent = legend();
    const child = makeWrestler('child', { popularity: 8, careerHighPopularity: 8 });
    const kid = asSecondGeneration(rngFromSeed('sg'), child, parent, ctx, new Set(), settings);
    expect(kid.popularity).toBeGreaterThan(30);
    expect(kid.popularity).toBeLessThan(60);
    expect(kid.careerHighPopularity).toBe(kid.popularity);
  });

  it('records who they came from, and takes their hometown', () => {
    const parent = legend('p2', { homeTerritoryId: 'territory-7' });
    const kid = asSecondGeneration(rngFromSeed('sg2'), makeWrestler('c2'), parent, ctx, new Set(), settings);
    expect(kid.lineage?.parentId).toBe(parent.id);
    expect(kid.lineage?.parentName).toBe('Duke Ashcombe');
    expect(kid.lineage?.familyName).toBe('Ashcombe');
    expect(kid.lineage?.inheritedAt).toBe(ctx.currentWeek);
    expect(kid.lineage?.provenBy).toBeNull();
    expect(kid.homeTerritoryId).toBe('territory-7');
  });

  it('inherits nothing that would make them good', () => {
    const parent = legend('p3', { strength: 95, skill: 95, agility: 95, stamina: 95, talent: 95 });
    const child = makeWrestler('c3');
    const kid = asSecondGeneration(rngFromSeed('sg3'), child, parent, ctx, new Set(), settings);
    // A name, a face, a crowd, a standard. Not a dropkick.
    expect(kid.strength).toBe(child.strength);
    expect(kid.skill).toBe(child.skill);
    expect(kid.agility).toBe(child.agility);
    expect(kid.stamina).toBe(child.stamina);
    expect(kid.talent).toBe(child.talent);
    expect(kid.potentials).toEqual(child.potentials);
  });

  it('pulls charisma partway toward the parent, and no further', () => {
    const parent = legend('p4', { charisma: 90 });
    const child = makeWrestler('c4', { charisma: 40 });
    const kid = asSecondGeneration(rngFromSeed('sg4'), child, parent, ctx, new Set(), settings);
    expect(kid.charisma).toBeGreaterThan(40);
    expect(kid.charisma).toBeLessThan(90);
  });
});

describe('where the name is known', () => {
  it('carries a share of the parent standing into each of their towns', () => {
    const parent = legend('p5', {
      regionalPopularity: { 'territory-1': 88, 'territory-2': 70, 'territory-3': 2 },
    });
    const towns = inheritedTowns(parent, settings);
    expect(towns['territory-1']).toBe(48);
    expect(towns['territory-2']).toBe(39);
    // Somewhere the parent never got over is not somewhere the kid is known.
    expect(towns['territory-3']).toBeUndefined();
  });

  it('is empty for a parent who never worked a territory', () => {
    expect(inheritedTowns(legend('p6', { regionalPopularity: {} }), settings)).toEqual({});
  });
});

describe('family resemblance', () => {
  it('only ever takes colouring and frame', () => {
    const parent = makeWrestler('rp').appearance;
    const own = makeWrestler('ro').appearance;
    // Certainty in both directions, so the split is testable.
    const takesAll = resemblance(rngFromSeed('r'), parent, own, { ...settings, secondGenResemblance: 1 });
    expect(takesAll.skinTone).toBe(parent.skinTone);
    expect(takesAll.hairColor).toBe(parent.hairColor);
    expect(takesAll.build).toBe(parent.build);
    expect(takesAll.height).toBe(parent.height);
    // Choices, not genes.
    expect(takesAll.hairStyle).toBe(own.hairStyle);
    expect(takesAll.attireTop).toBe(own.attireTop);
    expect(takesAll.attireBottom).toBe(own.attireBottom);
    expect(takesAll.boots).toBe(own.boots);
    expect(takesAll.mask).toBe(own.mask);
    expect(takesAll.primaryColor).toBe(own.primaryColor);

    const takesNone = resemblance(rngFromSeed('r'), parent, own, { ...settings, secondGenResemblance: 0 });
    expect(takesNone).toEqual(own);
  });
});

describe('living up to it', () => {
  function kid(over: Partial<Wrestler> = {}, provenBy: number | null = null): Wrestler {
    return makeWrestler('kid', {
      name: 'Rory Ashcombe',
      popularity: 41,
      lineage: {
        parentId: 'w-parent',
        parentName: 'Duke Ashcombe',
        familyName: 'Ashcombe',
        inheritedAt: 1000,
        inheritedStanding: 41,
        provenBy,
      },
      record: { wins: 0, losses: 0, draws: 0 },
      titleReigns: [],
      ...over,
    });
  }

  it('gives them the whole patience window before anything happens', () => {
    expect(patienceLeft(kid(), 1000, settings)).toBe(settings.secondGenPatienceWeeks);
    expect(weeklyLineage(kid(), 1040, settings)).toEqual({
      kind: 'carried',
      weeksLeft: settings.secondGenPatienceWeeks - 40,
    });
  });

  it('will not read a record too short to mean anything', () => {
    expect(hasProvenIt(kid({ record: { wins: 3, losses: 0, draws: 0 } }), settings)).toBe(false);
  });

  it('settles it on a winning record', () => {
    expect(hasProvenIt(kid({ record: { wins: 14, losses: 8, draws: 0 } }), settings)).toBe(true);
  });

  it('settles it on a title, whatever the record says', () => {
    const champion = kid({
      record: { wins: 2, losses: 30, draws: 0 },
      titleReigns: [
        {
          titleId: 't1',
          promotionId: 'p1',
          holderIds: ['kid'],
          holderAges: [22],
          wonFromIds: null,
          wonByMethod: 'match',
          startWeek: 1010,
          endWeek: null,
          endMethod: null,
        },
      ],
    });
    expect(hasProvenIt(champion, settings)).toBe(true);
  });

  it('settles it on getting genuinely more over than the name was worth', () => {
    expect(hasProvenIt(kid({ record: { wins: 5, losses: 20, draws: 0 }, popularity: 60 }), settings)).toBe(true);
  });

  it('says so, once, and then stops caring', () => {
    const proven = kid({ record: { wins: 15, losses: 5, draws: 0 } });
    const verdict = weeklyLineage(proven, 1500, settings);
    expect(verdict.kind).toBe('proven');
    if (verdict.kind === 'proven') expect(verdict.note).toContain('Duke Ashcombe');
    // Once stamped, the module has nothing further to say about them.
    expect(weeklyLineage(kid({ record: { wins: 15, losses: 5, draws: 0 } }, 1500), 1600, settings)).toEqual({
      kind: 'spent',
    });
  });

  it('takes the borrowed popularity back when the clock runs out', () => {
    const wasted = kid({ record: { wins: 1, losses: 25, draws: 0 } });
    const verdict = weeklyLineage(wasted, 1000 + settings.secondGenPatienceWeeks + 1, settings);
    expect(verdict.kind).toBe('fading');
    if (verdict.kind === 'fading') {
      expect(verdict.loss).toBeCloseTo(settings.secondGenFadePerWeek);
      expect(verdict.note).toContain('Ashcombe');
    }
  });

  it('never fades them below what any rookie would have had', () => {
    const floored = kid({ popularity: settings.secondGenFadeFloor, record: { wins: 0, losses: 30, draws: 0 } });
    expect(weeklyLineage(floored, 2000, settings)).toEqual({ kind: 'spent' });
  });

  it('has nothing to say about somebody who is not anybody kid', () => {
    expect(weeklyLineage(makeWrestler('nobody'), 1200, settings)).toEqual({ kind: 'spent' });
    expect(nameBurden(makeWrestler('nobody'), settings)).toBe(0);
    expect(lineageLabel(makeWrestler('nobody'))).toBeNull();
  });

  it('carries the burden of the name even after it is proven', () => {
    // The crowd moves on; the person does not. This is what they think they
    // are owed, not what the fans think.
    expect(nameBurden(kid({}, 1500), settings)).toBe(settings.secondGenExpectationBurden);
    expect(nameBurden(kid(), settings)).toBe(settings.secondGenExpectationBurden);
  });
});

describe('saying it out loud', () => {
  it('names the parent, and says they are gone when they are', () => {
    const parent = legend('p7', {
      careerStatus: 'mainEventer',
      deceased: { wrestlerId: 'w1', cause: 'age', age: 68, week: 1100 },
    });
    const kid = asSecondGeneration(rngFromSeed('sg7'), makeWrestler('c7'), parent, ctx, new Set(), settings);
    const line = debutLine(kid, parent);
    expect(line).toContain(kid.name);
    expect(line).toContain('Duke Ashcombe');
    expect(line).toContain('the late');
  });

  it('calls a hall of famer a hall of famer', () => {
    const parent = legend('p8');
    const kid = asSecondGeneration(rngFromSeed('sg8'), makeWrestler('c8'), parent, ctx, new Set(), settings);
    expect(debutLine(kid, parent)).toContain('hall of famer');
  });

  it('labels them on the card', () => {
    const parent = legend('p9');
    const kid = asSecondGeneration(rngFromSeed('sg9'), makeWrestler('c9'), parent, ctx, new Set(), settings);
    expect(lineageLabel(kid)).toBe("Second generation — Duke Ashcombe's kid");
  });
});

describe('rolling for one', () => {
  it('picks from the shortlist rather than always the top name', () => {
    const pool = Array.from({ length: 10 }, (_, i) =>
      legend(`pool-${i}`, { name: `Name ${i}`, careerHighPopularity: 95 - i }),
    );
    const picked = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const parent = rollParent(rngFromSeed(`roll-${i}`), pool, ctx, settings);
      if (parent) picked.add(parent.name);
    }
    expect(picked.size).toBeGreaterThan(1);
    expect(picked.size).toBeLessThanOrEqual(settings.secondGenParentShortlist);
  });

  it('fires about as often as the setting says', () => {
    const pool = [legend()];
    let hits = 0;
    const trials = 2000;
    for (let i = 0; i < trials; i++) {
      if (rollParent(rngFromSeed(`rate-${i}`), pool, ctx, settings)) hits++;
    }
    const rate = hits / trials;
    expect(rate).toBeGreaterThan(settings.secondGenChancePerGraduate * 0.6);
    expect(rate).toBeLessThan(settings.secondGenChancePerGraduate * 1.6);
  });
});
