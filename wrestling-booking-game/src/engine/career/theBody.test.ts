// A wrestler's body, and what he intends to do about it.
//
// The properties that matter: a history has to persist and be readable, the
// two opinions have to be capable of disagreeing, following the doctor must
// never be punished, and ignoring him must be a real gamble rather than either
// a free win or a death sentence.

import { describe, expect, it } from 'vitest';
import {
  recordInjury,
  injuryLine,
  bodyLine,
  recklessHistory,
  doctorsOpinion,
  wrestlersOpinion,
  resolveInjuryCall,
  theTwoOpinions,
  dealAppetite,
  appetiteLine,
  securityWanted,
  type InjuryRecord,
} from './theBody';
import { defaultWorldSettings } from '../world/settings';
import { rngFromSeed } from '../rng';
import type { Injury, Wrestler } from '../types';

const settings = defaultWorldSettings();

const man = (over: Partial<Wrestler> = {}): Wrestler =>
  ({
    id: 'w', name: 'Cass Ryland', age: 30, health: 80,
    ego: 40, selfPreservation: 70, injuryHistory: [],
    skill: 60, agility: 60, stamina: 60, strength: 60,
    popularity: 60, careerHighPopularity: 60,
    ...over,
  }) as Wrestler;

const hurt = (over: Partial<Injury> = {}): Injury =>
  ({
    severity: 'moderate', description: 'Torn ACL', sufferedWeek: 40,
    totalWeeks: 8, weeksRemaining: 8, permanentStatLoss: {}, earlyReturnWeeksUsed: 0,
    ...over,
  }) as Injury;

const record = (over: Partial<InjuryRecord> = {}): InjuryRecord => ({
  what: 'Torn ACL', severity: 'moderate', year: 2023, week: 40, weeksOut: 8, workedThroughIt: false,
  ...over,
});

describe('a body remembers', () => {
  it('writes it down, dated, and keeps it', () => {
    const after = recordInjury([], hurt(), 2023);
    expect(after).toHaveLength(1);
    expect(injuryLine(after[0]!)).toBe('Torn ACL, 2023');
  });

  it('stacks up over a career rather than replacing the last one', () => {
    let history = recordInjury([], hurt({ description: 'Torn ACL' }), 2023);
    history = recordInjury(history, hurt({ description: 'Concussion' }), 2025);
    history = recordInjury(history, hurt({ description: 'Broken orbital bone' }), 2026);
    expect(history.map((r) => r.year)).toEqual([2023, 2025, 2026]);
  });

  it('says nothing about a body nothing has happened to', () => {
    expect(bodyLine([], settings)).toBeNull();
  });

  it('names the bad one and says he was never the same', () => {
    const line = bodyLine([record({ severity: 'severe', what: 'Ruptured Achilles', year: 2024 })], settings)!;
    expect(line).toMatch(/Ruptured Achilles, 2024/);
    expect(line).toMatch(/never quite the same/i);
  });

  it('stops listing and starts summarising once a career has piled up', () => {
    const many = Array.from({ length: settings.bodyLongHistoryCount }, (_, i) => record({ year: 2020 + i }));
    expect(bodyLine(many, settings)).toMatch(/long history/i);
  });

  it('remembers who ignored a doctor and how often', () => {
    expect(recklessHistory([record(), record({ workedThroughIt: true }), record({ workedThroughIt: true })])).toBe(2);
  });
});

describe('the doctor', () => {
  it('gives a straight number of weeks', () => {
    const view = doctorsOpinion(hurt(), man(), settings);
    expect(view.weeks).toBeGreaterThan(0);
    expect(view.verdict).toMatch(/weeks/);
    expect(view.grave).toBe(false);
  });

  it('gives an older body longer, because that is how tissue works', () => {
    expect(doctorsOpinion(hurt(), man({ age: 46 }), settings).weeks).toBeGreaterThan(
      doctorsOpinion(hurt(), man({ age: 26 }), settings).weeks,
    );
  });

  it('gives a wrecked body longer than a fresh one of the same age', () => {
    expect(doctorsOpinion(hurt(), man({ health: 25 }), settings).weeks).toBeGreaterThan(
      doctorsOpinion(hurt(), man({ health: 95 }), settings).weeks,
    );
  });

  it('will not put a date on the worst of them', () => {
    const view = doctorsOpinion(hurt({ severity: 'careerThreatening' }), man(), settings);
    expect(view.grave).toBe(true);
    expect(view.verdict).toMatch(/career/i);
  });
});

describe('and the man', () => {
  const spread = (w: Wrestler, history: InjuryRecord[] = []) => {
    const rng = rngFromSeed('opinions');
    const seen = { restProperly: 0, comeBackEarly: 0, workThroughIt: 0 };
    for (let i = 0; i < 400; i += 1) seen[wrestlersOpinion(w, history, rng, settings).intent] += 1;
    return seen;
  };

  it('has the careful man doing as he is told, the overwhelming majority of the time', () => {
    // Asserted as a share and against the alternative rather than at an
    // invented threshold. A very careful man still occasionally decides he
    // feels alright, which is people rather than a bug — what must hold is
    // that he almost never goes the whole way and works through it.
    const seen = spread(man({ selfPreservation: 95, ego: 10 }));
    expect(seen.restProperly).toBeGreaterThan(seen.comeBackEarly + seen.workThroughIt);
    expect(seen.workThroughIt).toBeLessThan(seen.restProperly / 10);
  });

  it('has the man who thinks he is indestructible arguing about it', () => {
    const seen = spread(man({ selfPreservation: 10, ego: 85 }));
    expect(seen.workThroughIt).toBeGreaterThan(50);
    expect(seen.restProperly).toBeLessThan(seen.workThroughIt + seen.comeBackEarly);
  });

  it('teaches caution — a man on his fourth knee is less sure than on his first', () => {
    const reckless = man({ selfPreservation: 35, ego: 70 });
    const fresh = spread(reckless);
    const bitten = spread(reckless, [record(), record(), record(), record()]);
    expect(bitten.restProperly).toBeGreaterThan(fresh.restProperly);
  });

  it('puts both views in one sentence for the profile', () => {
    const doc = doctorsOpinion(hurt(), man(), settings);
    const him = wrestlersOpinion(man(), [], rngFromSeed('x'), settings);
    expect(theTwoOpinions(doc, him)).toContain(doc.verdict);
    expect(theTwoOpinions(doc, him)).toContain(him.says);
  });
});

