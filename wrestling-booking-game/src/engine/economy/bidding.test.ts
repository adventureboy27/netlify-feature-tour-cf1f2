import { describe, expect, it } from 'vitest';
import { rngFromSeed } from '../rng';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestler } from '../generate/wrestler';
import type { Bid, ChoiceContext } from './bidding';
import {
  bidCeiling,
  decideBids,
  clauseAppeal,
  guaranteeFor,
  interestedIn,
  invitationLine,
  keenness,
  resultLine,
  marketValue,
  rivalBid,
  scoreBid,
  stanceToward,
  worthAnAuction,
} from './bidding';
import { temperamentOf } from '../../data/biddingTemperaments';
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

/** A rival's offer, asserted to exist. Most tests are about a company that bids. */
function offerFrom(seed: string, w: Wrestler, c: Promotion, payroll = 20_000): Bid {
  const offer = rivalBid(rngFromSeed(seed), w, c, payroll, settings);
  expect(offer, `${c.id} did not bid at all`).not.toBeNull();
  return offer!;
}

/** The winner, or null if the room was sent away or refused outright. */
function settle(seed: string, w: Wrestler, bids: Bid[], c = choiceCtx(), round = 1) {
  const outcome = decideBids(rngFromSeed(seed), w, bids, c, settings, round);
  return outcome?.kind === 'signed' ? outcome.result : null;
}

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
    const offer = offerFrom('bid', subject, company('a'));
    expect(offer.weeklyRate).toBeGreaterThan(askingRate(subject, settings));
    expect(offer.promotionId).toBe('a');
    expect(offer.weeks).toBeGreaterThanOrEqual(settings.biddingMinWeeks);
    expect(offer.weeks).toBeLessThanOrEqual(settings.biddingMaxWeeks);
  });

  it('will not bid money it does not have', () => {
    const tight = company('tight', { bankBalance: 900_000 });
    const offer = offerFrom('tight', star(), tight, 18_000);
    const ceiling = bidCeiling(tight, 18_000, temperamentOf(tight.ownerPersonality), settings);
    expect(offer.weeklyRate).toBeLessThanOrEqual(ceiling + 25);
  });

  it('stays home rather than putting in a token offer it cannot back', () => {
    // Floored at the statutory minimum instead, a company that had gone broke
    // turned up on the result screen bidding sixty dollars a week.
    const broke = company('broke', { bankBalance: 300_000 });
    expect(rivalBid(rngFromSeed('broke'), star(), broke, 14_000, settings)).toBeNull();
  });

  it('does not all bid the same thing', () => {
    const rates = new Set<number>();
    for (let i = 0; i < 30; i++) {
      rates.add(offerFrom(`n-${i}`, star(), company('a')).weeklyRate);
    }
    expect(rates.size).toBeGreaterThan(5);
  });

  it('only offers clauses somebody has the ego to have asked for', () => {
    const humble = star({ ego: 10 });
    const offer = offerFrom('humble', humble, company('a'));
    expect(offer.clauses).not.toContain('creativeControl');
    expect(offer.clauses).not.toContain('ironClad');
  });
});

describe('what somebody is worth', () => {
  it('prices a draw well above a body nobody has heard of', () => {
    const draw = star({ popularity: 95 });
    const hand = person('hand', { popularity: 25, talent: 40 });
    expect(marketValue(draw, 0.4, settings)).toBeGreaterThan(marketValue(hand, 0.4, settings) * 2);
  });

  it('is a different number to a company buying the future than to one buying tonight', () => {
    const prospect = person('prospect', { popularity: 35, talent: 95, age: 21 });
    const winNow = marketValue(prospect, 0.15, settings);
    const builder = marketValue(prospect, 0.9, settings);
    expect(builder).toBeGreaterThan(winNow);

    // And the same reading, reversed, on somebody with no future left.
    const veteran = person('vet', { popularity: 80, talent: 95, age: 39 });
    expect(marketValue(veteran, 0.9, settings)).toBeLessThan(marketValue(veteran, 0.15, settings));
  });

  it('knocks money off a body held together with tape', () => {
    expect(marketValue(star({ health: 25 }), 0.4, settings)).toBeLessThan(
      marketValue(star({ health: 100 }), 0.4, settings),
    );
  });
});

