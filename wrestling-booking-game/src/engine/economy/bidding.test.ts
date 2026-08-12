import { describe, expect, it } from 'vitest';
import { rngFromSeed } from '../rng';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestler } from '../generate/wrestler';
import type { Bid, ChoiceContext } from './bidding';
import {
  chooseBid,
  clauseAppeal,
  guaranteeFor,
  interestedIn,
  invitationLine,
  keenness,
  resultLine,
  rivalBid,
  scoreBid,
  worthAnAuction,
} from './bidding';
import { askingRate } from './contracts';
import type { Promotion, Relationship, Wrestler } from '../types';

const settings = defaultWorldSettings();

function person(seed: string, over: Partial<Wrestler> = {}): Wrestler {
  const base = generateWrestler(rngFromSeed(seed), new Set(), { currentYear: 2030 });
  return { ...base, role: 'wrestler', age: 30, health: 90, ...over };
}

function star(over: Partial<Wrestler> = {}): Wrestler {
  return person('star', { name: 'Vance Mercer', popularity: 88, ego: 70, talent: 70, ...over });
}

function company(id: string, over: Partial<Promotion> = {}): Promotion {
  return {
    id,
    name: `${id.toUpperCase()} Wrestling`,
    identity: 'sportsEntertainment',
    isPlayer: false,
    rating: 55,
    bankBalance: 900_000,
    rosterIds: [],
    titleIds: [],
    ownedTerritoryIds: [],
    homeTerritoryId: 'territory-1',
    styleProfile: { workrate: 50, hardcore: 50, comedy: 50, spectacle: 50 },
    bookingCredibility: 50,
    reputation: 50,
    hardcoreSaturation: 0,
    recentShowQuality: 50,
    weeksInTheRed: 0,
    closedWeek: null,
    ownerId: 'owner-1',
    ownerPersonality: 'showman',
    ppvCalendar: [],
    ...over,
  } as Promotion;
}

const NOBODY_BANNED = { weeklyPayroll: () => 20_000, banned: () => false };

function choiceCtx(over: Partial<ChoiceContext> = {}): ChoiceContext {
  return {
    promotions: [],
    relationships: [],
    rosterOf: () => [],
    currentPromotionId: null,
    ...over,
  };
}

function bid(over: Partial<Bid> = {}): Bid {
  return {
    promotionId: 'a',
    promotionName: 'A Wrestling',
    weeklyRate: 2000,
    signingBonus: 0,
    weeks: 104,
    clauses: [],
    ...over,
  };
}

describe('who is worth an auction', () => {
  it('takes a genuine star', () => {
    expect(worthAnAuction(star(), settings)).toBe(true);
  });

  it('leaves the rest of the card alone', () => {
    expect(worthAnAuction(person('mid', { popularity: 55, talent: 50, age: 30 }), settings)).toBe(false);
  });

  it('takes a young prospect nobody has seen yet — the phenom door', () => {
    const phenom = person('kid', { popularity: 38, talent: 92, age: 21 });
    expect(worthAnAuction(phenom, settings)).toBe(true);
  });

  it('will not auction the same talent at forty — he would already be somewhere', () => {
    expect(worthAnAuction(person('late', { popularity: 40, talent: 92, age: 40 }), settings)).toBe(false);
  });

  it('never auctions the retired, the dead, or the office', () => {
    expect(worthAnAuction(star({ careerStatus: 'retired' }), settings)).toBe(false);
    expect(
      worthAnAuction(star({ deceased: { wrestlerId: 'x', cause: 'age', age: 70, week: 1 } }), settings),
    ).toBe(false);
    expect(worthAnAuction(star({ role: 'referee' }), settings)).toBe(false);
  });
});

