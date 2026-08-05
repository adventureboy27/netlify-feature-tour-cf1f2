import { describe, it, expect } from 'vitest';
import { appraise, aiBid, settleAuction, playerBidAmount, type AuctionLot, type Bid } from './auction';
import { rivalWeek, shouldFold, foldRisk } from './rivalEconomy';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';
import { generateWrestlers } from '../generate/wrestler';
import { createStartingTitles } from '../../data/titles';
import type { Promotion, Wrestler } from '../types';

const settings = defaultWorldSettings();

function promotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 'rival-0',
    name: 'Atlas Pro',
    identity: 'athletic',
    isPlayer: false,
    rating: 60,
    bankBalance: 1_000_000,
    rosterIds: [],
    titleIds: [],
    ownedTerritoryIds: [],
    homeTerritoryId: 'territory-unassigned',
    styleProfile: {
      preferredStyles: [],
      violenceTolerance: 50,
      workrateVsStarPower: 50,
      divisionFocus: ['mens'],
      promoHeavy: false,
    },
    bookingCredibility: 50,
    reputation: 60,
    hardcoreSaturation: 0,
    recentShowQuality: 60,
    weeksInTheRed: 0,
    closedWeek: null,
    ownerId: 'owner',
    ...overrides,
  };
}

function roster(count: number, popularity = 60): Wrestler[] {
  return generateWrestlers(rngFromSeed('auction'), count, { currentYear: 1985 }).map((w) => ({
    ...w,
    popularity,
    contract: { ...w.contract, weeklyRate: 300 } as Wrestler['contract'],
  }));
}

function lot(overrides: Partial<AuctionLot> = {}): AuctionLot {
  const people = roster(20);
  const titles = createStartingTitles('rival-1', 'Continental Championship Wrestling', 'oldSchool');
  return {
    fromPromotionId: 'rival-1',
    fromPromotionName: 'Continental Championship Wrestling',
    wrestlerIds: people.map((w) => w.id),
    titleIds: titles.map((t) => t.id),
    cash: 0,
    appraisal: appraise(people, titles, 0, settings),
    ...overrides,
  };
}

describe('a rival’s books', () => {
  it('makes real money at the top of the ladder and very little at the bottom', () => {
    const big = rivalWeek(promotion({ rating: 85, recentShowQuality: 75 }), roster(24), settings);
    const small = rivalWeek(promotion({ rating: 30, recentShowQuality: 40 }), roster(10), settings);
    expect(big.revenue).toBeGreaterThan(small.revenue * 5);
    expect(big.net).toBeGreaterThan(0);
  });

  it('punishes a big payroll on a bad run', () => {
    const bloated = rivalWeek(promotion({ rating: 35, recentShowQuality: 25 }), roster(26), settings);
    expect(bloated.net).toBeLessThan(0);
  });

  it('counts recent shows, not just standing', () => {
    const hot = rivalWeek(promotion({ rating: 60, recentShowQuality: 90 }), roster(15), settings);
    const cold = rivalWeek(promotion({ rating: 60, recentShowQuality: 20 }), roster(15), settings);
    expect(hot.revenue).toBeGreaterThan(cold.revenue);
  });
});

describe('closing the doors', () => {
  const base = { bankBalance: -100_000, companiesOpen: 7, settings };

  it('takes years of losses, not a bad quarter', () => {
    expect(shouldFold({ ...base, weeksInTheRed: 20 })).toBe(false);
    expect(shouldFold({ ...base, weeksInTheRed: 60 })).toBe(false);
    expect(shouldFold({ ...base, weeksInTheRed: settings.rivalBankruptcyGraceWeeks + 1 })).toBe(true);
  });

  it('never happens to a company that still has money', () => {
    expect(shouldFold({ ...base, bankBalance: 5, weeksInTheRed: 500 })).toBe(false);
  });

  it('never empties the business below the floor', () => {
    expect(
      shouldFold({ ...base, weeksInTheRed: 500, companiesOpen: settings.minimumPromotions }),
    ).toBe(false);
  });

  it('can be switched off entirely', () => {
    expect(
      shouldFold({ ...base, weeksInTheRed: 500, settings: { ...settings, rivalsCanGoBankrupt: false } }),
    ).toBe(false);
  });

  it('reads out how close they are', () => {
    expect(foldRisk(0, settings)).toBe('healthy');
    expect(foldRisk(10, settings)).toBe('struggling');
    expect(foldRisk(settings.rivalBankruptcyGraceWeeks - 5, settings)).toBe('inTrouble');
    expect(foldRisk(settings.rivalBankruptcyGraceWeeks + 1, settings)).toBe('closing');
  });
});