describe('what a booker will risk', () => {
  it('never commits money the company does not have', () => {
    const skint = company('skint', { bankBalance: 50_000 });
    expect(bidCeiling(skint, 30_000, temperamentOf('starChaser'), settings)).toBe(0);
  });

  it('lets a cautious owner risk less than a reckless one, out of the same account', () => {
    const same = company('same', { bankBalance: 2_000_000 });
    const reckless = bidCeiling(same, 20_000, temperamentOf('starChaser'), settings);
    const careful = bidCeiling(same, 20_000, temperamentOf('pennyPincher'), settings);
    expect(reckless).toBeGreaterThan(careful);
  });

  it('holds every bid inside the ceiling, however badly they want somebody', () => {
    // The thing that stops an auction spiralling. A company that bid its
    // keenness rather than its means would be bankrupt by spring.
    const tight = company('tight', { bankBalance: 700_000, ownerPersonality: 'starChaser' });
    const ceiling = bidCeiling(tight, 12_000, temperamentOf('starChaser'), settings);
    for (let i = 0; i < 50; i++) {
      const offer = rivalBid(rngFromSeed(`cap-${i}`), star({ popularity: 99 }), tight, 12_000, settings);
      if (offer) expect(offer.weeklyRate).toBeLessThanOrEqual(ceiling + 25);
    }
  });
});

describe('different companies bid differently', () => {
  function medianRate(personality: Parameters<typeof temperamentOf>[0], w = star()): number {
    const rates = Array.from({ length: 120 }, (_, i) =>
      offerFrom(`${personality}-${i}`, w, company('x', { ownerPersonality: personality }), 15_000).weeklyRate,
    ).sort((a, b) => a - b);
    return rates[60]!;
  }

  it('makes a star-chaser pay well over what a penny-pincher will', () => {
    expect(medianRate('starChaser')).toBeGreaterThan(medianRate('pennyPincher') * 1.4);
  });

  it('makes the builder pay for a prospect and the win-now company not', () => {
    const prospect = person('kid', { popularity: 32, talent: 95, age: 21, ego: 20 });
    expect(medianRate('traditionalist', prospect)).toBeGreaterThan(medianRate('starChaser', prospect));
  });

  it('makes a penny-pincher lock somebody in long and a star-chaser keep it short', () => {
    const long = offerFrom('t1', star(), company('a', { ownerPersonality: 'pennyPincher' }), 15_000);
    const short = offerFrom('t1', star(), company('b', { ownerPersonality: 'starChaser' }), 15_000);
    expect(long.weeks).toBeGreaterThan(short.weeks);
  });

  it('makes the showman the one who pays up front', () => {
    const bonusRate = (p: Parameters<typeof temperamentOf>[0]) =>
      Array.from({ length: 120 }, (_, i) =>
        offerFrom(`b-${p}-${i}`, star(), company('x', { ownerPersonality: p }), 15_000),
      ).filter((b) => b.signingBonus > 0).length;
    expect(bonusRate('showman')).toBeGreaterThan(bonusRate('pennyPincher') * 2);
  });

  it('makes the penny-pincher the one who keeps the clauses', () => {
    const clauses = (p: Parameters<typeof temperamentOf>[0]) =>
      Array.from({ length: 60 }, (_, i) =>
        offerFrom(`c-${p}-${i}`, star({ ego: 90 }), company('x', { ownerPersonality: p }), 15_000),
      ).reduce((n, b) => n + b.clauses.length, 0);
    expect(clauses('starChaser')).toBeGreaterThan(clauses('pennyPincher'));
  });
});

