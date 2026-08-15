// The Crucible and the Iron Crown.
//
// The rules a booker would notice being broken: the fee is steep enough to
// keep the skint out, a bigger field means fewer names apiece, the pot splits
// exactly in half between the winner and their company, and somebody actually
// wins the thing.

import { describe, expect, it } from 'vitest';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';
import { generateWrestler } from '../generate/wrestler';
import type { CrownReign } from './cup';
import type { Promotion, Wrestler } from '../types';
import {
  fieldIsBigEnough,
  crownsFor,
  crownBadge,
  crownSurge,
  slotsPerPromotion,
  cupBracketSize,
  willEnter,
  cupPurse,
  cupStanding,
  cupEntrantsFrom,
  fieldLine,
  crownLine,
  CUP_NAME,
  CUP_TROPHY,
} from './cup';
import { runCup } from './cupRun';

const settings = defaultWorldSettings();

function promo(over: Partial<Promotion> = {}): Promotion {
  return {
    id: 'p1',
    name: 'Player Pro',
    rating: 55,
    reputation: 50,
    bankBalance: settings.cupEntryFee * 10,
    isPlayer: true,
    rosterIds: [],
    titleIds: [],
    ownedTerritoryIds: [],
    homeTerritoryId: 't1',
    hardcoreSaturation: 0,
    bookingCredibility: 50,
    ...over,
  } as Promotion;
}

function roster(count: number, seed: string): Wrestler[] {
  const rng = rngFromSeed(seed);
  return Array.from({ length: count }, () =>
    generateWrestler(rng, new Set(), { currentYear: 2030 }),
  );
}

describe('who gets in', () => {
  it('keeps out anybody who cannot afford the ticket', () => {
    // The fee is the gate on the whole event. A company living hand to mouth
    // does not put the payroll on a tournament.
    const skint = promo({ bankBalance: settings.cupEntryFee });
    expect(willEnter(skint, settings)).toBe(false);

    const flush = promo({ bankBalance: settings.cupEntryFee * 5 });
    expect(willEnter(flush, settings)).toBe(true);
  });

  it('keeps out a company nobody has heard of', () => {
    const nobody = promo({ bankBalance: settings.cupEntryFee * 10, rating: 5 });
    expect(willEnter(nobody, settings)).toBe(false);
  });
});

describe('the field decides the format', () => {
  it('gives fewer names apiece as more companies buy in', () => {
    const two = slotsPerPromotion(2, settings);
    const four = slotsPerPromotion(4, settings);
    const eight = slotsPerPromotion(8, settings);
    expect(two).toBeGreaterThan(four);
    expect(four).toBeGreaterThan(eight);
    expect(eight).toBeGreaterThanOrEqual(1);
  });

  it('always leaves everybody at least one entrant', () => {
    // A field bigger than the bracket target must not price anybody out of
    // sending somebody — turning up with one name is still turning up.
    for (const field of [1, 2, 5, 16, 40]) {
      expect(slotsPerPromotion(field, settings)).toBeGreaterThanOrEqual(1);
    }
  });

  it('builds a bracket that is a power of two', () => {
    for (const field of [2, 3, 4, 5, 8]) {
      const size = cupBracketSize(field, settings);
      expect(Number.isInteger(Math.log2(size))).toBe(true);
    }
  });

  it('sends the biggest names a company has', () => {
    const people = roster(10, 'field');
    const picked = cupEntrantsFrom(people, 3, () => true);
    expect(picked).toHaveLength(3);
    const best = [...people].sort((a, b) => b.popularity - a.popularity).slice(0, 3);
    expect(picked.map((w) => w.id)).toEqual(best.map((w) => w.id));
  });

  it('respects who cannot work', () => {
    const people = roster(6, 'hurt');
    const benched = new Set([people[0]!.id, people[1]!.id]);
    const picked = cupEntrantsFrom(people, 6, (w) => !benched.has(w.id));
    expect(picked.some((w) => benched.has(w.id))).toBe(false);
  });
});

describe('the money', () => {
  const field = [promo(), promo({ id: 'p2', rating: 60 }), promo({ id: 'p3', rating: 45 })];

  it('puts every entry fee in the pot', () => {
    const purse = cupPurse(field, settings);
    expect(purse.entryFees).toBe(field.length * settings.cupEntryFee);
    expect(purse.pot).toBe(purse.entryFees + purse.gate);
  });

  it('splits down the middle and loses nothing', () => {
    // Half to the company, half to the wrestler, exactly.
    const purse = cupPurse(field, settings);
    expect(purse.companyShare + purse.wrestlerShare).toBe(purse.pot);
    expect(Math.abs(purse.companyShare - purse.wrestlerShare)).toBeLessThanOrEqual(1);
  });

  it('pays an individual more than any ordinary night could', () => {
    const purse = cupPurse(field, settings);
    expect(purse.wrestlerShare).toBeGreaterThan(settings.cupEntryFee);
  });

  it('grows with the field', () => {
    const small = cupPurse(field.slice(0, 2), settings);
    const big = cupPurse([...field, promo({ id: 'p4' }), promo({ id: 'p5' })], settings);
    expect(big.pot).toBeGreaterThan(small.pot);
  });
});

describe('how far you got', () => {
  it('pays the winner and costs a first-round exit', () => {
    const rounds = 4;
    expect(cupStanding(rounds, rounds, settings)).toBeGreaterThan(0);
    expect(cupStanding(0, rounds, settings)).toBeLessThan(0);
  });

  it('is monotonic — every round survived is worth something', () => {
    const rounds = 4;
    const seen = [0, 1, 2, 3, 4].map((won) => cupStanding(won, rounds, settings));
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]!).toBeGreaterThan(seen[i - 1]!);
    }
  });
});