describe('appraising the package', () => {
  it('values the talent above the belts', () => {
    const people = roster(20);
    const titles = createStartingTitles('rival-1', 'Atlas Pro', 'athletic');
    const withTalent = appraise(people, [], 0, settings);
    const withBelts = appraise([], titles, 0, settings);
    expect(withTalent).toBeGreaterThan(withBelts);
  });

  it('counts the cash but never a debt', () => {
    const people = roster(5);
    expect(appraise(people, [], 100_000, settings)).toBeGreaterThan(appraise(people, [], 0, settings));
    expect(appraise(people, [], -500_000, settings)).toBe(appraise(people, [], 0, settings));
  });
});

describe('the bidding', () => {
  it('never bids more of the bank than the ceiling allows', () => {
    const rng = rngFromSeed('bids');
    const poor = promotion({ bankBalance: 50_000 });
    for (let i = 0; i < 20; i++) {
      expect(aiBid(rng, poor, lot(), roster(20), settings)).toBeLessThanOrEqual(
        poor.bankBalance * settings.auctionMaxBankFraction,
      );
    }
  });

  it('bids more for talent that suits the house style', () => {
    const rng = rngFromSeed('fit');
    const hardcoreCompany = promotion({ identity: 'hardcore', bankBalance: 5_000_000 });
    const average = (people: Wrestler[]) => {
      let total = 0;
      for (let i = 0; i < 30; i++) total += aiBid(rng, hardcoreCompany, lot(), people, settings);
      return total / 30;
    };

    const theirKind = roster(20).map((w) => ({ ...w, style: 'hardcore' as const }));
    const wrongKind = roster(20).map((w) => ({ ...w, style: 'technical' as const }));
    expect(average(theirKind)).toBeGreaterThan(average(wrongKind));
  });

  it('gives the lot to the highest bid', () => {
    const bids: Bid[] = [
      { promotionId: 'a', amount: 500_000 },
      { promotionId: 'b', amount: 900_000 },
      { promotionId: 'c', amount: 700_000 },
    ];
    const result = settleAuction(bids, lot(), settings, () => 50);
    expect(result.winnerId).toBe('b');
    expect(result.winningBid).toBe(900_000);
    expect(result.bids[0]!.promotionId).toBe('b');
  });

  it('breaks a tie toward the bigger company', () => {
    const bids: Bid[] = [
      { promotionId: 'small', amount: 800_000 },
      { promotionId: 'big', amount: 800_000 },
    ];
    const result = settleAuction(bids, lot(), settings, (id) => (id === 'big' ? 90 : 20));
    expect(result.winnerId).toBe('big');
  });

  it('leaves the lot unsold when nobody meets the reserve', () => {
    const cheap: Bid[] = [{ promotionId: 'a', amount: 1 }];
    expect(settleAuction(cheap, lot(), settings, () => 50).winnerId).toBeNull();
  });

  it('sells for nothing when there are no bidders at all', () => {
    expect(settleAuction([], lot(), settings, () => 50).winnerId).toBeNull();
  });

  it('scales the player’s options off the appraisal', () => {
    const package_ = lot();
    expect(playerBidAmount('pass', package_, settings)).toBe(0);
    expect(playerBidAmount('lowball', package_, settings)).toBeLessThan(
      playerBidAmount('fair', package_, settings),
    );
    expect(playerBidAmount('aggressive', package_, settings)).toBeGreaterThan(package_.appraisal);
  });
});