describe('who they will and will not work for', () => {
  const foe = person('foe', { name: 'Delia Voss' });
  const wife = person('wife', { name: 'Nell Ashcombe' });

  function withRoster(bond: Relationship, roster: Wrestler[]) {
    return stanceToward(star(), 'a', roster, [bond], settings);
  }

  it('refuses outright over bad blood, at any price', () => {
    const hate: Relationship = { aId: star().id, bId: foe.id, type: 'enemy', strength: 90, history: [] };
    const read = withRoster(hate, [foe]);
    expect(read.stance).toBe('refuses');
    expect(read.reason).toContain('Delia Voss');
    expect(read.reason).toContain('same show');
  });

  it('will still go for more money over an ex', () => {
    const over: Relationship = { aId: star().id, bId: foe.id, type: 'exPartner', strength: 50, history: [] };
    const read = withRoster(over, [foe]);
    expect(read.stance).toBe('premium');
    expect(read.multiplier).toBeGreaterThan(1);
  });

  it('takes less to work with their wife', () => {
    const married: Relationship = { aId: star().id, bId: wife.id, type: 'married', strength: 90, history: [] };
    const read = withRoster(married, [wife]);
    expect(read.stance).toBe('discount');
    expect(read.multiplier).toBeLessThan(1);
    expect(read.reason).toContain('husband or wife');
  });

  it('does not care about somebody who works somewhere else', () => {
    const hate: Relationship = { aId: star().id, bId: foe.id, type: 'enemy', strength: 95, history: [] };
    expect(withRoster(hate, []).stance).toBe('neutral');
  });

  it('will not work for an office that did them wrong, whoever is on the roster', () => {
    const wronged = star({ grudges: ['a'] });
    const read = stanceToward(wronged, 'a', [], [], settings);
    expect(read.stance).toBe('refuses');
    expect(read.reason).toContain('will not work for that office');
    // And it is about that company, not about the business.
    expect(stanceToward(wronged, 'b', [], [], settings).stance).toBe('neutral');
  });
});