describe('running the thing', () => {
  function field(companies: number, each: number) {
    return Array.from({ length: companies }, (_, i) => ({
      promotion: promo({ id: `p${i}`, name: `Company ${i}` }),
      entrants: roster(each, `cup-${i}`),
    }));
  }

  it('crowns exactly one winner out of the whole field', () => {
    const f = field(4, 4);
    const result = runCup(rngFromSeed('crucible'), {
      field: f,
      slotsEach: 4,
      week: 31,
      year: 2030,
      settings,
    })!;
    expect(result).not.toBeNull();

    const everyone = f.flatMap((x) => x.entrants).map((w) => w.id);
    expect(everyone).toContain(result.winnerId);
    expect(result.winnerPromotionId).toBe(
      f.find((x) => x.entrants.some((w) => w.id === result.winnerId))!.promotion.id,
    );
  });

  it('works the whole bracket down to one', () => {
    const result = runCup(rngFromSeed('drain'), {
      field: field(4, 4),
      slotsEach: 4,
      week: 31,
      year: 2030,
      settings,
    })!;
    // 16 entrants, single elimination: fifteen matches and four rounds.
    expect(result.rounds).toBe(4);
    expect(result.bouts).toHaveLength(15);
    // The winner won every round they were in.
    expect(result.roundsWon[result.winnerId]).toBe(4);
  });

  it('nobody beats the winner', () => {
    const result = runCup(rngFromSeed('unbeaten'), {
      field: field(2, 8),
      slotsEach: 8,
      week: 31,
      year: 2030,
      settings,
    })!;
    const lost = result.bouts.filter(
      (b) => (b.aId === result.winnerId || b.bId === result.winnerId) && b.winnerId !== result.winnerId,
    );
    expect(lost).toHaveLength(0);
  });

  it('refuses to run with nobody in it', () => {
    expect(
      runCup(rngFromSeed('empty'), { field: [], slotsEach: 0, week: 31, year: 2030, settings }),
    ).toBeNull();
  });

  it('hands the crown to the winner, in their company s name', () => {
    const result = runCup(rngFromSeed('crown'), {
      field: field(4, 4),
      slotsEach: 4,
      week: 31,
      year: 2030,
      settings,
    })!;
    expect(result.reign.wrestlerId).toBe(result.winnerId);
    expect(result.reign.promotionId).toBe(result.winnerPromotionId);
    expect(crownLine(result.reign)).toContain(CUP_TROPHY);
    expect(result.line).toContain(CUP_NAME);
  });
});

describe('it takes a field to make a tournament', () => {
  it('will not run for two companies', () => {
    // Two is a supershow with brackets drawn on it, and the year already has
    // two of those in May and November.
    expect(fieldIsBigEnough(2, settings)).toBe(false);
    expect(fieldIsBigEnough(1, settings)).toBe(false);
    expect(fieldIsBigEnough(0, settings)).toBe(false);
  });

  it('runs from three up', () => {
    expect(fieldIsBigEnough(3, settings)).toBe(true);
    expect(fieldIsBigEnough(8, settings)).toBe(true);
  });

  it('says why it is off rather than going quiet', () => {
    const line = fieldLine(2, 8, settings);
    expect(line).toMatch(/off this year/);
    expect(line).toContain(String(settings.cupMinimumField));
  });
});

describe('the roll of honour', () => {
  const reign = (wrestlerId: string, year: number): CrownReign => ({
    wrestlerId,
    wrestlerName: 'Somebody',
    promotionId: 'p1',
    promotionName: 'A Company',
    wonWeek: 31,
    year,
  });

  it('counts a person s wins across the whole history', () => {
    const history = [reign('a', 2030), reign('b', 2031), reign('a', 2032)];
    expect(crownsFor(history, 'a')).toHaveLength(2);
    expect(crownsFor(history, 'b')).toHaveLength(1);
    expect(crownsFor(history, 'nobody')).toHaveLength(0);
  });

  it('says nothing at all for somebody who has never won it', () => {
    expect(crownBadge(0)).toBeNull();
  });

  it('marks a repeat winner, and does not count once', () => {
    expect(crownBadge(1)).toBe('IRON CHAMPION');
    expect(crownBadge(3)).toBe('IRON CHAMPION \u00d73');
  });
});

describe('the road to superstardom', () => {
  it('moves a career rather than nudging it', () => {
    const surge = crownSurge(settings);
    // Popularity is the headline, but the person genuinely comes back better.
    expect(surge.popularity).toBeGreaterThan(0);
    expect(surge.skill).toBeGreaterThan(0);
    expect(surge.charisma).toBeGreaterThan(0);
    expect(surge.stamina).toBeGreaterThan(0);
    expect(surge.attitude).toBeGreaterThan(0);
    expect(surge.momentum).toBeGreaterThan(0);
  });

  it('is worth more than the crown they carry for the year', () => {
    // The aura leaves when the crown does. This does not.
    expect(crownSurge(settings).popularity).toBeGreaterThan(settings.cupCrownPopularityBonus);
  });
});

describe('the paper', () => {
  it('says when nobody could afford it', () => {
    expect(fieldLine(0, 0)).toMatch(/Nobody could afford/);
  });

  it('says when only one company turned up', () => {
    expect(fieldLine(1, 8)).toMatch(/off/);
  });

  it('says how big the field is and what everybody brought', () => {
    expect(fieldLine(4, 4)).toBe('4 companies bought in, 4 names apiece.');
    expect(fieldLine(16, 1)).toBe('16 companies bought in, 1 name apiece.');
  });
});