describe('who is interested', () => {
  it('wants a star if it has the headroom', () => {
    const rooms = interestedIn(star(), [company('a'), company('b')], NOBODY_BANNED, settings);
    expect(rooms.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('prices out a company that cannot cover its own payroll for six months', () => {
    const broke = company('broke', { bankBalance: 40_000 });
    expect(interestedIn(star(), [broke], NOBODY_BANNED, settings)).toEqual([]);
  });

  it('leaves out a company that has been caught tampering', () => {
    const ctx = { weeklyPayroll: () => 20_000, banned: (id: string) => id === 'b' };
    const rooms = interestedIn(star(), [company('a'), company('b')], ctx, settings);
    expect(rooms.map((p) => p.id)).toEqual(['a']);
  });

  it('leaves out a company that has closed', () => {
    const gone = company('gone', { closedWeek: 40 });
    expect(interestedIn(star(), [gone], NOBODY_BANNED, settings)).toEqual([]);
  });

  it('keeps the current employer in even when they cannot really afford it', () => {
    const holder = company('holder', { bankBalance: 1_000, rosterIds: [star().id] });
    expect(interestedIn(star(), [holder], NOBODY_BANNED, settings).map((p) => p.id)).toEqual(['holder']);
  });

  it('is not interested in somebody who would not improve the top of the card', () => {
    const elite = company('elite', { rating: 95 });
    expect(interestedIn(person('ok', { popularity: 60 }), [elite], NOBODY_BANNED, settings)).toEqual([]);
  });
});

describe('what a rival offers', () => {
  it('wants somebody more the further above them they are', () => {
    const small = keenness(star(), company('small', { rating: 25 }), settings);
    const big = keenness(star(), company('big', { rating: 90 }), settings);
    expect(small).toBeGreaterThan(big);
  });

  it('bids above the asking rate for somebody it wants', () => {
    const subject = star();
    const offer = rivalBid(rngFromSeed('bid'), subject, company('a'), 20_000, settings);
    expect(offer.weeklyRate).toBeGreaterThan(askingRate(subject, settings));
    expect(offer.promotionId).toBe('a');
    expect(offer.weeks).toBeGreaterThanOrEqual(settings.biddingMinWeeks);
    expect(offer.weeks).toBeLessThanOrEqual(settings.biddingMaxWeeks);
  });

  it('will not bid money it does not have', () => {
    const tight = company('tight', { bankBalance: 200_000 });
    const offer = rivalBid(rngFromSeed('tight'), star(), tight, 6_000, settings);
    const ceiling = (tight.bankBalance - 6_000 * settings.biddingHeadroomWeeks) / settings.biddingHeadroomWeeks;
    expect(offer.weeklyRate).toBeLessThanOrEqual(Math.max(ceiling, askingRate(star(), settings) * 0.5) + 25);
  });

  it('does not all bid the same thing', () => {
    const rates = new Set<number>();
    for (let i = 0; i < 30; i++) {
      rates.add(rivalBid(rngFromSeed(`n-${i}`), star(), company('a'), 20_000, settings).weeklyRate);
    }
    expect(rates.size).toBeGreaterThan(5);
  });

  it('only offers clauses somebody has the ego to have asked for', () => {
    const humble = star({ ego: 10 });
    const offer = rivalBid(rngFromSeed('humble'), humble, company('a'), 20_000, settings);
    expect(offer.clauses).not.toContain('creativeControl');
    expect(offer.clauses).not.toContain('ironClad');
  });
});

describe('what a clause is worth to the person being offered it', () => {
  it('offers insurance to somebody who needs it, not to somebody who does not', () => {
    const battered = person('hurt', { health: 30, age: 38 });
    const kid = person('kid', { health: 100, age: 22 });
    expect(clauseAppeal('healthInsurance', battered, settings)).toBeGreaterThan(
      clauseAppeal('healthInsurance', kid, settings),
    );
  });

  it('makes creative control worth something only to somebody who thinks they are the draw', () => {
    expect(clauseAppeal('creativeControl', person('ego', { ego: 95 }), settings)).toBeGreaterThan(0.8);
    expect(clauseAppeal('creativeControl', person('meek', { ego: 10 }), settings)).toBeLessThan(0.2);
  });

  it('makes a merchandise cut worth most to somebody who actually moves shirts', () => {
    expect(clauseAppeal('merchandiseCut', person('over', { popularity: 95 }), settings)).toBeGreaterThan(
      clauseAppeal('merchandiseCut', person('cold', { popularity: 10 }), settings),
    );
  });
});

describe('how the wrestler chooses', () => {
  it('takes the bigger money, all else equal', () => {
    const subject = star();
    const ctx = choiceCtx();
    const low = scoreBid(bid({ weeklyRate: 2000 }), subject, ctx, settings);
    const high = scoreBid(bid({ weeklyRate: 4000 }), subject, ctx, settings);
    expect(high.score).toBeGreaterThan(low.score);
    expect(high.headline).toBe('the money');
  });

  it('stops caring about money past the ceiling', () => {
    const subject = star();
    const rate = askingRate(subject, settings);
    const ctx = choiceCtx();
    const atCeiling = scoreBid(bid({ weeklyRate: rate * settings.biddingMoneyCeiling }), subject, ctx, settings);
    const absurd = scoreBid(bid({ weeklyRate: rate * 10 }), subject, ctx, settings);
    expect(absurd.score).toBeCloseTo(atCeiling.score, 5);
  });

  it('lets the right sweeteners beat a bigger cheque', () => {
    // THE point of the feature. A man who thinks he is the business will take
    // less money to be told he cannot be booked to lose.
    const proud = star({ ego: 95, popularity: 90 });
    const ctx = choiceCtx();
    const cash = scoreBid(bid({ promotionId: 'rich', weeklyRate: 6000 }), proud, ctx, settings);
    const clever = scoreBid(
      bid({
        promotionId: 'clever',
        weeklyRate: 3500,
        clauses: ['creativeControl', 'noJobbing', 'titlePush'],
      }),
      proud,
      ctx,
      settings,
    );
    expect(clever.score).toBeGreaterThan(cash.score);
  });

  it('does not let the wrong sweeteners do the same', () => {
    // The same trick aimed at somebody who does not want any of it.
    const humble = star({ ego: 8, popularity: 80, health: 100, age: 24 });
    const ctx = choiceCtx();
    const cash = scoreBid(bid({ promotionId: 'rich', weeklyRate: 6000 }), humble, ctx, settings);
    const misread = scoreBid(
      bid({ promotionId: 'wrong', weeklyRate: 3500, clauses: ['creativeControl', 'noJobbing'] }),
      humble,
      ctx,
      settings,
    );
    expect(misread.score).toBeLessThan(cash.score);
  });

  it('reads a young ego as wanting out again soon, and an old body as wanting security', () => {
    const ctx = choiceCtx();
    const kid = star({ age: 22, ego: 90 });
    const veteran = star({ age: 40, ego: 30 });
    const shortDeal = bid({ weeks: settings.biddingMinWeeks });
    const longDeal = bid({ weeks: settings.biddingMaxWeeks });
    expect(scoreBid(shortDeal, kid, ctx, settings).score).toBeGreaterThan(
      scoreBid(longDeal, kid, ctx, settings).score,
    );
    expect(scoreBid(longDeal, veteran, ctx, settings).score).toBeGreaterThan(
      scoreBid(shortDeal, veteran, ctx, settings).score,
    );
  });

  it('counts the people already in the building', () => {
    const subject = star();
    const friend = person('friend');
    const ally: Relationship = { aId: subject.id, bId: friend.id, type: 'friend', strength: 80, history: [] };
    const ctx = choiceCtx({ relationships: [ally], rosterOf: (id) => (id === 'a' ? [friend] : []) });
    const withFriend = scoreBid(bid({ promotionId: 'a' }), subject, ctx, settings);
    const without = scoreBid(bid({ promotionId: 'b' }), subject, ctx, settings);
    expect(withFriend.score).toBeGreaterThan(without.score);
  });

  it('counts somebody they cannot stand, harder', () => {
    const subject = star();
    const foe = person('foe');
    const feud: Relationship = { aId: subject.id, bId: foe.id, type: 'enemy', strength: 90, history: [] };
    const ctx = choiceCtx({ relationships: [feud], rosterOf: (id) => (id === 'a' ? [foe] : []) });
    expect(scoreBid(bid({ promotionId: 'a' }), subject, ctx, settings).score).toBeLessThan(
      scoreBid(bid({ promotionId: 'b' }), subject, ctx, settings).score,
    );
  });

  it('counts working close to home', () => {
    const subject = star({ homeTerritoryId: 'territory-4' });
    const ctx = choiceCtx({
      promotions: [company('a', { ownedTerritoryIds: ['territory-4'] }), company('b')],
    });
    expect(scoreBid(bid({ promotionId: 'a' }), subject, ctx, settings).score).toBeGreaterThan(
      scoreBid(bid({ promotionId: 'b' }), subject, ctx, settings).score,
    );
  });

  it('picks one, and says what swung it, without a number in sight', () => {
    const subject = star();
    const ctx = choiceCtx({ promotions: [company('a'), company('b')] });
    const result = chooseBid(
      rngFromSeed('choose'),
      subject,
      [bid({ promotionId: 'a', promotionName: 'A Wrestling', weeklyRate: 5000 }), bid({ promotionId: 'b', weeklyRate: 1500 })],
      ctx,
      settings,
    )!;
    expect(result.winningPromotionId).toBe('a');
    expect(result.allBids).toHaveLength(2);
    // §0: odds in words, never percentages, and no naked numbers in prose.
    expect(result.swungIt).not.toMatch(/\d/);
    expect(result.swungIt).not.toContain('%');
  });

  it('has nothing to decide when nobody bid', () => {
    expect(chooseBid(rngFromSeed('none'), star(), [], choiceCtx(), settings)).toBeNull();
  });

  it('is one shot — the same offers against the same person settle the same way', () => {
    const subject = star();
    const ctx = choiceCtx();
    const offers = [bid({ promotionId: 'a', weeklyRate: 3000 }), bid({ promotionId: 'b', weeklyRate: 3100 })];
    const first = chooseBid(rngFromSeed('same'), subject, offers, ctx, settings);
    const second = chooseBid(rngFromSeed('same'), subject, offers, ctx, settings);
    expect(first).toEqual(second);
  });
});

describe('turning a win into a contract', () => {
  it('guarantees the whole term only when iron-clad was on the table', () => {
    expect(guaranteeFor(bid({ clauses: ['ironClad'] }), settings)).toBe(1);
    expect(guaranteeFor(bid({ clauses: ['titlePush'] }), settings)).toBe(settings.biddingBaseGuarantee);
  });
});

describe('saying it out loud', () => {
  const war = {
    id: 'war-1',
    wrestlerId: 'w-1',
    wrestlerName: 'Vance Mercer',
    reason: 'freeAgentStar' as const,
    openedWeek: 40,
    stage: 'settled' as const,
    playerIn: true,
    rivalIds: ['a', 'b'],
    bids: [],
    result: null,
  };

  it('says who won and how big the field was', () => {
    const result = chooseBid(
      rngFromSeed('line'),
      star(),
      [bid({ promotionId: 'a', promotionName: 'A Wrestling' }), bid({ promotionId: 'b', promotionName: 'B Wrestling' })],
      choiceCtx(),
      settings,
    )!;
    const line = resultLine(war, result);
    expect(line).toContain('Vance Mercer');
    expect(line).toContain(result.winningPromotionName);
    expect(line).toContain('seeing off one other offer');
  });

  it('tells a phenom story differently from a free-agency story', () => {
    const result = chooseBid(rngFromSeed('l2'), star(), [bid()], choiceCtx(), settings)!;
    expect(resultLine({ ...war, reason: 'phenom' }, result)).toContain('out of the school');
    expect(resultLine(war, result)).toContain('open market');
  });

  it('spells out the one-shot rule in the invitation', () => {
    const line = invitationLine(war, star(), 3);
    expect(line).toContain('no second round');
    expect(line).toContain('3 other companies');
  });
});