describe('sending the room away', () => {
  it('throws out an offer they would never take, whatever the money', () => {
    const subject = star();
    const foe = person('foe', { name: 'Delia Voss' });
    const hate: Relationship = { aId: subject.id, bId: foe.id, type: 'enemy', strength: 95, history: [] };
    const ctx = choiceCtx({ relationships: [hate], rosterOf: (id) => (id === 'a' ? [foe] : []) });

    const outcome = decideBids(
      rngFromSeed('veto'),
      subject,
      [bid({ promotionId: 'a', weeklyRate: 50_000 }), bid({ promotionId: 'b', weeklyRate: 4_000 })],
      ctx,
      settings,
    )!;
    expect(outcome.kind).toBe('signed');
    if (outcome.kind !== 'signed') return;
    // The huge offer was never opened.
    expect(outcome.result.winningPromotionId).toBe('b');
    expect(outcome.result.vetoed).toHaveLength(1);
    expect(outcome.result.vetoed[0]!.reason).toContain('Delia Voss');
  });

  it('asks everybody to go again when nothing on the table is serious', () => {
    const subject = star();
    const outcome = decideBids(
      rngFromSeed('insult'),
      subject,
      [bid({ promotionId: 'a', weeklyRate: 200 }), bid({ promotionId: 'b', weeklyRate: 250 })],
      choiceCtx(),
      settings,
      1,
    )!;
    expect(outcome.kind).toBe('reBid');
    if (outcome.kind === 'reBid') expect(outcome.reason).toContain('go again');
  });

  it('takes the best of a bad lot rather than asking a third time', () => {
    const subject = star();
    const lowball = [bid({ promotionId: 'a', weeklyRate: 200 }), bid({ promotionId: 'b', weeklyRate: 250 })];
    const outcome = decideBids(rngFromSeed('final'), subject, lowball, choiceCtx(), settings, settings.biddingMaxRounds)!;
    expect(outcome.kind).toBe('signed');
  });

  it('signs nobody at all when every door is one they will not walk through', () => {
    const subject = star();
    const foe = person('foe');
    const hate: Relationship = { aId: subject.id, bId: foe.id, type: 'enemy', strength: 95, history: [] };
    const ctx = choiceCtx({ relationships: [hate], rosterOf: () => [foe] });
    const lastRound = decideBids(
      rngFromSeed('nowhere'),
      subject,
      [bid({ promotionId: 'a', weeklyRate: 50_000 })],
      ctx,
      settings,
      settings.biddingMaxRounds,
    );
    expect(lastRound).toBeNull();
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

  it('takes less to work with somebody they love', () => {
    const subject = star();
    const wife = person('wife');
    const married: Relationship = { aId: subject.id, bId: wife.id, type: 'married', strength: 85, history: [] };
    const ctx = choiceCtx({ relationships: [married], rosterOf: (id) => (id === 'a' ? [wife] : []) });
    // The same money, worth more there.
    expect(scoreBid(bid({ promotionId: 'a' }), subject, ctx, settings).score).toBeGreaterThan(
      scoreBid(bid({ promotionId: 'b' }), subject, ctx, settings).score,
    );
  });

  it('charges more to work with an ex', () => {
    const subject = star();
    const ex = person('ex');
    const over: Relationship = { aId: subject.id, bId: ex.id, type: 'exPartner', strength: 55, history: [] };
    const ctx = choiceCtx({ relationships: [over], rosterOf: (id) => (id === 'a' ? [ex] : []) });
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
    const result = settle(
      'choose',
      subject,
      [bid({ promotionId: 'a', promotionName: 'A Wrestling', weeklyRate: 5000 }), bid({ promotionId: 'b', weeklyRate: 1500 })],
      ctx,
    )!;
    expect(result.winningPromotionId).toBe('a');
    expect(result.allBids).toHaveLength(2);
    // §0: odds in words, never percentages, and no naked numbers in prose.
    expect(result.swungIt).not.toMatch(/\d/);
    expect(result.swungIt).not.toContain('%');
  });

  it('has nothing to decide when nobody bid', () => {
    expect(decideBids(rngFromSeed('none'), star(), [], choiceCtx(), settings)).toBeNull();
  });

  it('is one shot — the same offers against the same person settle the same way', () => {
    const subject = star();
    const ctx = choiceCtx();
    const offers = [bid({ promotionId: 'a', weeklyRate: 3000 }), bid({ promotionId: 'b', weeklyRate: 3100 })];
    const first = settle('same', subject, offers, ctx);
    const second = settle('same', subject, offers, ctx);
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
    round: 1,
    reBidReason: null,
    playerIn: true,
    rivalIds: ['a', 'b'],
    bids: [],
    result: null,
  };

  it('says who won and how big the field was', () => {
    const result = settle('line', star(), [
      bid({ promotionId: 'a', promotionName: 'A Wrestling', weeklyRate: 9000 }),
      bid({ promotionId: 'b', promotionName: 'B Wrestling', weeklyRate: 9000 }),
    ])!;
    const line = resultLine(war, result);
    expect(line).toContain('Vance Mercer');
    expect(line).toContain(result.winningPromotionName);
    expect(line).toContain('seeing off one other offer');
  });

  it('tells a phenom story differently from a free-agency story', () => {
    const result = settle('l2', star(), [bid({ weeklyRate: 9000 })])!;
    expect(resultLine({ ...war, reason: 'phenom' }, result)).toContain('out of the school');
    expect(resultLine(war, result)).toContain('open market');
  });

  it('spells out the one-shot rule in the invitation', () => {
    const line = invitationLine(war, star(), 3);
    expect(line).toContain('no second round');
    expect(line).toContain('3 other companies');
  });
});
