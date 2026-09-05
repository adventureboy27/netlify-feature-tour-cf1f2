import { describe, it, expect } from 'vitest';
import {
  issueMandate,
  mandateMet,
  mandateExpired,
  resolveMandate,
  isFired,
  strikeWarning,
  type MandateContext,
} from './mandates';
import { OWNER_PROFILES, ownerProfile, MANDATE_TEXT } from '../../data/owners';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';
import type { MandateType, OwnerMandate, Promotion, Territory, Title, Wrestler } from '../types';

const settings = defaultWorldSettings();

let nextId = 0;
function person(over: Partial<Wrestler> = {}): Wrestler {
  nextId += 1;
  return { id: `w${nextId}`, name: `Wrestler ${nextId}`, age: 28, popularity: 50, ...over } as unknown as Wrestler;
}

function promotion(over: Partial<Promotion> = {}): Promotion {
  return {
    id: 'player',
    rating: 50,
    hardcoreSaturation: 0,
    homeTerritoryId: 'home',
    ...over,
  } as unknown as Promotion;
}

function town(id: string, over: Partial<Territory> = {}): Territory {
  return {
    id,
    name: id,
    capacity: 5000,
    revenueMult: 1,
    preferenceWeights: {},
    following: {},
    ownerPromotionId: null,
  climate: 'temperate',
    ...over,
  };
}

function belt(over: Partial<Title> = {}): Title {
  return { id: 'belt', name: 'The Belt', promotionId: 'player', currentHolderIds: [], ...over } as unknown as Title;
}

function ctxFor(over: Partial<MandateContext> = {}): MandateContext {
  return {
    week: 10,
    promotion: promotion(),
    personality: 'showman',
    roster: [person(), person()],
    available: [person({ popularity: 70 })],
    titles: [belt()],
    territories: [town('home'), town('away')],
    payroll: 5000,
    bestAttendanceSince: 1000,
    reachableHouse: 6000,
    settings,
    ...over,
  };
}

const issue = (over: Partial<MandateContext> = {}, seed = 'mandate') => issueMandate(rngFromSeed(seed), ctxFor(over));

describe('the owners', () => {
  it('is a real roster of distinct owners who all want different things', () => {
    // Not a fixed headcount — the real claim is that every profile is
    // unique and none of them is a placeholder. New owners join over time
    // (see 'nostalgic'), and this should stay true without a manual bump.
    expect(OWNER_PROFILES.length).toBeGreaterThanOrEqual(5);
    expect(new Set(OWNER_PROFILES.map((p) => p.id)).size).toBe(OWNER_PROFILES.length);
    for (const profile of OWNER_PROFILES) {
      expect(Object.keys(profile.weights).length).toBeGreaterThan(2);
      expect(profile.greetings.length).toBeGreaterThan(0);
    }
  });

  it('gives the accountant and the star-chaser opposite priorities', () => {
    const accountant = ownerProfile('pennyPincher').weights;
    const chaser = ownerProfile('starChaser').weights;
    expect(accountant.cutPayroll ?? 0).toBeGreaterThan(chaser.cutPayroll ?? 0);
    expect(chaser.signWrestler ?? 0).toBeGreaterThan(accountant.signWrestler ?? 0);
  });

  it('has words for every kind of demand', () => {
    for (const lines of Object.values(MANDATE_TEXT)) {
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) expect(line.length).toBeGreaterThan(5);
    }
  });
});

describe('what the owner asks for', () => {
  it('always asks for something possible', () => {
    for (const profile of OWNER_PROFILES) {
      const mandate = issue({ personality: profile.id }, `issue-${profile.id}`);
      expect(mandate).not.toBeNull();
      expect(mandate!.description).not.toMatch(/\{[a-z]+\}/i);
      expect(mandate!.deadlineWeek).toBe(10 + settings.mandateWeeksToComply);
      expect(mandate!.fulfilled).toBe(false);
    }
  });

  it('only asks for what its personality cares about', () => {
    // The accountant never sends you shopping.
    const types = new Set<MandateType>();
    for (let i = 0; i < 60; i++) {
      const mandate = issue({ personality: 'pennyPincher' }, `pincher-${i}`);
      if (mandate) types.add(mandate.type);
    }
    expect(types.has('signWrestler')).toBe(false);
    expect(types.has('cutPayroll')).toBe(true);
  });

  it('will not tell you to reach a rating you are already at', () => {
    for (let i = 0; i < 40; i++) {
      const mandate = issue({ promotion: promotion({ rating: 100 }), personality: 'showman' }, `maxed-${i}`);
      if (mandate?.type === 'reachRating') expect(mandate.targetValue).toBeGreaterThan(100);
    }
  });

  it('will not complain about hardcore when nobody has been bleeding', () => {
    const types = new Set<MandateType>();
    for (let i = 0; i < 40; i++) {
      const mandate = issue(
        { personality: 'traditionalist', promotion: promotion({ hardcoreSaturation: 0 }) },
        `clean-${i}`,
      );
      if (mandate) types.add(mandate.type);
    }
    expect(types.has('reduceHardcore')).toBe(false);
  });

  it('does complain when they have', () => {
    const types = new Set<MandateType>();
    for (let i = 0; i < 40; i++) {
      const mandate = issue(
        { personality: 'traditionalist', promotion: promotion({ hardcoreSaturation: 90 }) },
        `bloody-${i}`,
      );
      if (mandate) types.add(mandate.type);
    }
    expect(types.has('reduceHardcore')).toBe(true);
  });

  it('will not send you somewhere you already are', () => {
    for (let i = 0; i < 40; i++) {
      const mandate = issue({ personality: 'traditionalist' }, `where-${i}`);
      if (mandate?.type === 'runShowInTerritory') expect(mandate.targetId).not.toBe('home');
    }
  });

  it('picks somebody expendable to release, never the person you built', () => {
    const star = person({ popularity: 95 });
    const jobber = person({ popularity: 10 });
    for (let i = 0; i < 40; i++) {
      const mandate = issue({ personality: 'pennyPincher', roster: [star, jobber] }, `cut-${i}`);
      if (mandate?.type === 'releaseWrestler') expect(mandate.targetId).toBe(jobber.id);
    }
  });

  it('falls back to something else when its first choice is impossible', () => {
    // A star-chaser with nobody to sign and nobody young to push still wants
    // something out of you.
    const mandate = issue({
      personality: 'starChaser',
      available: [],
      roster: [person({ age: 50, popularity: 90 })],
    });
    expect(mandate).not.toBeNull();
  });
});