describe('what it costs to ignore him', () => {
  const doc = doctorsOpinion(hurt(), man(), settings);
  const many = (intent: Parameters<typeof resolveInjuryCall>[0]) => {
    const rng = rngFromSeed('calls');
    return Array.from({ length: 500 }, () => resolveInjuryCall(intent, doc, man(), rng, settings));
  };

  it('never punishes somebody for doing as he was told', () => {
    for (const r of many('restProperly')) {
      expect(r.outcome).toBe('healedClean');
      expect(r.healthCost).toBe(0);
      expect(r.weeksOut).toBe(doc.weeks);
    }
  });

  it('usually rewards coming back early, which is why anybody does it', () => {
    const got = many('comeBackEarly').filter((r) => r.outcome === 'gotAwayWithIt');
    expect(got.length).toBeGreaterThan(300);
  });

  it('gets him back much sooner when it works', () => {
    const ok = many('workThroughIt').find((r) => r.outcome === 'gotAwayWithIt')!;
    expect(ok.weeksOut).toBeLessThan(doc.weeks);
  });

  it('makes working through it the bigger gamble of the two', () => {
    const badEarly = many('comeBackEarly').filter((r) => r.outcome !== 'gotAwayWithIt').length;
    const badPushed = many('workThroughIt').filter((r) => r.outcome !== 'gotAwayWithIt').length;
    expect(badPushed).toBeGreaterThan(badEarly);
  });

  it('turns eight weeks into a great deal more when it goes wrong', () => {
    const worse = many('workThroughIt').find((r) => r.outcome === 'madeItWorse')!;
    expect(worse.weeksOut).toBeGreaterThan(doc.weeks);
    expect(worse.healthCost).toBeGreaterThan(0);
    expect(worse.line).toMatch(/should have listened/i);
  });

  it('can end a career, and only ends one on a night that went wrong', () => {
    const all = many('workThroughIt');
    expect(all.some((r) => r.outcome === 'careerEnding')).toBe(true);
    expect(all.filter((r) => r.outcome === 'careerEnding').length).toBeLessThan(all.length / 2);
  });

  it('can kill somebody who went out there on a career-threatening injury', () => {
    const grave = doctorsOpinion(hurt({ severity: 'careerThreatening' }), man(), settings);
    const rng = rngFromSeed('grave');
    const all = Array.from({ length: 600 }, () => resolveInjuryCall('workThroughIt', grave, man(), rng, settings));
    const dead = all.filter((r) => r.outcome === 'died');
    expect(dead.length).toBeGreaterThan(0);
    // A story rather than a mechanic: rare even on the worst possible call.
    expect(dead.length).toBeLessThan(all.length / 10);
    expect(dead[0]!.line).toMatch(/did not come back/i);
  });

  it('never kills anybody the doctor was not already grave about', () => {
    const rng = rngFromSeed('ordinary');
    const all = Array.from({ length: 800 }, () => resolveInjuryCall('workThroughIt', doc, man(), rng, settings));
    expect(all.some((r) => r.outcome === 'died')).toBe(false);
  });
});

describe('what he wants out of a deal', () => {
  it('has the careful and the frightened wanting cover', () => {
    expect(dealAppetite(man({ selfPreservation: 95 }), [], settings)).toBe('insurance');
    expect(
      dealAppetite(man({ selfPreservation: 55 }), [record({ severity: 'severe' }), record()], settings),
    ).toBe('insurance');
  });

  it('has the indestructible wanting it in money', () => {
    expect(dealAppetite(man({ selfPreservation: 15, ego: 80 }), [], settings)).toBe('cash');
  });

  it('changes its mind about a man over a career, which is the point', () => {
    const young = man({ selfPreservation: 30, ego: 70 });
    expect(dealAppetite(young, [], settings)).toBe('cash');
    const older = { ...young, injuryHistory: [] } as Wrestler;
    expect(dealAppetite(older, [record({ severity: 'severe' }), record({ severity: 'severe' }), record()], settings))
      .toBe('insurance');
  });

  it('says what he is after without advising anybody — §0', () => {
    for (const a of ['insurance', 'cash', 'comfort'] as const) {
      const line = appetiteLine(a, 'Cass');
      expect(line).toMatch(/Cass/);
      expect(line.toLowerCase()).not.toMatch(/should|offer him|do not/);
    }
  });
});

describe('security', () => {
  it('wants nothing extra from a body nothing has happened to', () => {
    expect(securityWanted(man({ selfPreservation: 0 }), [], settings)).toBe(0);
  });

  it('wants a longer deal the more the body has been through', () => {
    const one = securityWanted(man(), [record()], settings);
    const four = securityWanted(man(), [record(), record(), record(), record()], settings);
    expect(four).toBeGreaterThan(one);
  });

  it('is bounded, so nobody ever asks for a lifetime deal on scars alone', () => {
    const wrecked = Array.from({ length: 20 }, () => record({ severity: 'careerThreatening' }));
    expect(securityWanted(man({ selfPreservation: 100 }), wrecked, settings)).toBeLessThanOrEqual(settings.securityMax);
  });
});
