// §16 cross-promotional supershows.
//
// The rules that matter here are the ones a booker would notice being broken:
// the belts do not move, the money is genuinely better than a normal night for
// everybody involved, winning pays and losing costs, and the other booker is
// nobody's pushover.

import { describe, expect, it } from 'vitest';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';
import type { Promotion } from '../types';
import {
  coopAppetite,
  moodFor,
  respondToOffer,
  openingOffer,
  supershowPurse,
  personalPurse,
  crossPromoStakes,
  cardSizeMultiplier,
  nightVerdict,
} from './supershow';

const settings = defaultWorldSettings();

function promo(over: Partial<Promotion> = {}): Promotion {
  return {
    id: 'p1',
    name: 'Player Pro',
    rating: 55,
    reputation: 50,
    bankBalance: 100_000,
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

// §16's belts-do-not-move rule is not tested here any more, and deliberately:
// it used to be checked through a `titleCanTravel` predicate nobody called,
// which is a test of an opinion rather than of the game. It now runs against
// the actual joint card in supershowRun.test.ts, where a title on the sheet
// would be a real bug rather than a wrong answer from a dead function.

describe('the belts stay where they came from', () => {
  it('still puts a champion\'s credibility on the table', () => {
    const champ = crossPromoStakes(true, settings);
    const nobody = crossPromoStakes(false, settings);
    expect(champ.titlePrestigeSwing).toBeGreaterThan(0);
    expect(nobody.titlePrestigeSwing).toBe(0);
    // Amplified either way — the same number is the risk and the reward.
    expect(champ.popularityMultiplier).toBeGreaterThan(1);
    expect(champ.popularityMultiplier).toBe(nobody.popularityMultiplier);
  });
});

describe('the money', () => {
  const player = promo({ rating: 60 });
  const partner = promo({ id: 'p2', name: 'Atlas', rating: 50, isPlayer: false });
  const deal = openingOffer(player, partner, 't1', 10, settings);

  it('draws more than the two companies could apart', () => {
    // The reason to hold your nose and do business: both audiences buy one
    // show, plus the people who only turn out for something new.
    const joint = supershowPurse(player, partner, deal, 6, 3, settings);
    const alone =
      player.rating * settings.supershowGatePerRatingPoint +
      partner.rating * settings.supershowGatePerRatingPoint;
    expect(joint.totalGate).toBeGreaterThan(alone);
  });

  it('pays everybody on the card, and pays the winners more', () => {
    const purse = supershowPurse(player, partner, deal, 6, 3, settings);
    expect(purse.appearanceFee).toBeGreaterThan(0);
    expect(purse.winBonus).toBeGreaterThan(purse.appearanceFee);
    expect(personalPurse(purse, true, settings)).toBeGreaterThan(
      personalPurse(purse, false, settings),
    );
  });

  it('leaves the company in profit on a normal night', () => {
    // If the show cost more than it made nobody would ever run one.
    const purse = supershowPurse(player, partner, deal, 6, 3, settings);
    expect(purse.playerNet).toBeGreaterThan(0);
  });

  it('gives the host the bigger end', () => {
    const hosting = supershowPurse(
      player,
      partner,
      { ...deal, hostPromotionId: player.id },
      6,
      3,
      settings,
    );
    const away = supershowPurse(
      player,
      partner,
      { ...deal, hostPromotionId: partner.id },
      6,
      3,
      settings,
    );
    expect(hosting.playerShare).toBeGreaterThan(away.playerShare);
  });

  it('splits the whole gate and no more', () => {
    const purse = supershowPurse(player, partner, deal, 6, 3, settings);
    expect(purse.playerShare + purse.partnerShare).toBe(purse.totalGate);
  });

  it('pays a loser something rather than nothing', () => {
    // §16 already charges a loss in popularity and prestige. Taking the man's
    // money on top would be charging him twice for the same night.
    const purse = supershowPurse(player, partner, deal, 6, 3, settings);
    expect(personalPurse(purse, false, settings)).toBeGreaterThan(purse.appearanceFee);
    expect(personalPurse(purse, false, settings)).toBeLessThan(personalPurse(purse, true, settings));
  });

  it('bills the office exactly what the people on the card are handed', () => {
    // These two disagreed for as long as the loser's share existed: the bill
    // assumed everybody who lost took the flat fee, and the roster was shown a
    // bigger number than the office was paying out.
    const purse = supershowPurse(player, partner, deal, 6, 3, settings);
    const handed = personalPurse(purse, true, settings) * 3 + personalPurse(purse, false, settings) * 3;
    expect(purse.playerAppearanceBill).toBe(handed);
  });
});

describe('a card that came up short', () => {
  const player = promo({ rating: 60 });
  const partner = promo({ id: 'p2', name: 'Atlas', rating: 50, isPlayer: false });
  const deal = openingOffer(player, partner, 't1', 10, settings);

  it('costs nothing when the card ran as agreed', () => {
    expect(cardSizeMultiplier(12, 12, settings)).toBe(1);
    expect(cardSizeMultiplier(13, 12, settings)).toBe(1);
  });

  it('draws less the more of it got struck', () => {
    expect(cardSizeMultiplier(10, 12, settings)).toBeLessThan(1);
    expect(cardSizeMultiplier(8, 12, settings)).toBeLessThan(cardSizeMultiplier(10, 12, settings));
  });

  it('has a floor — both audiences already bought the ticket', () => {
    expect(cardSizeMultiplier(1, 12, settings)).toBe(settings.supershowShortCardFloor);
  });

  it('shows up in the gate rather than only in the write-up', () => {
    const full = supershowPurse(player, partner, deal, 6, 3, settings, 1);
    const short = supershowPurse(player, partner, deal, 6, 3, settings, cardSizeMultiplier(8, 12, settings));
    expect(short.totalGate).toBeLessThan(full.totalGate);
  });
});

describe('who won the night', () => {
  it('reads the count, not the star ratings', () => {
    const v = nightVerdict(6, 2, 'Player Pro', 'Atlas', settings);
    expect(v.margin).toBeGreaterThan(0);
    expect(v.companyRatingSwing).toBeGreaterThan(0);
    expect(v.line).toMatch(/Player Pro/);
  });

  it('costs the loser exactly what it pays the winner', () => {
    const won = nightVerdict(6, 2, 'A', 'B', settings);
    const lost = nightVerdict(2, 6, 'A', 'B', settings);
    expect(lost.companyRatingSwing).toBeCloseTo(-won.companyRatingSwing, 6);
    expect(lost.territorySwing).toBeCloseTo(-won.territorySwing, 6);
  });

  it('says so when it was a hiding', () => {
    expect(nightVerdict(7, 1, 'A', 'B', settings).line).toMatch(/embarrassed/);
  });

  it('lets a split night be a split night', () => {
    const v = nightVerdict(4, 4, 'A', 'B', settings);
    expect(v.margin).toBe(0);
    expect(v.companyRatingSwing).toBe(0);
    expect(v.line).toMatch(/split the night/);
  });
});

describe('the other booker', () => {
  const us = promo({ rating: 70 });

  it('is eager when it is the smaller name', () => {
    const them = promo({ id: 'p2', name: 'Small', rating: 25, isPlayer: false });
    expect(moodFor(coopAppetite(us, them, 0, settings), 0, settings)).toBe('eager');
  });

  it('is dismissive when it does not need you', () => {
    const them = promo({ id: 'p2', name: 'Giant', rating: 95, isPlayer: false });
    const small = promo({ rating: 20 });
    expect(moodFor(coopAppetite(small, them, 0, settings), 0, settings)).toBe('dismissive');
  });

  it('will not share a building with somebody it hates', () => {
    const them = promo({ id: 'p2', name: 'Wronged', rating: 30, isPlayer: false });
    const resentment = settings.supershowHostileResentment + 5;
    expect(moodFor(coopAppetite(us, them, resentment, settings), resentment, settings)).toBe('hostile');
    const reply = respondToOffer(
      rngFromSeed('hostile'),
      openingOffer(us, them, 't1', 4, settings),
      us,
      them,
      resentment,
      settings,
    );
    expect(reply.kind).toBe('refused');
  });

  it('takes a fair offer', () => {
    const them = promo({ id: 'p2', name: 'Fair', rating: 40, isPlayer: false });
    // Hand them rather more than they are worth and they stop arguing.
    const generous = { ...openingOffer(us, them, 't1', 4, settings), gateSplit: 0.3 };
    const reply = respondToOffer(rngFromSeed('fair'), generous, us, them, 0, settings);
    expect(reply.kind).toBe('accepted');
  });

  it('counters an insult rather than taking it', () => {
    const them = promo({ id: 'p2', name: 'Proud', rating: 60, isPlayer: false });
    const lowball = { ...openingOffer(us, them, 't1', 4, settings), gateSplit: 0.95 };
    const reply = respondToOffer(rngFromSeed('lowball'), lowball, us, them, 0, settings);
    expect(reply.kind).toBe('countered');
    if (reply.kind === 'countered') {
      expect(reply.deal.gateSplit).toBeLessThan(lowball.gateSplit);
      expect(reply.because).toMatch(/Proud/);
    }
  });

  it('keeps its champion out of it when it is being careful', () => {
    // A cautious partner protects the one act it cannot afford to have beaten.
    const them = promo({ id: 'p2', name: 'Careful', rating: 58, isPlayer: false });
    const lowball = { ...openingOffer(us, them, 't1', 4, settings), gateSplit: 0.95 };
    const reply = respondToOffer(rngFromSeed('careful'), lowball, us, them, 0, settings);
    if (reply.kind === 'countered' && moodFor(coopAppetite(us, them, 0, settings), 0, settings) === 'cautious') {
      expect(reply.deal.championVsChampion).toBe(false);
      expect(reply.deal.appearanceGuarantee).toBeGreaterThan(0);
    }
  });
});

describe('the package', () => {
  it('keeps the card within what §16 allows', () => {
    for (const rating of [10, 40, 70, 100]) {
      const deal = openingOffer(
        promo({ rating }),
        promo({ id: 'p2', rating, isPlayer: false }),
        't1',
        1,
        settings,
      );
      expect(deal.cardSize).toBeGreaterThanOrEqual(settings.supershowMinCard);
      expect(deal.cardSize).toBeLessThanOrEqual(settings.supershowMaxCard);
    }
  });

  it('puts the bigger company at home', () => {
    const big = promo({ rating: 80 });
    const small = promo({ id: 'p2', rating: 30, isPlayer: false });
    expect(openingOffer(big, small, 't1', 1, settings).hostPromotionId).toBe(big.id);
    expect(openingOffer(small, big, 't1', 1, settings).hostPromotionId).toBe(big.id);
  });
});