describe('whether it got done', () => {
  const met = (mandate: OwnerMandate, over: Partial<MandateContext> = {}) => mandateMet(mandate, ctxFor(over));

  it('reads a signing off the roster', () => {
    const target = person();
    const mandate = { type: 'signWrestler', targetId: target.id } as OwnerMandate;
    expect(met(mandate, { roster: [] })).toBe(false);
    expect(met(mandate, { roster: [target] })).toBe(true);
  });

  it('reads a release off the roster, the other way round', () => {
    const target = person();
    const mandate = { type: 'releaseWrestler', targetId: target.id } as OwnerMandate;
    expect(met(mandate, { roster: [target] })).toBe(false);
    expect(met(mandate, { roster: [] })).toBe(true);
  });

  it('wants the belt on the actual person', () => {
    const target = person();
    const mandate = { type: 'titleOnWrestler', targetId: target.id } as OwnerMandate;
    expect(met(mandate, { titles: [belt()] })).toBe(false);
    expect(met(mandate, { titles: [belt({ currentHolderIds: [target.id] })] })).toBe(true);
  });

  it('does not count a belt somebody else runs', () => {
    const target = person();
    const mandate = { type: 'titleOnWrestler', targetId: target.id } as OwnerMandate;
    const rivalBelt = belt({ promotionId: 'rival', currentHolderIds: [target.id] });
    expect(met(mandate, { titles: [rivalBelt] })).toBe(false);
  });

  it('checks the numbers the right way round', () => {
    expect(met({ type: 'reachRating', targetValue: 60 } as OwnerMandate, { promotion: promotion({ rating: 61 }) })).toBe(true);
    expect(met({ type: 'reachRating', targetValue: 60 } as OwnerMandate, { promotion: promotion({ rating: 59 }) })).toBe(false);
    // Payroll is the only one where lower is better.
    expect(met({ type: 'cutPayroll', targetValue: 4000 } as OwnerMandate, { payroll: 3999 })).toBe(true);
    expect(met({ type: 'cutPayroll', targetValue: 4000 } as OwnerMandate, { payroll: 4001 })).toBe(false);
    expect(met({ type: 'drawAttendance', targetValue: 2000 } as OwnerMandate, { bestAttendanceSince: 2000 })).toBe(true);
  });

  it('counts territories actually held', () => {
    const mandate = { type: 'expandTerritory', targetValue: 2 } as OwnerMandate;
    expect(met(mandate, { territories: [town('a', { ownerPromotionId: 'player' })] })).toBe(false);
    expect(
      met(mandate, {
        territories: [town('a', { ownerPromotionId: 'player' }), town('b', { ownerPromotionId: 'player' })],
      }),
    ).toBe(true);
  });

  it('knows when the clock has run out', () => {
    expect(mandateExpired(14, 13)).toBe(false);
    expect(mandateExpired(14, 14)).toBe(true);
  });
});

describe('the consequences', () => {
  it('pays for delivering and costs for not', () => {
    const good = resolveMandate(true, settings);
    expect(good.money).toBeGreaterThan(0);
    expect(good.strike).toBe(false);

    const bad = resolveMandate(false, settings);
    expect(bad.money).toBeLessThan(0);
    expect(bad.ratingDelta).toBeLessThan(0);
    expect(bad.strike).toBe(true);
  });

  it('fires you on the third strike and not before', () => {
    expect(isFired(0, settings)).toBe(false);
    expect(isFired(settings.mandateStrikesBeforeFiring - 1, settings)).toBe(false);
    expect(isFired(settings.mandateStrikesBeforeFiring, settings)).toBe(true);
  });

  it('warns you on the way, and harder as it gets closer', () => {
    expect(strikeWarning(0, settings)).toBeNull();
    expect(strikeWarning(1, settings)).toContain('watching');
    expect(strikeWarning(2, settings)).toContain('One more');
    expect(strikeWarning(3, settings)).toContain('finished');
  });
});
